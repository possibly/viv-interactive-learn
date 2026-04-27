import { useEffect, useRef, useState } from 'react'
import { loadViv, type UID } from '../viv'
import {
  actionRecord,
  createStage3World,
  makeAdapter,
  STAGE2_CHARACTERS,
} from './world'

// Stage 8: reactions chain actions together. tease queues a
// retaliate for the target. selectAction consumes queued actions
// before falling back to general selection, so the next time the
// target gets a turn their retaliate fires.
//
// We render a turn list like stage 5/6, but augmented with two
// new badges:
//
//   * "queues retaliate" -- when a tease fires, it tells us what
//     just got pushed to the target's queue.
//   * "← caused by T#"   -- when a retaliate fires, it tells us
//     which earlier turn produced it.
//
// We also display a tiny per-character queue snapshot at the
// start of each turn so the queue state is observable.

const STAGE8_BUNDLE_PATH = `${import.meta.env.BASE_URL}bundles/stage8.json`

const TURN_INITIATORS: UID[] = [
  'alice', 'bob', 'carol',
  'alice', 'bob', 'carol',
  'alice', 'bob', 'carol',
  'alice',
]

const ACTION_COLORS: Record<string, string> = {
  greet: '#7aa2f7',
  tease: '#f7768e',
  cheer_up: '#aa3bff',
  retaliate: '#f59e0b',
}

interface QueuedItem {
  avenger: UID
  bully: UID
  // Turn # of the tease that put this here.
  fromTurn: number
}

interface TurnRecord {
  turn: number
  initiator: UID
  initiatorName: string
  // The state of every character's queue at the START of the turn.
  queueByChar: Record<UID, QueuedItem[]>
  pickedActionName: string
  pickedReport: string
  // For tease: who got a retaliate queued for them?
  queuedFor?: { avenger: UID; bully: UID }
  // For retaliate: which tease turn caused this?
  causedByTurn?: number
}

export default function Stage8Demo() {
  const bundleRef = useRef<Promise<unknown> | null>(null)
  const [turns, setTurns] = useState<TurnRecord[]>([])
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

        const world = createStage3World()
        const viv = await loadViv()
        viv.initializeVivRuntime({
          contentBundle: bundle as Record<string, unknown>,
          adapter: makeAdapter(world),
        })

        // Parallel model of each character's reaction queue.
        const queues: Record<UID, QueuedItem[]> = {
          alice: [], bob: [], carol: [],
        }
        // Map each fired action ID back to its turn number, so a
        // retaliate can render "← caused by T#".
        const turnByActionID = new Map<UID, number>()

        const out: TurnRecord[] = []

        for (let i = 0; i < TURN_INITIATORS.length; i++) {
          const initiator = TURN_INITIATORS[i]
          const turnNum = i + 1

          // Snapshot the queue state for display.
          const queueByChar = Object.fromEntries(
            Object.entries(queues).map(([k, v]) => [k, [...v]]),
          ) as Record<UID, QueuedItem[]>

          const actionID = await viv.selectAction({ initiatorID: initiator })
          if (cancelled) return

          if (!actionID) {
            out.push({
              turn: turnNum,
              initiator,
              initiatorName: nameOf(initiator),
              queueByChar,
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
                causes?: UID[]
              }
            | undefined
          const pickedName = String(rec?.name ?? '?')
          turnByActionID.set(actionID, turnNum)

          let queuedFor: { avenger: UID; bully: UID } | undefined
          let causedByTurn: number | undefined

          if (pickedName === 'tease') {
            const teaser = rec?.bindings?.teaser?.[0]
            const target = rec?.bindings?.target?.[0]
            if (teaser && target) {
              queues[target] = queues[target] ?? []
              queues[target].push({
                avenger: target,
                bully: teaser,
                fromTurn: turnNum,
              })
              queuedFor = { avenger: target, bully: teaser }
            }
          } else if (pickedName === 'retaliate') {
            const avenger = rec?.bindings?.avenger?.[0]
            const bully = rec?.bindings?.bully?.[0]
            if (avenger && bully) {
              const q = queues[avenger] ?? []
              const idx = q.findIndex(
                (it) => it.avenger === avenger && it.bully === bully,
              )
              if (idx >= 0) {
                causedByTurn = q[idx].fromTurn
                q.splice(idx, 1)
              }
            }
            // The runtime also exposes causes directly. Prefer that
            // when available -- it's the authoritative answer.
            const causerID = rec?.causes?.[0]
            if (causerID && turnByActionID.has(causerID)) {
              causedByTurn = turnByActionID.get(causerID)
            }
          }

          out.push({
            turn: turnNum,
            initiator,
            initiatorName: nameOf(initiator),
            queueByChar,
            pickedActionName: pickedName,
            pickedReport: String(rec?.report ?? ''),
            queuedFor,
            causedByTurn,
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

  return (
    <div className="algo-demo">
      <header className="algo-demo-head">
        <div className="algo-controls">
          <button
            type="button"
            className="ghost"
            onClick={reroll}
            disabled={!vivReady}
            title="Re-run all 10 turns"
          >
            Reroll {TURN_INITIATORS.length} turns
          </button>
        </div>
      </header>

      {vivErr && <div className="error">{vivErr}</div>}

      <ol className="turn-list">
        {turns.map((t) => {
          const initiatorQueue = t.queueByChar[t.initiator] ?? []
          return (
            <li key={t.turn} className="turn-row">
              <div className="turn-header">
                <span className="turn-num">Turn {t.turn}</span>
                <span className="turn-initiator">
                  <strong>{t.initiatorName}</strong> is up
                </span>
              </div>
              <div className="queue-row">
                <span className="queue-label">{t.initiatorName}'s queue:</span>
                {initiatorQueue.length === 0 ? (
                  <span className="queue-empty">empty</span>
                ) : (
                  initiatorQueue.map((q, k) => (
                    <span key={k} className="queue-pill">
                      retaliate against <strong>{nameOf(q.bully)}</strong>
                      <span className="queue-pill-from">
                        from T{q.fromTurn}
                      </span>
                    </span>
                  ))
                )}
              </div>
              <div className="turn-pick">
                <span className="turn-pick-label">Picked:</span>
                <span
                  className="turn-action turn-pick-name"
                  style={{
                    color: ACTION_COLORS[t.pickedActionName] ?? 'inherit',
                  }}
                >
                  {t.pickedActionName}
                </span>
                {t.pickedReport && (
                  <span className="turn-pick-report">{t.pickedReport}</span>
                )}
                {t.causedByTurn && (
                  <span
                    className="turn-cause-tag"
                    title={`This retaliate was queued by turn ${t.causedByTurn}`}
                  >
                    ← caused by T{t.causedByTurn}
                  </span>
                )}
                {t.queuedFor && (
                  <span
                    className="turn-queue-tag"
                    title={`Queued retaliate for ${nameOf(t.queuedFor.avenger)} against ${nameOf(t.queuedFor.bully)}`}
                  >
                    → queued retaliate for {nameOf(t.queuedFor.avenger)}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function nameOf(id: UID): string {
  return STAGE2_CHARACTERS.find((c) => c.id === id)?.name ?? id
}
