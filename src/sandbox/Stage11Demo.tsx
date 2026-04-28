import { useEffect, useMemo, useRef, useState } from 'react'
import { loadViv, type UID } from '../viv'
import {
  actionRecord,
  createStage11World,
  makeAdapter,
  STAGE11_CHARACTERS,
  STAGE11_DEFAULT_RELATIONS,
  type ChronicleEntry,
  type RelationMatrix,
  type WorldState,
} from './world'

// Stage 11 -- Trope Fit Explorer.
//
// Two tropes:
//
//   rivalry (mutual):   @b in @a.dislikes && @a in @b.dislikes
//   admiration (1-way): @idol in @admirer.admires
//
// The user toggles directional dislikes/admires entries via a small
// matrix of checkboxes. Each toggle mutates the live world the
// runtime reads via getEntityView, so trope-fit verdicts (computed
// in TS for the panel) and the runtime's actual selectAction agree
// on the same world. Pressing "Step a turn" calls selectAction
// against that world; the chronicle records whichever action
// survived its conditions.

const STAGE11_BUNDLE_PATH = `${import.meta.env.BASE_URL}bundles/stage11.json`

const ACTION_COLORS: Record<string, string> = {
  greet: '#7aa2f7',
  snipe: '#f7768e',
  compliment: '#a3e09a',
}

interface OrderedPair {
  a: UID
  b: UID
}

function orderedPairs(): OrderedPair[] {
  const out: OrderedPair[] = []
  for (const a of STAGE11_CHARACTERS) {
    for (const b of STAGE11_CHARACTERS) {
      if (a.id !== b.id) out.push({ a: a.id, b: b.id })
    }
  }
  return out
}

function nameOf(id: UID): string {
  return STAGE11_CHARACTERS.find((c) => c.id === id)?.name ?? id
}

interface ConditionRow {
  source: string
  passed: boolean
}

interface FitVerdict {
  fits: boolean
  rows: ConditionRow[]
}

function fitsRivalry(rel: RelationMatrix, a: UID, b: UID): FitVerdict {
  const ab = (rel[a]?.dislikes ?? []).includes(b)
  const ba = (rel[b]?.dislikes ?? []).includes(a)
  return {
    fits: ab && ba,
    rows: [
      {
        source: `@b in @a.dislikes  →  ${nameOf(b)} ∈ ${nameOf(a)}.dislikes`,
        passed: ab,
      },
      {
        source: `@a in @b.dislikes  →  ${nameOf(a)} ∈ ${nameOf(b)}.dislikes`,
        passed: ba,
      },
    ],
  }
}

function fitsAdmiration(rel: RelationMatrix, admirer: UID, idol: UID): FitVerdict {
  const v = (rel[admirer]?.admires ?? []).includes(idol)
  return {
    fits: v,
    rows: [
      {
        source: `@idol in @admirer.admires  →  ${nameOf(idol)} ∈ ${nameOf(admirer)}.admires`,
        passed: v,
      },
    ],
  }
}

const PRESETS: Array<{ label: string; relations: RelationMatrix }> = [
  {
    label: 'no relations',
    relations: STAGE11_DEFAULT_RELATIONS,
  },
  {
    label: 'alice ↔ bob feud',
    relations: {
      alice: { dislikes: ['bob'], admires: [] },
      bob: { dislikes: ['alice'], admires: [] },
      carol: { dislikes: [], admires: [] },
    },
  },
  {
    label: 'carol idolises alice',
    relations: {
      alice: { dislikes: [], admires: [] },
      bob: { dislikes: [], admires: [] },
      carol: { dislikes: [], admires: ['alice'] },
    },
  },
  {
    label: 'three-way feud',
    relations: {
      alice: { dislikes: ['bob', 'carol'], admires: [] },
      bob: { dislikes: ['alice', 'carol'], admires: [] },
      carol: { dislikes: ['alice', 'bob'], admires: [] },
    },
  },
]

function cloneRelations(r: RelationMatrix): RelationMatrix {
  const out: RelationMatrix = {}
  for (const k of Object.keys(r)) {
    out[k] = { dislikes: [...r[k].dislikes], admires: [...r[k].admires] }
  }
  return out
}

export default function Stage11Demo() {
  const [relations, setRelations] = useState<RelationMatrix>(() =>
    cloneRelations(STAGE11_DEFAULT_RELATIONS),
  )
  const [chronicle, setChronicle] = useState<ChronicleEntry[]>([])
  const [turnIndex, setTurnIndex] = useState(0)
  const [vivErr, setVivErr] = useState<string | null>(null)
  const [vivReady, setVivReady] = useState(false)
  const [lastTurn, setLastTurn] = useState<{
    initiator: UID
    actionName: string | null
    report: string
  } | null>(null)
  const worldRef = useRef<WorldState>(createStage11World(STAGE11_DEFAULT_RELATIONS))

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [viv, bundle] = await Promise.all([
          loadViv(),
          fetch(STAGE11_BUNDLE_PATH).then((r) => r.json()),
        ])
        if (cancelled) return
        viv.initializeVivRuntime({
          contentBundle: bundle,
          adapter: makeAdapter(worldRef.current),
        })
        setVivReady(true)
      } catch (e) {
        if (cancelled) return
        setVivErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Push relation edits into the live world the runtime will read.
  useEffect(() => {
    for (const cid of worldRef.current.characters) {
      worldRef.current.entities[cid].dislikes = [...(relations[cid]?.dislikes ?? [])]
      worldRef.current.entities[cid].admires = [...(relations[cid]?.admires ?? [])]
    }
  }, [relations])

  const toggle = (
    owner: UID,
    target: UID,
    list: 'dislikes' | 'admires',
  ) => {
    setRelations((prev) => {
      const next = cloneRelations(prev)
      const cur = next[owner][list]
      if (cur.includes(target)) {
        next[owner][list] = cur.filter((x) => x !== target)
      } else {
        next[owner][list] = [...cur, target]
      }
      return next
    })
  }

  const applyPreset = (preset: RelationMatrix) => {
    setRelations(cloneRelations(preset))
  }

  const reset = async () => {
    worldRef.current = createStage11World(STAGE11_DEFAULT_RELATIONS)
    setRelations(cloneRelations(STAGE11_DEFAULT_RELATIONS))
    setChronicle([])
    setTurnIndex(0)
    setLastTurn(null)
    try {
      const viv = await loadViv()
      const bundle = await fetch(STAGE11_BUNDLE_PATH).then((r) => r.json())
      viv.initializeVivRuntime({
        contentBundle: bundle,
        adapter: makeAdapter(worldRef.current),
      })
    } catch (e) {
      setVivErr(e instanceof Error ? e.message : String(e))
    }
  }

  const stepTurn = async () => {
    const initiator = STAGE11_CHARACTERS[turnIndex % STAGE11_CHARACTERS.length].id
    try {
      const viv = await loadViv()
      const actionID = await viv.selectAction({ initiatorID: initiator })
      if (!actionID) {
        setLastTurn({ initiator, actionName: null, report: '(no action eligible)' })
        setTurnIndex((i) => i + 1)
        return
      }
      const rec = actionRecord(worldRef.current, actionID) as
        | { name?: string; report?: string }
        | undefined
      const entry: ChronicleEntry = {
        actionID,
        actionName: String(rec?.name ?? '?'),
        initiatorID: initiator,
        report: String(rec?.report ?? ''),
      }
      setChronicle((c) => [...c, entry])
      setLastTurn({
        initiator,
        actionName: entry.actionName,
        report: entry.report,
      })
      setTurnIndex((i) => i + 1)
    } catch (e) {
      setVivErr(e instanceof Error ? e.message : String(e))
    }
  }

  const pairs = useMemo(() => orderedPairs(), [])

  const nextInitiator =
    STAGE11_CHARACTERS[turnIndex % STAGE11_CHARACTERS.length].name

  return (
    <div className="algo-demo trope-demo">
      {vivErr && <div className="error">{vivErr}</div>}

      <div className="trope-grid">
        <div className="trope-panel">
          <h4>Relationships</h4>
          <p className="dim">
            For each ordered pair, toggle whether the first character{' '}
            <em>dislikes</em> or <em>admires</em> the second. Each toggle
            updates the same world the runtime reads via{' '}
            <code>getEntityView</code>; trope verdicts below recompute as
            you click.
          </p>
          <div className="opinion-presets">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="opinion-preset"
                onClick={() => applyPreset(p.relations)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <ul className="relation-list">
            {pairs.map(({ a, b }) => {
              const dislikes = (relations[a]?.dislikes ?? []).includes(b)
              const admires = (relations[a]?.admires ?? []).includes(b)
              return (
                <li key={`${a}->${b}`} className="relation-row">
                  <span className="relation-label">
                    <strong>{nameOf(a)}</strong>
                    <span className="opinion-arrow">→</span>
                    <strong>{nameOf(b)}</strong>
                  </span>
                  <label
                    className={`relation-toggle${dislikes ? ' relation-on relation-dislike' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={dislikes}
                      onChange={() => toggle(a, b, 'dislikes')}
                    />
                    <span>dislikes</span>
                  </label>
                  <label
                    className={`relation-toggle${admires ? ' relation-on relation-admire' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={admires}
                      onChange={() => toggle(a, b, 'admires')}
                    />
                    <span>admires</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="trope-panel">
          <h4>
            <code>fit trope rivalry</code>{' '}
            <span className="dim">(mutual)</span>
          </h4>
          <p className="dim">
            Tested per unordered pair. Both characters need each other on
            their <code>dislikes</code> list.
          </p>
          <div className="trope-fits">
            {(() => {
              const seen = new Set<string>()
              const out: React.ReactNode[] = []
              for (const { a, b } of pairs) {
                const key = [a, b].sort().join('|')
                if (seen.has(key)) continue
                seen.add(key)
                const verdict = fitsRivalry(relations, a, b)
                out.push(
                  <div
                    key={key}
                    className={`trope-fit-card${verdict.fits ? ' trope-fit-yes' : ''}`}
                  >
                    <header>
                      <span className="trope-fit-pair">
                        {nameOf(a)} <span className="opinion-arrow">↔</span>{' '}
                        {nameOf(b)}
                      </span>
                      <span
                        className={`trope-fit-verdict${
                          verdict.fits ? ' verdict-yes' : ' verdict-no'
                        }`}
                      >
                        {verdict.fits ? 'fits' : 'no fit'}
                      </span>
                    </header>
                    <ul className="trope-fit-rows">
                      {verdict.rows.map((r, i) => (
                        <li
                          key={i}
                          className={`trope-cond-row${r.passed ? ' cond-pass' : ' cond-fail'}`}
                        >
                          <span className="cond-mark">{r.passed ? '✓' : '✗'}</span>
                          <code>{r.source}</code>
                        </li>
                      ))}
                    </ul>
                  </div>,
                )
              }
              return out
            })()}
          </div>
        </div>

        <div className="trope-panel">
          <h4>
            <code>fit trope admiration</code>{' '}
            <span className="dim">(directional)</span>
          </h4>
          <p className="dim">
            Tested per ordered pair. Just one condition: the idol must be on
            the admirer's <code>admires</code> list.
          </p>
          <div className="trope-fits">
            {pairs.map(({ a, b }) => {
              const verdict = fitsAdmiration(relations, a, b)
              return (
                <div
                  key={`adm-${a}-${b}`}
                  className={`trope-fit-card${verdict.fits ? ' trope-fit-yes' : ''}`}
                >
                  <header>
                    <span className="trope-fit-pair">
                      {nameOf(a)} <span className="opinion-arrow">→</span>{' '}
                      {nameOf(b)}
                    </span>
                    <span
                      className={`trope-fit-verdict${
                        verdict.fits ? ' verdict-yes' : ' verdict-no'
                      }`}
                    >
                      {verdict.fits ? 'fits' : 'no fit'}
                    </span>
                  </header>
                  <ul className="trope-fit-rows">
                    {verdict.rows.map((r, i) => (
                      <li
                        key={i}
                        className={`trope-cond-row${r.passed ? ' cond-pass' : ' cond-fail'}`}
                      >
                        <span className="cond-mark">{r.passed ? '✓' : '✗'}</span>
                        <code>{r.source}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="trope-runtime-panel">
        <header className="algo-demo-head">
          <div className="algo-controls">
            <span className="dim">
              Next up: <strong>{nextInitiator}</strong>
            </span>
            <button type="button" onClick={stepTurn} disabled={!vivReady}>
              Step a turn
            </button>
            <button type="button" className="ghost" onClick={reset}>
              Reset relationships + chronicle
            </button>
          </div>
        </header>
        {lastTurn && (
          <div className="trope-last-turn">
            <span className="dim">{nameOf(lastTurn.initiator)}'s turn:</span>{' '}
            {lastTurn.actionName ? (
              <>
                <span
                  className="turn-action"
                  style={{
                    color:
                      ACTION_COLORS[lastTurn.actionName] ?? 'inherit',
                  }}
                >
                  {lastTurn.actionName}
                </span>{' '}
                <span className="turn-pick-report">{lastTurn.report}</span>
              </>
            ) : (
              <em>{lastTurn.report}</em>
            )}
          </div>
        )}
        <div className="chronicle-panel">
          <h4>
            Chronicle <span className="dim">({chronicle.length})</span>
          </h4>
          {chronicle.length === 0 ? (
            <p className="dim">
              Step a turn to see how the trope-gated actions react to the
              relationship grid above.
            </p>
          ) : (
            <ul className="chronicle-pile">
              {chronicle.map((c, i) => (
                <li key={i} className="strip">
                  <span
                    className="strip-action"
                    style={{ color: ACTION_COLORS[c.actionName] ?? 'inherit' }}
                  >
                    {c.actionName}
                  </span>
                  <span className="strip-report">{c.report}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
