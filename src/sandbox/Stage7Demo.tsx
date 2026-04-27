import { useEffect, useRef, useState } from 'react'
import { loadViv, type SiftingMatch, type UID } from '../viv'
import {
  actionRecord,
  createStage3World,
  makeAdapter,
  STAGE2_CHARACTERS,
} from './world'

// Stage 7: story sifting. We run a longer simulation (eight turns)
// to give the chronicle enough material, then run the comfort-arc
// sifting pattern over it. Pattern roles are unique entities, so
// for our 3-char world there are six (target, teaser, comforter)
// permutations -- we iterate them and let the runtime tell us which
// ones actually correspond to a story in the chronicle.

const STAGE7_BUNDLE_PATH = `${import.meta.env.BASE_URL}bundles/stage7.json`

const TURN_INITIATORS: UID[] = [
  'alice', 'bob', 'carol',
  'alice', 'bob', 'carol',
  'alice', 'bob',
]

const ACTION_COLORS: Record<string, string> = {
  greet: '#7aa2f7',
  tease: '#f7768e',
  cheer_up: '#aa3bff',
}

interface ChronicleEntry {
  index: number // 1-based turn number for display
  actionID: UID
  actionName: string
  initiatorID: UID
  initiatorName: string
  targetID?: UID
  report: string
}

interface ComfortArc {
  // The character bindings for this match
  target: UID
  teaser: UID
  comforter: UID
  targetName: string
  teaserName: string
  comforterName: string
  // The action IDs for the tease + cheer_up that the runtime picked
  teaseActionID: UID
  comfortActionID: UID
  // Indices into the chronicle (1-based)
  teaseIdx: number
  comfortIdx: number
}

export default function Stage7Demo() {
  const bundleRef = useRef<Promise<unknown> | null>(null)
  const [chronicle, setChronicle] = useState<ChronicleEntry[]>([])
  const [arcs, setArcs] = useState<ComfortArc[]>([])
  const [vivErr, setVivErr] = useState<string | null>(null)
  const [vivReady, setVivReady] = useState(false)
  const [runId, setRunId] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (!bundleRef.current) {
          bundleRef.current = fetch(STAGE7_BUNDLE_PATH).then((r) => r.json())
        }
        const bundle = await bundleRef.current
        if (cancelled) return

        const world = createStage3World()
        const viv = await loadViv()
        viv.initializeVivRuntime({
          contentBundle: bundle as Record<string, unknown>,
          adapter: makeAdapter(world),
        })

        // Build the chronicle by running selectAction for each turn.
        const entries: ChronicleEntry[] = []
        for (let i = 0; i < TURN_INITIATORS.length; i++) {
          const initiator = TURN_INITIATORS[i]
          const actionID = await viv.selectAction({ initiatorID: initiator })
          if (cancelled) return
          if (!actionID) continue
          const rec = actionRecord(world, actionID) as
            | {
                name?: string
                report?: string
                bindings?: Record<string, UID[]>
              }
            | undefined
          const name = String(rec?.name ?? '?')
          entries.push({
            index: entries.length + 1,
            actionID,
            actionName: name,
            initiatorID: initiator,
            initiatorName: nameOf(initiator),
            targetID: pickedTargetFrom(rec, name),
            report: String(rec?.report ?? ''),
          })
        }

        // Run the comfort-arc pattern for every (target, teaser,
        // comforter) permutation of distinct characters. The runtime
        // returns one match per call; iterating gives us up to one
        // story per character triple.
        const tuples = enumerateCharacterTuples()
        const collected: ComfortArc[] = []
        for (const t of tuples) {
          let match: SiftingMatch | null = null
          try {
            match = await viv.runSiftingPattern({
              patternName: 'comfort-arc',
              precastBindings: {
                target: [t.target],
                teaser: [t.teaser],
                comforter: [t.comforter],
              },
            })
          } catch {
            // Skip permutations the runtime rejects (shouldn't happen
            // with valid character IDs, but be defensive).
            match = null
          }
          if (cancelled) return
          if (!match) continue
          const teaseID = match['the-tease']?.[0]
          const comfortID = match['the-comfort']?.[0]
          if (!teaseID || !comfortID) continue
          const teaseIdx = entries.findIndex((e) => e.actionID === teaseID)
          const comfortIdx = entries.findIndex((e) => e.actionID === comfortID)
          if (teaseIdx < 0 || comfortIdx < 0) continue
          collected.push({
            target: t.target,
            teaser: t.teaser,
            comforter: t.comforter,
            targetName: nameOf(t.target),
            teaserName: nameOf(t.teaser),
            comforterName: nameOf(t.comforter),
            teaseActionID: teaseID,
            comfortActionID: comfortID,
            teaseIdx: teaseIdx + 1,
            comfortIdx: comfortIdx + 1,
          })
        }

        if (cancelled) return
        setVivReady(true)
        setChronicle(entries)
        setArcs(collected)
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

  // For each chronicle entry, the set of arc numbers it participates in.
  const arcMembership = new Map<UID, number[]>()
  arcs.forEach((arc, k) => {
    const num = k + 1
    for (const id of [arc.teaseActionID, arc.comfortActionID]) {
      const list = arcMembership.get(id) ?? []
      list.push(num)
      arcMembership.set(id, list)
    }
  })

  return (
    <div className="algo-demo">
      <header className="algo-demo-head">
        <div className="algo-controls">
          <button
            type="button"
            className="ghost"
            onClick={reroll}
            disabled={!vivReady}
            title="Re-run the eight turns and re-sift"
          >
            Reroll 8 turns
          </button>
        </div>
      </header>

      {vivErr && <div className="error">{vivErr}</div>}

      <div className="sift-grid">
        <section className="sift-panel">
          <h4>
            Chronicle <span className="dim">({chronicle.length})</span>
          </h4>
          {chronicle.length === 0 ? (
            <p className="dim">Loading...</p>
          ) : (
            <ol className="chronicle-numbered">
              {chronicle.map((c) => {
                const tags = arcMembership.get(c.actionID) ?? []
                return (
                  <li key={c.index} className="chronicle-numbered-row">
                    <span className="chron-num">{c.index}</span>
                    <span
                      className="strip-action"
                      style={{
                        color: ACTION_COLORS[c.actionName] ?? 'inherit',
                        background: 'transparent',
                      }}
                    >
                      {c.actionName}
                    </span>
                    <span className="chron-report">{c.report}</span>
                    {tags.length > 0 && (
                      <span className="chron-arc-tags">
                        {tags.map((n) => (
                          <span
                            key={n}
                            className="chron-arc-tag"
                            title={`Part of comfort-arc #${n}`}
                          >
                            arc {n}
                          </span>
                        ))}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        <section className="sift-panel">
          <h4>
            Comfort-arc matches <span className="dim">({arcs.length})</span>
          </h4>
          {chronicle.length === 0 ? (
            <p className="dim">Loading...</p>
          ) : arcs.length === 0 ? (
            <p className="dim">
              No comfort-arc emerged in this run. Reroll to sample again.
            </p>
          ) : (
            <ul className="arc-list">
              {arcs.map((arc, k) => {
                const num = k + 1
                const teaseEntry = chronicle.find(
                  (c) => c.actionID === arc.teaseActionID,
                )
                const comfortEntry = chronicle.find(
                  (c) => c.actionID === arc.comfortActionID,
                )
                return (
                  <li key={k} className="arc-card">
                    <div className="arc-card-head">
                      <span className="arc-card-num">arc {num}</span>
                      <span className="arc-card-tag">
                        target: <strong>{arc.targetName}</strong>
                      </span>
                    </div>
                    <div className="arc-card-body">
                      <div
                        className="arc-step"
                        style={{ borderColor: ACTION_COLORS.tease }}
                      >
                        <div className="arc-step-head">
                          <span
                            className="arc-step-num"
                            style={{ background: ACTION_COLORS.tease }}
                          >
                            {arc.teaseIdx}
                          </span>
                          <span
                            className="arc-step-name"
                            style={{ color: ACTION_COLORS.tease }}
                          >
                            tease
                          </span>
                        </div>
                        <div className="arc-step-report">
                          {teaseEntry?.report}
                        </div>
                      </div>
                      <div className="arc-step-arrow" aria-hidden="true">
                        ↓
                      </div>
                      <div
                        className="arc-step"
                        style={{ borderColor: ACTION_COLORS.cheer_up }}
                      >
                        <div className="arc-step-head">
                          <span
                            className="arc-step-num"
                            style={{ background: ACTION_COLORS.cheer_up }}
                          >
                            {arc.comfortIdx}
                          </span>
                          <span
                            className="arc-step-name"
                            style={{ color: ACTION_COLORS.cheer_up }}
                          >
                            cheer_up
                          </span>
                        </div>
                        <div className="arc-step-report">
                          {comfortEntry?.report}
                        </div>
                      </div>
                    </div>
                    <div className="arc-card-cast">
                      <span className="arc-cast-pill">
                        <span className="arc-cast-role">@teaser</span>
                        {arc.teaserName}
                      </span>
                      <span className="arc-cast-pill">
                        <span className="arc-cast-role">@target</span>
                        {arc.targetName}
                      </span>
                      <span className="arc-cast-pill">
                        <span className="arc-cast-role">@comforter</span>
                        {arc.comforterName}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function nameOf(id: UID): string {
  return STAGE2_CHARACTERS.find((c) => c.id === id)?.name ?? id
}

function enumerateCharacterTuples(): Array<{
  target: UID
  teaser: UID
  comforter: UID
}> {
  const ids = STAGE2_CHARACTERS.map((c) => c.id)
  const out: Array<{ target: UID; teaser: UID; comforter: UID }> = []
  for (const target of ids) {
    for (const teaser of ids) {
      if (teaser === target) continue
      for (const comforter of ids) {
        if (comforter === target || comforter === teaser) continue
        out.push({ target, teaser, comforter })
      }
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
