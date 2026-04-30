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

// Stage 12 -- Plans, the multi-phase reaction tape.
//
// The pedagogical question this demo answers: "What does a plan
// look like as it unfolds, turn by turn, against a real chronicle?"
// Reactions are easy to describe ("queue X next turn"); plans are
// harder because a single plan's phases can stretch over several
// turns and weave around general action selection. So the demo
// gives every active plan a card with a phase tape, and steps
// through turns one click at a time, lighting up the current phase
// as the runtime advances it.
//
// The host loop here is one line longer than every prior demo:
//
//   await viv.tickPlanner()
//   await viv.selectAction({ initiatorID })
//
// Every turn we tick the planner first; this is what gives plans a
// clock to attach to. Without the tick the plan sits in the planner
// queue forever -- selectAction alone won't drive it.

const STAGE12_BUNDLE_PATH = `${import.meta.env.BASE_URL}bundles/stage12.json`

const PHASES = ['stew', 'strike', 'regret'] as const
type Phase = (typeof PHASES)[number]

// Each phase queues exactly one named action; this is what we use
// to advance our local plan tracker in lockstep with the chronicle.
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
  id: string // local id, not the runtime's plan UID
  victim: UID
  offender: UID
  // Phases we have observed firing in the chronicle. Phases that
  // haven't fired yet are still pending.
  fired: Set<Phase>
  // The turn at which the plan was queued (for ordering).
  queuedAtTurn: number
}

interface ChronicleEntryPlus extends ChronicleEntry {
  // For tease: which plan was queued in response.
  queuedPlanId?: string
  // For phase actions: which plan card it advanced.
  advancedPlanId?: string
  // The turn this fired on.
  turn: number
}

const ROTATION: UID[] = ['alice', 'bob', 'carol']

export default function Stage12Demo() {
  const bundleRef = useRef<ContentBundle | null>(null)
  const worldRef = useRef<WorldState>(createStage12World())
  const [vivErr, setVivErr] = useState<string | null>(null)
  const [vivReady, setVivReady] = useState(false)
  const [chronicle, setChronicle] = useState<ChronicleEntryPlus[]>([])
  const [plans, setPlans] = useState<PlanCard[]>([])
  const [turn, setTurn] = useState(0) // count of completed steps
  const [busy, setBusy] = useState(false)

  const bindRuntime = async () => {
    const viv = await loadViv()
    let bundle = bundleRef.current
    if (!bundle) {
      bundle = (await fetch(STAGE12_BUNDLE_PATH).then((r) => r.json())) as ContentBundle
      bundleRef.current = bundle
    }
    viv.initializeVivRuntime({
      contentBundle: bundle,
      adapter: makeAdapter(worldRef.current),
    })
    return viv
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await bindRuntime()
        if (cancelled) return
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

  const reset = async () => {
    if (busy) return
    worldRef.current = createStage12World()
    setChronicle([])
    setPlans([])
    setTurn(0)
    try {
      await bindRuntime()
    } catch (e) {
      setVivErr(e instanceof Error ? e.message : String(e))
    }
  }

  // Force a specific tease to fire. We use attemptAction with the
  // teaser as initiator so the world resembles "Bob took his turn
  // and chose tease". This is also what kicks off a grudge-arc plan.
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
      const entry: ChronicleEntryPlus = {
        turn,
        actionID,
        actionName: String(rec?.name ?? 'tease'),
        initiatorID: teaser,
        report: String(rec?.report ?? ''),
        queuedPlanId: newPlanId,
      }
      setPlans((prev) => [...prev, newPlan])
      setChronicle((prev) => [...prev, entry])
    } catch (e) {
      setVivErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  // The actual plan-driven loop: tick the planner, then pick an
  // action for whoever's up. This is the only loop that exercises
  // both new APIs together.
  const stepTurn = async () => {
    if (!vivReady || busy) return
    setBusy(true)
    try {
      const viv = await bindRuntime()
      const initiator = ROTATION[turn % ROTATION.length]
      // Order matters: tickPlanner first lets active plans queue
      // their phase actions onto this character's queue before
      // selectAction targets them.
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
        return
      }

      const rec = actionRecord(worldRef.current, actionID) as
        | { name?: string; report?: string; bindings?: Record<string, UID[]> }
        | undefined
      const actionName = String(rec?.name ?? '?')
      let advancedPlanId: string | undefined
      let queuedPlanId: string | undefined

      // If this is a phase action, mark the corresponding plan
      // phase as fired. The matching is by victim: the only plan
      // whose victim equals this initiator and that hasn't yet
      // fired this phase is the one that just advanced.
      const phase = ACTION_PHASE[actionName]
      if (phase) {
        setPlans((prev) => {
          let matched = false
          const next = prev.map((p) => {
            if (matched) return p
            if (p.victim !== initiator) return p
            if (p.fired.has(phase)) return p
            matched = true
            advancedPlanId = p.id
            const fired = new Set(p.fired)
            fired.add(phase)
            return { ...p, fired }
          })
          return next
        })
      } else if (actionName === 'tease') {
        // Tease initiated by general action selection -- the
        // runtime's reactions block on tease just queued a plan.
        const teaser = rec?.bindings?.teaser?.[0] ?? initiator
        const target = rec?.bindings?.target?.[0]
        if (target) {
          const newPlanId = `${teaser}-${target}-${turn}-${chronicle.length}`
          queuedPlanId = newPlanId
          setPlans((prev) => [
            ...prev,
            {
              id: newPlanId,
              victim: target,
              offender: teaser,
              fired: new Set(),
              queuedAtTurn: turn,
            },
          ])
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
      }
      setChronicle((prev) => [...prev, entry])
      setTurn((t) => t + 1)
    } catch (e) {
      setVivErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const nextInitiator = ROTATION[turn % ROTATION.length]

  return (
    <div className="algo-demo plan-demo">
      {vivErr && <div className="error">{vivErr}</div>}

      <header className="algo-demo-head">
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
      </header>

      <div className="plan-tracker">
        <h4>Plans in flight ({plans.length})</h4>
        {plans.length === 0 ? (
          <p className="dim plan-empty">
            No plans queued yet. Use a <em>tease</em> button above (or step
            turns until the runtime picks one) to queue a{' '}
            <code>grudge-arc</code>.
          </p>
        ) : (
          <ul className="plan-cards">
            {plans.map((p) => {
              const completed = p.fired.size === PHASES.length
              const nextPhase = PHASES.find((ph) => !p.fired.has(ph)) ?? null
              return (
                <li
                  key={p.id}
                  className={`plan-card${completed ? ' plan-card-done' : ''}`}
                >
                  <header className="plan-card-head">
                    <span className="plan-card-name">grudge-arc</span>
                    <span className="plan-card-bindings">
                      <code>@victim</code>: <strong>{nameOf(p.victim)}</strong>{' '}
                      &nbsp;<code>@offender</code>:{' '}
                      <strong>{nameOf(p.offender)}</strong>
                    </span>
                    <span className="plan-card-status">
                      {completed
                        ? 'succeeded'
                        : nextPhase
                          ? `awaiting ${nextPhase}`
                          : 'pending'}
                    </span>
                  </header>
                  <ol className="plan-tape">
                    {PHASES.map((ph, i) => {
                      const fired = p.fired.has(ph)
                      const current = !fired && nextPhase === ph
                      return (
                        <li
                          key={ph}
                          className={`plan-phase${fired ? ' phase-fired' : ''}${current ? ' phase-current' : ''}`}
                        >
                          <span className="phase-num">{i + 1}</span>
                          <span className="phase-name">&gt;{ph}</span>
                          <span className="phase-action">
                            queue <code>{PHASE_ACTION[ph]}</code>
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
            Empty so far. Trigger a tease and step turns to watch the plan tape
            unspool.
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
