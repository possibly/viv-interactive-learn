import { useEffect, useRef, useState } from 'react'
import { loadViv, type ContentBundle, type UID } from '../viv'
import {
  actionRecord,
  createStage12World,
  makeAdapter,
  STAGE2_CHARACTERS,
  type ChronicleEntry,
  type WorldState,
} from './world'

// Stage 13 -- Adaptive plans.
//
// Same shape as Stage12Demo, with three additions:
//
//   1. Per-character `cheerful` chips. The if-check in >regret reads
//      this property on the victim, so the user needs to see it
//      flipping in real time to understand why the apology either
//      lands or doesn't.
//
//   2. A plan card can now be in a `failed` state -- specifically
//      when a re-tease lands during the gap between strike and
//      regret. We mark this locally when we observe a tease whose
//      target is the victim of an in-flight plan whose strike has
//      fired but whose regret hasn't.
//
//   3. The Chronicle annotates apologise-suppressed plans with a
//      "plan failed" tag, and the regret cell on the card renders
//      with a struck-through "fail" stamp instead of the usual
//      "phase fired" check.

const STAGE13_BUNDLE_PATH = `${import.meta.env.BASE_URL}bundles/stage13.json`

const PHASES = ['stew', 'strike', 'regret'] as const
type Phase = (typeof PHASES)[number]

const PHASE_ACTION: Record<Phase, string> = {
  stew: 'stew',
  strike: 'retaliate',
  regret: 'apologise',
}

const ACTION_PHASE: Record<string, Phase | undefined> = {
  stew: 'stew',
  retaliate: 'strike',
  apologise: 'regret',
}

const ACTION_COLORS: Record<string, string> = {
  greet: '#7aa2f7',
  tease: '#f7768e',
  stew: '#a78bfa',
  retaliate: '#f59e0b',
  apologise: '#34d399',
}

interface PlanCard {
  id: string
  victim: UID
  offender: UID
  fired: Set<Phase>
  failed?: boolean
  queuedAtTurn: number
}

interface ChronicleEntryPlus extends ChronicleEntry {
  queuedPlanId?: string
  advancedPlanId?: string
  failedPlanId?: string
  turn: number
}

interface CheerfulMap {
  alice: boolean
  bob: boolean
  carol: boolean
}

const ROTATION: UID[] = ['alice', 'bob', 'carol']

export default function Stage13Demo() {
  const bundleRef = useRef<ContentBundle | null>(null)
  const worldRef = useRef<WorldState>(createStage12World())
  const [vivErr, setVivErr] = useState<string | null>(null)
  const [vivReady, setVivReady] = useState(false)
  const [chronicle, setChronicle] = useState<ChronicleEntryPlus[]>([])
  const [plans, setPlans] = useState<PlanCard[]>([])
  const [turn, setTurn] = useState(0)
  const [busy, setBusy] = useState(false)
  const [cheerful, setCheerful] = useState<CheerfulMap>({
    alice: true,
    bob: true,
    carol: true,
  })

  const bindRuntime = async () => {
    const viv = await loadViv()
    let bundle = bundleRef.current
    if (!bundle) {
      bundle = (await fetch(STAGE13_BUNDLE_PATH).then((r) => r.json())) as ContentBundle
      bundleRef.current = bundle
    }
    viv.initializeVivRuntime({
      contentBundle: bundle,
      adapter: makeAdapter(worldRef.current),
    })
    return viv
  }

  // Sync the cheerful chips off the live world. Effects run inside
  // attemptAction/selectAction; we just have to mirror the changes
  // back into render state when they're done.
  const syncCheerful = () => {
    const w = worldRef.current
    setCheerful({
      alice: !!w.entities.alice?.cheerful,
      bob: !!w.entities.bob?.cheerful,
      carol: !!w.entities.carol?.cheerful,
    })
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await bindRuntime()
        if (cancelled) return
        setVivReady(true)
        syncCheerful()
      } catch (e) {
        if (cancelled) return
        setVivErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const reset = async () => {
    if (busy) return
    worldRef.current = createStage12World()
    setChronicle([])
    setPlans([])
    setTurn(0)
    try {
      await bindRuntime()
      syncCheerful()
    } catch (e) {
      setVivErr(e instanceof Error ? e.message : String(e))
    }
  }

  // After observing a tease against `target`, mark any in-flight
  // grudge-arc whose victim == target and whose strike has fired
  // but whose regret hasn't as failed. The runtime's
  // `if !@victim.cheerful: fail;` will hit at the next planner
  // tick that reaches that phase, and the apologise we'd have
  // expected will never queue.
  const markPotentiallyFailedFor = (
    target: UID,
    prev: PlanCard[],
  ): { plans: PlanCard[]; failedId?: string } => {
    let failedId: string | undefined
    const next = prev.map((p) => {
      if (p.failed) return p
      if (p.victim !== target) return p
      if (!p.fired.has('strike')) return p
      if (p.fired.has('regret')) return p
      failedId = p.id
      return { ...p, failed: true }
    })
    return { plans: next, failedId }
  }

  const forceTease = async (teaser: UID, target: UID) => {
    if (!vivReady || busy || teaser === target) return
    setBusy(true)
    try {
      const viv = await bindRuntime()
      const actionID = await viv.attemptAction({
        actionName: 'tease',
        initiatorID: teaser,
        precastBindings: {
          teaser: [teaser],
          target: [target],
        },
      })
      if (!actionID) {
        setBusy(false)
        return
      }
      const rec = actionRecord(worldRef.current, actionID) as
        | { name?: string; report?: string }
        | undefined
      const newPlanId = `${teaser}-${target}-${turn}-${chronicle.length}`
      const newPlan: PlanCard = {
        id: newPlanId,
        victim: target,
        offender: teaser,
        fired: new Set(),
        queuedAtTurn: turn,
      }
      // Two state changes: a fresh plan queued, AND any earlier
      // in-flight plan against the same victim that's mid-regret
      // is now headed for failure.
      let failedId: string | undefined
      setPlans((prev) => {
        const { plans: marked, failedId: fid } = markPotentiallyFailedFor(target, prev)
        failedId = fid
        return [...marked, newPlan]
      })
      const entry: ChronicleEntryPlus = {
        turn,
        actionID,
        actionName: String(rec?.name ?? 'tease'),
        initiatorID: teaser,
        report: String(rec?.report ?? ''),
        queuedPlanId: newPlanId,
        failedPlanId: failedId,
      }
      setChronicle((prev) => [...prev, entry])
      syncCheerful()
    } catch (e) {
      setVivErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const stepTurn = async () => {
    if (!vivReady || busy) return
    setBusy(true)
    try {
      const viv = await bindRuntime()
      const initiator = ROTATION[turn % ROTATION.length]
      await viv.tickPlanner()
      const actionID = await viv.selectAction({ initiatorID: initiator })

      if (!actionID) {
        setChronicle((prev) => [
          ...prev,
          {
            turn,
            actionID: '',
            actionName: '(none)',
            initiatorID: initiator,
            report: '(no action eligible)',
          },
        ])
        setTurn((t) => t + 1)
        syncCheerful()
        return
      }

      const rec = actionRecord(worldRef.current, actionID) as
        | { name?: string; report?: string; bindings?: Record<string, UID[]> }
        | undefined
      const actionName = String(rec?.name ?? '?')
      let advancedPlanId: string | undefined
      let queuedPlanId: string | undefined
      let failedId: string | undefined

      const phase = ACTION_PHASE[actionName]
      if (phase) {
        // Phase action fired; advance the matching plan's tape.
        // We pick the oldest in-flight, non-failed plan whose victim
        // is this initiator and whose phase is still pending.
        setPlans((prev) => {
          let matched = false
          return prev.map((p) => {
            if (matched) return p
            if (p.failed) return p
            if (p.victim !== initiator) return p
            if (p.fired.has(phase)) return p
            matched = true
            advancedPlanId = p.id
            const fired = new Set(p.fired)
            fired.add(phase)
            return { ...p, fired }
          })
        })
      } else if (actionName === 'tease') {
        // Tease fired via general action selection -- queue a fresh
        // plan AND mark any earlier in-flight plan against the same
        // victim that hasn't apologised yet as failed.
        const teaser = rec?.bindings?.teaser?.[0] ?? initiator
        const target = rec?.bindings?.target?.[0]
        if (target) {
          const newPlanId = `${teaser}-${target}-${turn}-${chronicle.length}`
          queuedPlanId = newPlanId
          setPlans((prev) => {
            const { plans: marked, failedId: fid } = markPotentiallyFailedFor(target, prev)
            failedId = fid
            return [
              ...marked,
              {
                id: newPlanId,
                victim: target,
                offender: teaser,
                fired: new Set(),
                queuedAtTurn: turn,
              },
            ]
          })
        }
      }

      const entry: ChronicleEntryPlus = {
        turn,
        actionID,
        actionName,
        initiatorID: initiator,
        report: String(rec?.report ?? ''),
        advancedPlanId,
        queuedPlanId,
        failedPlanId: failedId,
      }
      setChronicle((prev) => [...prev, entry])
      setTurn((t) => t + 1)
      syncCheerful()
    } catch (e) {
      setVivErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const nextInitiator = ROTATION[turn % ROTATION.length]

  return (
    <div className="algo-demo plan-demo plan-demo-13">
      {vivErr && <div className="error">{vivErr}</div>}

      <header className="algo-demo-head">
        <div className="cheerful-row">
          <span className="cheerful-row-label">cheerful:</span>
          {ROTATION.map((id) => (
            <span
              key={id}
              className={`cheerful-chip ${cheerful[id as keyof CheerfulMap] ? 'cheerful-yes' : 'cheerful-no'}`}
            >
              {nameOf(id)}{' '}
              <span className="cheerful-mark">
                {cheerful[id as keyof CheerfulMap] ? '✓' : '✗'}
              </span>
            </span>
          ))}
        </div>

        <div className="algo-controls plan-controls">
          <span className="dim">
            Next up: <strong>{nameOf(nextInitiator)}</strong>{' '}
            <span className="dim">(turn {turn + 1})</span>
          </span>
          <button type="button" onClick={stepTurn} disabled={!vivReady || busy}>
            Step turn
          </button>
          <button
            type="button"
            className="ghost"
            onClick={reset}
            disabled={busy || (chronicle.length === 0 && plans.length === 0)}
          >
            Reset
          </button>
        </div>
        <div className="plan-trigger-row">
          <span className="plan-trigger-label">Force a tease (queues a plan):</span>
          <div className="plan-trigger-buttons">
            {ROTATION.flatMap((teaser) =>
              ROTATION.filter((t) => t !== teaser).map((target) => (
                <button
                  key={`${teaser}-${target}`}
                  type="button"
                  className="plan-trigger-btn"
                  onClick={() => forceTease(teaser, target)}
                  disabled={!vivReady || busy}
                >
                  {nameOf(teaser)} → {nameOf(target)}
                </button>
              )),
            )}
          </div>
        </div>
        <p className="plan-tip dim">
          To see adaptation, click a tease button, step until{' '}
          <code>retaliate</code> fires, then click the same tease button again
          before stepping further. The <code>&gt;regret</code> phase will check{' '}
          <code>@victim.cheerful</code>, find it false, and{' '}
          <code>fail</code> instead of queueing the apology.
        </p>
      </header>

      <div className="plan-tracker">
        <h4>Plans in flight ({plans.length})</h4>
        {plans.length === 0 ? (
          <p className="dim plan-empty">
            No plans queued yet. Force a tease to start one.
          </p>
        ) : (
          <ul className="plan-cards">
            {plans.map((p) => {
              const completed = p.fired.size === PHASES.length && !p.failed
              const failed = !!p.failed
              const nextPhase = PHASES.find((ph) => !p.fired.has(ph)) ?? null
              return (
                <li
                  key={p.id}
                  className={`plan-card${completed ? ' plan-card-done' : ''}${failed ? ' plan-card-failed' : ''}`}
                >
                  <header className="plan-card-head">
                    <span className="plan-card-name">grudge-arc</span>
                    <span className="plan-card-bindings">
                      <code>@victim</code>: <strong>{nameOf(p.victim)}</strong>{' '}
                      &nbsp;<code>@offender</code>:{' '}
                      <strong>{nameOf(p.offender)}</strong>
                    </span>
                    <span className="plan-card-status">
                      {failed
                        ? 'failed at >regret'
                        : completed
                          ? 'succeeded'
                          : nextPhase
                            ? `awaiting ${nextPhase}`
                            : 'pending'}
                    </span>
                  </header>
                  <ol className="plan-tape">
                    {PHASES.map((ph, i) => {
                      const fired = p.fired.has(ph)
                      const current = !fired && !failed && nextPhase === ph
                      const failedHere = failed && ph === 'regret' && !fired
                      return (
                        <li
                          key={ph}
                          className={`plan-phase${fired ? ' phase-fired' : ''}${current ? ' phase-current' : ''}${failedHere ? ' phase-failed' : ''}`}
                        >
                          <span className="phase-num">{i + 1}</span>
                          <span className="phase-name">&gt;{ph}</span>
                          <span className="phase-action">
                            {ph === 'regret' ? (
                              <>
                                <code>if !@victim.cheerful</code>: <code>fail</code>;{' '}
                                else <code>queue apologise</code>
                              </>
                            ) : (
                              <>
                                <code>all:</code> queue <code>{PHASE_ACTION[ph]}</code>{' '}
                                <code>close</code>
                              </>
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="chronicle-panel">
        <h4>
          Chronicle <span className="dim">({chronicle.length})</span>
        </h4>
        {chronicle.length === 0 ? (
          <p className="dim">
            Empty so far. Force a tease and step to see how a clean grudge-arc
            plays out, then re-tease before regret to watch it abort.
          </p>
        ) : (
          <ul className="chronicle-pile plan-chronicle">
            {chronicle.map((c, i) => (
              <li key={i} className="strip">
                <span
                  className="strip-action"
                  style={{ color: ACTION_COLORS[c.actionName] ?? 'inherit' }}
                >
                  {c.actionName}
                </span>
                <span className="strip-report">
                  T{c.turn + 1}: {c.report}
                </span>
                {c.queuedPlanId && (
                  <span
                    className="phase-tag tag-queued"
                    title="A grudge-arc plan was queued in response."
                  >
                    queues plan
                  </span>
                )}
                {c.advancedPlanId && ACTION_PHASE[c.actionName] && (
                  <span
                    className={`phase-tag tag-phase tag-phase-${ACTION_PHASE[c.actionName]}`}
                    title="This action came from a plan phase."
                  >
                    phase: {ACTION_PHASE[c.actionName]}
                  </span>
                )}
                {c.failedPlanId && (
                  <span
                    className="phase-tag tag-failed"
                    title="An in-flight plan against this victim is now headed for >regret failure."
                  >
                    will fail an in-flight plan
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function nameOf(id: UID): string {
  return STAGE2_CHARACTERS.find((c) => c.id === id)?.name ?? id
}
