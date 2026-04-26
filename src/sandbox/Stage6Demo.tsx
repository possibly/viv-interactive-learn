import { useEffect, useRef, useState } from 'react'
import { loadViv, type UID } from '../viv'
import {
  actionRecord,
  createStage3World,
  makeAdapter,
  STAGE2_CHARACTERS,
  type ChronicleEntry,
} from './world'

// Stage 6: per-pair query gating.
//
// The has-greeted-with query is parameterized by two character
// roles, so tease and cheer_up only become eligible for a specific
// (initiator, recipient) pair after that pair has greeted in either
// direction. Greet's embargo also tracks the pair, so the runtime
// will not redundantly pick the same direction twice.
//
// We run five turns and visualize the state of all three character
// pairs at each turn so the unlocking is visible.

const STAGE6_BUNDLE_PATH = `${import.meta.env.BASE_URL}bundles/stage6.json`

const TURN_INITIATORS: UID[] = ['alice', 'bob', 'carol', 'alice', 'bob']

const ACTION_COLORS: Record<string, string> = {
  greet: '#7aa2f7',
  tease: '#f7768e',
  cheer_up: '#aa3bff',
}

interface BundleAction {
  name: string
}

type Bundle = { actions: Record<string, BundleAction> }

interface PairStatus {
  a: UID
  b: UID
  label: string
  greeted: boolean
}

interface TurnRecord {
  turn: number
  initiator: UID
  initiatorName: string
  pairsBefore: PairStatus[] // pair status at the START of the turn
  pickedActionName: string
  pickedTargetID?: UID
  pickedReport: string
  unlockedPair?: string // label of the pair that this turn's greet unlocked
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

        const greetedPairs = new Set<string>()
        const out: TurnRecord[] = []

        for (let i = 0; i < TURN_INITIATORS.length; i++) {
          const initiator = TURN_INITIATORS[i]
          const pairsBefore = enumeratePairs().map((p) => ({
            ...p,
            greeted: greetedPairs.has(pairKey(p.a, p.b)),
          }))

          const actionID = await viv.selectAction({ initiatorID: initiator })
          if (cancelled) return
          if (!actionID) {
            out.push({
              turn: i + 1,
              initiator,
              initiatorName: nameOf(initiator),
              pairsBefore,
              pickedActionName: '(none eligible)',
              pickedReport: '',
            })
            continue
          }

          const rec = actionRecord(world, actionID) as
            | {
                name?: string
                report?: string
                bindings?: Record<string, UID[]>
              }
            | undefined
          const pickedName = String(rec?.name ?? '?')
          const targetID = pickedTargetFrom(rec, pickedName)

          let unlockedPair: string | undefined
          if (pickedName === 'greet' && targetID) {
            const key = pairKey(initiator, targetID)
            if (!greetedPairs.has(key)) {
              greetedPairs.add(key)
              unlockedPair = pairLabel(initiator, targetID)
            }
          }

          out.push({
            turn: i + 1,
            initiator,
            initiatorName: nameOf(initiator),
            pairsBefore,
            pickedActionName: pickedName,
            pickedTargetID: targetID,
            pickedReport: String(rec?.report ?? ''),
            unlockedPair,
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
            </div>
            <div className="pair-status">
              <span className="pair-status-label">Pairs greeted:</span>
              {t.pairsBefore.map((p) => (
                <span
                  key={p.label}
                  className={`pair-pill ${p.greeted ? 'condition-pass' : 'condition-fail'}`}
                  title={
                    p.greeted
                      ? `${p.label} have greeted; tease and cheer_up unlocked for them`
                      : `${p.label} have not greeted; tease and cheer_up are gated`
                  }
                >
                  <span className="condition-mark">{p.greeted ? '✓' : '✗'}</span>
                  {p.label}
                </span>
              ))}
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
              {t.unlockedPair && (
                <span className="turn-embargo-fired" title="This greet unlocked the pair">
                  unlocked {t.unlockedPair} 🔓
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

function pairKey(a: UID, b: UID): string {
  return [a, b].sort().join('|')
}

function pairLabel(a: UID, b: UID): string {
  const [first, second] = [a, b].sort()
  return `${nameOf(first)}-${nameOf(second)}`
}

function enumeratePairs(): Array<{ a: UID; b: UID; label: string }> {
  const ids = STAGE2_CHARACTERS.map((c) => c.id)
  const out: Array<{ a: UID; b: UID; label: string }> = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      out.push({ a: ids[i], b: ids[j], label: pairLabel(ids[i], ids[j]) })
    }
  }
  return out
}

function pickedTargetFrom(
  rec: { bindings?: Record<string, UID[]> } | undefined,
  actionName: string,
): UID | undefined {
  if (!rec?.bindings) return undefined
  const targetRoleByAction: Record<string, string> = {
    greet: 'friend',
    tease: 'target',
    cheer_up: 'target',
  }
  const role = targetRoleByAction[actionName]
  if (!role) return undefined
  return rec.bindings[role]?.[0]
}
