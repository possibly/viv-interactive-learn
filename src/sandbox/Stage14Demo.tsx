import { useEffect, useRef, useState } from 'react'
import { loadViv, type ContentBundle, type UID } from '../viv'
import {
  actionRecord,
  createStage14World,
  makeAdapter,
  STAGE14_JOURNAL_ID,
  STAGE2_CHARACTERS,
  type WorldState,
} from './world'

// Stage 14: items — inscription and inspection.
//
// The demo shows three things happening in sequence as you step through turns:
//
//   1. Characters occasionally select write-in-journal, which appends the
//      action ID to the journal item's inscriptions list.
//
//   2. Clicking "Read journal" for a character fires a reserved read-journal
//      action (via attemptAction). The runtime runs `@reader inspect @journal`,
//      which copies all inscribed action IDs into the reader's memory book.
//
//   3. The "Knowledge" column shows, per character, which entries in their
//      memory book came from the journal vs. direct participation.

const STAGE14_BUNDLE_PATH = `${import.meta.env.BASE_URL}bundles/stage14.json`

const ROTATION: UID[] = ['alice', 'bob', 'carol']

const ACTION_COLORS: Record<string, string> = {
  greet: '#7aa2f7',
  'write-in-journal': '#f59e0b',
  'read-journal': '#34d399',
}

interface ChronicleItem {
  index: number
  actionID: UID
  actionName: string
  report: string
  initiatorID: UID
}

interface KnowledgeEntry {
  actionID: UID
  actionName: string
  report: string
  chronicleIndex: number
  source: 'wrote' | 'read' | 'witnessed'
}

const CHAR_NAMES: Record<UID, string> = Object.fromEntries(
  STAGE2_CHARACTERS.map((c) => [c.id, c.name]),
)

function nameOf(id: UID) {
  return CHAR_NAMES[id] ?? id
}

function buildKnowledge(
  world: WorldState,
  chron: ChronicleItem[],
  ins: UID[],
): Record<UID, KnowledgeEntry[]> {
  const indexByID = new Map(chron.map((c) => [c.actionID, c.index]))
  const kmap: Record<UID, KnowledgeEntry[]> = {}

  for (const char of STAGE2_CHARACTERS) {
    const ent = world.entities[char.id]
    const memMap = (ent?.memories ?? {}) as Record<UID, unknown>
    const entries: KnowledgeEntry[] = []

    for (const actionID of Object.keys(memMap)) {
      const chronEntry = chron.find((c) => c.actionID === actionID)
      if (!chronEntry) continue

      const rec = actionRecord(world, actionID) as
        | { bindings?: Record<string, UID[]> }
        | undefined
      const scribes = rec?.bindings?.scribe ?? []

      let source: KnowledgeEntry['source'] = 'witnessed'
      if (scribes.includes(char.id)) {
        source = 'wrote'
      } else if (ins.includes(actionID)) {
        source = 'read'
      }

      entries.push({
        actionID,
        actionName: chronEntry.actionName,
        report: chronEntry.report,
        chronicleIndex: indexByID.get(actionID) ?? 0,
        source,
      })
    }

    entries.sort((a, b) => a.chronicleIndex - b.chronicleIndex)
    kmap[char.id] = entries
  }

  return kmap
}

function readInscriptions(world: WorldState): UID[] {
  const journal = world.entities[STAGE14_JOURNAL_ID]
  return Array.isArray(journal?.inscriptions)
    ? (journal.inscriptions as UID[])
    : []
}

export default function Stage14Demo() {
  const bundleRef = useRef<ContentBundle | null>(null)
  const worldRef = useRef<WorldState>(createStage14World())
  const chronicleRef = useRef<ChronicleItem[]>([])
  const [vivReady, setVivReady] = useState(false)
  const [vivErr, setVivErr] = useState<string | null>(null)
  const [chronicle, setChronicle] = useState<ChronicleItem[]>([])
  const [inscriptions, setInscriptions] = useState<UID[]>([])
  const [knowledge, setKnowledge] = useState<Record<UID, KnowledgeEntry[]>>({})
  const [turn, setTurn] = useState(0)
  const [busy, setBusy] = useState(false)

  const applyChronicle = (next: ChronicleItem[]) => {
    chronicleRef.current = next
    const ins = readInscriptions(worldRef.current)
    setChronicle(next)
    setInscriptions(ins)
    setKnowledge(buildKnowledge(worldRef.current, next, ins))
  }

  const bindRuntime = async () => {
    const viv = await loadViv()
    let bundle = bundleRef.current
    if (!bundle) {
      bundle = (await fetch(STAGE14_BUNDLE_PATH).then((r) => r.json())) as ContentBundle
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
        applyChronicle([])
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
    worldRef.current = createStage14World()
    try {
      await bindRuntime()
      setTurn(0)
      applyChronicle([])
    } catch (e) {
      setVivErr(e instanceof Error ? e.message : String(e))
    }
  }

  const stepTurn = async () => {
    if (!vivReady || busy) return
    setBusy(true)
    try {
      const viv = await bindRuntime()
      const initiator = ROTATION[turn % ROTATION.length]
      const actionID = await viv.selectAction({ initiatorID: initiator })
      const prev = chronicleRef.current

      let next: ChronicleItem[]
      if (actionID) {
        const rec = actionRecord(worldRef.current, actionID) as
          | { name?: string; report?: string }
          | undefined
        next = [
          ...prev,
          {
            index: prev.length + 1,
            actionID,
            actionName: String(rec?.name ?? '?'),
            report: String(rec?.report ?? ''),
            initiatorID: initiator,
          },
        ]
      } else {
        next = [
          ...prev,
          {
            index: prev.length + 1,
            actionID: '',
            actionName: '(none)',
            report: '(no action eligible)',
            initiatorID: initiator,
          },
        ]
      }

      setTurn((t) => t + 1)
      applyChronicle(next)
    } catch (e) {
      setVivErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const readJournal = async (readerID: UID) => {
    if (!vivReady || busy) return
    setBusy(true)
    try {
      const viv = await bindRuntime()
      const actionID = await viv.attemptAction({
        actionName: 'read-journal',
        initiatorID: readerID,
        precastBindings: {
          reader: [readerID],
          journal: [STAGE14_JOURNAL_ID],
        },
      })
      if (!actionID) return
      const rec = actionRecord(worldRef.current, actionID) as
        | { name?: string; report?: string }
        | undefined
      const prev = chronicleRef.current
      const next: ChronicleItem[] = [
        ...prev,
        {
          index: prev.length + 1,
          actionID,
          actionName: String(rec?.name ?? 'read-journal'),
          report: String(rec?.report ?? ''),
          initiatorID: readerID,
        },
      ]
      setTurn((t) => t + 1)
      applyChronicle(next)
    } catch (e) {
      setVivErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const nextInitiator = ROTATION[turn % ROTATION.length]

  return (
    <div className="algo-demo items-demo">
      {vivErr && <div className="error">{vivErr}</div>}

      <header className="algo-demo-head">
        <div className="algo-controls">
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
            disabled={busy || chronicle.length === 0}
          >
            Reset
          </button>
        </div>
        <div className="items-read-row">
          <span className="dim">Inspect the journal:</span>
          {STAGE2_CHARACTERS.map((c) => (
            <button
              key={c.id}
              type="button"
              className="items-read-btn"
              onClick={() => readJournal(c.id)}
              disabled={!vivReady || busy || inscriptions.length === 0}
              title={
                inscriptions.length === 0
                  ? 'Journal is empty — step some turns first'
                  : `${c.name} reads the journal, gaining memory of all inscribed actions`
              }
            >
              {c.name} reads
            </button>
          ))}
        </div>
        <p className="plan-tip dim">
          Step turns until <code>write-in-journal</code> fires — it inscribes the action
          onto the journal. Then click "<em>Name</em> reads" to transfer that knowledge to
          a character who wasn't there.
        </p>
      </header>

      <div className="items-layout">
        {/* Left: journal + chronicle */}
        <div className="items-left">
          <div className="item-card">
            <div className="item-card-head">
              <span className="item-tag">item</span>
              <strong>Tavern Journal</strong>
            </div>
            <div className="item-card-body">
              <div className="item-field-label">
                inscriptions
                <span className="item-count dim">({inscriptions.length})</span>
              </div>
              {inscriptions.length === 0 ? (
                <p className="dim item-empty">
                  Empty — no actions inscribed yet.
                </p>
              ) : (
                <ol className="item-inscriptions">
                  {inscriptions.map((aid, i) => {
                    const entry = chronicle.find((c) => c.actionID === aid)
                    return (
                      <li key={aid} className="inscription-row">
                        <span className="inscription-num">#{i + 1}</span>
                        <span className="inscription-idx dim">
                          T{entry?.index ?? '?'}
                        </span>
                        <span
                          className="inscription-name"
                          style={{
                            color:
                              ACTION_COLORS[entry?.actionName ?? ''] ?? 'inherit',
                          }}
                        >
                          {entry?.actionName ?? '?'}
                        </span>
                        <span className="inscription-report">
                          {entry?.report ?? ''}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
          </div>

          <div className="chronicle-panel" style={{ marginTop: 14 }}>
            <h4>
              Chronicle <span className="dim">({chronicle.length})</span>
            </h4>
            {chronicle.length === 0 ? (
              <p className="dim">Step some turns to build a chronicle.</p>
            ) : (
              <ul className="chronicle-pile">
                {chronicle.map((c) => (
                  <li key={c.index} className="strip">
                    <span className="strip-idx dim">T{c.index}</span>
                    <span
                      className="strip-action"
                      style={{
                        color: ACTION_COLORS[c.actionName] ?? 'inherit',
                      }}
                    >
                      {c.actionName}
                    </span>
                    <span className="strip-report">{c.report}</span>
                    {c.actionName === 'write-in-journal' && (
                      <span className="items-tag items-tag-inscribed">inscribed</span>
                    )}
                    {c.actionName === 'read-journal' && (
                      <span className="items-tag items-tag-read">inspected</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: per-character knowledge */}
        <div className="items-right">
          <h4>Character knowledge</h4>
          <p className="dim memory-blurb">
            Each character's memory book, annotated with how they learned about each
            action.{' '}
            <span className="items-source-badge items-source-wrote">wrote it</span>{' '}
            = inscribed via participation.{' '}
            <span className="items-source-badge items-source-read">via journal</span>{' '}
            = transferred by inspection.
          </p>
          <div className="items-char-grid">
            {STAGE2_CHARACTERS.map((c) => {
              const entries = knowledge[c.id] ?? []
              return (
                <div key={c.id} className="memory-col">
                  <div className="memory-col-head">
                    <strong>{c.name}</strong>
                    <span className="dim">
                      {entries.length}{' '}
                      {entries.length === 1 ? 'memory' : 'memories'}
                    </span>
                  </div>
                  {entries.length === 0 ? (
                    <p className="dim" style={{ fontSize: 12 }}>
                      No memories yet.
                    </p>
                  ) : (
                    <ul className="memory-list">
                      {entries.map((e) => (
                        <li
                          key={e.actionID}
                          className="memory-item items-memory-item"
                        >
                          <span className="memory-idx">T{e.chronicleIndex}</span>
                          <span
                            className="memory-action"
                            style={{
                              color: ACTION_COLORS[e.actionName] ?? 'inherit',
                            }}
                          >
                            {e.actionName}
                          </span>
                          <span className="memory-report">{e.report}</span>
                          <span
                            className={`items-source-badge items-source-${e.source}`}
                            title={
                              e.source === 'wrote'
                                ? 'Inscribed directly by this character'
                                : e.source === 'read'
                                  ? 'Transferred via journal inspection'
                                  : 'Direct participation'
                            }
                          >
                            {e.source === 'wrote'
                              ? 'wrote it'
                              : e.source === 'read'
                                ? 'via journal'
                                : 'witnessed'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
