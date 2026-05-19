import { useEffect, useState } from 'react'
import AlgorithmDemo from './sandbox/AlgorithmDemo'
import CausalGraphDemo from './sandbox/CausalGraphDemo'
import { HighlightedTs, HighlightedViv } from './sandbox/highlight'

const VIV_SOURCE_PATH = `${import.meta.env.BASE_URL}vivsrc/stage1.viv`
const STAGE2_SOURCE_PATH = `${import.meta.env.BASE_URL}vivsrc/stage2.viv`

const HOST_WORLD = `// The host owns the world. Plain objects -- nothing here knows
// about Viv yet. Three friends with an id and a name; location is
// the one extra field the Viv runtime always reads (it checks
// role-presence by comparing locations), so we set it to null
// everywhere -- "no location modelled" -- and that's that.

const entities = {
  alice: { id: "alice", name: "Alice", location: null },
  bob:   { id: "bob",   name: "Bob",   location: null },
  carol: { id: "carol", name: "Carol", location: null },
};
const characters = ["alice", "bob", "carol"];
`

const HOST_WITH_VIV = `import { initializeVivRuntime, selectAction } from "viv-runtime";

// ...the entities map and characters list from before...

// One-time setup: tell the runtime about the compiled content bundle
// and how to read/write our world via a small adapter (boilerplate,
// elided here).
initializeVivRuntime({ contentBundle, adapter });

// The game loop: hand selectAction one character at a time.
// Everything else (which action, which cast, which effects) is the
// runtime's job. This is the entire mental model you need to keep
// in your head while writing Viv.

while (true) {
  for (const character of characters) {
    await selectAction({ initiatorID: character });
  }
}
`

export default function App() {
  const [vivSource, setVivSource] = useState<string>('Loading...')
  const [stage2Source, setStage2Source] = useState<string>('Loading...')

  useEffect(() => {
    let cancelled = false
    fetch(VIV_SOURCE_PATH)
      .then((r) => r.text())
      .then((t) => { if (!cancelled) setVivSource(t) })
      .catch(() => {})
    fetch(STAGE2_SOURCE_PATH)
      .then((r) => r.text())
      .then((t) => { if (!cancelled) setStage2Source(t) })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="page">
      <header className="hero">
        <h1>
          <span className="brand">Viv</span>: a tour of the authoring layer
        </h1>
        <p className="lede">
          Viv is a small DSL and runtime for <em>emergent narrative</em>. You declare what
          characters can do; the runtime decides who does what, when, and what fell out of
          it. This page is a guided walk through the authoring layer, starting from the
          smallest possible thing and growing.
        </p>
        <p className="meta">
          The runtime running below is the upstream{' '}
          <code>browser/runtime</code> branch of{' '}
          <a href="https://github.com/possibly/viv" target="_blank" rel="noreferrer">
            possibly/viv
          </a>
          , vendored verbatim. Each <code>.viv</code> source was compiled with{' '}
          <code>vivc</code> and committed alongside its JSON output, so the page itself
          never needs the Python compiler.
        </p>
      </header>

      <section className="prose">
        <h2>What we want our characters to do</h2>
        <p>
          Three friends -- <strong>Alice</strong>, <strong>Bob</strong>, and{' '}
          <strong>Carol</strong> -- hanging out together. We want them to be able to{' '}
          <strong>greet each other</strong>. That's the entire goal for stage 1:
          whenever it's a character's turn, they can say hello to one of the other two.
        </p>
      </section>

      <section className="prose">
        <h2>Start with the host</h2>
        <p>
          Building a small game like this usually begins the same way: you write a host
          program -- your game, your prototype, your Node script -- that owns the world.
          No DSL, no runtime, just plain objects describing what exists.
        </p>
        <HighlightedTs code={HOST_WORLD} />
        <p>
          Each character has an <code>id</code>, a <code>name</code>, and a{' '}
          <code>location</code> (set to <code>null</code> for now). You'd add fields here
          as you grow the game -- mood, inventory, memories, an actual location -- but
          stage 1 is deliberately bare so we can focus on what Viv adds.
        </p>
      </section>

      <section className="prose">
        <h2>Now bring in Viv</h2>
        <p>
          You could write each character's choices by hand: roll a random number, hand-pick
          a recipient, log a string, repeat. That's fine for two or three actions. By the
          time you want ten actions, ten conditions, and characters reacting to each
          other, you're maintaining a tangle of <code>if</code>s and ad-hoc selection
          logic.
        </p>
        <p>
          <strong>Viv is a small DSL for declaring what's possible</strong>; the runtime
          decides who does what when. You write the actions once -- their roles, their
          conditions, their effects -- and the runtime carries the picking, the casting,
          and the bookkeeping.
        </p>
        <p>
          For our friends, that's a single action: someone greets someone else.
        </p>
        <HighlightedViv code={vivSource} />
        <p>
          The action declares the two roles it needs cast (the initiator and the
          recipient) and how to describe what happened for the chronicle. No conditions,
          no effects -- a greet always succeeds and just records itself.
        </p>
      </section>

      <section className="prose">
        <h2>Wire the runtime into the host</h2>
        <p>
          Two additions to the host: import the runtime, and let it drive the loop.
        </p>
        <HighlightedTs code={HOST_WITH_VIV} />
        <p>
          The <code>adapter</code> referenced in <code>initializeVivRuntime</code> is the
          small bridge that lets the runtime read and write our entities through callbacks
          (<code>getEntityIDs</code>, <code>updateEntityProperty</code>, and friends).
          It's mostly mechanical -- the interesting line is the <code>await</code>.
        </p>
      </section>

      <section className="prose">
        <h2>Now let's look at what happens when <code>selectAction</code> is called</h2>
        <p>
          Pick a character below and walk through the four steps the runtime performs
          inside that single <code>await</code>. The first three are computed and
          displayed for you so you can see exactly what the runtime is considering; the
          fourth hands off to the real <code>selectAction</code>, which writes to the
          chronicle below.
        </p>
      </section>

      <AlgorithmDemo />

      {/* ── Lesson 2: Causal graphs ─────────────────────────────────── */}

      <section className="prose" style={{ marginTop: 64 }}>
        <p className="kicker">Lesson 2</p>
        <h2>From chronicle to causal graph</h2>
        <p>
          The chronicle you built in Lesson 1 is a flat list: events, in order, with
          timestamps. But the runtime doesn't just log them — it records{' '}
          <em>why</em> each event happened. Those "why" links form a directed graph,
          and the graph is what turns a sequence of events into{' '}
          <strong>interlocking storylines</strong>.
        </p>
        <p>
          The runtime builds causal links through four mechanisms. Each one
          is demonstrated in the interactive chronicle below.
        </p>
      </section>

      <section className="prose">
        <h3>1 — Action roles</h3>
        <p>
          When an action casts a past action's output (an item, a location) in one
          of its roles, the runtime automatically links the producer action as a cause.
          In the example below, <code>read-note</code> casts the note item as{' '}
          <code>@note</code>. Because the note was produced by <code>write-note</code>,
          that action becomes a cause of <code>read-note</code> — with no queuing, no
          relay, and nothing extra declared in the Viv source.
        </p>

        <h3>2 — Reactions</h3>
        <p>
          Any action can declare a <code>reactions</code> block that queues follow-up
          actions. When the runtime fires a reaction, the triggering action is always
          recorded as a cause of the queued one. Reaction chains — confront triggers
          apologize, apologize triggers forgive — all trace back through the causal graph
          to the action that started the chain.
        </p>

        <h3>3 — Knowledge relaying</h3>
        <p>
          A <code>relay</code> directive lets one action carry knowledge about an
          earlier event to a new audience. When the runtime processes that relayed
          knowledge and it triggers a reaction, <em>both</em> the relay action and the
          original event become causes of the resulting reaction. Two separate chronicle
          entries, far apart in time, can jointly cause a third.
        </p>

        <h3>4 — Inscription</h3>
        <p>
          An item can be inscribed with knowledge about an earlier action — think of a
          note, a journal, or a carved stone. When a character inspects that item and the
          inscription triggers a reaction, both the action that delivered the item{' '}
          <em>and</em> the original action described by the inscription are recorded as
          causes. A long-dead event can reach forward through an artefact and cause
          something new.
        </p>

        <p>
          A fifth mechanism — <strong>forced causes</strong> — lets the host application
          assert arbitrary causal links when it forcibly targets an action. This is an
          escape hatch for scripted events, cutscenes, or tutorial beats where the
          authoring system needs direct control. It is not demonstrated here; see the
          Viv documentation for details.
        </p>
      </section>

      <section className="prose">
        <h2>An interactive chronicle</h2>
        <p>
          Below is a 19-step chronicle from a small social world: a gossip note sets
          three separate chains of events in motion. Hit{' '}
          <strong>Reroll characters</strong> to swap the character names (the causal
          structure stays identical), <strong>Reveal causal links</strong> to see which
          mechanism connects each event to its causes, and{' '}
          <strong>Show sifting diagram</strong> to see how three distinct storylines are
          extracted from the same flat chronicle.
        </p>
      </section>

      <CausalGraphDemo />

      <section className="prose">
        <h2>What the sifting diagram shows</h2>
        <p>
          A <strong>sifting pattern</strong> is a query over the causal graph. It names
          a narrative shape — "something is written, then read, then someone reacts" —
          and the runtime searches for chronicle events that fit that shape, connected
          by the right kind of causal link. When you run multiple patterns against the
          same chronicle, the same events appear in different arcs, each telling a
          different facet of what happened.
        </p>
        <p>
          In the diagram above, all three storylines share a single{' '}
          <code>write-note</code> event at the root. One sifting pattern traces the
          direct confrontation through an action-role link. A second finds the relayed
          rumour through a knowledge-relay link. A third follows the inscribed tome
          through an inscription link. Three patterns, three arcs, one chronicle —
          that's the "interlocking storylines" aesthetic.
        </p>
      </section>

      <section className="prose">
        <h2>What the Viv source looks like</h2>
        <p>
          Here is the <code>.viv</code> source for this story world. The key authoring
          constructs are: item-typed roles (action-role links), <code>reactions</code>{' '}
          blocks (reaction links), the <code>relay</code> directive (knowledge-relay
          links), and effects that write to an item's inscription field (inscription
          links). Everything else — how they combine into a causal graph, which
          sifting patterns match — is handled by the runtime.
        </p>
        <HighlightedViv code={stage2Source} />
      </section>

      <footer className="page-footer">
        <p className="dim">
          Sandbox uses the upstream{' '}
          <a href="https://github.com/possibly/viv/tree/browser/runtime" target="_blank" rel="noreferrer">
            browser/runtime
          </a>{' '}
          build of Viv (v0.10.x). Source for this page lives in <code>/src</code>; the{' '}
          <code>.viv</code> source and compiled bundle live in{' '}
          <code>/public/vivsrc</code> and <code>/public/bundles</code>.
        </p>
      </footer>
    </div>
  )
}
