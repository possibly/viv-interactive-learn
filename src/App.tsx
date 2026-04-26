import { useEffect, useState } from 'react'
import AlgorithmDemo from './sandbox/AlgorithmDemo'
import Stage2Demo from './sandbox/Stage2Demo'
import Stage3Demo from './sandbox/Stage3Demo'
import Stage4Demo from './sandbox/Stage4Demo'
import { HighlightedTs, HighlightedViv } from './sandbox/highlight'

const STAGE1_VIV_PATH = `${import.meta.env.BASE_URL}vivsrc/stage1.viv`
const STAGE2_VIV_PATH = `${import.meta.env.BASE_URL}vivsrc/stage2.viv`
const STAGE3_VIV_PATH = `${import.meta.env.BASE_URL}vivsrc/stage3.viv`
const STAGE4_VIV_PATH = `${import.meta.env.BASE_URL}vivsrc/stage4.viv`

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

const HOST_WITH_VIV = `import { initializeVivRuntime, selectAction, EntityType } from "viv-runtime";

// ...entities map and characters list from before...

// The adapter bridges the runtime and the host: it answers
// questions about entities and stores action records. (A few
// bookkeeping callbacks are omitted for space.)
const adapter = {
  getEntityIDs: (type) =>
    type === EntityType.Character ? characters : [],
  getEntityView: (id) => structuredClone(entities[id]),
  saveActionData: (id, data) => { entities[id] = data; },
};

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

const HOST_ADAPTER = `// Stage 3 adds one new callback to the adapter we wrote in stage 1.
// The runtime calls updateEntityProperty once per effect statement,
// after a cast is picked, with (entityID, propertyPath, newValue).

const adapter = {
  // ...callbacks from stage 1 (getEntityIDs, getEntityView, ...)...

  updateEntityProperty(id, path, value) {
    // path looks like ["cheerful"] or ["inventory", "sword"].
    let cur = entities[id];
    for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
    cur[path[path.length - 1]] = value;
  },
};
`

export default function App() {
  const [stage1Source, setStage1Source] = useState<string>('Loading...')
  const [stage2Source, setStage2Source] = useState<string>('Loading...')
  const [stage3Source, setStage3Source] = useState<string>('Loading...')
  const [stage4Source, setStage4Source] = useState<string>('Loading...')

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      fetch(STAGE1_VIV_PATH).then((r) => r.text()),
      fetch(STAGE2_VIV_PATH).then((r) => r.text()),
      fetch(STAGE3_VIV_PATH).then((r) => r.text()),
      fetch(STAGE4_VIV_PATH).then((r) => r.text()),
    ])
      .then(([s1, s2, s3, s4]) => {
        if (cancelled) return
        setStage1Source(s1)
        setStage2Source(s2)
        setStage3Source(s3)
        setStage4Source(s4)
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
        <aside className="callout">
          <p>
            <strong>Where did <code>@greeter</code> come from?</strong> It is not a
            built-in name. It is one of the two roles this action declared in its{' '}
            <code>roles:</code> block (the other is <code>@friend</code>). Each action
            defines its own role names, and only those names are in scope inside that
            action's report, conditions, and effects. There is no global list of
            bindings; if you want a different name, you rename the role. See{' '}
            <a
              href="https://viv.sifty.studio/reference/language/09-roles/#role-reference"
              target="_blank"
              rel="noreferrer"
            >
              Roles &rsaquo; Role reference
            </a>{' '}
            for the syntax.
          </p>
        </aside>
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
          Stage 1 only ever knew how to say hello. Let's extend the simulation: we want
          our friends to do more than greet, but only some of those new actions should be
          available at any given moment.
        </p>
        <p>
          We can prevent the selection of some actions by placing{' '}
          <a
            href="https://viv.sifty.studio/reference/language/08-statements-and-control-flow/#conditionals"
            target="_blank"
            rel="noreferrer"
          >
            conditions
          </a>{' '}
          on those actions.
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

      <section className="prose">
        <h2>Stage 3: actions that change the world</h2>
        <p>
          Conditions read the world. The other half of an action is{' '}
          <a
            href="https://viv.sifty.studio/reference/language/10-actions/#effects"
            target="_blank"
            rel="noreferrer"
          >
            effects
          </a>
          : statements that fire when the action is picked, mutating entity properties on
          the host's side.
        </p>
        <p>
          We'll add two more actions. <code>tease</code> makes the target grumpy.{' '}
          <code>cheer_up</code> only applies to grumpy targets, and makes them cheerful
          again.
        </p>
        <HighlightedViv code={stage3Source} />
        <p>
          Effects use assignment expressions (<code>=</code>, <code>+=</code>, etc.) on
          properties reachable from a role. The runtime walks the picked action's effect
          list after step 3, calling <code>updateEntityProperty</code> on the host's
          adapter for each statement. The host's world is now different, and the next{' '}
          <code>selectAction</code> will see the new state.
        </p>
        <p>
          To support this, we extend the adapter we wrote earlier with one new callback:
        </p>
        <HighlightedTs code={HOST_ADAPTER} />
      </section>

      <section className="prose">
        <h2>
          Let's look at how our friends at the tavern now greet, tease, and cheer each
          other up
        </h2>
        <p>
          Step 4 still picks one passing cast at random, but it also lists the picked
          action's effect statements and shows a snapshot of the world after they ran.
          Whichever character was touched gets an outline and a "before → after"
          annotation.
        </p>
      </section>

      <Stage3Demo />

      <section className="prose">
        <h2>Stage 4: importance steers selection</h2>
        <p>
          Step 4 has been picking uniformly: every passing cast got the same{' '}
          <code>1/N</code> chance. Authors usually do not want that. <code>cheer_up</code>{' '}
          is dramatically interesting; <code>greet</code> is filler. Viv expresses that
          preference with{' '}
          <a
            href="https://viv.sifty.studio/reference/language/10-actions/#importance"
            target="_blank"
            rel="noreferrer"
          >
            importance
          </a>
          : a number declared per action. The runtime weights its random pick by
          importance, so a higher number is more likely to fire.
        </p>
        <p>
          We give each action a weight. Greeting is filler (1), teasing is moderate (3),
          and cheering someone up is the dramatic beat we want most often (5).
        </p>
        <HighlightedViv code={stage4Source} />
        <p>
          Nothing in the host changes for this stage. Importance lives entirely in the
          bundle and is consumed by the runtime's picker. The demo below adds a{' '}
          <strong>Lab</strong> panel where you can retune each action's importance with a
          slider, see the expected distribution change live, and sample with{' '}
          <strong>Reroll</strong> to watch the observed bar approach the expected one.
        </p>
      </section>

      <Stage4Demo />

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
