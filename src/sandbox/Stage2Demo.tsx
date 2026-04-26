import { useEffect, useRef, useState } from 'react'
import { loadViv, type UID } from '../viv'
import {
  actionRecord,
  createStage2World,
  makeAdapter,
  STAGE2_CHARACTERS,
  type ChronicleEntry,
  type WorldState,
} from './world'

// Stage 2: same four-step walkthrough as stage 1, but a second action
// (`compliment`) has a role condition on `@subject.cheerful`. Step 3
// stamps each cast PASS or FAIL by evaluating the condition against
// the world; failed casts drop out of the pool that step 4 picks from.

interface BundleAction {
  name: string
  roles: Record<string, BundleRole>
  conditions: {
    globalConditions: ConditionEntry[]
    roleConditions: Record<string, ConditionEntry[]>
  }
  effects: unknown[]
}
interface BundleRole {
  name: string
  participationMode?: string
}
interface ConditionEntry {
  body: ConditionExpr
  references?: string[]
}
type ConditionExpr =
  | {
      type: 'comparison'
      negated?: boolean
      value: { left: ConditionExpr; right: ConditionExpr; operator: string }
    }
  | { type: 'bool'; value: boolean }
  | { type: 'int'; value: number }
  | { type: 'float'; value: number }
  | { type: 'string'; value: string }
  | {
      type: 'entityReference'
      negated?: boolean
      value: {
        anchor: string
        path: Array<{ type: string; name: string }>
      }
    }

type Bundle = { actions: Record<string, BundleAction> }

interface CastSlot {
  role: string
  characterID: UID
  name: string
  locked?: boolean
}

interface DisplayCondition {
  source: string
  passed: boolean
}

interface CastAttempt {
  actionName: string
  slots: CastSlot[]
  conditions: DisplayCondition[]
  conditionsPassed: boolean
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

export default function Stage2Demo() {
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [vivErr, setVivErr] = useState<string | null>(null)
  const [vivReady, setVivReady] = useState(false)
  const worldRef = useRef<WorldState>(createStage2World())
  const [chronicle, setChronicle] = useState<ChronicleEntry[]>([])
  const [initiator, setInitiator] = useState<UID>('alice')
  const [demo, setDemo] = useState<DemoState | null>(null)
  const [runId, setRunId] = useState(0)

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

  useEffect(() => {
    if (!vivReady || !bundle) return
    let cancelled = false
    void (async () => {
      try {
        worldRef.current = createStage2World()
        const viv = await loadViv()
        viv.initializeVivRuntime({
          contentBundle: bundle,
          adapter: makeAdapter(worldRef.current),
        })

        const eligible = computeEligible(bundle)
        const attempts = computeAttemptsWithConditions(
          bundle,
          initiator,
          eligible,
          worldRef.current,
        )

        const actionID = await viv.selectAction({ initiatorID: initiator })
        if (cancelled) return
        if (!actionID) {
          setDemo({
            initiator,
            initiatorName: nameOf(initiator),
            eligible,
            attempts,
          })
          setChronicle([])
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
            attempts,
          })
          setChronicle([])
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
        const finalAttempts = attempts.map((a) => {
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
        setChronicle([entry])
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
              {STAGE2_CHARACTERS.map((c) => (
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
            title="Re-run with the same initiator and clear the chronicle"
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
  return STAGE2_CHARACTERS.find((c) => c.id === id)?.name ?? id
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

function computeAttemptsWithConditions(
  bundle: Bundle,
  initiator: UID,
  eligible: Array<{ name: string }>,
  world: WorldState,
): CastAttempt[] {
  const initiatorName = nameOf(initiator)
  const attempts: CastAttempt[] = []
  for (const e of eligible) {
    const action = bundle.actions[e.name]
    const initiatorRole = initiatorRoleNameFor(action)
    const otherRoles = Object.values(action.roles).filter(
      (r) => r.participationMode && r.participationMode !== 'initiator',
    )
    const baseSlots: CastSlot[] = [
      {
        role: initiatorRole,
        characterID: initiator,
        name: initiatorName,
        locked: true,
      },
    ]
    if (otherRoles.length === 0) {
      const conds = collectAndEvaluate(action, { [initiatorRole]: initiator }, world)
      attempts.push({
        actionName: e.name,
        slots: baseSlots,
        conditions: conds,
        conditionsPassed: conds.every((c) => c.passed),
      })
      continue
    }
    const otherRole = otherRoles[0]
    const candidates = STAGE2_CHARACTERS.filter((c) => c.id !== initiator)
    for (const cand of candidates) {
      const slots: CastSlot[] = [
        ...baseSlots,
        {
          role: otherRole.name,
          characterID: cand.id,
          name: cand.name,
        },
      ]
      const bindings: Record<string, UID> = {
        [initiatorRole]: initiator,
        [otherRole.name]: cand.id,
      }
      const conds = collectAndEvaluate(action, bindings, world)
      attempts.push({
        actionName: e.name,
        slots,
        conditions: conds,
        conditionsPassed: conds.every((c) => c.passed),
      })
    }
  }
  return attempts
}

function collectAndEvaluate(
  action: BundleAction,
  bindings: Record<string, UID>,
  world: WorldState,
): DisplayCondition[] {
  const all: ConditionEntry[] = [
    ...action.conditions.globalConditions,
    ...Object.values(action.conditions.roleConditions).flat(),
  ]
  return all.map((c) => ({
    source: getConditionSource(c.body),
    passed: evaluateCondition(c.body, bindings, world),
  }))
}

function getConditionSource(expr: ConditionExpr): string {
  const src = (expr as { source?: { code?: string } }).source?.code
  if (typeof src === 'string') return src
  return JSON.stringify(expr)
}

function evaluateCondition(
  expr: ConditionExpr,
  bindings: Record<string, UID>,
  world: WorldState,
): boolean {
  if (expr.type === 'comparison') {
    const left = evaluateExpr(expr.value.left, bindings, world)
    const right = evaluateExpr(expr.value.right, bindings, world)
    const op = expr.value.operator
    const result = compare(left, right, op)
    return expr.negated ? !result : result
  }
  // Truthy entity-reference shortcut: `@x.flag` (no comparison).
  if (expr.type === 'entityReference') {
    const v = evaluateExpr(expr, bindings, world)
    return expr.negated ? !v : !!v
  }
  if (expr.type === 'bool') return expr.value
  return false
}

function evaluateExpr(
  expr: ConditionExpr,
  bindings: Record<string, UID>,
  world: WorldState,
): unknown {
  if (expr.type === 'bool') return expr.value
  if (expr.type === 'int' || expr.type === 'float') return expr.value
  if (expr.type === 'string') return expr.value
  if (expr.type === 'entityReference') {
    const ref = expr.value
    const id = bindings[ref.anchor]
    if (!id) return undefined
    let cur: unknown = world.entities[id]
    for (const part of ref.path) {
      if (cur && typeof cur === 'object') {
        cur = (cur as Record<string, unknown>)[part.name]
      } else {
        return undefined
      }
    }
    return cur
  }
  return undefined
}

function compare(left: unknown, right: unknown, op: string): boolean {
  switch (op) {
    case '==':
      return left === right
    case '!=':
      return left !== right
    case '>':
      return (left as number) > (right as number)
    case '<':
      return (left as number) < (right as number)
    case '>=':
      return (left as number) >= (right as number)
    case '<=':
      return (left as number) <= (right as number)
    default:
      return false
  }
}

// Step rendering

function renderStepBody(step: number, d: DemoState): React.ReactNode {
  switch (step) {
    case 1:
      return (
        <>
          <p>
            Two actions now declare an <code>initiator</code> role, so both come off the
            script.
          </p>
          <div className="paper-stage stage-step-1">
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
            Each eligible action gets one card per candidate for its other role. Both
            actions take a recipient, so each produces two cards.
          </p>
          <div className="paper-stage stage-step-2">
            <div className="roster">
              <div className="roster-label">Host's characters (with traits)</div>
              <div className="roster-chips">
                {STAGE2_CHARACTERS.map((c) => (
                  <div
                    key={c.id}
                    className={`chip${c.id === d.initiator ? ' chip-initiator' : ''}`}
                  >
                    {c.name}
                    <span
                      className={`chip-trait ${c.cheerful ? 'trait-yes' : 'trait-no'}`}
                    >
                      {c.cheerful ? 'cheerful' : 'grumpy'}
                    </span>
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
            Each card's conditions are evaluated against the cast bindings. <code>greet</code>{' '}
            has none and passes by default. <code>compliment</code> only passes when the
            recipient is cheerful, so the cast against grumpy Bob is discarded.
          </p>
          <div className="paper-stage stage-step-3">
            <div className="cast-grid">
              {d.attempts.map((a, i) => {
                const cls = a.conditionsPassed
                  ? 'card-stamped'
                  : 'card-stamped card-crumpled'
                return (
                  <div key={i} className={`card card-cast ${cls}`}>
                    <div className="card-name">{a.actionName}</div>
                    <div className="card-slots">
                      {a.slots.map((s) => (
                        <div
                          key={s.role}
                          className={`slot${s.locked ? ' slot-locked' : ''}`}
                        >
                          <span className="slot-role">@{s.role}</span>
                          <span className="slot-chip">{s.name}</span>
                        </div>
                      ))}
                    </div>
                    {a.conditions.length > 0 && (
                      <div className="card-conditions">
                        {a.conditions.map((c, k) => (
                          <div
                            key={k}
                            className={`condition-pill ${c.passed ? 'condition-pass' : 'condition-fail'}`}
                          >
                            <span className="condition-mark">{c.passed ? '✓' : '✗'}</span>
                            <code>{c.source}</code>
                          </div>
                        ))}
                      </div>
                    )}
                    <div
                      className={`stamp${a.conditionsPassed ? '' : ' stamp-fail'}`}
                      aria-label={a.conditionsPassed ? 'passed' : 'failed'}
                    >
                      {a.conditionsPassed ? 'PASS' : 'FAIL'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )
    case 4: {
      const passing = d.attempts.filter((a) => a.conditionsPassed)
      return (
        <>
          <p>
            Pick uniformly from the passing pile, a 1/{passing.length || 1} chance for
            each. Failed cards are out of the running.
          </p>
          <div className="paper-stage stage-step-4">
            <div className="cast-grid">
              {d.attempts.map((a, i) => {
                const fadedOrCrumpled = !a.conditionsPassed
                  ? 'card-crumpled'
                  : a.picked
                    ? 'card-picked'
                    : 'card-faded'
                return (
                  <div key={i} className={`card card-cast card-stamped ${fadedOrCrumpled}`}>
                    <div className="card-name">{a.actionName}</div>
                    <div className="card-slots">
                      {a.slots.map((s) => (
                        <div
                          key={s.role}
                          className={`slot${s.locked ? ' slot-locked' : ''}`}
                        >
                          <span className="slot-role">@{s.role}</span>
                          <span className="slot-chip">{s.name}</span>
                        </div>
                      ))}
                    </div>
                    <div
                      className={`stamp${a.conditionsPassed ? '' : ' stamp-fail'}`}
                      aria-label={a.conditionsPassed ? 'passed' : 'failed'}
                    >
                      {a.conditionsPassed ? 'PASS' : 'FAIL'}
                    </div>
                    {a.picked && <div className="ribbon">picked</div>}
                  </div>
                )
              })}
            </div>
            {d.pickedReport && (
              <div className="chronicle-emit">
                <div className="paper-arrow" aria-hidden="true">
                  ↓
                </div>
                <div className="strip">
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
