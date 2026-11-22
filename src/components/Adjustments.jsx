const SLIDERS = [
  { key: "length", label: "Length", min: 0.6, max: 1.5, step: 0.05 },
  { key: "curl", label: "Curl", min: 0, max: 2, step: 0.05 },
  { key: "density", label: "Fullness", min: 0.5, max: 1.6, step: 0.05 },
  { key: "thickness", label: "Thickness", min: 0.5, max: 1.6, step: 0.05 },
  { key: "darkness", label: "Darkness", min: 0.4, max: 1, step: 0.05 },
];

export default function Adjustments({ value, onChange, onReset }) {
  return (
    <div className="adjustments">
      {SLIDERS.map((s) => (
        <label key={s.key} className="slider" htmlFor={`adj-${s.key}`}>
          <span className="slider-head">
            <span>{s.label}</span>
            <span className="slider-value">{Math.round(value[s.key] * 100)}%</span>
          </span>
          <input
            id={`adj-${s.key}`}
            type="range"
            min={s.min}
            max={s.max}
            step={s.step}
            value={value[s.key]}
            onChange={(e) => onChange({ ...value, [s.key]: Number(e.target.value) })}
          />
        </label>
      ))}
      <label className="check" htmlFor="adj-lashline">
        <input
          id="adj-lashline"
          type="checkbox"
          checked={value.lashLine}
          onChange={(e) => onChange({ ...value, lashLine: e.target.checked })}
        />
        <span>Lash line</span>
      </label>
      <button type="button" className="link-btn" onClick={onReset}>
        Reset adjustments
      </button>
    </div>
  );
}
