import { useEffect, useRef, useState } from 'react'
import { loadViv, type ContentBundle, type UID } from '../viv'
import {
  actionRecord,
  createStage14World,
  makeAdapter,
  STAGE14_BEER_IDS,
  STAGE2_CHARACTERS,
  type WorldState,
} from './world'

const STAGE14_BUNDLE_PATH = `${import.meta.env.BASE_URL}bundles/stage14.json`

const ROTATION: UID[] = ['alice', 'bob', 'carol']

const ACTION_COLORS: Record<string, string> = {
  greet: '#7aa2f7',
  'buy-beer': '#f59e0b',
  'give-beer': '#a78bfa',
  'drink-beer': '#f87171',
}

interface ChronicleItem {
  index: number
  actionID: UID
  actionName: string
  report: string
  beerID?: UID
}

interface BeerState {
  id: UID
  held: boolean
  // flash class for animation trigger
  flashKey: number
}

interface CharState {
  id: UID
  name: string
  beers: number
}

const CHAR_NAMES: Record<UID, string> = Object.fromEntries(
  STAGE2_CHARACTERS.map((c) => [c.id, c.name]),
)

function beerLabel(id: string) {
  const n = id.replace('beer-', '')
  return `Beer ${n}`
}

function syncBeers(world: WorldState, prev: BeerState[]): BeerState[] {
  return STAGE14_BEER_IDS.map((id, i) => {
    const ent = world.entities[id]
    const held = ent?.held === true
    const prevHeld = prev[i]?.held ?? false
    return { id, held, flashKey: held !== prevHeld ? (prev[i]?.flashKey ?? 0) + 1 : (prev[i]?.flashKey ?? 0) }
  })
}

function syncChars(world: WorldState): CharState[] {
  return STAGE2_CHARACTERS.map((c) => ({
    id: c.id,
    name: c.name,
    beers: Number(world.entities[c.id]?.beers ?? 0),
  }))
}

export default function Stage14Demo() {
  const bundleRef = useRef<ContentBundle | null>(null)
  const worldRef = useRef<WorldState>(createStage14World())
  const chronicleRef = useRef<ChronicleItem[]>([])
  const [vivReady, setVivReady] = useState(false)
  const [vivErr, setVivErr] = useState<string | null>(null)
  const [chronicle, setChronicle] = useState<ChronicleItem[]>([])
  const [beers, setBeers] = useState<BeerState[]>(() =>
    STAGE14_BEER_IDS.map((id) => ({ id, held: false, flashKey: 0 })),
  )
  const [chars, setChars] = useState<CharState[]>(() =>
    STAGE2_CHARACTERS.map((c) => ({ id: c.id, name: c.name, beers: 0 })),
  )
  const [turn, setTurn] = useState(0)
  const [busy, setBusy] = useState(false)

  const applyState = (next: ChronicleItem[]) => {
    chronicleRef.current = next
    setChronicle(next)
    setBeers((prev) => syncBeers(worldRef.current, prev))
    setChars(syncChars(worldRef.current))
  }

  const bindRuntime = async () => {
    const viv = await loadViv()
    let bundle = bundleRef.current
    if (!bundle) {
      bundle = (await fetch(STAGE14_BUNDLE_PATH).then((r) => r.json())) as ContentBundle
      bundleRef.current = bundle
    }
    viv.initializeVivRuntime({ contentBundle: bundle, adapter: makeAdapter(worldRef.current) })
    return viv
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await bindRuntime()
        if (cancelled) return
        setVivReady(true)
        applyState([])
      } catch (e) {
        if (cancelled) return
        setVivErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => { cancelled = true }
  }, [])

  const reset = async () => {
    if (busy) return
    worldRef.current = createStage14World()
    try {
      await bindRuntime()
      setTurn(0)
      applyState([])
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
          | { name?: string; report?: string; bindings?: Record<string, UID[]> }
          | undefined
        const beerID = rec?.bindings?.beer?.[0]
        next = [
          ...prev,
          {
            index: prev.length + 1,
            actionID,
            actionName: String(rec?.name ?? '?'),
            report: String(rec?.report ?? ''),
            beerID,
          },
        ]
      } else {
        next = [
          ...prev,
          { index: prev.length + 1, actionID: '', actionName: '(none)', report: '(no action eligible)' },
        ]
      }

      setTurn((t) => t + 1)
      applyState(next)
    } catch (e) {
      setVivErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const nextInitiator = ROTATION[turn % ROTATION.length]

  return (
    <div className="algo-demo inv-demo">
      {vivErr && <div className="error">{vivErr}</div>}

      <header className="algo-demo-head">
        <div className="algo-controls">
          <span className="dim">
            Next up: <strong>{CHAR_NAMES[nextInitiator]}</strong>{' '}
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
      </header>

      <div className="inv-layout">
        {/* Left: beer rack + chronicle */}
        <div className="inv-left">
          <div className="beer-rack">
            <div className="beer-rack-label">Bar stock</div>
            <div className="beer-rack-items">
              {beers.map((b) => (
                <div
                  key={b.id}
                  className={`beer-card ${b.held ? 'beer-held' : 'beer-free'}`}
                  data-flash={b.flashKey}
                >
                  <span className="beer-icon" aria-hidden="true" />
                  <span className="beer-name">{beerLabel(b.id)}</span>
                  <span className="beer-status">{b.held ? 'held' : 'free'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="chronicle-panel" style={{ marginTop: 14 }}>
            <h4>
              Chronicle <span className="dim">({chronicle.length})</span>
            </h4>
            {chronicle.length === 0 ? (
              <p className="dim">Step some turns to see actions fire.</p>
            ) : (
              <ul className="chronicle-pile">
                {chronicle.map((c) => (
                  <li key={c.index} className="strip">
                    <span className="strip-idx dim">T{c.index}</span>
                    <span
                      className="strip-action"
                      style={{ color: ACTION_COLORS[c.actionName] ?? 'inherit' }}
                    >
                      {c.actionName}
                    </span>
                    <span className="strip-report">{c.report}</span>
                    {c.beerID && (
                      <span className="inv-item-tag" title={`item role @beer cast to ${c.beerID}`}>
                        @beer: {beerLabel(c.beerID)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: character inventories */}
        <div className="inv-right">
          <h4>Inventories</h4>
          <p className="dim memory-blurb">
            Each character's beer count. <code>buy-beer</code> and{' '}
            <code>drink-beer</code> cast an item into <code>@beer</code> and
            change its <code>held</code> property alongside the character
            counter. <code>give-beer</code> transfers between character counts
            with no item role needed.
          </p>
          <div className="inv-char-list">
            {chars.map((c) => (
              <div key={c.id} className="inv-char-row">
                <span className="inv-char-name">{c.name}</span>
                <div className="inv-pips">
                  {c.beers === 0 ? (
                    <span className="inv-empty dim">none</span>
                  ) : (
                    Array.from({ length: c.beers }, (_, i) => (
                      <span key={i} className="inv-pip" aria-label="beer" />
                    ))
                  )}
                </div>
                <span className="inv-count dim">{c.beers}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
