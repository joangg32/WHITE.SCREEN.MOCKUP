import { useRef } from 'react';

// Overlay of 4 independently-draggable handles on top of the preview canvas.
// `corners` are in CANVAS-PIXEL space [TL, TR, BR, BL]; the overlay is displayed
// scaled, so we convert between display px and canvas px via the element rect.
const LABELS = ['SI', 'SD', 'ID', 'II']; // sup-izq, sup-der, inf-der, inf-izq

export default function CornerEditor({ corners, canvasSize, onChange }) {
  const ref = useRef(null);
  const dragging = useRef(-1);

  const toCanvas = (e) => {
    const r = ref.current.getBoundingClientRect();
    const sx = canvasSize.w / r.width;
    const sy = canvasSize.h / r.height;
    return [
      Math.max(0, Math.min(canvasSize.w, (e.clientX - r.left) * sx)),
      Math.max(0, Math.min(canvasSize.h, (e.clientY - r.top) * sy)),
    ];
  };

  const onDown = (i) => (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = i;
  };
  const onMove = (e) => {
    if (dragging.current < 0) return;
    onChange(dragging.current, toCanvas(e));
  };
  const onUp = () => { dragging.current = -1; };

  const pct = ([x, y]) => ({ left: `${(x / canvasSize.w) * 100}%`, top: `${(y / canvasSize.h) * 100}%` });
  // Corner labels sit inside on the diagonal so they never clip off-canvas.
  const anchor = [
    { transform: 'translate(2px, 2px)' },
    { transform: 'translate(calc(-100% - 2px), 2px)' },
    { transform: 'translate(calc(-100% - 2px), calc(-100% - 2px))' },
    { transform: 'translate(2px, calc(-100% - 2px))' },
  ];
  const polyPoints = corners
    .map(([x, y]) => `${(x / canvasSize.w) * 100},${(y / canvasSize.h) * 100}`)
    .join(' ');

  return (
    <div
      ref={ref}
      className="corner-overlay"
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <svg className="corner-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon points={polyPoints} />
      </svg>
      {corners.map((c, i) => (
        <div key={i} className="corner-handle" style={pct(c)} onPointerDown={onDown(i)}>
          <span className="corner-tag" style={anchor[i]}>
            {LABELS[i]} {Math.round(c[0])},{Math.round(c[1])}
          </span>
        </div>
      ))}
    </div>
  );
}
