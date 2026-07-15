function Range({ label, value, min, max, step, unit = '', onChange }) {
  return (
    <label className="range">
      <span className="range-head">
        <em>{label}</em><b>{value.toFixed(2)}{unit}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

// Adjustments applied to the inserted content before it is warped into the quad.
export default function ContentAdjust({ adjust, setAdjust, disabled }) {
  const set = (k, v) => setAdjust((s) => ({ ...s, [k]: v }));
  const rotate = () => set('rotation', (adjust.rotation + 90) % 360);
  const reset = () => setAdjust({
    rotation: 0, flipH: false, flipV: false, scale: 1, offsetX: 0, offsetY: 0, fitMode: 'fill',
  });

  return (
    <fieldset className="block" disabled={disabled}>
      <legend>Contenido</legend>

      <div className="pills">
        <button className={`pill ${adjust.fitMode === 'fill' ? 'on' : ''}`} onClick={() => set('fitMode', 'fill')}>Rellenar</button>
        <button className={`pill ${adjust.fitMode === 'fit' ? 'on' : ''}`} onClick={() => set('fitMode', 'fit')}>Ajustar</button>
      </div>

      <div className="pills">
        <button className="pill" onClick={rotate}>Rotar 90° · {adjust.rotation}°</button>
        <button className={`pill ${adjust.flipH ? 'on' : ''}`} onClick={() => set('flipH', !adjust.flipH)}>Espejo H</button>
        <button className={`pill ${adjust.flipV ? 'on' : ''}`} onClick={() => set('flipV', !adjust.flipV)}>Espejo V</button>
      </div>

      <Range label="Escala" value={adjust.scale} min={0.2} max={3} step={0.01} unit="x" onChange={(v) => set('scale', v)} />
      <Range label="Recorte X" value={adjust.offsetX} min={-0.5} max={0.5} step={0.005} onChange={(v) => set('offsetX', v)} />
      <Range label="Recorte Y" value={adjust.offsetY} min={-0.5} max={0.5} step={0.005} onChange={(v) => set('offsetY', v)} />

      <button className="pill ghost" onClick={reset}>Reset</button>
    </fieldset>
  );
}
