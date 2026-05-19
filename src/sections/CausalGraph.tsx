import CausalGraphDemo from '../sandbox/CausalGraphDemo'
import { HighlightedViv } from '../sandbox/highlight'

interface Props {
  source: string
}

export default function CausalGraph({ source }: Props) {
  return (
    <>
      <section className="prose" id="causal-graph">
        <h2>How the chronicle becomes a causal graph</h2>
        <p>
          The previous section mentioned that action records now carry a{' '}
          <code>causes</code> field. That field is what turns the chronicle
          from a flat list into a directed graph: each event points back to
          the event (or events) that caused it, and the runtime builds those
          links automatically.
        </p>
        <p>
          The runtime builds causal links through four mechanisms. Together
          they are what produces the <em>interlocking storylines</em> aesthetic:
          the same flat chronicle, sifted with different patterns, yields
          multiple distinct narrative arcs.
        </p>

        <h3>1 — Action roles</h3>
        <p>
          When an action casts a past action's output — an item, a location —
          in one of its roles, the runtime records the producer action as a
          cause automatically. In the example below, <code>read-note</code>{' '}
          casts the note item as <code>@note</code>. Because the note was
          produced by <code>write-note</code>, that action becomes a cause
          of <code>read-note</code> with nothing extra declared in the source.
        </p>

        <h3>2 — Reactions</h3>
        <p>
          Any action can declare a <code>reactions</code> block that queues
          follow-up actions. When the runtime fires a reaction, the triggering
          action is always recorded as a cause of the queued one. Long
          reaction chains — confront triggers apologize, apologize triggers
          forgive — all trace back through the causal graph to the event that
          started the chain.
        </p>

        <h3>3 — Knowledge relaying</h3>
        <p>
          A <code>relay</code> directive lets one action carry knowledge about
          an earlier event to a new audience. When that relayed knowledge
          triggers a reaction, <em>both</em> the relay action and the original
          event become causes of the resulting reaction. Two chronicle entries
          far apart in time can jointly cause a third.
        </p>

        <h3>4 — Inscription</h3>
        <p>
          An item can be inscribed with knowledge about an earlier action.
          When a character inspects that item and the inscription triggers a
          reaction, both the delivery action <em>and</em> the original action
          described by the inscription are recorded as causes. A long-past
          event can reach forward through an artefact and cause something new.
        </p>

        <p>
          A fifth mechanism —{' '}
          <strong>forced causes</strong> — lets the host application assert
          arbitrary causal links when it forcibly targets an action via{' '}
          <code>attemptAction</code>. This is an escape hatch for scripted
          events, cutscenes, or tutorial beats. It is not demonstrated here.
        </p>
      </section>

      <section className="prose">
        <h3>An interactive chronicle</h3>
        <p>
          Below is a 19-step chronicle from a small social world: a single
          gossip note seeds three separate causal chains. Hit{' '}
          <strong>Reroll characters</strong> to swap character names (the
          causal structure stays identical — the graph topology is independent
          of which specific character fills each role). Hit{' '}
          <strong>Reveal causal links</strong> to see which mechanism connects
          each event to its causes. Then hit{' '}
          <strong>Show sifting diagram</strong> to see all three storylines
          extracted side by side from the same flat chronicle.
        </p>
      </section>

      <CausalGraphDemo />

      <section className="prose">
        <h3>What the sifting diagram shows</h3>
        <p>
          All three storylines share a single <code>write-note</code> event at
          the root. One sifting pattern traces the direct confrontation through
          an action-role link. A second finds the relayed rumour through a
          knowledge-relay link. A third follows the inscribed tome through an
          inscription link. Three patterns, three arcs, one chronicle — that
          is the "interlocking storylines" aesthetic in action.
        </p>
        <p>
          Here is the <code>.viv</code> source for this story world. The four
          causal mechanisms correspond to: item-typed roles (<code>@note</code>{' '}
          as <code>item</code>), <code>reactions</code> blocks, the{' '}
          <code>relay</code> directive, and item-effect assignments that encode
          inscription knowledge. Everything else — how they combine into a causal
          graph, which sifting patterns match — is handled by the runtime.
        </p>
        <HighlightedViv code={source} />
      </section>
    </>
  )
}
