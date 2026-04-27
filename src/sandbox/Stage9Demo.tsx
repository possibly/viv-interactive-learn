import { useEffect, useRef, useState } from 'react'
import { loadViv, type SiftingMatch, type UID } from '../viv'
import {
  actionRecord,
  createStage3World,
  makeAdapter,
  STAGE2_CHARACTERS,
} from './world'

// Stage 9: memory and salience.
//
// We run the same 10-turn sim as before, but the runtime now also
// hands each active character a memory record per action they took
// part in. Salience varies per role -- being teased registers
// stronger than teasing somebody else, etc.
//
// We render three columns (one per character) showing each
// character's memory book, plus a side panel that runs the
// comfort-arc sifting pattern globally and from each character's
// POV. POV sifts can return different matches than the global sift
// because a character's memory only contains actions they were
// actively involved in.

const STAGE9_BUNDLE_PATH = `${import.meta.env.BASE_URL}bundles/stage9.json`

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

interface MemoryRecord {
  action: UID // the action ID
  salience: number
  formationTimestamp: number
  associations: string[]
  forgotten?: boolean
}

interface MemoryItem {
  actionID: UID
  actionName: string
  report: string
  salience: number
  // Index in the chronicle (1-based), if the action was actually saved.
  chronicleIdx: number
}

interface ChronicleItem {
  index: number
  actionID: UID
  actionName: string
  report: string
}

interface PovMatch {
  pov: 'chronicle' | UID
  povName: string
  // The story, if found
  teaseIdx: number | null
  teaseReport: string | null
  comfortIdx: number | null
  comfortReport: string | null
  // True if the runtime returned a match
  matched: boolean
}

export default function Stage9Demo() {
  const bundleRef = useRef<Promise<unknown> | null>(null)
  const [chronicle, setChronicle] = useState<ChronicleItem[]>([])
  const [memoryByChar, setMemoryByChar] = useState<Record<UID, MemoryItem[]>>({})
  const [matches, setMatches] = useState<PovMatch[]>([])
  const [vivErr, setVivErr] = useState<string | null>(null)
  const [vivReady, setVivReady] = useState(false)
  const [runId, setRunId] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (!bundleRef.current) {
          bundleRef.current = fetch(STAGE9_BUNDLE_PATH).then((r) => r.json())
        }
        const bundle = await bundleRef.current
        if (cancelled) return

        const world = createStage3World()
        const viv = await loadViv()
        viv.initializeVivRuntime({
          contentBundle: bundle as Record<string, unknown>,
          adapter: makeAdapter(world),
        })

        const built: ChronicleItem[] = []
        for (let i = 0; i < TURN_INITIATORS.length; i++) {
          const aid = await viv.selectAction({ initiatorID: TURN_INITIATORS[i] })
          if (cancelled) return
          if (!aid) continue
          const rec = actionRecord(world, aid) as
            | { name?: string; report?: string }
            | undefined
          built.push({
            index: built.length + 1,
            actionID: aid,
            actionName: String(rec?.name ?? '?'),
            report: String(rec?.report ?? ''),
          })
        }
        if (cancelled) return

        const idxByActionID = new Map(built.map((c) => [c.actionID, c.index]))

        // Build memory views from the world state.
        const memByChar: Record<UID, MemoryItem[]> = {}
        for (const cid of world.characters) {
          const ent = world.entities[cid]
          const memMap = (ent.memories ?? {}) as Record<UID, MemoryRecord>
          const list: MemoryItem[] = []
          for (const [actionID, m] of Object.entries(memMap)) {
            const chronEntry = built.find((c) => c.actionID === actionID)
            if (!chronEntry) continue
            list.push({
              actionID,
              actionName: chronEntry.actionName,
              report: chronEntry.report,
              salience: typeof m.salience === 'number' ? m.salience : 0,
              chronicleIdx: idxByActionID.get(actionID) ?? 0,
            })
          }
          // Order by chronicle position so memory reads top-to-bottom.
          list.sort((a, b) => a.chronicleIdx - b.chronicleIdx)
          memByChar[cid] = list
        }

        // Run comfort-arc globally and per character POV.
        const povs: Array<'chronicle' | UID> = [
          'chronicle', ...world.characters,
        ]
        const out: PovMatch[] = []
        for (const pov of povs) {
          let m: SiftingMatch | null = null
          try {
            m = await viv.runSiftingPattern({
              patternName: 'comfort-arc',
              ...(pov !== 'chronicle' ? { searchDomain: pov } : {}),
            })
          } catch {
            m = null
          }
          if (cancelled) return
          const povName = pov === 'chronicle' ? 'Chronicle' : nameOf(pov)
          const teaseID = m?.['the-tease']?.[0]
          const comfortID = m?.['the-comfort']?.[0]
          const teaseEntry = teaseID
            ? built.find((c) => c.actionID === teaseID)
            : undefined
          const comfortEntry = comfortID
            ? built.find((c) => c.actionID === comfortID)
            : undefined
          // Treat a result as matched only if both action IDs resolve
          // in the chronicle we built. A dangling ID would render as
          // an empty "T" pill, which is just confusing.
          if (!m || !teaseEntry || !comfortEntry) {
            out.push({
              pov,
              povName,
              teaseIdx: null,
              teaseReport: null,
              comfortIdx: null,
              comfortReport: null,
              matched: false,
            })
            continue
          }
          out.push({
            pov,
            povName,
            teaseIdx: teaseEntry.index,
            teaseReport: teaseEntry.report,
            comfortIdx: comfortEntry.index,
            comfortReport: comfortEntry.report,
            matched: true,
          })
        }

        if (cancelled) return
        setVivReady(true)
        setChronicle(built)
        setMemoryByChar(memByChar)
        setMatches(out)
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

      <section className="memory-section">
        <h4>
          Chronicle <span className="dim">({chronicle.length})</span>
        </h4>
        {chronicle.length === 0 ? (
          <p className="dim">Loading...</p>
        ) : (
          <ol className="chronicle-numbered chronicle-compact">
            {chronicle.map((c) => (
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
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="memory-section">
        <h4>Each character's memory book</h4>
        <p className="dim memory-blurb">
          The runtime calls <code>saveCharacterMemory</code> once per
          actively-involved character per action. Salience comes from the
          action's <code>saliences</code> field, looked up by role.
        </p>
        <div className="memory-grid">
          {STAGE2_CHARACTERS.map((c) => {
            const mem = memoryByChar[c.id] ?? []
            return (
              <div key={c.id} className="memory-col">
                <div className="memory-col-head">
                  <strong>{c.name}</strong>
                  <span className="dim">
                    ({mem.length} {mem.length === 1 ? 'memory' : 'memories'})
                  </span>
                </div>
                {mem.length === 0 ? (
                  <p className="dim">No memories yet.</p>
                ) : (
                  <ul className="memory-list">
                    {mem.map((m) => (
                      <li key={m.actionID} className="memory-item">
                        <span className="memory-idx">T{m.chronicleIdx}</span>
                        <span
                          className="memory-action"
                          style={{
                            color: ACTION_COLORS[m.actionName] ?? 'inherit',
                          }}
                        >
                          {m.actionName}
                        </span>
                        <span className="memory-report">{m.report}</span>
                        <span
                          className="memory-salience"
                          title={`Salience for ${c.name}: ${m.salience}`}
                        >
                          ★ {m.salience}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="memory-section">
        <h4>Comfort-arc sifted from each POV</h4>
        <p className="dim memory-blurb">
          The global chronicle contains every action.{' '}
          <code>runSiftingPattern</code> with{' '}
          <code>searchDomain: characterID</code> restricts the sift to
          that character's memories -- so a comfort-arc can be visible
          to one character and not another.
        </p>
        <ul className="pov-list">
          {matches.map((m) => (
            <li
              key={m.pov}
              className={`pov-row${m.matched ? '' : ' pov-row-empty'}`}
            >
              <span className="pov-label">
                {m.pov === 'chronicle' ? (
                  <>
                    <span className="pov-tag pov-tag-global">global</span>
                    {m.povName}
                  </>
                ) : (
                  <>
                    <span className="pov-tag pov-tag-char">memory</span>
                    {m.povName}
                  </>
                )}
              </span>
              {m.matched ? (
                <span className="pov-match">
                  <span className="pov-step">
                    T{m.teaseIdx} <code>tease</code> {m.teaseReport}
                  </span>
                  <span className="pov-arrow" aria-hidden="true">
                    →
                  </span>
                  <span className="pov-step">
                    T{m.comfortIdx} <code>cheer_up</code> {m.comfortReport}
                  </span>
                </span>
              ) : (
                <span className="pov-empty dim">
                  no comfort-arc visible from this view
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function nameOf(id: UID): string {
  return STAGE2_CHARACTERS.find((c) => c.id === id)?.name ?? id
}
