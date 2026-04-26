import { useEffect, useRef, useState } from 'react'
import { loadViv, type UID } from '../viv'
import {
  actionRecord,
  createInitialWorld,
  makeAdapter,
  type ChronicleEntry,
  type WorldState,
} from './world'

// Walks the user through what selectAction does internally for the
// stage-1 storyworld, with paper-metaphor visuals: actions tear off
// the script as cards, character chips slide into role slots, casts
// get stamped as they pass conditions, and the picked cast prints
// its line to a chronicle pile at the bottom.
//
// Steps 1-3 are computed locally so we can show the working set the
// runtime is examining; step 4 hands off to selectAction, snapshots
// the action record it produces, and animates the chronicle strip.

interface BundleAction {
  name: string
  roles: Record<string, BundleRole>
  conditions: { globalConditions: unknown[]; roleConditions: Record<string, unknown[]> }
  effects: Array<{ body: { source?: { code?: string } } }>
}
interface BundleRole {
  name: string
  participationMode?: string
}
type Bundle = { actions: Record<string, BundleAction> }

interface CastSlot {
  role: string
  characterID: UID
  name: string
  locked?: boolean // true for the initiator slot (precast)
}

interface CastAttempt {
  actionName: string
  slots: CastSlot[]
  conditionsCount: number
  conditionsPassed?: boolean
  picked?: boolean
}

interface DemoState {
  initiator: UID
  initiatorName: string
  eligible: Array<{ name: string }>
  attempts: CastAttempt[]
  pickedReport?: string
}

const STEP_TITLES = [
  '1. Find eligible actions',
  '2. Cast the remaining roles',
  '3. Evaluate conditions',
  '4. Pick, then write to the chronicle',
]

const CHARACTERS: Array<{ id: UID; name: string }> = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
  { id: 'carol', name: 'Carol' },
]

export default function AlgorithmDemo() {
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [vivErr, setVivErr] = useState<string | null>(null)
  const [vivReady, setVivReady] = useState(false)
  const worldRef = useRef<WorldState>(createInitialWorld())
  const [chronicle, setChronicle] = useState<ChronicleEntry[]>([])
  const [initiator, setInitiator] = useState<UID>('alice')
  const [demo, setDemo] = useState<DemoState | null>(null)
  const [runId, setRunId] = useState(0)
  const appendNextRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [viv, bundleJson] = await Promise.all([
          loadViv(),
          fetch(`${import.meta.env.BASE_URL}bundles/stage1.json`).then((r) => r.json()),
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

  useEffect(() => {
    if (!vivReady || !bundle) return
    let cancelled = false
    const append = appendNextRef.current
    appendNextRef.current = false
    void (async () => {
      try {
        worldRef.current = createInitialWorld()
        const viv = await loadViv()
        viv.initializeVivRuntime({
          contentBundle: bundle,
          adapter: makeAdapter(worldRef.current),
        })

        const eligible = computeEligible(bundle)
        const castAttempts = computeAttempts(bundle, initiator, eligible)
        const evaluated = castAttempts.map((a) => ({ ...a, conditionsPassed: true }))

        const actionID = await viv.selectAction({ initiatorID: initiator })
        if (cancelled) return
        if (!actionID) {
          setDemo({
            initiator,
            initiatorName: nameOf(initiator),
            eligible,
            attempts: evaluated,
          })
          if (!append) setChronicle([])
          return
        }
        const rec = actionRecord(worldRef.current, actionID) as
          | { name?: string; report?: string; bindings?: Record<string, UID[]> }
          | undefined
        if (!rec) {
          setDemo({
            initiator,
            initiatorName: nameOf(initiator),
            eligible,
            attempts: evaluated,
          })
          if (!append) setChronicle([])
          return
        }
        const pickedSlots: CastSlot[] = []
        for (const [role, ids] of Object.entries(rec.bindings ?? {})) {
          if (role === 'this') continue
          const cid = ids[0]
          if (!cid) continue
          pickedSlots.push({
            role,
            characterID: cid,
            name: nameOf(cid),
            locked: role === initiatorRoleNameFor(bundle.actions[String(rec.name)]),
          })
        }
        const entry: ChronicleEntry = {
          actionID,
          actionName: String(rec.name ?? '?'),
          initiatorID: initiator,
          report: String(rec.report ?? ''),
        }
        const finalAttempts = evaluated.map((a) => {
          const sameAction = a.actionName === entry.actionName
          const sameCast = pickedSlots.every((s) =>
            a.slots.some((as) => as.role === s.role && as.characterID === s.characterID),
          )
          return { ...a, picked: sameAction && sameCast }
        })
        setDemo({
          initiator,
          initiatorName: nameOf(initiator),
          eligible,
          attempts: finalAttempts,
          pickedReport: entry.report,
        })
        if (append) {
          setChronicle((c) => [...c, entry])
        } else {
          setChronicle([entry])
        }
      } catch (e) {
        if (cancelled) return
        setVivErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [initiator, runId, bundle, vivReady])

  const reroll = () => {
    appendNextRef.current = true
    setRunId((n) => n + 1)
  }

  return (
    <div className="algo-demo">
      <header className="algo-demo-head">
        <div className="algo-controls">
          <label>
            <span>Initiator:</span>
            <select
              value={initiator}
              onChange={(e) => setInitiator(e.target.value)}
              disabled={!vivReady}
            >
              {CHARACTERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="ghost"
            onClick={reroll}
            disabled={!vivReady}
            title="Re-run selectAction with the same initiator"
          >
            Reroll
          </button>
        </div>
      </header>

      {vivErr && <div className="error">{vivErr}</div>}

      <ol className="algo-steps">
        {STEP_TITLES.map((title, i) => {
          const stepNum = i + 1
          return (
            <li key={i} className="algo-step done">
              <header>
                <span className="step-num">{stepNum}</span>
                <span className="step-title">{title}</span>
              </header>
              {demo && <div className="step-body">{renderStepBody(stepNum, demo)}</div>}
            </li>
          )
        })}
      </ol>

      <div className="chronicle-panel">
        <h4>
          Chronicle <span className="dim">({chronicle.length})</span>
        </h4>
        {chronicle.length === 0 ? (
          <p className="dim">Loading...</p>
        ) : (
          <ul className="chronicle-pile">
            {chronicle.map((c, i) => (
              <li key={i} className="strip">
                <span className="strip-action">{c.actionName}</span>
                <span className="strip-report">{c.report}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// Helpers

function nameOf(id: UID): string {
  return CHARACTERS.find((c) => c.id === id)?.name ?? id
}

function initiatorRoleNameFor(action: BundleAction | undefined): string {
  if (!action) return 'initiator'
  return (
    Object.values(action.roles).find((r) => r.participationMode === 'initiator')?.name ??
    'initiator'
  )
}

function computeEligible(bundle: Bundle): Array<{ name: string }> {
  const eligible: Array<{ name: string }> = []
  for (const [name, action] of Object.entries(bundle.actions)) {
    const initiatorRole = Object.values(action.roles).find(
      (r) => r.participationMode === 'initiator',
    )
    if (initiatorRole) eligible.push({ name })
  }
  return eligible
}

function computeAttempts(
  bundle: Bundle,
  initiator: UID,
  eligible: Array<{ name: string }>,
): CastAttempt[] {
  const initiatorName = nameOf(initiator)
  const attempts: CastAttempt[] = []
  for (const e of eligible) {
    const action = bundle.actions[e.name]
    const initiatorRole = initiatorRoleNameFor(action)
    const otherRoles = Object.values(action.roles).filter(
      (r) => r.participationMode && r.participationMode !== 'initiator',
    )
    if (otherRoles.length === 0) {
      attempts.push({
        actionName: e.name,
        slots: [
          {
            role: initiatorRole,
            characterID: initiator,
            name: initiatorName,
            locked: true,
          },
        ],
        conditionsCount: 0,
      })
      continue
    }
    const otherRole = otherRoles[0]
    const candidates = CHARACTERS.filter((c) => c.id !== initiator)
    for (const cand of candidates) {
      attempts.push({
        actionName: e.name,
        slots: [
          {
            role: initiatorRole,
            characterID: initiator,
            name: initiatorName,
            locked: true,
          },
          {
            role: otherRole.name,
            characterID: cand.id,
            name: cand.name,
          },
        ],
        conditionsCount: 0,
      })
    }
  }
  return attempts
}

// Step rendering

function renderStepBody(step: number, d: DemoState): React.ReactNode {
  switch (step) {
    case 1:
      return (
        <>
          <p>
            Scan the bundle for actions where this character can fill the{' '}
            <code>initiator</code> role.
          </p>
          <div className="paper-stage stage-step-1">
            <div className="script-page">
              <div className="script-rule" />
              <pre className="script-source">
                <code>
                  {`action `}
                  <span className="hl">greet</span>
                  {`:
    report: '{@greeter.name} says hello to {@friend.name}'
    roles:
        @greeter:
            as: initiator
        @friend:
            as: recipient`}
                </code>
              </pre>
            </div>
            <div className="paper-arrow" aria-hidden="true">
              →
            </div>
            <div className="tray" data-label="Eligible actions">
              {d.eligible.map((e) => (
                <div key={e.name} className="card card-action">
                  <div className="card-name">{e.name}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )
    case 2:
      return (
        <>
          <p>
            Each card needs its other roles cast. The <code>@greeter</code> slot is
            already filled by the initiator (locked). For <code>@friend</code>, the
            runtime calls{' '}
            <code>getEntityIDs(EntityType.Character, initiator.location)</code> to get
            candidates. The initiator's location is <code>"tavern"</code>, and the adapter
            returns everyone in the tavern.
          </p>
          <div className="paper-stage stage-step-2">
            <div className="roster">
              <div className="roster-label">Host's characters</div>
              <div className="roster-chips">
                {CHARACTERS.map((c) => (
                  <div
                    key={c.id}
                    className={`chip${c.id === d.initiator ? ' chip-initiator' : ''}`}
                  >
                    {c.name}
                  </div>
                ))}
              </div>
            </div>
            <div className="paper-arrow" aria-hidden="true">
              ↓
            </div>
            <div className="cast-grid">
              {d.attempts.map((a, i) => (
                <div key={i} className="card card-cast">
                  <div className="card-name">{a.actionName}</div>
                  <div className="card-slots">
                    {a.slots.map((s) => (
                      <div key={s.role} className={`slot${s.locked ? ' slot-locked' : ''}`}>
                        <span className="slot-role">@{s.role}</span>
                        <span className="slot-chip">{s.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )
    case 3:
      return (
        <>
          <p>
            Run each card's conditions. Failing cards are discarded. <code>greet</code> has
            no conditions ({0} to check), so every card passes.
          </p>
          <div className="paper-stage stage-step-3">
            <div className="cast-grid">
              {d.attempts.map((a, i) => (
                <div
                  key={i}
                  className={`card card-cast${a.conditionsPassed ? ' card-stamped' : ''}`}
                >
                  <div className="card-name">{a.actionName}</div>
                  <div className="card-slots">
                    {a.slots.map((s) => (
                      <div key={s.role} className={`slot${s.locked ? ' slot-locked' : ''}`}>
                        <span className="slot-role">@{s.role}</span>
                        <span className="slot-chip">{s.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="stamp" aria-label="passed">
                    PASS
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )
    case 4: {
      const passing = d.attempts.filter((a) => a.conditionsPassed)
      return (
        <>
          <p>
            Pick one of the passing cards at random, uniform, so a 1/{passing.length || 1}{' '}
            chance for each. Run the action's effects (none here), save the action record,
            and the chronicle gets a new line.
          </p>
          <div className="paper-stage stage-step-4">
            <div className="cast-grid">
              {d.attempts.map((a, i) => (
                <div
                  key={i}
                  className={`card card-cast card-stamped${a.picked ? ' card-picked' : ' card-faded'}`}
                >
                  <div className="card-name">{a.actionName}</div>
                  <div className="card-slots">
                    {a.slots.map((s) => (
                      <div key={s.role} className={`slot${s.locked ? ' slot-locked' : ''}`}>
                        <span className="slot-role">@{s.role}</span>
                        <span className="slot-chip">{s.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="stamp" aria-label="passed">PASS</div>
                  {a.picked && <div className="ribbon">picked</div>}
                </div>
              ))}
            </div>
            {d.pickedReport && (
              <div className="chronicle-emit">
                <div className="paper-arrow" aria-hidden="true">
                  ↓
                </div>
                <div className="strip">
                  <span className="strip-action">greet</span>
                  <span className="strip-report">{d.pickedReport}</span>
                </div>
              </div>
            )}
          </div>
          <p className="dim">
            That same line just landed in the chronicle below. Pick another character
            above to see another outcome.
          </p>
        </>
      )
    }
    default:
      return null
  }
}
