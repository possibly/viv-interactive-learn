import SelectorCascadeDemo from '../sandbox/SelectorCascadeDemo'
import { HighlightedTs, HighlightedViv } from '../sandbox/highlight'

interface Props {
  source: string
}

const HOST_SNIPPET = `// No new runtime call. Same selectAction as before.
//
// On Bob's turn, the runtime sees the respond-to-tease selector
// in his queue, walks the candidates in order, fires whichever
// passes targeting first, and returns that action's ID -- not
// the selector's. From the host's perspective, a selector is
// just a more elaborate way for a reaction to specify what to do
// next; the host doesn't see the dispatch.

const actionID = await selectAction({ initiatorID: "bob" });

// actionID points at the action that fired (retaliate or pout),
// never at the selector. The chronicle never contains a selector
// entry, only the chosen action.
`

const GENERAL_SELECTION_SNIPPET = `// A non-reserved action selector. Drop the \`reserved\` marker
// and the runtime will offer this selector to general action
// selection alongside non-reserved actions. The constraint: every
// role on the selector (and every binding it does into its
// candidates) must be castable by the runtime, since there is no
// reaction's \`with\` clause to precast non-initiator roles.

action wave:
    importance: 1
    report: '{@waver.name} waves at nobody in particular'
    roles:
        @waver:
            as: initiator

action shrug:
    importance: 1
    report: '{@shrugger.name} shrugs'
    roles:
        @shrugger:
            as: initiator

// No \`reserved\`. The selector itself becomes a candidate in
// every general selectAction call -- if the runtime picks it,
// the with-weights policy chooses between wave and shrug at a
// 10:1 ratio.
action-selector idle-gesture:
    target with weights:
        (10) wave;
        (1) shrug;
`

export default function Selectors({ source }: Props) {
  return (
    <>
      <section className="prose" id="selectors">
        <h2>Many candidates, one policy</h2>
        <p>
          Reactions queue a single action by name. Often that's enough,
          but sometimes the right move depends on context: an author
          wants the runtime to consider several candidates and pick
          one. The construct for this is an{' '}
          <a
            href="https://viv.sifty.studio/reference/language/18-selectors/"
            target="_blank"
            rel="noreferrer"
          >
            action selector
          </a>{' '}
          -- a named menu of actions plus a policy for choosing among
          them.
        </p>
        <p>The three policies are:</p>
        <ul>
          <li>
            <code>target randomly</code> -- pick uniformly at random
            from the candidates.
          </li>
          <li>
            <code>target with weights</code> -- pick proportionally to
            per-candidate weight expressions, similar to{' '}
            <a href="#importance">importance</a> for general selection.
          </li>
          <li>
            <code>target in order</code> -- try each candidate in
            sequence; fire the first whose targeting succeeds. Failed
            targeting (a condition, an embargo, an empty casting pool)
            cascades to the next candidate.
          </li>
        </ul>
        <p>
          We rewrite the tease reaction to use a selector with{' '}
          <code>target in order</code>. The selector tries{' '}
          <code>retaliate</code> first; if the per-pair retaliate
          embargo blocks it (because the target already retaliated
          against this bully once), the cascade falls through to a new{' '}
          <code>pout</code> action. Both candidates are{' '}
          <code>reserved</code>, so neither can be picked by general
          selection -- they only happen via this selector.
        </p>
        <HighlightedViv code={source} />
        <p>A few details to notice:</p>
        <ul>
          <li>
            <strong>The selector is <code>reserved</code></strong> for
            the same reason reserved actions are reserved: it has
            non-initiator precast roles (<code>@bully</code>). Only
            reactions or other selectors can target it.
          </li>
          <li>
            <strong>
              <code>@bully: as: character, precast</code>
            </strong>{' '}
            -- the role labels field accepts comma-separated labels.
            Here we declare both the entity type and the modifier
            label that says "this role is filled by the queueing
            reaction's <code>with</code> clause, not cast at runtime".
          </li>
          <li>
            <strong>Initiator pass-through.</strong> The selector
            declares <code>@hurt: as: initiator</code>; each candidate
            then binds its own initiator role to <code>@hurt</code>
            via <code>with partial</code>. This is the convention --
            an action selector requires an initiator, and each
            candidate's initiator must be the selector's initiator.
          </li>
        </ul>
      </section>

      <section className="prose">
        <h3>How the host targets a selector</h3>
        <p>
          There is no new runtime API for selectors. The host code
          looks identical to stage 8: a single{' '}
          <code>selectAction({"{ initiatorID }"})</code> call per
          turn. The selector lives entirely on the runtime's side,
          reachable through two paths:
        </p>
        <ol>
          <li>
            <strong>Queued by a reaction</strong> -- the path our
            cascade above takes. When tease fires, its reaction
            queues <code>respond-to-tease</code> for the target's
            queue. On the target's next{' '}
            <code>selectAction</code>, the runtime targets the
            selector ahead of any general candidate, walks its
            policy, and fires whichever candidate passes targeting.
          </li>
          <li>
            <strong>Considered in general selection</strong> -- if
            the selector is <em>not</em> marked <code>reserved</code>,
            the runtime offers it as a candidate alongside non-reserved
            actions in general action targeting (see the next
            subsection).
          </li>
        </ol>
        <p>
          Either way, <code>selectAction</code> returns the entity
          ID of the action that ultimately fired, never the
          selector's. The chronicle records actions; a selector is
          dispatch logic and leaves no trace of its own.
        </p>
        <HighlightedTs code={HOST_SNIPPET} />
      </section>

      <section className="prose">
        <h3>Selectors in general action selection</h3>
        <p>
          Drop the <code>reserved</code> marker and the selector
          becomes a top-level candidate in every general{' '}
          <code>selectAction</code> call -- the same eligible pool
          as the page's other actions. This is how authors group
          alternatives without taxing the picker: instead of three
          peer actions competing on importance, one selector
          competes on importance and then resolves internally.
        </p>
        <HighlightedViv code={GENERAL_SELECTION_SNIPPET} />
        <p>
          The runtime's targeting algorithm doesn't change. From{' '}
          <code>selectAction</code>'s perspective, a non-reserved
          selector is just another row in the candidate list:
          eligibility check, role casting, condition evaluation, and
          a weighted pick. If the selector wins the pick, the
          runtime then runs the selector's own policy to choose
          which candidate fires.
        </p>
        <p>
          The constraint: an action selector that participates in
          general selection cannot have non-initiator precast roles.
          There is no reaction's <code>with</code> clause to fill
          them. Every role the selector declares must be castable
          from the host's world the way an action's roles are -- by
          proximity, by an explicit casting pool, or via initiator
          pass-through. Our <code>respond-to-tease</code> selector
          fails this test (it precasts <code>@bully</code>), which
          is why it stays reserved.
        </p>
      </section>

      <section className="prose">
        <h3>Watch the cascade</h3>
        <p>
          Two deterministic scenarios for the same target (Bob), set
          up via <code>attemptAction</code>. In scenario 1, Carol
          teases Bob and the selector picks the first candidate. In
          scenario 2, Bob has already retaliated against Carol once,
          activating the per-pair embargo; a second tease queues
          another selector, and this time the cascade has to fall
          through to <code>pout</code>.
        </p>
        <SelectorCascadeDemo />
      </section>
    </>
  )
}

