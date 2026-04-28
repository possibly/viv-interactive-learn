import Stage11Demo from '../sandbox/Stage11Demo'
import { HighlightedViv } from '../sandbox/highlight'

interface Props {
  source: string
}

export default function Tropes({ source }: Props) {
  return (
    <>
      <section className="prose" id="tropes">
        <h2>Naming a relational pattern</h2>
        <p>
          Up to now every action's conditions have been written inline. That
          works fine when each pattern only shows up once, but the moment two
          actions need the same relational check -- "these two characters
          actively dislike each other", "this character looks up to that one"
          -- you start duplicating logic, and inevitably one copy drifts
          while the other stays put.
        </p>
        <p>
          A{' '}
          <a
            href="https://viv.sifty.studio/reference/language/14-tropes/"
            target="_blank"
            rel="noreferrer"
          >
            trope
          </a>{' '}
          is a named, parameterised bundle of conditions. You declare the
          roles it relates and the statements that must hold over them; any
          action, query, or sifting pattern can then test it with{' '}
          <code>fit trope &lt;name&gt;</code> and pass bindings.
        </p>
        <p>
          To make this concrete we give the friends two list properties:{' '}
          <code>dislikes</code> and <code>admires</code>, each a roster of
          other character IDs. Two tropes capture our patterns:{' '}
          <code>rivalry</code> (mutual -- both characters list each other
          under <code>dislikes</code>) and <code>admiration</code>{' '}
          (directional -- the idol is on the admirer's{' '}
          <code>admires</code> list). Two new actions,{' '}
          <code>snipe</code> and <code>compliment</code>, gate on them;{' '}
          <code>greet</code> stays unconditional as the neutral baseline.
        </p>
        <HighlightedViv code={source} />
        <p>A few details to notice:</p>
        <ul>
          <li>
            <strong>Tropes are top-level, not action-scoped.</strong> Like
            queries and sifting patterns, a trope is a free-standing
            authoring construct. Multiple actions can share one.
          </li>
          <li>
            <strong>Their conditions are ordinary statements.</strong> Same
            expression language as action conditions -- comparisons,{' '}
            <code>&amp;&amp;</code>, <code>preceded</code>, <code>knows</code>,
            even other trope fits. The only constraint is that every
            statement must evaluate to truthy for the trope to fit.
          </li>
          <li>
            <strong>
              <code>fit trope &lt;name&gt;: with: ...</code>
            </strong>{' '}
            is the call site. The <code>with</code> block maps the trope's
            roles to whichever role-references the calling site has in
            scope. Here <code>snipe</code> binds the trope's{' '}
            <code>@a</code> and <code>@b</code> to its own{' '}
            <code>@aggressor</code> and <code>@rival</code>; the trope
            doesn't care what the caller calls them.
          </li>
          <li>
            <strong>The runtime treats a trope fit like any condition.</strong>{' '}
            From <code>selectAction</code>'s perspective, the action is
            castable when all its conditions evaluate to true; whether one
            of them happens to be a trope fit is incidental. The compiler
            inlines the trope's statements into the calling site's
            evaluation, with role bindings substituted.
          </li>
        </ul>
      </section>

      <section className="prose">
        <h3>Trope-fit explorer</h3>
        <p>
          Click the toggles to add or remove directional{' '}
          <code>dislikes</code>/<code>admires</code> entries. The runtime
          reads from the same world via <code>getEntityView</code>, so each
          pair's fit verdict updates live below. Press{' '}
          <em>Step a turn</em> to call <code>selectAction</code> against
          the current state; the chronicle records whichever action
          survived its conditions.
        </p>
        <p>
          A few things to try: dislike-toggle Alice ↔ Bob both directions
          and watch <code>snipe</code> become eligible only between the
          two of them; have Carol admire Alice and watch the chronicle
          start filling with compliments on Carol's turn; flip every pair
          to mutual dislike and watch the chronicle fill with snipes
          regardless of who's up.
        </p>
        <Stage11Demo />
      </section>
    </>
  )
}
