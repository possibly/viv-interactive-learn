import Stage3Demo from '../sandbox/Stage3Demo'
import { HighlightedTs, HighlightedViv } from '../sandbox/highlight'

const HOST_ADAPTER = `// Add one new callback to the adapter we wrote earlier.
// The runtime calls updateEntityProperty once per effect statement,
// after a cast is picked, with (entityID, propertyPath, newValue).

const adapter = {
  // ...callbacks from before (getEntityIDs, getEntityView, ...)...

  updateEntityProperty(id, path, value) {
    // path looks like ["cheerful"] or ["inventory", "sword"].
    let cur = entities[id];
    for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
    cur[path[path.length - 1]] = value;
  },
};
`

interface Props {
  source: string
}

export default function Effects({ source }: Props) {
  return (
    <>
      <section className="prose" id="effects">
        <h2>Actions that change the world</h2>
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
        <HighlightedViv code={source} />
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
        <h3>
          Let's look at how our friends at the tavern now greet, tease, and cheer each
          other up
        </h3>
        <p>
          Step 4 still picks one passing cast at random, but it also lists the picked
          action's effect statements and shows a snapshot of the world after they ran.
          Whichever character was touched gets an outline and a "before → after"
          annotation.
        </p>
      </section>

      <Stage3Demo />
    </>
  )
}
