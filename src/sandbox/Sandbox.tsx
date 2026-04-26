import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadViv, type UID } from '../viv'
import {
  actionRecord,
  createInitialWorld,
  makeAdapter,
  snapshotCharacters,
  type ChronicleEntry,
  type EntityRecord,
  type WorldState,
} from './world'
import { HOST_BOOTSTRAP, STEP_LOOP } from './host-code'
import type { Stage } from './stages'

type TabId = 'sandbox' | 'viv' | 'host' | 'bundle'

interface SandboxProps {
  stage: Stage
}

// Stage-2 (and later) introduce optional/anywhere roles. We treat any
// returned action ID as a successful step regardless.

const TAB_LABELS: Record<TabId, string> = {
  sandbox: 'Sandbox',
  viv: 'Viv source',
  host: 'Host code',
  bundle: 'Compiled bundle',
}

export default function Sandbox({ stage }: SandboxProps) {
  const [tab, setTab] = useState<TabId>('sandbox')
  const [worldVersion, setWorldVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vivSrc, setVivSrc] = useState<string>('Loading...')
  const [bundleSrc, setBundleSrc] = useState<string>('Loading...')
  const [bundleReady, setBundleReady] = useState(false)
  const [turn, setTurn] = useState(0)

  const worldRef = useRef<WorldState>(
    createInitialWorld({ initialMood: stage.initialMood, withTavern: stage.withTavern }),
  )
  const initializedForStageRef = useRef<number | null>(null)

  // Re-init runtime when the stage changes.
  useEffect(() => {
    let cancelled = false
    setError(null)
    setBundleReady(false)
    setTurn(0)
    worldRef.current = createInitialWorld({
      initialMood: stage.initialMood,
      withTavern: stage.withTavern,
    })
    setWorldVersion((v) => v + 1)

    void (async () => {
      try {
        const [viv, srcText, bundleJson] = await Promise.all([
          loadViv(),
          fetch(stage.vivPath).then((r) => r.text()),
          fetch(stage.bundlePath).then((r) => r.json()),
        ])
        if (cancelled) return
        setVivSrc(srcText)
        setBundleSrc(JSON.stringify(bundleJson, null, 2))
        viv.initializeVivRuntime({
          contentBundle: bundleJson,
          adapter: makeAdapter(worldRef.current),
        })
        initializedForStageRef.current = stage.id
        setBundleReady(true)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [stage.id, stage.bundlePath, stage.vivPath, stage.initialMood, stage.withTavern])

  const reset = useCallback(() => {
    setError(null)
    setTurn(0)
    worldRef.current = createInitialWorld({
      initialMood: stage.initialMood,
      withTavern: stage.withTavern,
    })
    setWorldVersion((v) => v + 1)
    void (async () => {
      try {
        const viv = await loadViv()
        const bundleJson = JSON.parse(bundleSrc)
        viv.initializeVivRuntime({
          contentBundle: bundleJson,
          adapter: makeAdapter(worldRef.current),
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
  }, [bundleSrc, stage.initialMood, stage.withTavern])

  const step = useCallback(
    async (n = 1) => {
      if (!bundleReady || busy) return
      setBusy(true)
      setError(null)
      try {
        const viv = await loadViv()
        const world = worldRef.current
        for (let i = 0; i < n; i++) {
          const cid = world.characters[(turn + i) % world.characters.length] as UID
          const before = snapshotCharacters(world)
          const actionID = await viv.selectAction({ initiatorID: cid })
          if (actionID) {
            const rec = actionRecord(world, actionID)
            const entry: ChronicleEntry = {
              actionID,
              actionName: String((rec as { name?: string } | undefined)?.name ?? '?'),
              initiatorID: cid,
              timestamp: world.timestamp,
              report: String(
                (rec as { report?: string; gloss?: string } | undefined)?.report ??
                  (rec as { gloss?: string } | undefined)?.gloss ??
                  '(no description)',
              ),
            }
            world.chronicle.push(entry)
          } else {
            world.chronicle.push({
              actionID: '',
              actionName: '(none)',
              initiatorID: cid,
              timestamp: world.timestamp,
              report: `${nameOf(world.entities[cid])} stares into the middle distance.`,
            })
          }
          // Advance simulated time after each character ticks once around.
          if ((turn + i + 1) % world.characters.length === 0) world.timestamp += 1
          // Suppress unused snapshot variable -- before is for future diff UI.
          void before
        }
        setTurn((t) => t + n)
        setWorldVersion((v) => v + 1)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [bundleReady, busy, turn],
  )

  const characters = useMemo(
    () => snapshotCharacters(worldRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [worldVersion],
  )

  const chronicle = worldRef.current.chronicle

  return (
    <div className="sandbox">
      <div className="sandbox-header">
        <div className="sandbox-tabs" role="tablist">
          {(Object.keys(TAB_LABELS) as TabId[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? 'tab active' : 'tab'}
              onClick={() => setTab(t)}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="sandbox-meta">
          <span className="badge">{stage.title}</span>
          <span className="dim"> introduces: {stage.introduces.join(', ')}</span>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="sandbox-body">
        {tab === 'sandbox' && (
          <SandboxView
            characters={characters}
            chronicle={chronicle}
            turn={turn}
            busy={busy}
            ready={bundleReady}
            onStep={() => step(1)}
            onStepRound={() => step(worldRef.current.characters.length)}
            onReset={reset}
            timestamp={worldRef.current.timestamp}
            stage={stage}
          />
        )}
        {tab === 'viv' && <CodeView text={vivSrc} lang="viv" />}
        {tab === 'host' && <CodeView text={`${HOST_BOOTSTRAP}\n${STEP_LOOP}`} lang="ts" />}
        {tab === 'bundle' && <CodeView text={bundleSrc} lang="json" />}
      </div>
    </div>
  )
}

interface SandboxViewProps {
  characters: EntityRecord[]
  chronicle: ChronicleEntry[]
  turn: number
  busy: boolean
  ready: boolean
  timestamp: number
  stage: Stage
  onStep: () => void
  onStepRound: () => void
  onReset: () => void
}

function SandboxView({
  characters,
  chronicle,
  turn,
  busy,
  ready,
  timestamp,
  stage,
  onStep,
  onStepRound,
  onReset,
}: SandboxViewProps) {
  const nextCid = characters[turn % characters.length]?.id
  const nextName = nextCid ? nameOf(characters[turn % characters.length]) : '?'

  return (
    <div className="sandbox-grid">
      <div className="panel">
        <h4>
          State <span className="dim">@ T={timestamp}</span>
        </h4>
        <table className="state-table">
          <thead>
            <tr>
              <th>Character</th>
              <th>Mood</th>
              {stage.withTavern && <th>Tipsy</th>}
              <th>Memories</th>
            </tr>
          </thead>
          <tbody>
            {characters.map((c) => (
              <tr key={String(c.id)}>
                <td>
                  <strong>{nameOf(c)}</strong>
                </td>
                <td className={moodClass(c.mood as number | undefined)}>
                  {(c.mood as number | undefined) ?? 0}
                </td>
                {stage.withTavern && <td>{(c.tipsy as number | undefined) ?? 0}</td>}
                <td className="dim">{Object.keys((c.memories as object) ?? {}).length}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="controls">
          <button onClick={onStep} disabled={!ready || busy}>
            Step ({nextName}'s turn)
          </button>
          <button onClick={onStepRound} disabled={!ready || busy}>
            Step round
          </button>
          <button onClick={onReset} disabled={busy} className="ghost">
            Reset
          </button>
        </div>
      </div>

      <div className="panel">
        <h4>
          Chronicle <span className="dim">({chronicle.length})</span>
        </h4>
        {chronicle.length === 0 && (
          <p className="dim">
            No actions yet. Press <em>Step</em> to let {nextName} try something.
          </p>
        )}
        <ol className="chronicle">
          {chronicle.map((c, i) => (
            <li key={i} className={c.actionName === '(none)' ? 'no-action' : undefined}>
              <span className="ts">[T={c.timestamp}]</span>{' '}
              <span className="action-name">{c.actionName}</span>{' '}
              <span className="report">{c.report}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function CodeView({ text, lang }: { text: string; lang: string }) {
  return (
    <pre className={`code lang-${lang}`}>
      <code>{text}</code>
    </pre>
  )
}

function nameOf(e: EntityRecord | undefined): string {
  return String(e?.name ?? e?.id ?? '?')
}

function moodClass(m?: number): string {
  if (m === undefined) return 'dim'
  if (m > 6) return 'mood mood-up'
  if (m > 0) return 'mood mood-mid'
  if (m < -6) return 'mood mood-down'
  if (m < 0) return 'mood mood-meh'
  return 'mood'
}
