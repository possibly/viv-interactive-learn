import { useEffect, useState } from 'react'
import AlgorithmDemo from './sandbox/AlgorithmDemo'
import { HighlightedTs, HighlightedViv } from './sandbox/highlight'

const VIV_SOURCE_PATH = `${import.meta.env.BASE_URL}vivsrc/stage1.viv`

const HOST_CODE = `import { initializeVivRuntime, selectAction } from "viv-runtime";

// The host owns the world. These are plain objects -- nothing in
// here knows about Viv. The runtime sees them through a small
// adapter (omitted) when it asks "who's at this location?",
// "what's Alice's mood?", and so on.

const entities = {
  tavern: { id: "tavern", name: "The Crooked Tankard" },
  alice:  { id: "alice", name: "Alice", location: "tavern", mood: 0 },
  bob:    { id: "bob",   name: "Bob",   location: "tavern", mood: 0 },
  carol:  { id: "carol", name: "Carol", location: "tavern", mood: 0 },
};
const characters = ["alice", "bob", "carol"];

initializeVivRuntime({ contentBundle, adapter });

// The host's job from here: hand selectAction one character at a
// time. Everything else (which action, which cast, which effects)
// is the runtime's. This is the entire mental model you need to
// keep in your head while writing Viv.

while (true) {
  for (const character of characters) {
    await selectAction({ initiatorID: character });
  }
}
`

export default function App() {
  const [vivSource, setVivSource] = useState<string>('Loading...')

  useEffect(() => {
    let cancelled = false
    fetch(VIV_SOURCE_PATH)
      .then((r) => r.text())
      .then((t) => {
        if (!cancelled) setVivSource(t)
      })
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
          A small tavern. Three regulars -- <strong>Alice</strong>, <strong>Bob</strong>,
          and <strong>Carol</strong> -- hang around the Crooked Tankard. We want them to be
          able to <strong>greet each other</strong> and <strong>order beer</strong>. Either
          one, in any order, whenever it's their turn.
        </p>
      </section>

      <section className="prose">
        <h2>Let's write that in Viv</h2>
        <p>
          One action per intent. Each action declares the roles it needs cast, what its
          effects are, and how to describe it for the chronicle. That's the whole file:
        </p>
        <HighlightedViv code={vivSource} />
      </section>

      <section className="prose">
        <h2>Now we need a host</h2>
        <p>
          Viv's runtime is a library, not an engine that runs on its own. A host
          application -- your game, your prototype, your Node script -- is the thing that{' '}
          <em>uses</em> the runtime: it owns the world state, decides whose turn it is, and
          asks Viv "what's next?" via <code>selectAction</code>.
        </p>
        <p>
          "Owns the world state" is the load-bearing phrase here.{' '}
          <strong>The host decides what entities exist and what properties they have</strong>{' '}
          -- including spatial ones like which character is where, and which item is
          sitting on which table. The runtime never invents those; it queries the host
          through a small adapter when it needs them. In our tavern, the host puts Alice,
          Bob, and Carol all at one location named <code>tavern</code>; that's why
          everyone counts as "nearby" everyone else when the runtime goes looking for role
          candidates.
        </p>
        <p>
          A minimal host then looks like this -- the world data the runtime will read
          from, the one initialization call, and a loop that keeps asking{' '}
          <code>selectAction</code> for the next move:
        </p>
        <HighlightedTs code={HOST_CODE} />
        <p>
          That's the whole game loop. The runtime does everything else.
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

      <section className="prose stub">
        <h2>What comes next</h2>
        <p>
          The next pass adds conditions, then importance, then location-aware roles, then
          reactions. We'll re-introduce them one at a time, alongside their own algorithm
          panels, once the Stage 1 walkthrough above feels right.
        </p>
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
