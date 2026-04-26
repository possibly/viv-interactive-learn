import { useMemo, useState } from 'react'
import Sandbox from './sandbox/Sandbox'
import { STAGES } from './sandbox/stages'
import {
  HOST_ONLY_STAGE_1,
  HOST_ONLY_STAGE_2,
  HOST_ONLY_TAKEAWAY,
} from './sandbox/host-code'

export default function App() {
  const [activeStageId, setActiveStageId] = useState<number>(1)
  const activeStage = useMemo(
    () => STAGES.find((s) => s.id === activeStageId) ?? STAGES[0],
    [activeStageId],
  )

  return (
    <div className="page">
      <header className="hero">
        <h1>
          <span className="brand">Viv</span>: a tour of the authoring layer
        </h1>
        <p className="lede">
          Viv is a small DSL and runtime for <em>emergent narrative</em>. You declare what
          characters can do; the runtime decides who does what, when, and what fell out of it.
          This is a guided walk: one storyworld, growing in size and ambition as we introduce
          each piece of the language. Step the sandbox at any point to watch your edits land.
        </p>
        <p className="meta">
          The runtime running below is the upstream{' '}
          <code>browser/runtime</code> branch of{' '}
          <a href="https://github.com/possibly/viv" target="_blank" rel="noreferrer">
            possibly/viv
          </a>
          , vendored verbatim. Each stage's <code>.viv</code> source was compiled with{' '}
          <code>vivc</code> and committed alongside the JSON output, so the page itself never
          needs the Python compiler.
        </p>
      </header>

      <aside className="floating-stage-picker" aria-label="Jump to stage">
        <span className="dim">Sandbox stage:</span>
        {STAGES.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setActiveStageId(s.id)
              document
                .getElementById(`stage-${s.id}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            className={s.id === activeStageId ? 'pill active' : 'pill'}
          >
            {s.title}
          </button>
        ))}
      </aside>

      <section className="prose">
        <h2>What we're building</h2>
        <p>
          A small tavern simulation. Three regulars -- <strong>Alice</strong>,{' '}
          <strong>Bob</strong>, and <strong>Carol</strong> -- hang around the Crooked
          Tankard. Each tick we ask Viv: "given everything you know, what would{' '}
          <em>this</em> character plausibly do right now?" Viv:
        </p>
        <ol>
          <li>
            looks at every action defined in the bundle for which this character could be
            the initiator;
          </li>
          <li>
            tries to <strong>cast the other roles</strong> from the entities the host adapter
            tells it about (typically nearby characters and items);
          </li>
          <li>
            evaluates each action's <strong>conditions</strong> against the current state;
          </li>
          <li>
            picks one (weighted by importance/salience), runs its{' '}
            <strong>effects</strong>, and saves the action record in your world via the
            adapter's <code>saveActionData</code>.
          </li>
        </ol>
        <p>
          That last step is the magic trick: the action records form a graph. Story sifting
          (out of scope here) reads that graph after the fact to find narrative arcs.
        </p>

        <p>
          The sandbox below sticks with you the whole way down. Pick a stage in the sidebar
          (or from the floating picker on the right), then keep reading. The{' '}
          <strong>Viv source</strong>, <strong>Host code</strong>, and{' '}
          <strong>Compiled bundle</strong> tabs all show the same artifacts the runtime is
          actually using.
        </p>
      </section>

      <SandboxAnchor stage={activeStage} />

      {/* ------------------------------------------------------------ */}
      <Section
        anchor="stage-1"
        kicker="Stage 1"
        title="One action, two roles, two effects"
        onActivate={() => setActiveStageId(1)}
      >
        <p>
          Here is the entire content bundle for our first run, in source form:
        </p>
        <Snippet lang="viv">{`action hello:
    gloss: "@greeter says hello to @friend"
    report: '{@greeter.name} smiles and waves at {@friend.name}'
    roles:
        @greeter:
            as: initiator
        @friend:
            as: recipient
    effects:
        @greeter.mood += 5
        @friend.mood += 5`}</Snippet>
        <p>
          A few things to notice -- they recur in every later stage:
        </p>
        <ul>
          <li>
            <strong>Roles are typed slots</strong>, not characters. <code>@greeter</code> is
            "the initiator" and Viv casts it from whichever character we asked about. Viv
            also casts <code>@friend</code> for us.
          </li>
          <li>
            <strong>Effects are imperative.</strong> Read them like JavaScript: dotted-path
            mutations on the entity views the host hands back.
          </li>
          <li>
            <strong>Gloss vs report:</strong> a one-line label and a longer narrative line.
            Both can interpolate role-bound entities and their fields. The chronicle below
            uses the report.
          </li>
        </ul>
        <Callout>
          Try it: switch the sandbox to Stage 1, then press <em>Step round</em> a few times.
          Everyone's mood rises monotonically -- there's literally no other action available
          to choose. Hit <em>Reset</em> to start fresh.
        </Callout>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section
        anchor="stage-2"
        kicker="Stage 2"
        title="Conditions, and the first real choice"
        onActivate={() => setActiveStageId(2)}
      >
        <p>
          Add a second action: <code>gossip</code>. It has three roles -- gossiper,
          listener, and the off-stage subject -- and it's only eligible when the gossiper is
          already in a sour mood.
        </p>
        <Snippet lang="viv">{`action gossip:
    roles:
        @gossiper:  { as: initiator }
        @listener:  { as: recipient }
        @subject:   { as: character, anywhere }
    conditions:
        @gossiper.mood < 0
        @subject != @gossiper
        @subject != @listener
    effects:
        @gossiper.mood += 2
        @listener.mood -= 1
        @subject.mood -= 5`}</Snippet>
        <p>
          Two new pieces of the language are doing real work:
        </p>
        <ul>
          <li>
            <strong>Conditions</strong> are expressions evaluated against the cast. If any
            fail, this casting attempt is discarded and Viv tries again with a different
            cast (or another action).
          </li>
          <li>
            The <code>anywhere</code> modifier on <code>@subject</code> lifts the default
            "must be at the location" constraint -- you can gossip about someone who isn't
            in the room. (We'll see why that matters in Stage 4.)
          </li>
        </ul>
        <p>
          Run the sandbox a few rounds. With everyone starting at mood 0, gossip can't fire,
          so it's hellos all the way. Now press <em>Reset</em>, scroll up, and notice we have
          no way to make anyone grumpy from here. That's by design for Stage 2 -- the next
          stage adds the action that swings moods both ways.
        </p>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section
        anchor="stage-3"
        kicker="Stage 3"
        title="Importance and salience -- which moments matter"
        onActivate={() => setActiveStageId(3)}
      >
        <p>
          We add a third action, <code>befriend</code>, gated on both characters already
          being in a good mood. We also start <em>tagging</em> each action with its narrative
          weight via <code>importance</code> and <code>saliences</code>:
        </p>
        <Snippet lang="viv">{`action befriend:
    importance: #HIGH
    roles:
        @a: { as: initiator }
        @b: { as: recipient }
    conditions:
        @a.mood > 5
        @b.mood > 5
        @a != @b
    effects:
        @a.mood += 10
        @b.mood += 10`}</Snippet>
        <p>
          Importance is the language saying "for the storyteller's eye, this is a{' '}
          <em>load-bearing</em> moment." Story sifting later prioritises high-importance
          actions when looking for arcs. Salience does the same per-character: how memorable
          is this for <em>this</em> participant?
        </p>
        <p>
          We start the cast at mood 4 in this stage so that a couple of greetings push
          someone over the threshold and unlock <code>befriend</code>. Watch the{' '}
          <em>Compiled bundle</em> tab and grep for <code>befriend</code> -- you'll see the
          conditions encoded as a tiny AST, exactly what the runtime walks at every casting
          attempt.
        </p>
        <Callout>
          A useful intuition: importance is for <em>readers</em> of the chronicle (the
          drama manager, the sifter, the player-facing recap). Conditions are for{' '}
          <em>writers</em> of the chronicle (the runtime, deciding what's even legal).
        </Callout>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section
        anchor="stage-4"
        kicker="Stage 4"
        title="Place: the tavern, and proximity for free"
        onActivate={() => setActiveStageId(4)}
      >
        <p>
          We finally reach into the simulated world. The tavern now flags itself with{' '}
          <code>is_tavern: true</code>, and three tankards of ale are sitting on the table.
          We add one more action:
        </p>
        <Snippet lang="viv">{`action drink-ale:
    roles:
        @drinker: { as: initiator }
        @here:    { as: location }
        @ale:     { as: item }
    conditions:
        @here.is_tavern == true
    effects:
        @drinker.mood += 3
        @drinker.tipsy += 1`}</Snippet>
        <p>
          The host adapter does no special filtering here. The runtime asks "what items are
          near the initiator?" via <code>getEntityIDs(EntityType.Item, locationID)</code>,
          gets the tankards back, and considers each as a possible casting of{' '}
          <code>@ale</code>. The location role <code>@here</code> is filled with whatever
          location the initiator is currently in. The condition checks a flag we set on the
          location entity -- pure data, no special verb.
        </p>
        <p>
          Now go to the playground for Stage 4 and step a round. With everyone in the same
          room, ale is plentiful, and tipsy starts climbing. If we had a second location with{' '}
          <code>is_tavern: false</code> and we moved Bob there, <code>drink-ale</code> would
          silently stop being eligible for him -- no edits to <code>drink-ale</code>{' '}
          required.
        </p>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section
        anchor="stage-5"
        kicker="Stage 5"
        title="Consequences: actions queue actions"
        onActivate={() => setActiveStageId(5)}
      >
        <p>
          Last stop. We start the cast at mood -4 so the new <code>insult</code> action is
          eligible right away, and we wire a <code>retort</code> reaction onto it:
        </p>
        <Snippet lang="viv">{`action insult:
    importance: #HIGH
    roles:
        @aggressor: { as: initiator }
        @victim:    { as: recipient }
    conditions:
        @aggressor.mood < -2
    effects:
        @victim.mood -= 8
    reactions:
        queue action retort:
            with:
                @retorter: @victim
                @target:   @aggressor

reserved action retort:
    roles:
        @retorter: { as: initiator }
        @target:   { as: recipient, precast }
    effects:
        @target.mood -= 4
        @retorter.mood += 1`}</Snippet>
        <p>
          Two tiny pieces of syntax are doing a lot of work:
        </p>
        <ul>
          <li>
            <code>reactions:</code> is a child of an action and queues another construct
            keyed by the action that just fired. The runtime processes the queue on
            subsequent <code>selectAction</code> calls.
          </li>
          <li>
            <code>reserved</code> + <code>precast</code> together mean "this action can only
            be triggered by something that already knows who the participants are." That's
            why <code>retort</code> doesn't show up as a regular option for whoever's
            turn it is -- it can only be summoned by an <code>insult</code>.
          </li>
        </ul>
        <p>
          Step the sandbox a few rounds. You'll see chronicle entries chained: the insult
          appears, then on a subsequent turn the victim fires back via <code>retort</code>,
          carrying the original insult as the cause in the runtime's internal graph. That
          graph is what story sifting consumes -- but the chronicle alone is already a
          recognisable little micro-arc.
        </p>
      </Section>

      {/* ------------------------------------------------------------ */}
      <section className="prose host-only">
        <h2>"Why not just write this in the host?"</h2>
        <p>
          A reasonable instinct, especially at Stage 1. Here is the same simulation in
          plain TypeScript with no DSL at all:
        </p>
        <Snippet lang="ts">{HOST_ONLY_STAGE_1}</Snippet>
        <p>
          That's tight! Now do Stage 2 the same way and you start to feel the seams:
        </p>
        <Snippet lang="ts">{HOST_ONLY_STAGE_2}</Snippet>
        <Snippet lang="ts">{HOST_ONLY_TAKEAWAY}</Snippet>
        <p>
          The pitch isn't "Viv lets you do things impossible in TypeScript." It's "Viv
          lets you keep the surface small while the runtime carries the boilerplate." For
          a single action you don't need it. For the kind of ten-action, ten-condition,
          ten-reaction soup that emergent narrative wants, you very much do.
        </p>
      </section>

      {/* ------------------------------------------------------------ */}
      <section className="prose">
        <h2>What we deliberately skipped</h2>
        <p>
          Viv has more language than this tour shows. The big absences:
        </p>
        <ul>
          <li>
            <strong>Sifting patterns</strong> -- the declarative shape of an arc you want
            to find ("an insult, followed eventually by reconciliation between the same
            pair"). They run over the action graph after the fact.
          </li>
          <li>
            <strong>Plans and plan selectors</strong> -- multi-step intentions a character
            adopts, complete with abandonment conditions and timing constraints. They feel
            like little schemes the cast carries around.
          </li>
          <li>
            <strong>Queries</strong> -- author-defined searches over the world used inside
            casting pools, conditions, and effects.
          </li>
          <li>
            <strong>Tropes</strong> -- a way to bundle related sifting patterns together so
            the sifter can recognise a familiar story shape at multiple zoom levels.
          </li>
        </ul>
        <p>
          The{' '}
          <a
            href="https://viv.sifty.studio/reference/language/"
            target="_blank"
            rel="noreferrer"
          >
            language reference
          </a>{' '}
          is the source of truth for all of these. The pieces this tour <em>did</em> walk
          you through are the ones you'll touch in the first day or two of authoring.
        </p>
      </section>

      <footer className="page-footer">
        <p className="dim">
          Sandbox uses the upstream{' '}
          <a href="https://github.com/possibly/viv/tree/browser/runtime" target="_blank" rel="noreferrer">
            browser/runtime
          </a>{' '}
          build of Viv (v0.10.x). The five <code>.viv</code> sources and their compiled
          JSON are in <code>/public/vivsrc</code> and <code>/public/bundles</code>.
        </p>
      </footer>
    </div>
  )
}

interface SectionProps {
  anchor: string
  kicker: string
  title: string
  children: React.ReactNode
  onActivate: () => void
}

function Section({ anchor, kicker, title, children, onActivate }: SectionProps) {
  return (
    <section
      id={anchor}
      className="stage-section"
      onMouseEnter={onActivate}
      onFocus={onActivate}
    >
      <div className="prose">
        <p className="kicker">{kicker}</p>
        <h2>{title}</h2>
        {children}
      </div>
    </section>
  )
}

function Snippet({ children, lang }: { children: string; lang: string }) {
  return (
    <pre className={`code lang-${lang}`}>
      <code>{children}</code>
    </pre>
  )
}

function Callout({ children }: { children: React.ReactNode }) {
  return <div className="callout">{children}</div>
}

function SandboxAnchor({ stage }: { stage: ReturnType<typeof STAGES.at> }) {
  if (!stage) return null
  return (
    <div className="sandbox-anchor" aria-live="polite">
      <Sandbox stage={stage} />
      <p className="dim sandbox-hint">{stage.blurb}</p>
    </div>
  )
}
