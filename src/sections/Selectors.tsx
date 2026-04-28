import SelectorCascadeDemo from '../sandbox/SelectorCascadeDemo'
import { HighlightedViv } from '../sandbox/highlight'

interface Props {
  source: string
}

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
          <li>
            <strong>What gets returned.</strong> The selector itself
            isn't a chronicle entry. <code>selectAction</code> still
            returns the action ID of whichever candidate fired. The
            selector is just dispatch logic.
          </li>
        </ul>
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
