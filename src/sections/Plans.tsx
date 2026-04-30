import Stage12Demo from '../sandbox/Stage12Demo'
import { HighlightedTs, HighlightedViv } from '../sandbox/highlight'

interface Props {
  source: string
}

const HOST_LOOP_BEFORE = `// Stages 8–11: reactions queue per-character actions.
// selectAction picks them up on the affected character's
// next turn. The host's loop never had to think about plans.

while (running) {
  for (const character of characters) {
    await selectAction({ initiatorID: character });
  }
}
`

const HOST_LOOP_AFTER = `// Stage 12: plans live in their own queue with a phase
// tape. tickPlanner advances each active plan one phase
// per call, queueing that phase's reactions onto the
// appropriate character. selectAction picks them up.

while (running) {
  for (const character of characters) {
    await tickPlanner();             // advance plans
    await selectAction({ initiatorID: character });
  }
}
`

export default function Plans({ source }: Props) {
  return (
    <>
      <section className="prose" id="plans">
        <h2>Multi-phase reaction tapes</h2>
        <p>
          A reaction queues one follow-up action: tease fires, retaliate lands the next
          time the target gets a turn, and we're done. That's a single beat. Anything
          longer -- "first stew on it,{' '}
          <em>then</em> retaliate, <em>then</em> apologise" -- has to be authored as
          three separate reactions, each one written into the previous action's body, and
          you cross your fingers nothing slips between them.
        </p>
        <p>
          A{' '}
          <a
            href="https://viv.sifty.studio/reference/language/17-plans/"
            target="_blank"
            rel="noreferrer"
          >
            plan
          </a>{' '}
          is a reaction with a phase tape. You declare named phases and fill each one
          with the reactions to issue when that phase runs; the runtime walks the tape
          across turns, advancing implicitly when a phase's instructions have been
          dispatched and succeeding when the last phase is done.
        </p>
        <p>
          We use it to extend tease's response from a one-shot retaliate into a
          three-phase grudge arc:{' '}
          <code>&gt;stew</code> →{' '}
          <code>&gt;strike</code> →{' '}
          <code>&gt;regret</code>. Tease's <code>reactions</code> block stops queuing a
          single action and instead queues the plan, with bindings flowing from the
          tease's cast into the plan's roles.
        </p>
        <HighlightedViv code={source} />
        <p>A few things worth pulling out:</p>
        <ul>
          <li>
            <strong>The reaction site moved up a level.</strong> Tease used to{' '}
            <code>queue action retaliate</code>; now it{' '}
            <code>queue plan grudge-arc</code>. The same{' '}
            <code>with:</code> bindings precast the plan's roles, but the work that
            happens after is owned by the plan, not the action.
          </li>
          <li>
            <strong>Phases are sequential by default.</strong>{' '}
            <code>&gt;stew</code> queues <code>stew</code>, the runtime advances,{' '}
            <code>&gt;strike</code> queues <code>retaliate</code>, advances,{' '}
            <code>&gt;regret</code> queues <code>apologise</code>, advances; that
            implicit advance is what gives the arc its shape. (For finer control you can
            wrap instructions in <code>all:</code>/<code>any:</code> windows or insert{' '}
            <code>wait:</code> blocks; we keep it simple here.)
          </li>
          <li>
            <strong>The phase actions are <code>reserved</code>.</strong> Same rule
            from stage 8: actions whose non-initiator roles are precast can't be picked
            by general action selection -- only by a reaction or, in this case, a plan
            phase. The plan's <code>with:</code> bindings on each{' '}
            <code>queue action ...</code> line are what supply those precasts.
          </li>
          <li>
            <strong>Bindings flow from the queueing site through to every phase.</strong>{' '}
            The plan declares <code>@victim</code> and <code>@offender</code> as its
            roles; tease's <code>queue plan grudge-arc: with: ...</code> binds them; and
            then each phase's <code>queue action ...: with: ...</code> destructures them
            into the inner action's role names. There's no global scope to leak through.
          </li>
        </ul>
      </section>

      <section className="prose">
        <h3>The host loop changes by exactly one line</h3>
        <p>
          Up to now the integration has been mechanical: hand{' '}
          <code>selectAction</code> a character at a time, the runtime does the rest.
          Plans introduce a second touchpoint -- <code>tickPlanner</code> -- because plan
          execution is decoupled from action selection.{' '}
          <code>selectAction</code> drains the per-character action queue;{' '}
          <code>tickPlanner</code> walks plans and pushes their next-phase reactions onto
          those queues. Without the tick, queued plans sit forever.
        </p>
        <HighlightedTs code={HOST_LOOP_BEFORE} />
        <HighlightedTs code={HOST_LOOP_AFTER} />
        <p>
          One ticked plan can queue many reactions in a single tick (a phase can have
          multiple <code>queue</code> instructions, or a <code>wait:</code> block can
          finish, or the plan can advance phases mid-tick). Plans that finish a phase but
          aren't done are kept around for the next tick. Both new APIs are async because
          a plan instruction can bottom out in something the host computes, like a custom
          function call -- and that's the contract: plans introduce no new adapter
          callbacks, only a new entry point.
        </p>
      </section>

      <section className="prose">
        <h3>Watch a plan unfold</h3>
        <p>
          The buttons up top force a specific tease, just so you don't have to wait for
          general action selection to roll one. Pick any{' '}
          <em>(teaser → target)</em> button and you'll see a plan card appear with a
          three-phase tape. Then click <strong>Step turn</strong> to advance one rotation
          step at a time.
        </p>
        <p>
          The current phase glows; fired phases dim. A plan succeeds when its last phase
          runs (<code>&gt;regret</code> here). New tease actions during a step keep
          stacking new plans -- watch the chronicle: each <code>tease</code> in there
          carries a <em>queues plan</em> tag, and each phase action carries a{' '}
          <em>phase: stew/strike/regret</em> tag pointing back to which plan slot it
          filled.
        </p>
        <p className="dim">
          Things to try: trigger <em>Bob → Alice</em> and step three turns; trigger{' '}
          <em>Bob → Alice</em> twice in a row before stepping and watch how the second
          arc interacts with retaliate's forever embargo (it'll get queued, but the
          embargo on retaliate keeps the second strike phase from materialising a new
          action); trigger <em>Bob → Alice</em> and <em>Carol → Alice</em> back to back
          to see two grudges sharing the same victim interleave their phases.
        </p>
        <Stage12Demo />
      </section>
    </>
  )
}
