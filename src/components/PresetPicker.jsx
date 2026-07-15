import { PRESETS } from '../lib/presets.js';

// Grid of bundled mockups. Selecting one loads it as the active mockup.
export default function PresetPicker({ activeUrl, onPick }) {
  return (
    <div className="presets">
      {PRESETS.map((p) => (
        <button
          key={p.id}
          className={`preset ${activeUrl === p.url ? 'is-active' : ''}`}
          onClick={() => onPick(p)}
          title={p.label}
        >
          <img src={p.url} alt={p.label} loading="lazy" />
          <span className="preset-id">{p.label}</span>
        </button>
      ))}
    </div>
  );
}
