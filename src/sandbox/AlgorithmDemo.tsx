import { useEffect, useMemo, useRef, useState } from 'react'
import { loadViv, type UID } from '../viv'
import { createInitialWorld, makeAdapter, snapshotCharacters, type WorldState } from './world'

// A guided walkthrough of what `selectAction` does internally, for the
// stage-1 "hello" action. The user picks an initiator, then advances
// step-by-step through:
//
//   1. Find eligible actions (actions whose initiator role matches)
//   2. Cast the remaining roles from the host's nearby-entity query
//   3. Evaluate conditions
//   4. Pick + apply effects + save the action record
//
// We compute steps 1-3 ourselves from the bundle and adapter so we can
// show the working set the runtime is examining; then we hand the same
// scenario to `selectAction` and confirm the runtime made an equivalent
// choice. The point is to make the algorithm legible, not to replace it.

interface BundleAction {
  name: string
  gloss?: { value?: unknown }
  report?: { value?: unknown }
  roles: Record<string, BundleRole>
  conditions: { globalConditions: unknown[]; roleConditions: Record<string, unknown[]> }
  effects: Array<{ body: { source?: { code?: string } } }>
}
interface BundleRole {
  name: string
  participationMode?: string
  entityType?: string
  precast?: boolean
  anywhere?: boolean
}

interface CastingAttempt {
  cast: Record<string, UID>
  conditionsPassed: boolean
  conditionsCount: number
}

interface DemoState {
  step: number // 0=not started, 1..4 = completed step
  initiator: UID
  eligibleActions: string[]
  attempts: CastingAttempt[]
  picked?: { actionName: string; cast: Record<string, UID>; effectCode: string[] }
  beforeMoods: Record<UID, number>
  afterMoods: Record<UID, number>
  vivConfirmation?: { actionName: string; cast: Record<string, UID> } | 'pending' | 'failed'
}

const STEP_TITLES = [
  '1. Find eligible actions',
  '2. Cast the remaining roles',
  '3. Evaluate conditions',
  '4. Pick, apply effects, save',
]

export default function AlgorithmDemo() {
  const [bundle, setBundle] = useState<{ actions: Record<string, BundleAction> } | null>(null)
  const [vivErr, setVivErr] = useState<string | null>(null)

  // We keep two parallel worlds: one for our hand-narrated walk, one
  // dedicated to the verifier so the two don't fight over runtime
  // initialization or shared state.
  const narrationWorldRef = useRef<WorldState>(
    createInitialWorld({ initialMood: 0, withTavern: false }),
  )
  const verifyWorldRef = useRef<WorldState>(
    createInitialWorld({ initialMood: 0, withTavern: false }),
  )

  const [initiator, setInitiator] = useState<UID>('alice')
  const [demo, setDemo] = useState<DemoState>(() => freshDemo('alice'))

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const bundleJson = await fetch(`${import.meta.env.BASE_URL}bundles/stage1.json`).then(
          (r) => r.json(),
        )
        if (cancelled) return
        setBundle(bundleJson)
      } catch (e) {
        if (cancelled) return
        setVivErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const characters = useMemo(
    () => snapshotCharacters(narrationWorldRef.current),
    [demo],
  )

  const reset = (nextInitiator: UID = initiator) => {
    narrationWorldRef.current = createInitialWorld({ initialMood: 0, withTavern: false })
    verifyWorldRef.current = createInitialWorld({ initialMood: 0, withTavern: false })
    setDemo(freshDemo(nextInitiator))
  }

  const onPickInitiator = (id: UID) => {
    setInitiator(id)
    reset(id)
  }

  const advance = async () => {
    if (!bundle) return
    setDemo((d) => stepAlgorithm(d, bundle, narrationWorldRef.current))
  }

  const verifyWithViv = async () => {
    if (!bundle) return
    setDemo((d) => ({ ...d, vivConfirmation: 'pending' }))
    try {
      const viv = await loadViv()
      // Reset the verify-world (so we can isolate this single call) and
      // ask the real runtime to act for the same initiator.
      verifyWorldRef.current = createInitialWorld({ initialMood: 0, withTavern: false })
      viv.initializeVivRuntime({
        contentBundle: bundle,
        adapter: makeAdapter(verifyWorldRef.current),
      })
      const actionID = await viv.selectAction({ initiatorID: initiator })
      if (!actionID) {
        setDemo((d) => ({ ...d, vivConfirmation: 'failed' }))
        return
      }
      const rec = verifyWorldRef.current.entities[actionID] as {
        name?: string
        bindings?: Record<string, UID[]>
      }
      const cast: Record<string, UID> = {}
      for (const [roleName, ids] of Object.entries(rec.bindings ?? {})) {
        // Skip the special `this` binding the runtime adds, which points
        // at the action record itself.
        if (roleName === 'this') continue
        if (ids[0]) cast[roleName] = ids[0]
      }
      setDemo((d) => ({
        ...d,
        vivConfirmation: { actionName: String(rec.name ?? '?'), cast },
      }))
    } catch (e) {
      setVivErr(e instanceof Error ? e.message : String(e))
      setDemo((d) => ({ ...d, vivConfirmation: 'failed' }))
    }
  }

  return (
    <div className="algo-demo">
      <header className="algo-demo-head">
        <div className="algo-controls">
          <label>
            <span>Initiator:</span>
            <select
              value={initiator}
              onChange={(e) => onPickInitiator(e.target.value)}
              disabled={demo.step > 0}
            >
              <option value="alice">Alice</option>
              <option value="bob">Bob</option>
              <option value="carol">Carol</option>
            </select>
          </label>
          <button onClick={advance} disabled={!bundle || demo.step >= 4}>
            {demo.step === 0 ? 'Start' : demo.step >= 4 ? 'Done' : `Run step ${demo.step + 1}`}
          </button>
          <button className="ghost" onClick={() => reset()} disabled={demo.step === 0}>
            Reset
          </button>
        </div>
        <div className="algo-state">
          <span className="dim">Storyworld:</span>{' '}
          {characters
            .map((c) => `${c.name} (mood ${c.mood as number})`)
            .join(' · ')}
        </div>
      </header>

      {vivErr && <div className="error">{vivErr}</div>}

      <ol className="algo-steps">
        {STEP_TITLES.map((title, i) => {
          const stepNum = i + 1
          const status =
            demo.step >= stepNum ? 'done' : demo.step + 1 === stepNum ? 'next' : 'pending'
          return (
            <li key={i} className={`algo-step ${status}`}>
              <header>
                <span className="step-num">{stepNum}</span>
                <span className="step-title">{title}</span>
                <span className={`status status-${status}`}>{status}</span>
              </header>
              {demo.step >= stepNum && (
                <div className="step-body">{renderStepBody(stepNum, demo)}</div>
              )}
            </li>
          )
        })}
      </ol>

      {demo.step >= 4 && (
        <div className="algo-verify">
          <h4>Cross-check with the actual Viv runtime</h4>
          <p className="dim">
            We just walked the algorithm by hand. Let's hand the exact same scenario to the
            real <code>selectAction</code> and see what it does.
          </p>
          <button onClick={verifyWithViv} disabled={demo.vivConfirmation === 'pending'}>
            {demo.vivConfirmation === 'pending'
              ? 'Asking runtime...'
              : 'Run selectAction({ initiatorID })'}
          </button>
          {demo.vivConfirmation && demo.vivConfirmation !== 'pending' && (
            <div className="verify-result">
              {demo.vivConfirmation === 'failed' ? (
                <p className="bad">Runtime returned no action -- something's off.</p>
              ) : (
                <>
                  <p>
                    Runtime picked <code>{demo.vivConfirmation.actionName}</code> with cast:{' '}
                    {Object.entries(demo.vivConfirmation.cast)
                      .map(([r, id]) => `@${r} = ${id}`)
                      .join(', ')}
                  </p>
                  <p className="dim">
                    Same action, possibly a different friend pick -- both castings were
                    eligible and the choice between them is uniformly random.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---- Algorithm narration ---------------------------------------------

function freshDemo(initiator: UID): DemoState {
  return {
    step: 0,
    initiator,
    eligibleActions: [],
    attempts: [],
    beforeMoods: {},
    afterMoods: {},
  }
}

function stepAlgorithm(
  d: DemoState,
  bundle: { actions: Record<string, BundleAction> },
  world: WorldState,
): DemoState {
  switch (d.step) {
    case 0: {
      // Step 1: find every action where this character could be initiator.
      // For stage 1, the @greeter role is the initiator role of `hello`.
      const eligible: string[] = []
      for (const [name, action] of Object.entries(bundle.actions)) {
        const initiatorRole = Object.values(action.roles).find(
          (r) => r.participationMode === 'initiator' || (r as { name: string }).name === 'greeter',
        )
        if (initiatorRole) eligible.push(name)
      }
      return { ...d, step: 1, eligibleActions: eligible }
    }
    case 1: {
      // Step 2: for each eligible action, cast the remaining roles by
      // asking the host adapter for nearby characters/items. For stage 1
      // the only non-initiator role on `hello` is @friend (recipient,
      // character, present at location).
      const attempts: CastingAttempt[] = []
      for (const actionName of d.eligibleActions) {
        // We only have one action (`hello`) at stage 1, but the loop is
        // structured to mirror what the runtime does for every eligible
        // action: ask the host for nearby characters and form one cast
        // per candidate.
        void bundle.actions[actionName]
        const initiatorLoc = world.entities[d.initiator].location as UID
        const candidates = world.characters.filter(
          (cid) => cid !== d.initiator && world.entities[cid].location === initiatorLoc,
        )
        for (const friend of candidates) {
          attempts.push({
            cast: { greeter: d.initiator, friend },
            conditionsPassed: true,
            conditionsCount: 0,
          })
        }
      }
      return { ...d, step: 2, attempts }
    }
    case 2: {
      // Step 3: evaluate conditions. `hello` has none, so every cast
      // passes. We still mark the count so the panel can say so honestly.
      const attempts = d.attempts.map((a) => ({
        ...a,
        conditionsPassed: true,
        conditionsCount: 0,
      }))
      return { ...d, step: 3, attempts }
    }
    case 3: {
      // Step 4: pick uniformly from passing attempts, run effects,
      // record the action.
      const passing = d.attempts.filter((a) => a.conditionsPassed)
      if (passing.length === 0) return { ...d, step: 4 }
      const pick = passing[Math.floor(Math.random() * passing.length)]
      const action = Object.values(bundle.actions)[0]
      const effectCode = action.effects.map(
        (e) => e.body.source?.code ?? '(unknown effect)',
      )
      // Apply locally to our narration world so the state panel updates.
      const before: Record<UID, number> = {}
      const after: Record<UID, number> = {}
      for (const cid of world.characters) before[cid] = world.entities[cid].mood as number
      const greeter = world.entities[pick.cast.greeter] as { mood: number }
      const friend = world.entities[pick.cast.friend] as { mood: number }
      greeter.mood = (greeter.mood ?? 0) + 5
      friend.mood = (friend.mood ?? 0) + 5
      for (const cid of world.characters) after[cid] = world.entities[cid].mood as number
      return {
        ...d,
        step: 4,
        picked: { actionName: action.name, cast: pick.cast, effectCode },
        beforeMoods: before,
        afterMoods: after,
      }
    }
    default:
      return d
  }
}

// ---- Step rendering --------------------------------------------------

function renderStepBody(step: number, d: DemoState): React.ReactNode {
  switch (step) {
    case 1:
      return (
        <>
          <p>
            Looking through the bundle for actions that have an{' '}
            <code>initiator</code> role this character can fill.
          </p>
          <ul className="bare">
            {d.eligibleActions.map((name) => (
              <li key={name}>
                <code>{name}</code>
              </li>
            ))}
          </ul>
          <p className="dim">
            (Stage 1 only ships one action, so this is the entire menu. With ten actions
            we'd see ten candidates here, each waiting for casting.)
          </p>
        </>
      )
    case 2:
      return (
        <>
          <p>
            For each candidate action, ask the host adapter "who's nearby and could fill the
            other roles?" The runtime calls{' '}
            <code>getEntityIDs(EntityType.Character, locationID)</code>, then forms one
            casting attempt per combination.
          </p>
          <ul className="bare">
            {d.attempts.map((a, i) => (
              <li key={i}>
                <code>hello</code>: @greeter = {a.cast.greeter}, @friend ={' '}
                <strong>{a.cast.friend}</strong>
              </li>
            ))}
          </ul>
        </>
      )
    case 3:
      return (
        <>
          <p>
            Run each attempt's conditions. If a condition fails, the attempt is discarded.{' '}
            <code>hello</code> has no conditions, so:
          </p>
          <ul className="bare">
            {d.attempts.map((a, i) => (
              <li key={i}>
                @friend = <strong>{a.cast.friend}</strong> →{' '}
                <span className="good">passed</span> ({a.conditionsCount} conditions)
              </li>
            ))}
          </ul>
        </>
      )
    case 4:
      if (!d.picked) return <p>No casting attempt passed. Nothing happens.</p>
      return (
        <>
          <p>
            Pick one of the passing attempts at random, run its effects, then save the action
            record so the chronicle (and downstream story sifting) can see it.
          </p>
          <p>
            Picked: <code>{d.picked.actionName}</code> with @greeter ={' '}
            <strong>{d.picked.cast.greeter}</strong>, @friend ={' '}
            <strong>{d.picked.cast.friend}</strong>
          </p>
          <p>Effects:</p>
          <ul className="bare effects">
            {d.picked.effectCode.map((c, i) => (
              <li key={i}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
          <table className="diff-table">
            <thead>
              <tr>
                <th></th>
                <th>before</th>
                <th>after</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(d.beforeMoods).map((cid) => {
                const b = d.beforeMoods[cid]
                const a = d.afterMoods[cid]
                const changed = a !== b
                return (
                  <tr key={cid} className={changed ? 'changed' : ''}>
                    <td>
                      <strong>{cid}</strong>.mood
                    </td>
                    <td>{b}</td>
                    <td>
                      {a} {changed && <span className="delta">(+{a - b})</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )
    default:
      return null
  }
}
