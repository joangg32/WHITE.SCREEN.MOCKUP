function Range({ label, value, min, max, step, onChange }) {
  return (
    <label className="range">
      <span className="range-head"><em>{label}</em><b>{value.toFixed(2)}</b></span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

export default function Controls({ keying, setKeying, disabled }) {
  const set = (k) => (v) => setKeying((s) => ({ ...s, [k]: v }));
  return (
    <fieldset className="block" disabled={disabled}>
      <legend>Keying blanco</legend>
      <Range label="Umbral brillo" value={keying.threshold} min={0} max={1} step={0.01} onChange={set('threshold')} />
      <Range label="Suavizado" value={keying.softness} min={0} max={0.3} step={0.005} onChange={set('softness')} />
      <Range label="Saturación máx" value={keying.satMax} min={0} max={0.6} step={0.01} onChange={set('satMax')} />
    </fieldset>
  );
}
