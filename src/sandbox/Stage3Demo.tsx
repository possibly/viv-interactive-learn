import { useEffect, useRef, useState } from 'react'
import { loadViv, type UID } from '../viv'
import {
  actionRecord,
  createStage3World,
  makeAdapter,
  STAGE2_CHARACTERS,
  type ChronicleEntry,
  type EntityRecord,
  type WorldState,
} from './world'

// Stage 3: same four-step walkthrough, plus effects. Each cast card
// labels what it would change; step 4 shows the picked card with a
// before/after world snapshot for any properties the effects touched.

const STAGE3_BUNDLE_PATH = `${import.meta.env.BASE_URL}bundles/stage3.json`

interface BundleAction {
  name: string
  roles: Record<string, BundleRole>
  conditions: {
    globalConditions: ConditionEntry[]
    roleConditions: Record<string, ConditionEntry[]>
  }
  effects: EffectEntry[]
}
interface BundleRole {
  name: string
  participationMode?: string
}
interface ConditionEntry {
  body: ConditionExpr
  references?: string[]
}
interface EffectEntry {
  body: EffectExpr
  references?: string[]
}
type ConditionExpr =
  | {
      type: 'comparison'
      negated?: boolean
      value: { left: ConditionExpr; right: ConditionExpr; operator: string }
      source?: { code?: string }
    }
  | { type: 'bool'; value: boolean; source?: { code?: string } }
  | { type: 'int'; value: number; source?: { code?: string } }
  | { type: 'float'; value: number; source?: { code?: string } }
  | { type: 'string'; value: string; source?: { code?: string } }
  | {
      type: 'entityReference'
      negated?: boolean
      value: { anchor: string; path: Array<{ type: string; name: string }> }
      source?: { code?: string }
    }
type EffectExpr = {
  type: 'assignment'
  value: { left: ConditionExpr; right: ConditionExpr; operator: string }
  source?: { code?: string }
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

interface DisplayEffect {
  source: string
}

interface CastAttempt {
  actionName: string
  slots: CastSlot[]
  conditions: DisplayCondition[]
  conditionsPassed: boolean
  effects: DisplayEffect[]
  picked?: boolean
}

interface WorldSnapshot {
  // characterID -> { cheerful: boolean }
  [characterID: string]: { cheerful: boolean }
}

interface DemoState {
  initiator: UID
  initiatorName: string
  eligible: Array<{ name: string }>
  attempts: CastAttempt[]
  pickedReport?: string
  before: WorldSnapshot
  after: WorldSnapshot
}

const STEP_TITLES = [
  '1. Find eligible actions',
  '2. Cast the remaining roles',
  '3. Evaluate conditions',
  '4. Pick, fire effects, write to the chronicle',
]

export default function Stage3Demo() {
  const bundleRef = useRef<Promise<Bundle> | null>(null)
  const [chronicle, setChronicle] = useState<ChronicleEntry[]>([])
  const [initiator, setInitiator] = useState<UID>('alice')
  const [demo, setDemo] = useState<DemoState | null>(null)
  const [vivErr, setVivErr] = useState<string | null>(null)
  const [runId, setRunId] = useState(0)
  const [vivReady, setVivReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (!bundleRef.current) {
          bundleRef.current = fetch(STAGE3_BUNDLE_PATH).then((r) => r.json())
        }
        const bundle = (await bundleRef.current) as Bundle
        if (cancelled) return

        const world = createStage3World()
        const before = snapshot(world)
        const viv = await loadViv()
        viv.initializeVivRuntime({
          contentBundle: bundle,
          adapter: makeAdapter(world),
        })

        const eligible = computeEligible(bundle)
        const attempts = computeAttempts(bundle, initiator, eligible, world)

        const actionID = await viv.selectAction({ initiatorID: initiator })
        if (cancelled) return

        let entry: ChronicleEntry | null = null
        let pickedReport: string | undefined
        let finalAttempts = attempts

        if (actionID) {
          const rec = actionRecord(world, actionID) as
            | { name?: string; report?: string; bindings?: Record<string, UID[]> }
            | undefined
          if (rec) {
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
            const newEntry: ChronicleEntry = {
              actionID,
              actionName: String(rec.name ?? '?'),
              initiatorID: initiator,
              report: String(rec.report ?? ''),
            }
            entry = newEntry
            pickedReport = newEntry.report
            finalAttempts = attempts.map((a) => {
              const sameAction = a.actionName === newEntry.actionName
              const sameCast = pickedSlots.every((s) =>
                a.slots.some((as) => as.role === s.role && as.characterID === s.characterID),
              )
              return { ...a, picked: sameAction && sameCast }
            })
          }
        }

        const after = snapshot(world)

        if (cancelled) return
        setVivReady(true)
        setDemo({
          initiator,
          initiatorName: nameOf(initiator),
          eligible,
          attempts: finalAttempts,
          pickedReport,
          before,
          after,
        })
        setChronicle(entry ? [entry] : [])
      } catch (e) {
        if (cancelled) return
        setVivErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [initiator, runId])

  const reroll = () => setRunId((n) => n + 1)

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
              {demo && (
                <div className="step-body">
                  {renderStepBody(
                    stepNum,
                    demo,
                    stepNum === 4 ? reroll : undefined,
                    vivReady,
                  )}
                </div>
              )}
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

function computeAttempts(
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
      const conds = collectConditions(action, { [initiatorRole]: initiator }, world)
      attempts.push({
        actionName: e.name,
        slots: baseSlots,
        conditions: conds,
        conditionsPassed: conds.every((c) => c.passed),
        effects: collectEffects(action),
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
      const conds = collectConditions(action, bindings, world)
      attempts.push({
        actionName: e.name,
        slots,
        conditions: conds,
        conditionsPassed: conds.every((c) => c.passed),
        effects: collectEffects(action),
      })
    }
  }
  return attempts
}

function collectConditions(
  action: BundleAction,
  bindings: Record<string, UID>,
  world: WorldState,
): DisplayCondition[] {
  const all: ConditionEntry[] = [
    ...action.conditions.globalConditions,
    ...Object.values(action.conditions.roleConditions).flat(),
  ]
  return all.map((c) => ({
    source: getSource(c.body),
    passed: evaluateCondition(c.body, bindings, world),
  }))
}

function collectEffects(action: BundleAction): DisplayEffect[] {
  return action.effects.map((e) => ({ source: getSource(e.body) }))
}

function getSource(expr: { source?: { code?: string } }): string {
  return expr.source?.code ?? '?'
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

function snapshot(world: WorldState): WorldSnapshot {
  const out: WorldSnapshot = {}
  for (const id of world.characters) {
    const ent = world.entities[id] as EntityRecord
    out[id] = { cheerful: !!ent.cheerful }
  }
  return out
}

// Step rendering

function renderStepBody(
  step: number,
  d: DemoState,
  onReroll: (() => void) | undefined,
  vivReady: boolean,
): React.ReactNode {
  switch (step) {
    case 1:
      return (
        <>
          <p>
            Three actions now declare an <code>initiator</code> role: <code>greet</code>{' '}
            and <code>tease</code> have no role conditions, while <code>cheer_up</code> only
            applies to grumpy targets.
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
            Each action gets one card per non-initiator candidate. Cards keep their
            effects attached so we can show what would happen later.
          </p>
          <div className="paper-stage stage-step-2">
            <div className="roster">
              <div className="roster-label">Host's characters (with traits)</div>
              <div className="roster-chips">
                {STAGE2_CHARACTERS.map((c) => {
                  const isCheerful = d.before[c.id]?.cheerful ?? c.cheerful
                  return (
                    <div
                      key={c.id}
                      className={`chip${c.id === d.initiator ? ' chip-initiator' : ''}`}
                    >
                      {c.name}
                      <span
                        className={`chip-trait ${isCheerful ? 'trait-yes' : 'trait-no'}`}
                      >
                        {isCheerful ? 'cheerful' : 'grumpy'}
                      </span>
                    </div>
                  )
                })}
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
            Conditions are checked per cast. <code>cheer_up</code>'s condition fails for
            cheerful targets, and those casts are crumpled.
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
      const picked = d.attempts.find((a) => a.picked)
      return (
        <>
          <p>
            Pick uniformly from the passing pile, a 1/{passing.length || 1} chance for
            each. The picked card's <strong>effects</strong> fire, mutating entity
            properties in the host's world.
          </p>
          <div className="paper-stage stage-step-4">
            <div className="cast-grid">
              {d.attempts.map((a, i) => {
                const cls = !a.conditionsPassed
                  ? 'card-crumpled'
                  : a.picked
                    ? 'card-picked'
                    : 'card-faded'
                return (
                  <div key={i} className={`card card-cast card-stamped ${cls}`}>
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
          </div>

          {picked && (
            <div className="effects-panel">
              <h5>
                Effects of <code>{picked.actionName}</code>
              </h5>
              {picked.effects.length === 0 ? (
                <p className="dim">No effects. The world is unchanged.</p>
              ) : (
                <ul className="effects-list">
                  {picked.effects.map((e, k) => (
                    <li key={k}>
                      <code>{e.source}</code>
                    </li>
                  ))}
                </ul>
              )}
              <div className="world-diff">
                <div className="world-diff-label">World after</div>
                <div className="roster-chips">
                  {STAGE2_CHARACTERS.map((c) => {
                    const before = d.before[c.id]
                    const after = d.after[c.id]
                    const changed = before && after && before.cheerful !== after.cheerful
                    const isCheerful = after?.cheerful ?? false
                    return (
                      <div key={c.id} className={`chip${changed ? ' chip-changed' : ''}`}>
                        {c.name}
                        <span
                          className={`chip-trait ${isCheerful ? 'trait-yes' : 'trait-no'}`}
                        >
                          {isCheerful ? 'cheerful' : 'grumpy'}
                        </span>
                        {changed && (
                          <span className="chip-diff">
                            ({before!.cheerful ? 'cheerful' : 'grumpy'} →{' '}
                            {after!.cheerful ? 'cheerful' : 'grumpy'})
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

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

          {onReroll && (
            <div className="step-reroll">
              <button
                type="button"
                className="ghost"
                onClick={onReroll}
                disabled={!vivReady}
                title="Re-run with the same initiator and clear the chronicle"
              >
                Reroll
              </button>
              <span className="dim">Roll the dice again with the same initiator.</span>
            </div>
          )}
        </>
      )
    }
    default:
      return null
  }
}
