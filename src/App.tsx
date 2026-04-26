import { useEffect, useState } from 'react'
import AlgorithmDemo from './sandbox/AlgorithmDemo'
import Stage2Demo from './sandbox/Stage2Demo'
import { HighlightedTs, HighlightedViv } from './sandbox/highlight'

const STAGE1_VIV_PATH = `${import.meta.env.BASE_URL}vivsrc/stage1.viv`
const STAGE2_VIV_PATH = `${import.meta.env.BASE_URL}vivsrc/stage2.viv`

const HOST_WORLD = `// The host owns the world. Plain objects, nothing here knows
// about Viv yet. Three friends with an id, a name, and a
// location. They're all in the same room: a tavern.

const entities = {
  alice: { id: "alice", name: "Alice", location: "tavern" },
  bob:   { id: "bob",   name: "Bob",   location: "tavern" },
  carol: { id: "carol", name: "Carol", location: "tavern" },
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
// runtime's job.

while (true) {
  for (const character of characters) {
    await selectAction({ initiatorID: character });
  }
}
`

const HOST_STAGE2 = `// Same entities, with one extra field per character. Bob's having
// a bad day; the others are not.

const entities = {
  alice: { id: "alice", name: "Alice", location: "tavern", cheerful: true  },
  bob:   { id: "bob",   name: "Bob",   location: "tavern", cheerful: false },
  carol: { id: "carol", name: "Carol", location: "tavern", cheerful: true  },
};
`

export default function App() {
  const [stage1Source, setStage1Source] = useState<string>('Loading...')
  const [stage2Source, setStage2Source] = useState<string>('Loading...')

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      fetch(STAGE1_VIV_PATH).then((r) => r.text()),
      fetch(STAGE2_VIV_PATH).then((r) => r.text()),
    ])
      .then(([s1, s2]) => {
        if (cancelled) return
        setStage1Source(s1)
        setStage2Source(s2)
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
      </header>

      <section className="prose">
        <h2>What we want our characters to do</h2>
        <p>
          Three friends, <strong>Alice</strong>, <strong>Bob</strong>, and{' '}
          <strong>Carol</strong>, hanging out together. We want them to be able to{' '}
          <strong>greet each other</strong>. Whenever it's a character's turn, they can
          say hello to one of the other two.
        </p>
      </section>

      <section className="prose">
        <h2>Start with the host</h2>
        <p>
          Let's start by deciding what exists in our game. We declare this in our host
          program.
        </p>
        <HighlightedTs code={HOST_WORLD} />
        <p>
          Each character has an <code>id</code>, a <code>name</code>, and a{' '}
          <code>location</code> (the tavern they're all in). You'd add fields here as you
          grow the game, like mood, inventory, or memories.
        </p>
        <aside className="callout">
          <p>
            Viv has a few built-in <strong>entity types</strong> (characters, items,
            locations, actions), and a <code>location</code> property is expected on every
            entity. See{' '}
            <a
              href="https://viv.sifty.studio/reference/language/05-entities-and-symbols/#entity-types"
              target="_blank"
              rel="noreferrer"
            >
              Entities and symbols &rsaquo; Entity types
            </a>{' '}
            in the language reference.
          </p>
        </aside>
      </section>

      <section className="prose">
        <h2>Now bring in Viv</h2>
        <p>
          <strong>Viv is a small DSL for declaring what's possible</strong>; the runtime
          decides who does what when. You write the actions once, their roles, their
          conditions, their effects, and the runtime carries the picking, the casting,
          and the bookkeeping.
        </p>
        <p>
          For our friends, that's a single action: someone greets someone else.
        </p>
        <HighlightedViv code={stage1Source} />
        <p>
          The action declares the two roles it needs cast (the initiator and the
          recipient) and how to describe what happened for the chronicle. No conditions,
          no effects, a greet always succeeds and just records itself.
        </p>
      </section>

      <section className="prose">
        <h2>Wire the runtime into the host</h2>
        <p>
          Three additions to the host: import the runtime, initialize it, and let it drive
          the loop.
        </p>
        <HighlightedTs code={HOST_WITH_VIV} />
        <p>
          The <code>adapter</code> referenced in <code>initializeVivRuntime</code> is the
          small bridge that lets the runtime read and write our entities through callbacks
          (<code>getEntityIDs</code>, <code>updateEntityProperty</code>, and friends).
        </p>
      </section>

      <section className="prose">
        <h2>Now let's look at what happens when <code>selectAction</code> is called</h2>
        <p>
          Pick a character below to see the four steps the runtime performs inside that
          single <code>await</code>. The first three are computed and displayed; the
          fourth hands off to the real <code>selectAction</code>, which writes to the
          chronicle below.
        </p>
      </section>

      <AlgorithmDemo />

      <section className="prose">
        <h2>Stage 2: gating actions with conditions</h2>
        <p>
          The runtime so far picks uniformly from every cast it can build. Real characters
          shouldn't act on every option, an action should only fire when the world looks
          right for it. In Viv, that's a <strong>condition</strong>.
        </p>
        <p>
          We'll add a second action, <code>compliment</code>, with one role condition: the
          subject has to be <code>cheerful</code>. The host has to set that field; the
          runtime just reads it.
        </p>
        <HighlightedTs code={HOST_STAGE2} />
        <HighlightedViv code={stage2Source} />
        <p>
          Conditions reference role bindings (<code>@subject</code>) and any property the
          host stores on that entity. The compiler attaches each condition to the role it
          depends on, so the runtime evaluates it per cast, not per action.
        </p>
      </section>

      <section className="prose">
        <h2>What changes in <code>selectAction</code></h2>
        <p>
          Steps 1 and 2 are unchanged. Step 3 now does real work: each cast is checked
          against its conditions, and any cast that fails is dropped before step 4 picks.
          Pick a character below; the cards that fail are stamped <code>FAIL</code> and
          fall out of the running.
        </p>
      </section>

      <Stage2Demo />

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
