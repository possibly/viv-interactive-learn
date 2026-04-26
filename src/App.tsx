import { useEffect, useState } from 'react'
import AlgorithmDemo from './sandbox/AlgorithmDemo'
import { HighlightedTs, HighlightedViv } from './sandbox/highlight'

const VIV_SOURCE_PATH = `${import.meta.env.BASE_URL}vivsrc/stage1.viv`

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
