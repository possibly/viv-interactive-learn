import { useEffect, useRef, useState } from 'react'
import { loadViv, type ContentBundle, type UID } from '../viv'
import {
  actionRecord,
  createInitialWorld,
  makeAdapter,
  moodOf,
  type ChronicleEntry,
  type WorldState,
} from './world'

// Stage 2 sandbox: the possibility matrix.
//
// The Stage 1 demo walked through the runtime's four steps for one
// initiator, one action. With three actions and conditions, the
// interesting question is no longer "what are the four steps?", it's
// "given the current world state, which (initiator, action, target)
// triples are *legal* right now?". So this sandbox shows that whole
// matrix, live, alongside controls for nudging moods up and down and
// watching which cells flip from red to green.
//
// The runtime is the source of truth for picking. We mirror the
// Stage 2 conditions in JS (CONDITIONS, below) only so the matrix can
// explain *why* a cell is failing -- the actual filtering on every
// `selectAction` call is done by the real runtime against the
// compiled bundle.

type ActionName = 'greet' | 'cheer-up' | 'boast'

interface ActionDef {
  name: ActionName
  initiatorRole: string
  targetRole: string
  conditionExpr: string // human-readable, mirrors the .viv source
  conditionFails: (initiatorMood: number, targetMood: number) => string | null
  effectsLabel: string
}

const ACTIONS: ActionDef[] = [
  {
    name: 'greet',
    initiatorRole: 'greeter',
    targetRole: 'friend',
    conditionExpr: '(none)',
    conditionFails: () => null,
    effectsLabel: '(none)',
  },
  {
    name: 'cheer-up',
    initiatorRole: 'cheerer',
    targetRole: 'friend',
    conditionExpr: '@friend.mood < 0',
    conditionFails: (_iMood, tMood) =>
      tMood < 0 ? null : `@friend.mood is ${tMood}, not < 0`,
    effectsLabel: '@friend.mood += 4   |   @cheerer.mood += 1',
  },
  {
    name: 'boast',
    initiatorRole: 'boaster',
    targetRole: 'listener',
    conditionExpr: '@boaster.mood > 0',
    conditionFails: (iMood) =>
      iMood > 0 ? null : `@boaster.mood is ${iMood}, not > 0`,
    effectsLabel: '@boaster.mood += 1   |   @listener.mood -= 2',
  },
]

const CHARACTERS: Array<{ id: UID; name: string }> = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
  { id: 'carol', name: 'Carol' },
]

const MOOD_MIN = -5
const MOOD_MAX = 5

// Initial moods picked so the first frame already shows a mix of
// passing and failing conditions, highlighting why the matrix matters.
const INITIAL_MOODS = { alice: 2, bob: -1, carol: 0 }

interface MatrixCell {
  initiatorID: UID
  action: ActionDef
  targetID: UID
  failReason: string | null // null = passes
  picked?: boolean
  pickedTimestep?: number
}

interface DemoState {
  timestep: number
  lastPick: Record<UID, { actionName: ActionName; targetID: UID } | null>
}

type MoodMap = Record<UID, number>

export default function ConditionsDemo() {
  const [bundle, setBundle] = useState<ContentBundle | null>(null)
  const [vivErr, setVivErr] = useState<string | null>(null)
  const [vivReady, setVivReady] = useState(false)
  // The runtime gets a stable host-state reference via the ref + adapter.
  // Render uses the moods snapshot below, which we sync any time the world
  // changes (either user adjusting moods, or effects firing during a step).
  const worldRef = useRef<WorldState>(createInitialWorld(INITIAL_MOODS))
  const [moods, setMoods] = useState<MoodMap>({ ...INITIAL_MOODS })
  const [chronicle, setChronicle] = useState<ChronicleEntry[]>([])
  const [demo, setDemo] = useState<DemoState>({
    timestep: 0,
    lastPick: { alice: null, bob: null, carol: null },
  })
  const [busy, setBusy] = useState(false)

  const syncMoods = () => {
    setMoods({
      alice: moodOf(worldRef.current, 'alice'),
      bob: moodOf(worldRef.current, 'bob'),
      carol: moodOf(worldRef.current, 'carol'),
    })
  }

  // Load the bundle + initialize the runtime once.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [viv, bundleJson] = await Promise.all([
          loadViv(),
          fetch(`${import.meta.env.BASE_URL}bundles/stage2.json`).then((r) => r.json()),
        ])
        if (cancelled) return
        viv.initializeVivRuntime({
          contentBundle: bundleJson,
          adapter: makeAdapter(worldRef.current),
        })
        setBundle(bundleJson)
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

  // Re-init whenever we reset the world so the runtime is wired to
  // the fresh adapter.
  const resetWorld = async (initial = INITIAL_MOODS) => {
    if (busy) return
    worldRef.current = createInitialWorld(initial)
    setChronicle([])
    setDemo({ timestep: 0, lastPick: { alice: null, bob: null, carol: null } })
    setMoods({ ...initial })
    if (bundle) {
      try {
        const viv = await loadViv()
        viv.initializeVivRuntime({
          contentBundle: bundle,
          adapter: makeAdapter(worldRef.current),
        })
      } catch (e) {
        setVivErr(e instanceof Error ? e.message : String(e))
      }
    }
  }

  const adjustMood = (id: UID, delta: number) => {
    if (busy) return
    const cur = moodOf(worldRef.current, id)
    const next = Math.max(MOOD_MIN, Math.min(MOOD_MAX, cur + delta))
    worldRef.current.entities[id] = {
      ...worldRef.current.entities[id],
      mood: next,
    }
    // Clear last-pick highlights once the user changes the world by
    // hand -- they no longer correspond to the current state.
    setDemo((d) => ({ ...d, lastPick: { alice: null, bob: null, carol: null } }))
    syncMoods()
  }

  const runOneTimestep = async () => {
    if (!vivReady || busy) return
    setBusy(true)
    try {
      const viv = await loadViv()
      const lastPick: Record<UID, { actionName: ActionName; targetID: UID } | null> = {
        alice: null,
        bob: null,
        carol: null,
      }
      const newEntries: ChronicleEntry[] = []
      for (const c of CHARACTERS) {
        const actionID = await viv.selectAction({ initiatorID: c.id })
        if (!actionID) continue
        const rec = actionRecord(worldRef.current, actionID) as
          | { name?: string; report?: string; bindings?: Record<string, UID[]> }
          | undefined
        if (!rec) continue
        const actionName = String(rec.name ?? '?') as ActionName
        // Find the target binding (the role that isn't the initiator).
        const def = ACTIONS.find((a) => a.name === actionName)
        const targetID = def
          ? rec.bindings?.[def.targetRole]?.[0] ?? null
          : null
        if (targetID) lastPick[c.id] = { actionName, targetID }
        newEntries.push({
          actionID,
          actionName,
          initiatorID: c.id,
          report: String(rec.report ?? ''),
        })
      }
      setChronicle((prev) => [...prev, ...newEntries])
      setDemo((d) => ({ timestep: d.timestep + 1, lastPick }))
      syncMoods()
    } catch (e) {
      setVivErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const matrix = buildMatrix(moods, demo.lastPick)

  return (
    <div className="cond-demo">
      <header className="cond-head">
        <div className="cond-title">
          <h3>Possibility matrix</h3>
          <p className="dim">
            Every (initiator, action, target) triple in the world. Green cells pass
            conditions and are eligible for the runtime to pick. Red cells fail -- hover
            for the reason. Adjust moods on the left and watch the cells flip.
          </p>
        </div>
      </header>

      {vivErr && <div className="error">{vivErr}</div>}

      <div className="cond-body">
        <div className="cond-roster">
          {CHARACTERS.map((c) => {
            const m = moods[c.id] ?? 0
            return (
              <div key={c.id} className="mood-card">
                <div className="mood-name">{c.name}</div>
                <div className={`mood-value ${moodClass(m)}`}>
                  {m > 0 ? `+${m}` : m}
                </div>
                <div className="mood-bar" aria-hidden="true">
                  <div className="mood-bar-zero" />
                  <div
                    className={`mood-bar-fill ${moodClass(m)}`}
                    style={{
                      left: m >= 0 ? '50%' : `${50 + (m / MOOD_MIN) * 50 * (-1)}%`,
                      width: `${(Math.abs(m) / MOOD_MAX) * 50}%`,
                    }}
                  />
                </div>
                <div className="mood-controls">
                  <button onClick={() => adjustMood(c.id, -1)} disabled={busy || m <= MOOD_MIN}>
                    -1
                  </button>
                  <button onClick={() => adjustMood(c.id, +1)} disabled={busy || m >= MOOD_MAX}>
                    +1
                  </button>
                </div>
                <div className="mood-label dim">{moodLabel(m)}</div>
              </div>
            )
          })}
        </div>

        <div className="cond-matrix">
          <table>
            <thead>
              <tr>
                <th>initiator</th>
                {ACTIONS.map((a) => (
                  <th key={a.name} colSpan={2} className="th-action">
                    <code>{a.name}</code>
                    <div className="th-cond">
                      <span className="th-cond-label">conditions:</span>{' '}
                      <code>{a.conditionExpr}</code>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CHARACTERS.map((c) => (
                <tr key={c.id}>
                  <td className="td-initiator">{c.name}</td>
                  {ACTIONS.flatMap((a) =>
                    targetsFor(c.id).map((t) => {
                      const cell = matrix.find(
                        (m) =>
                          m.initiatorID === c.id &&
                          m.action.name === a.name &&
                          m.targetID === t.id,
                      )
                      if (!cell) return null
                      return (
                        <td
                          key={`${a.name}-${t.id}`}
                          className={`cell ${cell.failReason ? 'cell-fail' : 'cell-pass'} ${cell.picked ? 'cell-picked' : ''}`}
                          title={cell.failReason ?? 'passes'}
                        >
                          <div className="cell-target">→ {t.name}</div>
                          {cell.failReason ? (
                            <div className="cell-reason">{shortReason(cell.failReason)}</div>
                          ) : (
                            <div className="cell-pass-mark">✓ legal</div>
                          )}
                          {cell.picked && <div className="cell-ribbon">picked</div>}
                        </td>
                      )
                    }),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <footer className="cond-foot">
        <div className="cond-controls">
          <button onClick={runOneTimestep} disabled={!vivReady || busy}>
            {busy ? 'Running...' : `Run timestep ${demo.timestep + 1}`}
          </button>
          <button
            className="ghost"
            onClick={() => resetWorld()}
            disabled={busy}
          >
            Reset
          </button>
          <span className="cond-hint dim">
            One timestep = one <code>selectAction</code> call per character. Effects from
            an early pick can flip later cells in the same timestep.
          </span>
        </div>

        <div className="chronicle-panel">
          <h4>
            Chronicle <span className="dim">({chronicle.length})</span>
          </h4>
          {chronicle.length === 0 ? (
            <p className="dim">
              Empty so far. Click <strong>Run timestep 1</strong> -- one entry per character
              who could find a legal cast.
            </p>
          ) : (
            <ul className="chronicle-pile">
              {chronicle.map((c, i) => (
                <li
                  key={i}
                  className="strip strip-in"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <span className="strip-action">{c.actionName}</span>
                  <span className="strip-report">{c.report}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </footer>
    </div>
  )
}

// ---- Helpers ---------------------------------------------------------

function targetsFor(initiatorID: UID): Array<{ id: UID; name: string }> {
  return CHARACTERS.filter((c) => c.id !== initiatorID)
}

function buildMatrix(
  moods: MoodMap,
  lastPick: Record<UID, { actionName: ActionName; targetID: UID } | null>,
): MatrixCell[] {
  const cells: MatrixCell[] = []
  for (const c of CHARACTERS) {
    for (const a of ACTIONS) {
      for (const t of targetsFor(c.id)) {
        const failReason = a.conditionFails(moods[c.id] ?? 0, moods[t.id] ?? 0)
        const lp = lastPick[c.id]
        const picked = !!lp && lp.actionName === a.name && lp.targetID === t.id
        cells.push({
          initiatorID: c.id,
          action: a,
          targetID: t.id,
          failReason,
          picked,
        })
      }
    }
  }
  return cells
}

function moodClass(m: number): string {
  if (m >= 3) return 'mood-up'
  if (m >= 1) return 'mood-mid'
  if (m === 0) return 'mood-meh'
  if (m >= -2) return 'mood-meh'
  return 'mood-down'
}

function moodLabel(m: number): string {
  if (m >= 3) return 'elated'
  if (m >= 1) return 'good'
  if (m === 0) return 'neutral'
  if (m >= -2) return 'down'
  return 'miserable'
}

function shortReason(full: string): string {
  // e.g. "@friend.mood is -2, not < 0" -> "mood -2 ⊀ 0"
  const m = full.match(/@(\w+)\.mood is (-?\d+), not ([<>])= ?(-?\d+)|@(\w+)\.mood is (-?\d+), not ([<>]) (-?\d+)/)
  if (!m) return full
  const role = m[1] || m[5]
  const value = m[2] || m[6]
  const op = m[3] || m[7]
  const target = m[4] || m[8]
  return `${role}.mood ${value} ${op === '<' ? '⊀' : '⊁'} ${target}`
}
