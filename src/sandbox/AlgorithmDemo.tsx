import { useEffect, useMemo, useRef, useState } from 'react'
import { loadViv, type UID } from '../viv'
import { createInitialWorld, makeAdapter, snapshotCharacters, type WorldState } from './world'

// Walks the user through what selectAction does internally for the
// stage-1 storyworld. Steps 1-3 we narrate ourselves so we can expose
// the working set the runtime is examining (eligible actions, candidate
// casts, condition results). Step 4 hands off to the real selectAction
// and folds the action it picked into the chronicle. The walkthrough
// is reusable: pick another initiator and step again to add another
// chronicle entry.

interface BundleAction {
  name: string
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
type Bundle = { actions: Record<string, BundleAction> }

interface CastingAttempt {
  actionName: string
  cast: Record<string, UID>
  conditionsCount: number
  conditionsPassed: boolean
}

interface ChronicleEntry {
  initiator: UID
  actionName: string
  cast: Record<string, UID>
  report: string
  effects: string[]
  before: Record<UID, number>
  after: Record<UID, number>
}

interface DemoState {
  step: number // 0 = nothing yet, 1..4 = steps completed
  initiator: UID
  eligibleActions: string[]
  attempts: CastingAttempt[]
  picked?: ChronicleEntry
}

const STEP_TITLES = [
  '1. Find eligible actions',
  '2. Cast the remaining roles',
  '3. Evaluate conditions',
  '4. Pick, run effects, append to the chronicle',
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

  const worldRef = useRef<WorldState>(
    createInitialWorld({ initialMood: 0, withTavern: false }),
  )
  const [chronicle, setChronicle] = useState<ChronicleEntry[]>([])
  const [initiator, setInitiator] = useState<UID>('alice')
  const [demo, setDemo] = useState<DemoState>(() => freshDemo('alice'))

  // Fetch the bundle, init the runtime once. We keep one shared world
  // so chronicle entries accumulate across "Step another character"
  // clicks -- the same way they would in a real loop.
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

  const characters = useMemo(
    () => snapshotCharacters(worldRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chronicle.length, demo.step],
  )

  const reset = async (nextInitiator: UID = 'alice') => {
    worldRef.current = createInitialWorld({ initialMood: 0, withTavern: false })
    setChronicle([])
    setInitiator(nextInitiator)
    setDemo(freshDemo(nextInitiator))
    // Re-init runtime against the fresh world so any internal queues
    // are cleared too.
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

  const advance = async () => {
    if (!bundle) return
    if (demo.step < 3) {
      setDemo((d) => narrateStep(d, bundle, worldRef.current))
      return
    }
    if (demo.step === 3) {
      // Step 4: hand off to the real runtime, snapshot before/after.
      try {
        const viv = await loadViv()
        const before = snapshotMoods(worldRef.current)
        const actionID = await viv.selectAction({ initiatorID: demo.initiator })
        if (!actionID) {
          setDemo((d) => ({ ...d, step: 4, picked: undefined }))
          return
        }
        const rec = worldRef.current.entities[actionID] as {
          name?: string
          report?: string
          gloss?: string
          bindings?: Record<string, UID[]>
        }
        const cast: Record<string, UID> = {}
        for (const [k, v] of Object.entries(rec.bindings ?? {})) {
          if (k === 'this') continue
          if (v[0]) cast[k] = v[0]
        }
        const after = snapshotMoods(worldRef.current)
        const action = bundle.actions[String(rec.name)]
        const effects = action?.effects.map(
          (e) => e.body.source?.code ?? '',
        ) ?? []
        const entry: ChronicleEntry = {
          initiator: demo.initiator,
          actionName: String(rec.name ?? '?'),
          cast,
          report: String(rec.report ?? rec.gloss ?? ''),
          effects,
          before,
          after,
        }
        setChronicle((c) => [...c, entry])
        setDemo((d) => ({ ...d, step: 4, picked: entry }))
      } catch (e) {
        setVivErr(e instanceof Error ? e.message : String(e))
      }
    }
  }

  const stepAnother = (nextInitiator: UID) => {
    setInitiator(nextInitiator)
    setDemo(freshDemo(nextInitiator))
  }

  return (
    <div className="algo-demo">
      <header className="algo-demo-head">
        <div className="algo-controls">
          <label>
            <span>Initiator:</span>
            <select
              value={initiator}
              onChange={(e) => stepAnother(e.target.value)}
              disabled={demo.step > 0 && demo.step < 4}
            >
              {CHARACTERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {demo.step < 4 && (
            <button onClick={advance} disabled={!vivReady}>
              {demo.step === 0 ? 'Start' : `Run step ${demo.step + 1}`}
            </button>
          )}
          {demo.step >= 4 && (
            <button onClick={() => stepAnother(nextInitiator(initiator))} disabled={!vivReady}>
              Step another character
            </button>
          )}
          <button className="ghost" onClick={() => reset('alice')} disabled={chronicle.length === 0 && demo.step === 0}>
            Reset
          </button>
        </div>
        <div className="algo-state">
          <span className="dim">State:</span>{' '}
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

      <div className="chronicle-panel">
        <h4>
          Chronicle <span className="dim">({chronicle.length})</span>
        </h4>
        {chronicle.length === 0 ? (
          <p className="dim">
            Empty so far. Walk through the four steps for at least one character to see the
            first entry the runtime appends.
          </p>
        ) : (
          <ol className="chronicle">
            {chronicle.map((c, i) => (
              <li key={i}>
                <span className="action-name">{c.actionName}</span>{' '}
                <span className="report">{c.report}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

// ---- Helpers ---------------------------------------------------------

function freshDemo(initiator: UID): DemoState {
  return { step: 0, initiator, eligibleActions: [], attempts: [] }
}

function snapshotMoods(w: WorldState): Record<UID, number> {
  const out: Record<UID, number> = {}
  for (const cid of w.characters) out[cid] = w.entities[cid].mood as number
  return out
}

function nextInitiator(current: UID): UID {
  const order = CHARACTERS.map((c) => c.id)
  const i = order.indexOf(current)
  return order[(i + 1) % order.length]
}

function narrateStep(d: DemoState, bundle: Bundle, world: WorldState): DemoState {
  switch (d.step) {
    case 0: {
      // Step 1: find every action where this character could be the initiator.
      const eligible: string[] = []
      for (const [name, action] of Object.entries(bundle.actions)) {
        const initiatorRole = Object.values(action.roles).find(
          (r) => r.participationMode === 'initiator',
        )
        if (initiatorRole) eligible.push(name)
      }
      return { ...d, step: 1, eligibleActions: eligible }
    }
    case 1: {
      // Step 2: for each eligible action, ask the host adapter for
      // candidates for the remaining roles. Only character roles
      // appear in stage 1.
      const attempts: CastingAttempt[] = []
      const initiatorLoc = world.entities[d.initiator].location as UID
      for (const actionName of d.eligibleActions) {
        const action = bundle.actions[actionName]
        const otherCharacterRoles = Object.values(action.roles).filter(
          (r) => r.participationMode && r.participationMode !== 'initiator',
        )
        if (otherCharacterRoles.length === 0) {
          attempts.push({
            actionName,
            cast: { [initiatorRoleNameFor(action)]: d.initiator },
            conditionsCount: 0,
            conditionsPassed: true,
          })
          continue
        }
        // Stage 1 has at most one extra character role per action.
        const otherRole = otherCharacterRoles[0]
        const candidates = world.characters.filter(
          (cid) => cid !== d.initiator && world.entities[cid].location === initiatorLoc,
        )
        for (const partner of candidates) {
          attempts.push({
            actionName,
            cast: {
              [initiatorRoleNameFor(action)]: d.initiator,
              [otherRole.name]: partner,
            },
            conditionsCount: 0,
            conditionsPassed: true,
          })
        }
      }
      return { ...d, step: 2, attempts }
    }
    case 2: {
      // Step 3: stage 1's actions have no conditions. Mark every
      // attempt as passing and surface the count for honesty.
      const attempts = d.attempts.map((a) => ({
        ...a,
        conditionsPassed: true,
        conditionsCount: 0,
      }))
      return { ...d, step: 3, attempts }
    }
    default:
      return d
  }
}

function initiatorRoleNameFor(action: BundleAction): string {
  return (
    Object.values(action.roles).find((r) => r.participationMode === 'initiator')?.name ??
    'initiator'
  )
}

// ---- Step rendering --------------------------------------------------

function renderStepBody(step: number, d: DemoState): React.ReactNode {
  switch (step) {
    case 1:
      return (
        <>
          <p>
            Look through the bundle for actions where this character can fill the{' '}
            <code>initiator</code> role. With ten actions defined we'd see ten candidates
            here, each waiting for casting.
          </p>
          <ul className="bare">
            {d.eligibleActions.map((name) => (
              <li key={name}>
                <code>{name}</code>
              </li>
            ))}
          </ul>
        </>
      )
    case 2:
      return (
        <>
          <p>
            For each candidate action, the runtime needs to fill the remaining roles. By
            default it draws candidates from entities at the same location as the
            initiator. <strong>Location isn't a Viv concept</strong> -- it's a plain
            property the host attaches to each character entity, and the runtime queries
            it through the adapter:
          </p>
          <pre className="code lang-ts inline-snippet">
            <code>{`// host state, set up before any selectAction call
entities.alice = { id: "alice", location: "tavern", mood: 0, ... }
entities.bob   = { id: "bob",   location: "tavern", mood: 0, ... }
entities.carol = { id: "carol", location: "tavern", mood: 0, ... }`}</code>
          </pre>
          <p>
            All three regulars are at <code>tavern</code>, so for Alice the candidates for{' '}
            <code>@friend</code> are simply Bob and Carol.
          </p>
          <p className="dim">
            (If you wanted a role to consider entities anywhere in the world regardless of
            location, you'd opt out in the viv file with{' '}
            <code>as: character, anywhere</code>. We don't need that here.)
          </p>
          <p>Each candidate becomes one casting attempt:</p>
          <ul className="bare">
            {d.attempts.map((a, i) => (
              <li key={i}>
                <code>{a.actionName}</code>:{' '}
                {Object.entries(a.cast)
                  .map(([role, id]) => `@${role} = ${id}`)
                  .join(', ')}
              </li>
            ))}
          </ul>
        </>
      )
    case 3:
      return (
        <>
          <p>
            Run each attempt's conditions. Failing attempts are discarded. Stage 1's
            actions don't define any conditions, so every attempt passes.
          </p>
          <ul className="bare">
            {d.attempts.map((a, i) => (
              <li key={i}>
                <code>{a.actionName}</code> →{' '}
                {Object.entries(a.cast)
                  .map(([role, id]) => `@${role} = ${id}`)
                  .join(', ')}{' '}
                → <span className="good">passed</span> ({a.conditionsCount} conditions)
              </li>
            ))}
          </ul>
        </>
      )
    case 4: {
      if (!d.picked) return <p>No casting attempt passed. Nothing happens.</p>
      const e = d.picked
      return (
        <>
          <p>
            Pick one of the passing attempts at random.{' '}
            <strong>It's uniform: every attempt has the same chance</strong> -- a fair
            (1/{d.attempts.filter((a) => a.conditionsPassed).length || 1}) coin toss across
            the candidates above. (Later stages introduce <code>importance</code> and{' '}
            <code>saliences</code>, which let you bias which attempts are picked. Stage 1
            doesn't declare either, so the distribution stays flat.) Then run the action's
            effects, save the action record, and the chronicle updates.
          </p>
          <p>
            Picked: <code>{e.actionName}</code> with{' '}
            {Object.entries(e.cast)
              .map(([role, id]) => `@${role} = ${id}`)
              .join(', ')}
          </p>
          {e.effects.length > 0 && (
            <>
              <p>Effects:</p>
              <ul className="bare effects">
                {e.effects.map((c, i) => (
                  <li key={i}>
                    <code>{c}</code>
                  </li>
                ))}
              </ul>
            </>
          )}
          <table className="diff-table">
            <thead>
              <tr>
                <th></th>
                <th>before</th>
                <th>after</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(e.before).map((cid) => {
                const b = e.before[cid]
                const a = e.after[cid]
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
          <p className="dim">
            That last line of the chronicle below was written by the runtime via the
            adapter's <code>saveActionData</code>. Pick another initiator and step again
            to add to it.
          </p>
        </>
      )
    }
    default:
      return null
  }
}
