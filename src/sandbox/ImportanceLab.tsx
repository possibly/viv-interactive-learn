// Sliders + expected-distribution bar for importance. Lives outside
// the Stage 4 demo so the reader can play with it as a teaching aid
// before they see one full algorithm walkthrough below.

const ACTION_NAMES = ['greet', 'tease', 'cheer_up'] as const

const ACTION_COLORS: Record<string, string> = {
  greet: '#7aa2f7',
  tease: '#f7768e',
  cheer_up: '#aa3bff',
}

interface Props {
  importance: Record<string, number>
  setImportance: (next: Record<string, number>) => void
}

export default function ImportanceLab({ importance, setImportance }: Props) {
  const total = ACTION_NAMES.reduce((s, n) => s + (importance[n] ?? 0), 0)

  const set = (name: string, value: number) =>
    setImportance({ ...importance, [name]: value })

  return (
    <div className="lab-panel lab-panel-inline">
      <div className="lab-sliders">
        {ACTION_NAMES.map((name) => (
          <div key={name} className="lab-slider">
            <label>
              <span className="lab-slider-name" style={{ color: ACTION_COLORS[name] }}>
                {name}
              </span>
              <span className="lab-slider-value">{importance[name] ?? 0}</span>
            </label>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={importance[name] ?? 1}
              onChange={(e) => set(name, Number(e.target.value))}
              style={{ accentColor: ACTION_COLORS[name] }}
            />
          </div>
        ))}
      </div>

      <div className="lab-bars">
        <div className="dist-bar">
          <div className="dist-bar-label">Expected share of the picker's choices</div>
          <div className="dist-bar-track">
            {total === 0 ? (
              <div className="dist-bar-empty">no weight</div>
            ) : (
              ACTION_NAMES.map((name) => {
                const v = (importance[name] ?? 0) / total
                const pct = v * 100
                if (pct <= 0) return null
                return (
                  <div
                    key={name}
                    className="dist-bar-seg"
                    style={{ width: `${pct}%`, background: ACTION_COLORS[name] }}
                    title={`${name}: ${pct.toFixed(1)}%`}
                  >
                    <span className="dist-bar-seg-label">{name}</span>
                  </div>
                )
              })
            )}
          </div>
          <div className="dist-bar-legend">
            {ACTION_NAMES.map((name) => {
              const v = total > 0 ? ((importance[name] ?? 0) / total) * 100 : 0
              return (
                <span key={name} className="dist-bar-legend-item">
                  <span
                    className="dist-bar-swatch"
                    style={{ background: ACTION_COLORS[name] }}
                    aria-hidden="true"
                  />
                  <code>{name}</code>: {v.toFixed(1)}%
                </span>
              )
            })}
          </div>
        </div>
      </div>

      <p className="dim lab-footnote">
        Bars assume one passing cast per action. The actual distribution scales by how
        many casts of each action survive step 3, so an action with two passing casts at
        the same importance gets twice the share.
      </p>
    </div>
  )
}
