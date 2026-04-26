import { useEffect, useRef, useState } from 'react'
import { loadViv, type UID } from '../viv'
import {
  actionRecord,
  createStage3World,
  makeAdapter,
  STAGE2_CHARACTERS,
  type ChronicleEntry,
} from './world'

// Stage 6: queries gate actions on the chronicle.
//
// Runs five turns. Tease and cheer_up include the has-greeted query
// as a condition, so they're locked out until greet fires once.
// Greet's forever embargo means it then never fires again, so
// turns 2-5 alternate between tease and cheer_up.

const STAGE6_BUNDLE_PATH = `${import.meta.env.BASE_URL}bundles/stage6.json`

const TURN_INITIATORS: UID[] = ['alice', 'bob', 'carol', 'alice', 'bob']

const ACTION_COLORS: Record<string, string> = {
  greet: '#7aa2f7',
  tease: '#f7768e',
  cheer_up: '#aa3bff',
}

const ALL_ACTION_NAMES = ['greet', 'tease', 'cheer_up'] as const

interface BundleAction {
  name: string
  embargoes?: Array<{ permanent?: boolean }>
}

type Bundle = { actions: Record<string, BundleAction> }

interface TurnRecord {
  turn: number
  initiator: UID
  initiatorName: string
  hasGreeted: boolean // query state at the start of this turn
  eligible: string[] // action names eligible after embargo + query gates
  embargoed: string[] // action names embargoed at start of turn
  queryGated: string[] // action names blocked by the has-greeted query
  pickedActionName: string
  pickedReport: string
  effectsActivatedEmbargo: boolean
}

export default function Stage6Demo() {
  const bundleRef = useRef<Promise<Bundle> | null>(null)
  const [turns, setTurns] = useState<TurnRecord[]>([])
  const [vivErr, setVivErr] = useState<string | null>(null)
  const [vivReady, setVivReady] = useState(false)
  const [runId, setRunId] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (!bundleRef.current) {
          bundleRef.current = fetch(STAGE6_BUNDLE_PATH).then((r) => r.json())
        }
        const bundle = (await bundleRef.current) as Bundle
        if (cancelled) return

        const world = createStage3World()
        const viv = await loadViv()
        viv.initializeVivRuntime({
          contentBundle: bundle,
          adapter: makeAdapter(world),
        })

        const permanentEmbargoActions = new Set<string>()
        for (const [name, def] of Object.entries(bundle.actions)) {
          if (def.embargoes?.some((e) => e.permanent)) {
            permanentEmbargoActions.add(name)
          }
        }

        // Local mirror of which actions require the has-greeted query
        // to have matched. Lets us narrate eligibility without parsing
        // the bundle's condition AST again here.
        const QUERY_GATED = new Set(['tease', 'cheer_up'])

        const out: TurnRecord[] = []
        const fired = new Set<string>()
        let hasGreeted = false

        for (let i = 0; i < TURN_INITIATORS.length; i++) {
          const initiator = TURN_INITIATORS[i]
          const embargoed = ALL_ACTION_NAMES.filter(
            (n) => permanentEmbargoActions.has(n) && fired.has(n),
          )
          const queryGated = hasGreeted
            ? []
            : ALL_ACTION_NAMES.filter((n) => QUERY_GATED.has(n))
          const eligible = ALL_ACTION_NAMES.filter(
            (n) => !embargoed.includes(n) && !queryGated.includes(n),
          )

          const actionID = await viv.selectAction({ initiatorID: initiator })
          if (cancelled) return
          if (!actionID) {
            out.push({
              turn: i + 1,
              initiator,
              initiatorName: nameOf(initiator),
              hasGreeted,
              eligible,
              embargoed,
              queryGated,
              pickedActionName: '(none eligible)',
              pickedReport: '',
              effectsActivatedEmbargo: false,
            })
            continue
          }
          const rec = actionRecord(world, actionID) as
            | { name?: string; report?: string }
            | undefined
          const pickedName = String(rec?.name ?? '?')
          const wasNewlyEmbargoed =
            permanentEmbargoActions.has(pickedName) && !fired.has(pickedName)
          if (permanentEmbargoActions.has(pickedName)) {
            fired.add(pickedName)
          }
          if (pickedName === 'greet') {
            hasGreeted = true
          }
          out.push({
            turn: i + 1,
            initiator,
            initiatorName: nameOf(initiator),
            hasGreeted,
            eligible,
            embargoed,
            queryGated,
            pickedActionName: pickedName,
            pickedReport: String(rec?.report ?? ''),
            effectsActivatedEmbargo: wasNewlyEmbargoed,
          })
        }

        if (cancelled) return
        setVivReady(true)
        setTurns(out)
      } catch (e) {
        if (cancelled) return
        setVivErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [runId])

  const reroll = () => setRunId((n) => n + 1)

  const chronicle: ChronicleEntry[] = turns
    .filter((t) => t.pickedReport)
    .map((t, i) => ({
      actionID: `t${t.turn}_${i}`,
      actionName: t.pickedActionName,
      initiatorID: t.initiator,
      report: t.pickedReport,
    }))

  return (
    <div className="algo-demo">
      <header className="algo-demo-head">
        <div className="algo-controls">
          <button
            type="button"
            className="ghost"
            onClick={reroll}
            disabled={!vivReady}
            title="Re-run all 5 turns"
          >
            Reroll 5 turns
          </button>
        </div>
      </header>

      {vivErr && <div className="error">{vivErr}</div>}

      <ol className="turn-list">
        {turns.map((t) => (
          <li key={t.turn} className="turn-row">
            <div className="turn-header">
              <span className="turn-num">Turn {t.turn}</span>
              <span className="turn-initiator">
                <strong>{t.initiatorName}</strong> is up
              </span>
              <span
                className={`query-pill ${t.hasGreeted ? 'condition-pass' : 'condition-fail'}`}
              >
                <span className="condition-mark">{t.hasGreeted ? '✓' : '✗'}</span>
                <code>has-greeted</code>
              </span>
            </div>
            <div className="turn-eligible">
              <span className="turn-eligible-label">Eligible:</span>
              {ALL_ACTION_NAMES.map((name) => {
                const isEligible = t.eligible.includes(name)
                const isEmbargoed = t.embargoed.includes(name)
                const isQueryGated = t.queryGated.includes(name)
                let title: string | undefined
                if (isEmbargoed) title = 'Embargoed (already fired)'
                else if (isQueryGated) title = 'Query has-greeted has not matched yet'
                return (
                  <span
                    key={name}
                    className={`turn-action${isEligible ? '' : ' turn-action-embargoed'}`}
                    style={isEligible ? { color: ACTION_COLORS[name] } : undefined}
                    title={title}
                  >
                    {name}
                    {isEmbargoed && <span aria-hidden="true"> 🔒</span>}
                    {isQueryGated && <span aria-hidden="true"> ?</span>}
                  </span>
                )
              })}
            </div>
            <div className="turn-pick">
              <span className="turn-pick-label">Picked:</span>
              <span
                className="turn-action turn-pick-name"
                style={{ color: ACTION_COLORS[t.pickedActionName] ?? 'inherit' }}
              >
                {t.pickedActionName}
              </span>
              {t.pickedReport && (
                <span className="turn-pick-report">{t.pickedReport}</span>
              )}
              {t.effectsActivatedEmbargo && (
                <span className="turn-embargo-fired" title="Permanent embargo activated">
                  embargo activated 🔒
                </span>
              )}
            </div>
          </li>
        ))}
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

function nameOf(id: UID): string {
  return STAGE2_CHARACTERS.find((c) => c.id === id)?.name ?? id
}
