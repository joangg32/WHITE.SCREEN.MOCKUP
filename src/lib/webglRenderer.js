// ---------------------------------------------------------------------------
// WebGL renderer: composites warped user-content onto a mockup, keyed by the
// mockup's white areas. Everything happens in ONE fragment-shader pass.
//
// Strategy (inverse mapping):
//  - Draw a single quad covering the whole canvas.
//  - For each output pixel we know its position in canvas space.
//  - We hold H⁻¹ (canvas-pixel -> content-uv). Applying it tells us which pixel
//    of the user's content maps here. If that uv is inside [0,1] we're inside
//    the warped quad.
//  - We also sample the mockup at this same pixel and compute its "whiteness".
//  - Final pixel = mix(mockup, content, whiteness * insideQuad). Because the
//    whiteness is a smoothstep, edges between white and non-white feather
//    automatically — no halo, no jaggies.
// ---------------------------------------------------------------------------

import { computeHomography, invert3x3 } from './homography.js';

const VERT_SRC = `
attribute vec2 aPos;          // clip-space full-canvas quad
varying vec2 vCanvasUV;       // (0,0)=top-left, (1,1)=bottom-right
void main() {
  vCanvasUV = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG_SRC = `
precision highp float;
varying vec2 vCanvasUV;

uniform sampler2D uMockup;
uniform sampler2D uContent;
uniform vec2  uResolution;   // canvas size in pixels
uniform mat3  uHinv;         // canvas-pixel -> quad-uv (column-major)
uniform mat3  uContentUV;    // quad-uv -> content-uv (column-major)
uniform mat3  uMockupUV;     // canvas-uv -> mockup-uv (rotate/mirror the mockup)
uniform float uThreshold;    // whiteness value cutoff [0..1]
uniform float uSoftness;     // feather width around cutoff
uniform float uSatMax;       // max saturation still considered "white"
uniform int   uMode;         // 0 = composite, 1 = mask preview
uniform int   uHasContent;   // 0 = no content loaded yet

// How "white" is a color? high value (brightness) + low saturation.
float whiteness(vec3 c) {
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float sat = mx > 0.0001 ? (mx - mn) / mx : 0.0;
  float valMask = smoothstep(uThreshold - uSoftness, uThreshold + uSoftness, mx);
  float satMask = 1.0 - smoothstep(uSatMax, uSatMax + 0.15, sat);
  return valMask * satMask;
}

void main() {
  vec3 muv = uMockupUV * vec3(vCanvasUV, 1.0);
  vec2 mockupUv = muv.xy / muv.z;
  vec3 mockup = texture2D(uMockup, mockupUv).rgb;
  float wmask = whiteness(mockup);

  if (uMode == 1) {            // mask-preview mode: show what gets replaced
    gl_FragColor = vec4(vec3(wmask), 1.0);
    return;
  }

  // Map this canvas pixel back into the quad's unit square.
  vec2 px = vCanvasUV * uResolution;
  vec3 uvh = uHinv * vec3(px, 1.0);
  vec2 quadUv = uvh.xy / uvh.z;

  float inQuad = step(0.0, quadUv.x) * step(quadUv.x, 1.0) *
                 step(0.0, quadUv.y) * step(quadUv.y, 1.0);

  // Apply content placement (fit/fill, rotate, mirror, scale, offset).
  vec3 cuv = uContentUV * vec3(quadUv, 1.0);
  vec2 sampleUv = cuv.xy / cuv.z;
  float inContent = step(0.0, sampleUv.x) * step(sampleUv.x, 1.0) *
                    step(0.0, sampleUv.y) * step(sampleUv.y, 1.0);

  vec4 content = texture2D(uContent, sampleUv);
  float alpha = wmask * inQuad * inContent * content.a * float(uHasContent);

  gl_FragColor = vec4(mix(mockup, content.rgb, alpha), 1.0);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('Shader compile error: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

// Our homography is row-major; WebGL uniformMatrix3fv wants column-major.
function toColumnMajor(m) {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

// Unit square corners in the SAME order the UI stores destination corners:
// top-left, top-right, bottom-right, bottom-left.
const UNIT_SQUARE = [[0, 0], [1, 0], [1, 1], [0, 1]];

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL not supported in this browser.');
    this.gl = gl;
    this.canvas = canvas;

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT_SRC));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(prog));
    }
    this.prog = prog;

    // Full-canvas quad (two triangles).
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW);

    this.mockupTex = this._makeTexture();
    this.contentTex = this._makeTexture();

    this.loc = {
      aPos: gl.getAttribLocation(prog, 'aPos'),
      uMockup: gl.getUniformLocation(prog, 'uMockup'),
      uContent: gl.getUniformLocation(prog, 'uContent'),
      uResolution: gl.getUniformLocation(prog, 'uResolution'),
      uHinv: gl.getUniformLocation(prog, 'uHinv'),
      uContentUV: gl.getUniformLocation(prog, 'uContentUV'),
      uMockupUV: gl.getUniformLocation(prog, 'uMockupUV'),
      uThreshold: gl.getUniformLocation(prog, 'uThreshold'),
      uSoftness: gl.getUniformLocation(prog, 'uSoftness'),
      uSatMax: gl.getUniformLocation(prog, 'uSatMax'),
      uMode: gl.getUniformLocation(prog, 'uMode'),
      uHasContent: gl.getUniformLocation(prog, 'uHasContent'),
    };
    this.hasContent = false;
  }

  _makeTexture() {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // Our UV origin is top-left (vCanvasUV.y=0 at screen top), so we must NOT
    // flip Y on upload; leaving it false keeps images upright and un-mirrored.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // 1x1 placeholder so sampling is valid before real data is uploaded.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255]));
    return tex;
  }

  // `source` = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement.
  uploadMockup(source) { this._upload(this.mockupTex, source); }
  uploadContent(source) { this._upload(this.contentTex, source); this.hasContent = true; }

  _upload(tex, source) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } catch (e) {
      // Video frame may not be ready yet on the very first frames.
    }
  }

  /**
   * @param {Object} p
   * @param {number[][]} p.corners  destination corners [TL,TR,BR,BL] in canvas px
   * @param {number} p.threshold
   * @param {number} p.softness
   * @param {number} p.satMax
   * @param {number} p.mode  0 composite | 1 mask preview
   */
  render(p) {
    const gl = this.gl;
    const w = this.canvas.width, h = this.canvas.height;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);

    // H maps content unit-square -> canvas pixels; shader needs the inverse.
    const H = computeHomography(UNIT_SQUARE, p.corners);
    const Hinv = H ? invert3x3(H) : null;
    // Fall back to identity-ish if degenerate (e.g. collapsed quad).
    const HinvCM = toColumnMajor(Hinv || [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const contentUV = p.contentUV || [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const contentUVCM = toColumnMajor(contentUV);
    const mockupUV = p.mockupUV || [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const mockupUVCM = toColumnMajor(mockupUV);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.enableVertexAttribArray(this.loc.aPos);
    gl.vertexAttribPointer(this.loc.aPos, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.mockupTex);
    gl.uniform1i(this.loc.uMockup, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.contentTex);
    gl.uniform1i(this.loc.uContent, 1);

    gl.uniform2f(this.loc.uResolution, w, h);
    gl.uniformMatrix3fv(this.loc.uHinv, false, HinvCM);
    gl.uniformMatrix3fv(this.loc.uContentUV, false, contentUVCM);
    gl.uniformMatrix3fv(this.loc.uMockupUV, false, mockupUVCM);
    gl.uniform1f(this.loc.uThreshold, p.threshold);
    gl.uniform1f(this.loc.uSoftness, p.softness);
    gl.uniform1f(this.loc.uSatMax, p.satMax);
    gl.uniform1i(this.loc.uMode, p.mode || 0);
    gl.uniform1i(this.loc.uHasContent, this.hasContent ? 1 : 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
