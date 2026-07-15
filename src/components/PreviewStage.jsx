import { useEffect, useRef } from 'react';
import { Renderer } from '../lib/webglRenderer.js';
import { buildContentUvInverse, buildOrientationInverse, quadAspect } from '../lib/uvTransform.js';
import { effectiveDims } from '../lib/dims.js';
import CornerEditor from './CornerEditor.jsx';

// Owns the WebGL canvas + render loop. Canvas resolution matches the mockup's
// native size so exports are full quality; CSS scales it down to fit the box.
export default function PreviewStage({
  mockup, content, corners, keying, adjust, mockAdjust, mode, showHandles, onCornersChange, registerCanvas,
}) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const stateRef = useRef({});

  // Keep the latest props reachable from inside the RAF loop.
  stateRef.current = { mockup, content, corners, keying, adjust, mockAdjust, mode };

  useEffect(() => {
    const r = new Renderer(canvasRef.current);
    rendererRef.current = r;
    registerCanvas?.(canvasRef.current);
    let raf;
    const loop = () => {
      const s = stateRef.current;
      if (s.mockup) {
        if (s.mockup.type === 'video') r.uploadMockup(s.mockup.el);
        if (s.content?.type === 'video') r.uploadContent(s.content.el);

        const contentUV = s.content
          ? buildContentUvInverse({
              rotation: s.adjust.rotation,
              flipH: s.adjust.flipH,
              flipV: s.adjust.flipV,
              scale: s.adjust.scale,
              offsetX: s.adjust.offsetX,
              offsetY: s.adjust.offsetY,
              mode: s.adjust.fitMode,
              contentAspect: s.content.width / s.content.height,
              quadAspect: quadAspect(s.corners),
            })
          : null;

        const mockupUV = buildOrientationInverse({
          rotation: s.mockAdjust.rotation,
          flipH: s.mockAdjust.flipH,
          flipV: s.mockAdjust.flipV,
        });

        r.render({
          corners: s.corners,
          contentUV,
          mockupUV,
          threshold: s.keying.threshold,
          softness: s.keying.softness,
          satMax: s.keying.satMax,
          mode: s.mode === 'mask' ? 1 : 0,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const r = rendererRef.current;
    if (!r || !mockup) return;
    const { w, h } = effectiveDims(mockup, mockAdjust.rotation);
    canvasRef.current.width = w;
    canvasRef.current.height = h;
    if (mockup.type === 'image') r.uploadMockup(mockup.el);
    if (mockup.type === 'video') mockup.el.play().catch(() => {});
  }, [mockup, mockAdjust.rotation]);

  useEffect(() => {
    const r = rendererRef.current;
    if (!r || !content) return;
    if (content.type === 'image') r.uploadContent(content.el);
    if (content.type === 'video') content.el.play().catch(() => {});
  }, [content]);

  const canvasSize = effectiveDims(mockup, mockAdjust.rotation);

  return (
    <div className="stage">
      <canvas ref={canvasRef} className="preview-canvas" />
      {mockup && showHandles && mode !== 'mask' && (
        <CornerEditor corners={corners} canvasSize={canvasSize} onChange={onCornersChange} />
      )}
      {!mockup && <div className="stage-empty">CARGA UN MOCKUP</div>}
    </div>
  );
}
