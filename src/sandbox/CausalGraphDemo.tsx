import { useMemo, useState } from 'react'
import {
  buildChronicle,
  getStorylines,
  METHOD_COLOR,
  METHOD_LABEL,
  type CauseMethod,
  type ChronicleEvent,
  type StepRef,
  type Storyline,
  type StorylineEdge,
} from './causal-data'

// ── Main component ─────────────────────────────────────────────────────────

export default function CausalGraphDemo() {
  const [seed, setSeed] = useState(0)
  const [showCauses, setShowCauses] = useState(false)
  const [showDiagram, setShowDiagram] = useState(false)

  const chronicle = useMemo(() => buildChronicle(seed), [seed])
  const storylines = useMemo(() => getStorylines(chronicle), [chronicle])

  const reroll = () => {
    setSeed((s) => s + 1)
    setShowCauses(false)
    setShowDiagram(false)
  }

  return (
    <div className="causal-demo">
      <header className="causal-demo-head">
        <div className="causal-demo-controls">
          <button className="ghost" onClick={reroll}>
            ↺ Reroll characters
          </button>
          <button
            className={showCauses ? 'causal-btn-active' : ''}
            onClick={() => {
              setShowCauses((v) => !v)
              if (showCauses) setShowDiagram(false)
            }}
          >
            {showCauses ? 'Hide' : 'Reveal'} causal links
          </button>
          {showCauses && (
            <button
              className={showDiagram ? 'causal-btn-active' : ''}
              onClick={() => setShowDiagram((v) => !v)}
            >
              {showDiagram ? 'Hide' : 'Show'} sifting diagram
            </button>
          )}
        </div>

        {showCauses && <MethodLegend />}
      </header>

      <div className="causal-chronicle">
        {chronicle.map((ev) => (
          <ChronicleStrip key={ev.step} ev={ev} showCauses={showCauses} chronicle={chronicle} />
        ))}
      </div>

      {showDiagram && (
        <SiftingMatchDiagram chronicle={chronicle} storylines={storylines} />
      )}
    </div>
  )
}

// ── Method legend ──────────────────────────────────────────────────────────

function MethodLegend() {
  const methods: CauseMethod[] = ['action-role', 'reaction', 'knowledge-relay', 'inscription']
  return (
    <div className="method-legend">
      {methods.map((m) => (
        <span key={m} className="method-legend-item">
          <span className="method-dot" style={{ background: METHOD_COLOR[m] }} />
          {METHOD_LABEL[m]}
        </span>
      ))}
    </div>
  )
}

// ── Chronicle strips ───────────────────────────────────────────────────────

function ChronicleStrip({
  ev,
  showCauses,
  chronicle,
}: {
  ev: ChronicleEvent
  showCauses: boolean
  chronicle: ChronicleEvent[]
}) {
  const hasCauses = ev.causes.length > 0

  return (
    <div className={`causal-strip${hasCauses && showCauses ? ' causal-strip-linked' : ''}`}>
      <div className="causal-strip-main">
        <span className="causal-strip-ts">t{String(ev.step).padStart(2, '0')}</span>
        <span className="causal-strip-action">{ev.action}</span>
        <span className="causal-strip-report">{ev.report}</span>
      </div>
      {showCauses && hasCauses && (
        <div className="causal-causes-row">
          {ev.causes.map((c, i) => {
            const origin = chronicle.find((x) => x.step === c.causeStep)
            return (
              <span
                key={i}
                className="method-tag"
                style={{
                  borderColor: METHOD_COLOR[c.method],
                  color: METHOD_COLOR[c.method],
                }}
              >
                <span className="method-tag-arrow">←</span>
                <span className="method-tag-ref">
                  {origin?.action ?? '?'} t{c.causeStep}
                </span>
                <span className="method-tag-kind">{METHOD_LABEL[c.method]}</span>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Sifting match diagram ─────────────────────────────────────────────────
//
// constructSiftingMatchDiagram: given a sifting pattern (a named narrative
// shape with roles and required causal links) and the causal graph, produce a
// diagram that shows which chronicle events match each role.
//
// Here we render three patterns side by side.  All three share write-note(t02)
// as their "source event" role, which is what produces the interlocking look:
// one event in the flat chronicle turns out to be the root of three distinct
// storyline arcs.

function SiftingMatchDiagram({
  chronicle,
  storylines,
}: {
  chronicle: ChronicleEvent[]
  storylines: Storyline[]
}) {
  const root = chronicle.find((e) => e.step === 2)!
  const converge = chronicle.find((e) => e.step === 19)!

  return (
    <div className="sifting-diagram">
      <h4 className="sifting-title">Sifting match diagram</h4>
      <p className="sifting-desc">
        Three sifting patterns applied to the causal graph above — each one extracting
        a different storyline from the same{' '}
        <code>write-note</code> event at the root.
      </p>

      {/* Shared root */}
      <div className="sifting-root-row">
        <div className="sifting-root-node">
          <span className="sifting-node-step">t{root.step.toString().padStart(2, '0')}</span>
          <span className="sifting-node-action">{root.action}</span>
          <span className="sifting-node-report">{root.report}</span>
          <span className="sifting-root-label">shared root</span>
        </div>
      </div>

      {/* Branch connectors */}
      <div className="sifting-branch-connectors">
        {storylines.map((sl) => (
          <div key={sl.name} className="sifting-branch-connector">
            <div
              className="sifting-branch-line"
              style={{ borderColor: sl.color }}
            />
            <span className="sifting-branch-method" style={{ color: sl.color }}>
              {METHOD_LABEL[sl.method]}
              {sl.edges[0]?.viaLabel && (
                <span className="sifting-branch-via"> ({sl.edges[0].viaLabel})</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Storyline columns */}
      <div className="sifting-columns">
        {storylines.map((sl) => (
          <StorylineColumn key={sl.name} storyline={sl} chronicle={chronicle} />
        ))}
      </div>

      {/* Convergence */}
      <div className="sifting-converge-row">
        <div className="sifting-converge-note">
          storylines 1 &amp; 2 converge →
        </div>
        <div className="sifting-converge-node">
          <span className="sifting-node-step">t{converge.step.toString().padStart(2, '0')}</span>
          <span className="sifting-node-action">{converge.action}</span>
          <span className="sifting-node-report">{converge.report}</span>
        </div>
      </div>
    </div>
  )
}

function StorylineColumn({
  storyline,
  chronicle,
}: {
  storyline: Storyline
  chronicle: ChronicleEvent[]
}) {
  // Skip the first node (write-note, step 2) — it's rendered as the shared root above.
  const nodes = storyline.nodes.slice(1)
  const edges = storyline.edges.slice(1)  // edges within the column (after the opening edge)

  return (
    <div className="sifting-column" style={{ borderColor: storyline.color }}>
      <div
        className="sifting-column-header"
        style={{ background: storyline.color + '18', borderBottomColor: storyline.color + '40' }}
      >
        <span className="sifting-column-name" style={{ color: storyline.color }}>
          {storyline.name}
        </span>
        <span className="sifting-column-desc">{storyline.description}</span>
      </div>

      <div className="sifting-column-body">
        {nodes.map((node, i) => {
          const ev = chronicle.find((e) => e.step === node.step)!
          const edge: StorylineEdge | undefined = edges[i - 1]

          return (
            <div key={node.step}>
              {edge && (
                <EdgeConnector edge={edge} />
              )}
              <StorylineEventNode
                node={node}
                ev={ev}
                accentColor={storyline.color}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StorylineEventNode({
  node,
  ev,
  accentColor,
}: {
  node: StepRef
  ev: ChronicleEvent
  accentColor: string
}) {
  return (
    <div
      className="sifting-event-node"
      style={{ borderColor: accentColor + '55' }}
    >
      <span className="sifting-node-step">t{node.step.toString().padStart(2, '0')}</span>
      <span className="sifting-node-action">{node.action}</span>
      <span className="sifting-node-report">{ev.report}</span>
    </div>
  )
}

function EdgeConnector({ edge }: { edge: StorylineEdge }) {
  const color = METHOD_COLOR[edge.method]
  return (
    <div className="sifting-edge-connector">
      <div className="sifting-edge-line" style={{ borderColor: color }} />
      <span className="sifting-edge-label" style={{ color }}>
        {METHOD_LABEL[edge.method]}
        {edge.viaLabel && <span className="sifting-edge-via"> ({edge.viaLabel})</span>}
      </span>
      <div className="sifting-edge-line" style={{ borderColor: color }} />
    </div>
  )
}
