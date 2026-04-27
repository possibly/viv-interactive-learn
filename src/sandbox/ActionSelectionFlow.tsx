import { useEffect, useRef, useState } from 'react'
import { loadViv, type UID } from '../viv'
import {
  actionRecord,
  createStage3World,
  makeAdapter,
  STAGE2_CHARACTERS,
  type WorldState,
} from './world'

// "How does action selection handle the queue?"
//
// The runtime's contract for selectAction is: target queued
// actions first, fall through to general selection if none of
// them succeed. We illustrate this with three deterministic
// scenarios, set up via attemptAction:
//
//   1. Empty queue              -> straight to general selection
//   2. Queued retaliate ready   -> queued action fires
//   3. Queued retaliate blocked -> targeting fails, fall-through
//
// In all three Bob is the focus. The setup uses attemptAction so
// the demo isn't dependent on randomness.

const STAGE8_BUNDLE_PATH = `${import.meta.env.BASE_URL}bundles/stage8.json`

const ACTION_COLORS: Record<string, string> = {
  greet: '#7aa2f7',
  tease: '#f7768e',
  cheer_up: '#aa3bff',
  retaliate: '#f59e0b',
}

type ScenarioID = 'empty' | 'ready' | 'blocked'

interface Scenario {
  id: ScenarioID
  label: string
  blurb: string
}

const SCENARIOS: Scenario[] = [
  {
    id: 'empty',
    label: '1. Empty queue',
    blurb:
      "Bob has nothing pending. selectAction skips the queue check and runs general action selection -- the same four-step algorithm from earlier in this page.",
  },
  {
    id: 'ready',
    label: '2. Queued retaliate, conditions clear',
    blurb:
      "Carol just teased Bob, so a retaliate is queued for him. selectAction targets it first; conditions and embargoes pass; the queued action fires and general selection is skipped.",
  },
  {
    id: 'blocked',
    label: '3. Queued retaliate, but embargoed',
    blurb:
      "Carol teased Bob earlier and he already retaliated, activating the (avenger=Bob, bully=Carol) embargo. Carol teases Bob again, queueing another retaliate. selectAction targets it, the embargo blocks it, and the runtime falls through to general selection.",
  },
]

interface FlowState {
  scenarioID: ScenarioID
  // What was queued for Bob at the start of his selectAction call.
  queuedRetaliate: { avenger: UID; bully: UID } | null
  // Was the queued action targeted, and did it succeed?
  queuedTried: boolean
  queuedSucceeded: boolean
  queuedBlockedReason?: string
  // Did general selection run?
  generalRan: boolean
  // The action that ultimately fired (or null).
  pickedActionName: string | null
  pickedReport: string | null
}

export default function ActionSelectionFlow() {
  const bundleRef = useRef<Promise<unknown> | null>(null)
  const [scenarioID, setScenarioID] = useState<ScenarioID>('empty')
  const [flow, setFlow] = useState<FlowState | null>(null)
  const [vivErr, setVivErr] = useState<string | null>(null)
  const [vivReady, setVivReady] = useState(false)
  const [runId, setRunId] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (!bundleRef.current) {
          bundleRef.current = fetch(STAGE8_BUNDLE_PATH).then((r) => r.json())
        }
        const bundle = await bundleRef.current
        if (cancelled) return

        // Build a fresh world per scenario so attempts don't leak.
        const world = createStage3World()
        const viv = await loadViv()
        viv.initializeVivRuntime({
          contentBundle: bundle as Record<string, unknown>,
          adapter: makeAdapter(world),
        })

        // Set up the world according to the scenario.
        const setup = await applyScenarioSetup(viv, world, scenarioID)
        if (cancelled) return

        // Now Bob takes a turn -- the actual selectAction we want to study.
        const aid = await viv.selectAction({ initiatorID: 'bob' })
        if (cancelled) return

        const rec = aid
          ? (actionRecord(world, aid) as
              | { name?: string; report?: string }
              | undefined)
          : undefined
        const pickedName = rec?.name ? String(rec.name) : null
        const pickedReport = rec?.report ? String(rec.report) : null

        // Decide what to render in the flow visualization.
        const queuedRetaliate = setup.queuedFor
          ? { avenger: 'bob' as UID, bully: setup.queuedFor }
          : null
        const queuedTried = !!queuedRetaliate
        const queuedSucceeded = queuedTried && pickedName === 'retaliate'
        const generalRan = queuedTried ? !queuedSucceeded : true
        const queuedBlockedReason =
          queuedTried && !queuedSucceeded
            ? setup.embargoActive
              ? 'embargo (avenger=Bob, bully=Carol) is active from an earlier retaliate'
              : 'targeting failed for another reason'
            : undefined

        if (cancelled) return
        setVivReady(true)
        setFlow({
          scenarioID,
          queuedRetaliate,
          queuedTried,
          queuedSucceeded,
          queuedBlockedReason,
          generalRan,
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

      {flow && (
        <ol className="flow-steps">
          <li className={`flow-step${flow.queuedTried ? ' flow-step-active' : ' flow-step-skipped'}`}>
            <header>
              <span className="step-num">A</span>
              <span className="step-title">
                Target Bob's queued actions
              </span>
              <span
                className={`flow-status ${flow.queuedTried ? (flow.queuedSucceeded ? 'flow-status-pass' : 'flow-status-fail') : 'flow-status-skip'}`}
              >
                {flow.queuedTried
                  ? flow.queuedSucceeded
                    ? 'fired'
                    : 'targeting failed'
                  : 'queue empty'}
              </span>
            </header>
            <div className="flow-step-body">
              {flow.queuedRetaliate ? (
                <div className="flow-queue">
                  <span className="queue-label">Queue:</span>
                  <span className="queue-pill">
                    retaliate against{' '}
                    <strong>{nameOf(flow.queuedRetaliate.bully)}</strong>
                  </span>
                </div>
              ) : (
                <div className="flow-queue">
                  <span className="queue-label">Queue:</span>
                  <span className="queue-empty">empty</span>
                </div>
              )}
              {flow.queuedTried && !flow.queuedSucceeded && flow.queuedBlockedReason && (
                <p className="flow-detail">
                  Blocked by <strong>{flow.queuedBlockedReason}</strong>.
                  Because targeting failed, the runtime moves on to step B
                  rather than firing this action.
                </p>
              )}
              {flow.queuedTried && flow.queuedSucceeded && (
                <p className="flow-detail">
                  Targeting passed. The action fires and the runtime
                  returns this action's ID; step B does not run.
                </p>
              )}
              {!flow.queuedTried && (
                <p className="flow-detail">
                  Nothing in the queue, so the runtime moves directly to
                  step B.
                </p>
              )}
            </div>
          </li>

          <li className={`flow-step${flow.generalRan ? ' flow-step-active' : ' flow-step-skipped'}`}>
            <header>
              <span className="step-num">B</span>
              <span className="step-title">General action selection</span>
              <span
                className={`flow-status ${flow.generalRan ? 'flow-status-pass' : 'flow-status-skip'}`}
              >
                {flow.generalRan ? 'ran' : 'skipped'}
              </span>
            </header>
            <div className="flow-step-body">
              {flow.generalRan ? (
                <p className="flow-detail">
                  The runtime ran the four-step algorithm from earlier:
                  enumerate eligible actions, cast the remaining roles,
                  filter by conditions, and weighted-pick one of the
                  passing casts.
                </p>
              ) : (
                <p className="flow-detail">
                  Step A's queued action fired, so general selection
                  was skipped.
                </p>
              )}
            </div>
          </li>

          <li className="flow-step flow-step-active flow-step-final">
            <header>
              <span className="step-num">✓</span>
              <span className="step-title">selectAction returns</span>
            </header>
            <div className="flow-step-body">
              {flow.pickedActionName ? (
                <div className="flow-pick">
                  <span
                    className="turn-action turn-pick-name"
                    style={{
                      color:
                        ACTION_COLORS[flow.pickedActionName] ?? 'inherit',
                    }}
                  >
                    {flow.pickedActionName}
                  </span>
                  {flow.pickedReport && (
                    <span className="turn-pick-report">
                      {flow.pickedReport}
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

interface SetupResult {
  // Who Bob has a queued retaliate against (if any).
  queuedFor: UID | null
  // Whether retaliate(bob, carol)'s embargo is already active.
  embargoActive: boolean
}

async function applyScenarioSetup(
  viv: Awaited<ReturnType<typeof loadViv>>,
  _world: WorldState,
  scenarioID: ScenarioID,
): Promise<SetupResult> {
  if (scenarioID === 'empty') {
    return { queuedFor: null, embargoActive: false }
  }
  // Both 'ready' and 'blocked' begin with Carol greeting Bob (to
  // pass tease's greeted-with gate) and then Carol teasing Bob (to
  // queue a retaliate for Bob).
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
  if (scenarioID === 'ready') {
    return { queuedFor: 'carol', embargoActive: false }
  }
  // 'blocked': have Bob retaliate now (consumes the queued action,
  // activates the embargo), then have Carol tease Bob again so a
  // fresh retaliate is queued -- but it will fail the embargo when
  // selectAction targets it.
  await viv.selectAction({ initiatorID: 'bob' })
  await viv.attemptAction({
    actionName: 'tease',
    initiatorID: 'carol',
    precastBindings: { teaser: ['carol'], target: ['bob'] },
  })
  return { queuedFor: 'carol', embargoActive: true }
}

function nameOf(id: UID): string {
  return STAGE2_CHARACTERS.find((c) => c.id === id)?.name ?? id
}
