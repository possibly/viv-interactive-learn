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

// Stage 4: importance steers selection. Same four steps as stage 3,
// plus a Lab panel below the chronicle that lets the reader retune
// each action's importance and watch the empirical distribution
// move toward the new theoretical one as they sample with Reroll.

const STAGE4_BUNDLE_PATH = `${import.meta.env.BASE_URL}bundles/stage4.json`

const ACTION_NAMES = ['greet', 'tease', 'cheer_up'] as const
const INITIAL_IMPORTANCE: Record<string, number> = {
  greet: 1,
  tease: 3,
  cheer_up: 5,
}
const ACTION_COLORS: Record<string, string> = {
  greet: '#7aa2f7',
  tease: '#f7768e',
  cheer_up: '#aa3bff',
}

interface BundleAction {
  name: string
  roles: Record<string, BundleRole>
  conditions: {
    globalConditions: ConditionEntry[]
    roleConditions: Record<string, ConditionEntry[]>
  }
  effects: EffectEntry[]
  importance?: { type: string; value: number }
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
  body: { source?: { code?: string } }
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
  importance: number
  picked?: boolean
}

interface WorldSnapshot {
  [characterID: string]: { cheerful: boolean }
}

interface DemoState {
  initiator: UID
  initiatorName: string
  eligible: Array<{ name: string }>
  attempts: CastAttempt[]
  pickedReport?: string
  pickedActionName?: string
  before: WorldSnapshot
  after: WorldSnapshot
}

const STEP_TITLES = [
  '1. Find eligible actions',
  '2. Cast the remaining roles',
  '3. Evaluate conditions',
  '4. Pick (weighted by importance), fire effects',
]

export default function Stage4Demo() {
  const bundleRef = useRef<Promise<Bundle> | null>(null)
  const [importance, setImportance] = useState<Record<string, number>>(INITIAL_IMPORTANCE)
  const [chronicle, setChronicle] = useState<ChronicleEntry[]>([])
  const [initiator, setInitiator] = useState<UID>('alice')
  const [demo, setDemo] = useState<DemoState | null>(null)
  const [vivErr, setVivErr] = useState<string | null>(null)
  const [runId, setRunId] = useState(0)
  const [vivReady, setVivReady] = useState(false)
  const [samples, setSamples] = useState<Record<string, number>>({})

  const importanceKey = JSON.stringify(importance)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (!bundleRef.current) {
          bundleRef.current = fetch(STAGE4_BUNDLE_PATH).then((r) => r.json())
        }
        const base = (await bundleRef.current) as Bundle
        if (cancelled) return

        const bundle = applyImportance(base, importance)
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
        let pickedActionName: string | undefined
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
            pickedActionName = newEntry.actionName
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
          pickedActionName,
          before,
          after,
        })
        setChronicle(entry ? [entry] : [])
        if (pickedActionName) {
          setSamples((prev) => ({
            ...prev,
            [pickedActionName!]: (prev[pickedActionName!] ?? 0) + 1,
          }))
        }
      } catch (e) {
        if (cancelled) return
        setVivErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
    // importance is read via the importanceKey snapshot; including the
    // object directly would re-fire the effect on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initiator, runId, importanceKey])

  const handleImportance = (action: string, value: number) => {
    setImportance((prev) => ({ ...prev, [action]: value }))
    setSamples({})
  }

  const handleInitiatorChange = (id: UID) => {
    setInitiator(id)
    setSamples({})
  }

  const reroll = () => setRunId((n) => n + 1)
  const resetSamples = () => setSamples({})

  const expected = demo ? expectedDistribution(demo.attempts, importance) : {}
  const totalSamples = Object.values(samples).reduce((a, b) => a + b, 0)

  return (
    <div className="algo-demo">
      <header className="algo-demo-head">
        <div className="algo-controls">
          <label>
            <span>Initiator:</span>
            <select
              value={initiator}
              onChange={(e) => handleInitiatorChange(e.target.value)}
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
                  {renderStepBody(stepNum, demo, stepNum === 4 ? reroll : undefined, vivReady)}
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

      <div className="lab-panel">
        <header className="lab-header">
          <h4>Lab: tune importance, watch the distribution</h4>
          <p className="dim">
            Sliders mutate the bundle's importance values before each <code>selectAction</code>{' '}
            call. The expected bar updates live. Click <strong>Reroll</strong> repeatedly to
            sample; the observed bar should approach the expected one.
          </p>
        </header>

        <div className="lab-sliders">
          {ACTION_NAMES.map((name) => (
            <div key={name} className="lab-slider">
              <label>
                <span
                  className="lab-slider-name"
                  style={{ color: ACTION_COLORS[name] }}
                >
                  {name}
                </span>
                <span className="lab-slider-value">{importance[name]}</span>
              </label>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={importance[name]}
                onChange={(e) => handleImportance(name, Number(e.target.value))}
                disabled={!vivReady}
                style={{ accentColor: ACTION_COLORS[name] }}
              />
            </div>
          ))}
        </div>

        <div className="lab-bars">
          <DistributionBar
            label="Expected"
            data={expected}
            total={1}
            renderValue={(v) => `${(v * 100).toFixed(1)}%`}
          />
          <DistributionBar
            label={`Observed (${totalSamples} sample${totalSamples === 1 ? '' : 's'})`}
            data={Object.fromEntries(
              ACTION_NAMES.map((n) => [n, totalSamples > 0 ? (samples[n] ?? 0) / totalSamples : 0]),
            )}
            total={1}
            renderValue={(v, name) =>
              totalSamples > 0
                ? `${(v * 100).toFixed(1)}% (${samples[name] ?? 0})`
                : '—'
            }
          />
        </div>

        <div className="lab-actions">
          <button
            type="button"
            className="ghost"
            onClick={reroll}
            disabled={!vivReady}
            title="Sample once with the current importance values"
          >
            Reroll
          </button>
          <button
            type="button"
            className="ghost"
            onClick={resetSamples}
            disabled={totalSamples === 0}
            title="Clear the observed counts"
          >
            Reset samples
          </button>
        </div>
      </div>
    </div>
  )
}

interface DistributionBarProps {
  label: string
  data: Record<string, number>
  total: number
  renderValue: (v: number, name: string) => string
}

function DistributionBar({ label, data, total, renderValue }: DistributionBarProps) {
  const segments = ACTION_NAMES.map((name) => ({
    name,
    value: data[name] ?? 0,
  }))
  const sum = segments.reduce((a, s) => a + s.value, 0)
  return (
    <div className="dist-bar">
      <div className="dist-bar-label">{label}</div>
      <div className="dist-bar-track">
        {sum === 0 ? (
          <div className="dist-bar-empty">no data yet</div>
        ) : (
          segments.map((s) => {
            const pct = (s.value / total) * 100
            if (pct <= 0) return null
            return (
              <div
                key={s.name}
                className="dist-bar-seg"
                style={{ width: `${pct}%`, background: ACTION_COLORS[s.name] }}
                title={`${s.name}: ${renderValue(s.value, s.name)}`}
              >
                <span className="dist-bar-seg-label">{s.name}</span>
              </div>
            )
          })
        )}
      </div>
      <div className="dist-bar-legend">
        {segments.map((s) => (
          <span key={s.name} className="dist-bar-legend-item">
            <span
              className="dist-bar-swatch"
              style={{ background: ACTION_COLORS[s.name] }}
              aria-hidden="true"
            />
            <code>{s.name}</code>: {renderValue(s.value, s.name)}
          </span>
        ))}
      </div>
    </div>
  )
}

// Helpers

function applyImportance(bundle: Bundle, importance: Record<string, number>): Bundle {
  const cloned: Bundle = structuredClone(bundle)
  for (const [name, value] of Object.entries(importance)) {
    const action = cloned.actions[name]
    if (action?.importance) {
      action.importance.value = value
    }
  }
  return cloned
}

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
    const importance = action.importance?.value ?? 1
    if (otherRoles.length === 0) {
      const conds = collectConditions(action, { [initiatorRole]: initiator }, world)
      attempts.push({
        actionName: e.name,
        slots: baseSlots,
        conditions: conds,
        conditionsPassed: conds.every((c) => c.passed),
        effects: collectEffects(action),
        importance,
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
        importance,
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

// Expected probability per ACTION across passing casts. Each cast
// competes weighted by its action's importance, so an action with
// k passing casts at importance w contributes k*w to the total.
function expectedDistribution(
  attempts: CastAttempt[],
  importance: Record<string, number>,
): Record<string, number> {
  const passing = attempts.filter((a) => a.conditionsPassed)
  const weights: Record<string, number> = {}
  for (const a of passing) {
    weights[a.actionName] = (weights[a.actionName] ?? 0) + (importance[a.actionName] ?? 1)
  }
  const total = Object.values(weights).reduce((s, w) => s + w, 0)
  if (total === 0) return {}
  const out: Record<string, number> = {}
  for (const [name, w] of Object.entries(weights)) {
    out[name] = w / total
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
            Three actions, each declaring an <code>initiator</code> role.
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
            Each eligible action gets a card per non-initiator candidate.
          </p>
          <div className="paper-stage stage-step-2">
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
            Conditions are checked per cast. Failed casts are crumpled and dropped.
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
      const totalWeight = passing.reduce((s, a) => s + a.importance, 0)
      return (
        <>
          <p>
            Each passing cast has a weight equal to its action's importance. The runtime
            picks a cast with probability <code>weight / total</code>. Total weight here is{' '}
            <strong>{totalWeight}</strong>.
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
                    {a.conditionsPassed && (
                      <div
                        className="importance-badge"
                        style={{
                          background: ACTION_COLORS[a.actionName],
                        }}
                        title={`importance ${a.importance}`}
                      >
                        ★ {a.importance}
                      </div>
                    )}
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
                title="Sample again with the current importance values"
              >
                Reroll
              </button>
              <span className="dim">Each reroll counts as one sample in the lab below.</span>
            </div>
          )}
        </>
      )
    }
    default:
      return null
  }
}
