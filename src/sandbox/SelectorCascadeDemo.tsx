import { useEffect, useRef, useState } from 'react'
import { loadViv } from '../viv'
import { actionRecord, createStage3World, makeAdapter } from './world'

// Two deterministic scenarios for the respond-to-tease selector's
// `target in order` cascade. Setup is forced via attemptAction.
// In both scenarios Bob is the target. Scenario A is his first
// tease, so retaliate's per-pair embargo is clear and retaliate
// fires. Scenario B has Bob already retaliated against Carol once,
// so the embargo blocks retaliate; the selector cascades to pout.

const STAGE10_BUNDLE_PATH = `${import.meta.env.BASE_URL}bundles/stage10.json`

const ACTION_COLORS: Record<string, string> = {
  greet: '#7aa2f7',
  tease: '#f7768e',
  cheer_up: '#aa3bff',
  retaliate: '#f59e0b',
  pout: '#06b6d4',
}

type ScenarioID = 'first' | 'second'

interface Scenario {
  id: ScenarioID
  label: string
  blurb: string
}

const SCENARIOS: Scenario[] = [
  {
    id: 'first',
    label: '1. First tease → retaliate',
    blurb:
      "Carol teases Bob. The reaction queues the respond-to-tease selector for Bob. On Bob's turn, the selector's `target in order` policy tries retaliate first; targeting passes, retaliate fires, pout is never tried.",
  },
  {
    id: 'second',
    label: '2. Second tease → pout',
    blurb:
      "Carol teases Bob; Bob retaliates. The (avenger=Bob, bully=Carol) retaliate embargo is now active. Carol teases Bob again, queueing another selector. On Bob's turn the selector tries retaliate first, gets blocked by the embargo, and cascades to pout.",
  },
]

interface CandidateOutcome {
  name: 'retaliate' | 'pout'
  status: 'skipped-prior-fire' | 'blocked-embargo' | 'fired'
  detail?: string
}

interface CascadeState {
  scenarioID: ScenarioID
  candidates: CandidateOutcome[]
  pickedActionName: string | null
  pickedReport: string | null
}

export default function SelectorCascadeDemo() {
  const bundleRef = useRef<Promise<unknown> | null>(null)
  const [scenarioID, setScenarioID] = useState<ScenarioID>('first')
  const [state, setState] = useState<CascadeState | null>(null)
  const [vivErr, setVivErr] = useState<string | null>(null)
  const [vivReady, setVivReady] = useState(false)
  const [runId, setRunId] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (!bundleRef.current) {
          bundleRef.current = fetch(STAGE10_BUNDLE_PATH).then((r) => r.json())
        }
        const bundle = await bundleRef.current
        if (cancelled) return

        const world = createStage3World()
        const viv = await loadViv()
        viv.initializeVivRuntime({
          contentBundle: bundle as Record<string, unknown>,
          adapter: makeAdapter(world),
        })

        // Setup. Both scenarios begin with Carol greeting Bob (to
        // pass tease's greeted-with gate) and then Carol teasing
        // Bob (to queue the selector for Bob).
        await viv.attemptAction({
          actionName: 'greet',
          initiatorID: 'carol',
          precastBindings: { greeter: ['carol'], friend: ['bob'] },
        })
        await viv.attemptAction({
          actionName: 'tease',
          initiatorID: 'carol',
          precastBindings: { teaser: ['carol'], target: ['bob'] },
        })
        if (cancelled) return

        let retaliateAlreadyFired = false
        if (scenarioID === 'second') {
          // Bob retaliates now. This activates the per-pair
          // forever embargo, then we queue another selector by
          // having Carol tease Bob again.
          const aid = await viv.selectAction({ initiatorID: 'bob' })
          if (cancelled) return
          const rec = aid
            ? (actionRecord(world, aid) as { name?: string } | undefined)
            : undefined
          retaliateAlreadyFired = rec?.name === 'retaliate'
          await viv.attemptAction({
            actionName: 'tease',
            initiatorID: 'carol',
            precastBindings: { teaser: ['carol'], target: ['bob'] },
          })
        }
        if (cancelled) return

        // The actual call we're studying: Bob takes a turn, with
        // a selector queued.
        const aid = await viv.selectAction({ initiatorID: 'bob' })
        if (cancelled) return

        const rec = aid
          ? (actionRecord(world, aid) as
              | { name?: string; report?: string }
              | undefined)
          : undefined
        const pickedName = rec?.name ? String(rec.name) : null
        const pickedReport = rec?.report ? String(rec.report) : null

        const candidates: CandidateOutcome[] = []
        if (pickedName === 'retaliate') {
          candidates.push({
            name: 'retaliate',
            status: 'fired',
            detail: 'Targeting passed; the action fires.',
          })
          candidates.push({
            name: 'pout',
            status: 'skipped-prior-fire',
            detail:
              'Skipped because an earlier candidate already fired. `target in order` stops at the first success.',
          })
        } else if (pickedName === 'pout') {
          candidates.push({
            name: 'retaliate',
            status: 'blocked-embargo',
            detail: retaliateAlreadyFired
              ? 'Blocked by the (avenger=Bob, bully=Carol) forever embargo from the earlier retaliate.'
              : 'Targeting failed.',
          })
          candidates.push({
            name: 'pout',
            status: 'fired',
            detail: 'Targeting passed; pout fires as the cascade fallback.',
          })
        }

        if (cancelled) return
        setVivReady(true)
        setState({
          scenarioID,
          candidates,
          pickedActionName: pickedName,
          pickedReport,
        })
      } catch (e) {
        if (cancelled) return
        setVivErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [scenarioID, runId])

  const reroll = () => setRunId((n) => n + 1)
  const scenario = SCENARIOS.find((s) => s.id === scenarioID)!

  return (
    <div className="algo-demo">
      <header className="algo-demo-head">
        <div className="scenario-tabs" role="tablist">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === scenarioID}
              className={`scenario-tab${s.id === scenarioID ? ' active' : ''}`}
              onClick={() => setScenarioID(s.id)}
              disabled={!vivReady}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="algo-controls">
          <button
            type="button"
            className="ghost"
            onClick={reroll}
            disabled={!vivReady}
            title="Re-run with the same scenario"
          >
            Reroll
          </button>
        </div>
      </header>

      <p className="scenario-blurb">{scenario.blurb}</p>

      {vivErr && <div className="error">{vivErr}</div>}

      {state && (
        <ol className="flow-steps">
          <li className="flow-step flow-step-active">
            <header>
              <span className="step-num">A</span>
              <span className="step-title">
                Selector targets candidates in order
              </span>
            </header>
            <div className="flow-step-body">
              <p className="flow-detail dim">
                Bob's queue contains the{' '}
                <code>respond-to-tease</code> selector with{' '}
                <code>@hurt=Bob, @bully=Carol</code>. The selector's
                policy is <code>target in order</code>; it walks the
                candidates top-to-bottom and stops at the first one
                whose targeting passes.
              </p>
              <ol className="cascade-list">
                {state.candidates.map((c, i) => (
                  <li
                    key={c.name}
                    className={`cascade-item cascade-${c.status}`}
                  >
                    <span className="cascade-num">{i + 1}.</span>
                    <span
                      className="cascade-name"
                      style={{ color: ACTION_COLORS[c.name] ?? 'inherit' }}
                    >
                      {c.name}
                    </span>
                    <span
                      className={`flow-status ${
                        c.status === 'fired'
                          ? 'flow-status-pass'
                          : c.status === 'blocked-embargo'
                            ? 'flow-status-fail'
                            : 'flow-status-skip'
                      }`}
                    >
                      {c.status === 'fired'
                        ? 'fired'
                        : c.status === 'blocked-embargo'
                          ? 'blocked'
                          : 'skipped'}
                    </span>
                    {c.detail && (
                      <span className="cascade-detail">{c.detail}</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </li>

          <li className="flow-step flow-step-active flow-step-final">
            <header>
              <span className="step-num">✓</span>
              <span className="step-title">selectAction returns</span>
            </header>
            <div className="flow-step-body">
              {state.pickedActionName ? (
                <div className="flow-pick">
                  <span
                    className="turn-action turn-pick-name"
                    style={{
                      color:
                        ACTION_COLORS[state.pickedActionName] ?? 'inherit',
                    }}
                  >
                    {state.pickedActionName}
                  </span>
                  {state.pickedReport && (
                    <span className="turn-pick-report">
                      {state.pickedReport}
                    </span>
                  )}
                </div>
              ) : (
                <p className="flow-detail dim">No action was performed.</p>
              )}
            </div>
          </li>
        </ol>
      )}
    </div>
  )
}

