import { COLOR_MODES, LASH_COLORS, TIP_COLORS } from "../lib/lashStyles.js";

// Colour, fullness, darkness and extras.
export default function Adjustments({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="adjustments">
      <div className="field">
        <span className="field-label">Colour</span>
        <div className="swatch-row">
          {LASH_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-label={c.label}
              title={c.label}
              className={`swatch${value.color === c.id ? " is-active" : ""}`}
              style={{ background: `rgb(${c.rgb})` }}
              onClick={() => set({ color: c.id })}
            />
          ))}
        </div>
      </div>
      <div className="field">
        <span className="field-label">Colour accent</span>
        <div className="swatch-row">
          {TIP_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-label={c.label}
              title={c.label}
              className={`swatch${value.tip === c.id ? " is-active" : ""}${c.rgb ? "" : " swatch-none"}`}
              style={c.rgb ? { background: `linear-gradient(135deg, rgb(16,11,11) 45%, rgb(${c.rgb}) 46%)` } : undefined}
              onClick={() => set({ tip: c.id })}
            />
          ))}
        </div>
        {value.tip !== "none" && (
          <div className="chip-row" role="group" aria-label="How the colour is used">
            {COLOR_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`chip${(value.colorMode || "tips") === m.id ? " is-active" : ""}`}
                onClick={() => set({ colorMode: m.id })}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <label className="slider" htmlFor="adj-density">
        <span className="slider-head">
          <span>Fullness</span>
          <span className="slider-value">{Math.round(value.density * 100)}%</span>
        </span>
        <input
          id="adj-density"
          type="range"
          min="0.5"
          max="1.5"
          step="0.05"
          value={value.density}
          onChange={(e) => set({ density: Number(e.target.value) })}
        />
      </label>
      <label className="slider" htmlFor="adj-darkness">
        <span className="slider-head">
          <span>Darkness</span>
          <span className="slider-value">{Math.round(value.darkness * 100)}%</span>
        </span>
        <input
          id="adj-darkness"
          type="range"
          min="0.4"
          max="1"
          step="0.05"
          value={value.darkness}
          onChange={(e) => set({ darkness: Number(e.target.value) })}
        />
      </label>

      <div className="check-row">
        <label className="check" htmlFor="adj-lower">
          <input id="adj-lower" type="checkbox" checked={value.lower} onChange={(e) => set({ lower: e.target.checked })} />
          <span>Bottom lashes</span>
        </label>
        <label className="check" htmlFor="adj-lashline">
          <input
            id="adj-lashline"
            type="checkbox"
            checked={value.lashLine}
            onChange={(e) => set({ lashLine: e.target.checked })}
          />
          <span>Lash line</span>
        </label>
      </div>
    </div>
  );
}
