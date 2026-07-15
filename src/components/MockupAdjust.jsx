// Orientation controls for the MOCKUP itself (not the inserted content):
// rotate in 90° steps and mirror horizontally / vertically.
export default function MockupAdjust({ mockAdjust, setMockAdjust, disabled }) {
  const set = (k, v) => setMockAdjust((s) => ({ ...s, [k]: v }));
  const rotate = () => set('rotation', (mockAdjust.rotation + 90) % 360);

  return (
    <div className="pills" aria-disabled={disabled} style={disabled ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
      <button className="pill" onClick={rotate}>Girar 90° · {mockAdjust.rotation}°</button>
      <button className={`pill ${mockAdjust.flipH ? 'on' : ''}`} onClick={() => set('flipH', !mockAdjust.flipH)}>Espejo H</button>
      <button className={`pill ${mockAdjust.flipV ? 'on' : ''}`} onClick={() => set('flipV', !mockAdjust.flipV)}>Espejo V</button>
    </div>
  );
}
