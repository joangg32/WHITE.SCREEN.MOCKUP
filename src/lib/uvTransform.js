// ---------------------------------------------------------------------------
// Content placement transform. The homography already maps each canvas pixel to
// a "quad-uv" in [0,1] over the target quadrilateral. Before we sample the
// user's content we transform that quad-uv into "content-uv" to apply:
//   - fit / fill (aspect-correct contain vs cover)
//   - rotate in 90° steps
//   - mirror horizontal / vertical
//   - scale (zoom) and offset (pan) -> effectively crop
//
// We build the FORWARD placement matrix D (content-uv -> quad-uv) and return its
// inverse, because the shader does inverse mapping (quad-uv -> content-uv).
// All matrices are row-major length-9.
// ---------------------------------------------------------------------------

import { invert3x3 } from './homography.js';

const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function mul(a, b) {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++)
        r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}
const translate = (x, y) => [1, 0, x, 0, 1, y, 0, 0, 1];
const scale = (x, y) => [x, 0, 0, 0, y, 0, 0, 0, 1];
function rotate(rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/**
 * @param {Object} p
 * @param {number} p.rotation   0 | 90 | 180 | 270 (degrees, content rotation)
 * @param {boolean} p.flipH
 * @param {boolean} p.flipV
 * @param {number} p.scale      zoom (1 = base)
 * @param {number} p.offsetX    pan in quad units (-0.5..0.5-ish)
 * @param {number} p.offsetY
 * @param {'fit'|'fill'} p.mode
 * @param {number} p.contentAspect   content w/h
 * @param {number} p.quadAspect      target quad w/h
 * @returns {number[]} inverse placement matrix (quad-uv -> content-uv), row-major
 */
export function buildContentUvInverse(p) {
  const quarterTurned = p.rotation === 90 || p.rotation === 270;
  // After a 90/270 turn the content's effective aspect is inverted.
  const cAspect = quarterTurned ? 1 / p.contentAspect : p.contentAspect;
  const r = cAspect / p.quadAspect;

  // Per-axis placement scale so content keeps its aspect inside the quad.
  let kx, ky;
  if (p.mode === 'fill') {          // cover: overflow the short side
    if (r >= 1) { kx = r; ky = 1; } else { kx = 1; ky = 1 / r; }
  } else {                          // fit: contain within the quad
    if (r >= 1) { kx = 1; ky = 1 / r; } else { kx = r; ky = 1; }
  }
  kx *= p.scale; ky *= p.scale;

  const fx = p.flipH ? -1 : 1;
  const fy = p.flipV ? -1 : 1;

  // D = T(0.5+offset) · R(rotation) · Flip · Scale(kx,ky) · T(-0.5)
  // Built around the (0.5,0.5) center of the unit square.
  let D = I;
  D = mul(D, translate(0.5 + p.offsetX, 0.5 + p.offsetY));
  D = mul(D, rotate((p.rotation * Math.PI) / 180));
  D = mul(D, scale(fx, fy));
  D = mul(D, scale(kx, ky));
  D = mul(D, translate(-0.5, -0.5));

  return invert3x3(D) || I;
}

/**
 * Pure rotate (90° steps) + mirror for the mockup itself, as an inverse uv
 * matrix (canvas-uv -> mockup-uv). No aspect/scale: the canvas dimensions are
 * swapped for 90°/270° upstream, so the rotated mockup fills the canvas exactly.
 */
export function buildOrientationInverse({ rotation, flipH, flipV }) {
  return buildContentUvInverse({
    rotation, flipH, flipV, scale: 1, offsetX: 0, offsetY: 0,
    mode: 'fill', contentAspect: 1, quadAspect: 1,
  });
}

// Average width/height aspect of an arbitrary quad [TL,TR,BR,BL].
export function quadAspect(corners) {
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const [TL, TR, BR, BL] = corners;
  const w = (dist(TL, TR) + dist(BL, BR)) / 2;
  const h = (dist(TL, BL) + dist(TR, BR)) / 2;
  return h > 0 ? w / h : 1;
}
