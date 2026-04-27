import ActionSelectionFlow from '../sandbox/ActionSelectionFlow'
import Stage8Demo from '../sandbox/Stage8Demo'
import { HighlightedViv } from '../sandbox/highlight'

interface Props {
  source: string
}

export default function Reactions({ source }: Props) {
  return (
    <>
      <section className="prose" id="reactions">
        <h2>Actions that cause actions</h2>
        <p>
          Sifting was about reading the chronicle. The other half of the
          loop is writing it: an action can declare that another action
          should happen <em>because</em> it happened. We call that a{' '}
          <a
            href="https://viv.sifty.studio/reference/language/11-reactions/"
            target="_blank"
            rel="noreferrer"
          >
            reaction
          </a>
          .
        </p>
        <p>
          We extend the simulation: whenever someone teases, the target
          retaliates the next time they get a turn. The mechanic is a
          new <code>reactions:</code> block on tease that{' '}
          <code>queue</code>s a <code>retaliate</code> action with the
          tease's bindings flipped (the target becomes the avenger; the
          teaser becomes the bully).
        </p>
        <HighlightedViv code={source} />
        <p>A few things to notice:</p>
        <ul>
          <li>
            <strong>retaliate is <code>reserved</code></strong>. Reserved
            actions cannot be picked by general action selection, only
            queued by a reaction (or a selector). This is required because{' '}
            <code>@bully</code> is a non-initiator role that gets precast
            in the queue's <code>with</code> clause; only the initiator
            can be precast for a non-reserved action.
          </li>
          <li>
            <strong>retaliate carries its own embargo</strong>. It can fire
            at most once per (avenger, bully) pair. Tease's reaction will
            still queue duplicates if Carol teases Bob twice, but the
            second retaliate fails its targeting check on the embargo and
            the runtime falls back to general selection.
          </li>
          <li>
            <strong>The host code does not change.</strong> No new adapter
            callbacks; no new arguments to{' '}
            <code>selectAction</code>. The runtime owns the per-character
            queue, and the existing call already targets queued actions
            ahead of general action selection.
          </li>
        </ul>
      </section>

      <section className="prose">
        <h3>How the queue affects action selection</h3>
        <p>
          The queue changes what <code>selectAction</code> does, but only
          a little. The contract is:
        </p>
        <ol>
          <li>
            <strong>Target the character's queued actions first.</strong>
            {' '}If one passes its conditions and embargoes, fire it and
            return.
          </li>
          <li>
            <strong>Otherwise, run general action selection</strong> --
            the four-step algorithm we walked through earlier.
          </li>
        </ol>
        <p>
          So a queued action is not a <em>guarantee</em>; it is a
          first-pick offered to the targeting machinery. If targeting
          rejects it (its conditions evaluate false, an embargo applies,
          a casting pool is empty), the runtime keeps going.
        </p>
        <p>
          Below: three deterministic scenarios, each running one{' '}
          <code>selectAction</code> for Bob. The world setup is forced
          via <code>attemptAction</code> so the only thing that varies
          is what is sitting in Bob's queue and whether the embargo is
          already up.
        </p>
        <ActionSelectionFlow />
      </section>

      <section className="prose">
        <h3>Watch the queue fill and drain</h3>
        <p>
          Now back to a stochastic run. Ten turns rotating through Alice,
          Bob, Carol. Each row shows the active character's queue at the
          start of the turn, what got picked, and (if it was a tease)
          what just got pushed onto the target's queue. A retaliate row
          points back to the tease turn that produced it.
        </p>
        <p>
          On the chronicle side, every action record now carries causal
          metadata. <code>retaliate</code>'s <code>causes</code> field
          points back to the tease that queued it; the tease's{' '}
          <code>caused</code> field points forward to the retaliate. That
          is what powers <code>caused</code> in queries and{' '}
          <code>caused</code> as a relation in sifting patterns: the
          chronicle is now a graph, not just a list.
        </p>
      </section>

      <Stage8Demo />
    </>
  )
}
