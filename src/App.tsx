import { useEffect, useState } from 'react'
import AlgorithmDemo from './sandbox/AlgorithmDemo'
import ImportanceLab from './sandbox/ImportanceLab'
import Stage2Demo from './sandbox/Stage2Demo'
import Stage3Demo from './sandbox/Stage3Demo'
import Stage4Demo from './sandbox/Stage4Demo'
import Stage5Demo from './sandbox/Stage5Demo'
import Stage6Demo from './sandbox/Stage6Demo'
import { HighlightedTs, HighlightedViv } from './sandbox/highlight'

const STAGE1_VIV_PATH = `${import.meta.env.BASE_URL}vivsrc/stage1.viv`
const STAGE2_VIV_PATH = `${import.meta.env.BASE_URL}vivsrc/stage2.viv`
const STAGE3_VIV_PATH = `${import.meta.env.BASE_URL}vivsrc/stage3.viv`
const STAGE4_VIV_PATH = `${import.meta.env.BASE_URL}vivsrc/stage4.viv`
const STAGE5_VIV_PATH = `${import.meta.env.BASE_URL}vivsrc/stage5.viv`
const STAGE6_VIV_PATH = `${import.meta.env.BASE_URL}vivsrc/stage6.viv`

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

const INITIAL_IMPORTANCE: Record<string, number> = {
  greet: 1,
  tease: 3,
  cheer_up: 3,
}

export default function App() {
  const [stage1Source, setStage1Source] = useState<string>('Loading...')
  const [stage2Source, setStage2Source] = useState<string>('Loading...')
  const [stage3Source, setStage3Source] = useState<string>('Loading...')
  const [stage4Source, setStage4Source] = useState<string>('Loading...')
  const [stage5Source, setStage5Source] = useState<string>('Loading...')
  const [stage6Source, setStage6Source] = useState<string>('Loading...')
  const [importance, setImportance] = useState<Record<string, number>>(INITIAL_IMPORTANCE)

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      fetch(STAGE1_VIV_PATH).then((r) => r.text()),
      fetch(STAGE2_VIV_PATH).then((r) => r.text()),
      fetch(STAGE3_VIV_PATH).then((r) => r.text()),
      fetch(STAGE4_VIV_PATH).then((r) => r.text()),
      fetch(STAGE5_VIV_PATH).then((r) => r.text()),
      fetch(STAGE6_VIV_PATH).then((r) => r.text()),
    ])
      .then(([s1, s2, s3, s4, s5, s6]) => {
        if (cancelled) return
        setStage1Source(s1)
        setStage2Source(s2)
        setStage3Source(s3)
        setStage4Source(s4)
        setStage5Source(s5)
        setStage6Source(s6)
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
          <code>1/N</code> chance. Now we want to extend our simulation: we want our
          friends to tease and cheer each other up more often than they say hello. Viv
          expresses that with{' '}
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
          We give greeting an importance of <strong>1</strong>, and tease and cheer_up
          each an importance of <strong>3</strong>.
        </p>
        <HighlightedViv code={stage4Source} />
        <p>
          Nothing in the host changes for this stage. Importance lives entirely in the
          bundle and is consumed by the runtime's picker.
        </p>
        <p>
          Drag the sliders below to retune each action's importance. The bar shows the
          expected share of the picker's choices for the values you set.
        </p>
        <ImportanceLab importance={importance} setImportance={setImportance} />
      </section>

      <Stage4Demo importance={importance} />

      <section className="prose">
        <h2>Stage 5: keep an action from happening twice</h2>
        <p>
          With importance dialed in, our friends now tease and cheer up plenty often, but
          they also greet whenever the picker rolls that way. We want greeting to be a
          one-time thing: once anyone has said hello, the simulation should move on.
        </p>
        <p>
          Viv expresses this with{' '}
          <a
            href="https://viv.sifty.studio/reference/language/10-actions/#embargoes"
            target="_blank"
            rel="noreferrer"
          >
            embargoes
          </a>
          : a per-action declaration that prevents the action from being targeted again
          for some duration after it fires. An embargo carries a <code>time</code> field,
          which is either <code>forever</code> (the action is locked out for the rest of
          the run) or a time period like <code>3 hours</code> or <code>2 weeks</code>.
          Time periods are measured against the host's clock, supplied through the
          adapter's <code>getCurrentTimestamp</code> callback.
        </p>
        <p>
          We give greeting a <code>forever</code> embargo. Tease and cheer_up stay
          unrestricted.
        </p>
        <HighlightedViv code={stage5Source} />
        <p>
          The demo runs five turns, rotating through Alice, Bob, Carol, Alice, Bob and
          calling <code>selectAction</code> once per turn. The eligible-actions strip
          shrinks as soon as greet fires.
        </p>
      </section>

      <Stage5Demo />

      <section className="prose">
        <h2>Stage 6: gating actions on the chronicle with queries</h2>
        <p>
          The story still feels disorderly. Tease and cheer_up can fire on turn 1, before
          anyone has even said hello. We want greeting to come <em>first</em>, and we want
          it to be a per-pair handshake: Alice and Bob have to greet each other before
          they can tease or cheer up <em>each other</em>, but their hello should not
          unlock anything for the Bob-Carol pair.
        </p>
        <p>
          Conditions can do more than read entity properties. They can also run a{' '}
          <a
            href="https://viv.sifty.studio/reference/language/15-queries.html"
            target="_blank"
            rel="noreferrer"
          >
            query
          </a>{' '}
          over the chronicle, the runtime's record of every action that has fired so far.
          A query is a named pattern; a condition that runs the query passes when at
          least one chronicle entry matches.
        </p>
        <p>
          A query can take roles of its own. We declare <code>greeted-with</code> with two
          character roles, <code>@a</code> and <code>@b</code>, and ask for any greet
          where both of them were active. tease and cheer_up bind their own cast into the
          query (<code>@a: @teaser, @b: @target</code>), so the gate is per-pair. greet
          also embargoes the same pair so the runtime will not pick the same direction
          twice.
        </p>
        <HighlightedViv code={stage6Source} />
        <p>
          The demo runs the same five turns. At each turn we show the state of all three
          character pairs; tease and cheer_up only become available for a pair once a
          green check sits next to it.
        </p>
      </section>

      <Stage6Demo />

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
