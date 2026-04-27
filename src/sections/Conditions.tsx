import Stage2Demo from '../sandbox/Stage2Demo'
import { HighlightedTs, HighlightedViv } from '../sandbox/highlight'

const HOST_STAGE2 = `// Same entities, with one extra field per character. Bob's having
// a bad day; the others are not.

const entities = {
  alice: { id: "alice", name: "Alice", location: "tavern", cheerful: true  },
  bob:   { id: "bob",   name: "Bob",   location: "tavern", cheerful: false },
  carol: { id: "carol", name: "Carol", location: "tavern", cheerful: true  },
};
`

interface Props {
  source: string
}

export default function Conditions({ source }: Props) {
  return (
    <>
      <section className="prose" id="conditions">
        <h2>Gating actions with conditions</h2>
        <p>
          So far our friends only know how to greet. Let's extend the simulation: we want
          them to do more than say hello, but only some of those new actions should be
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
        <HighlightedViv code={source} />
        <p>
          Conditions reference role bindings (<code>@subject</code>) and any property the
          host stores on that entity. The compiler attaches each condition to the role it
          depends on, so the runtime evaluates it per cast, not per action.
        </p>
      </section>

      <section className="prose">
        <h3>
          What changes in <code>selectAction</code>
        </h3>
        <p>
          Steps 1 and 2 are unchanged. Step 3 now does real work: each cast is checked
          against its conditions, and any cast that fails is dropped before step 4 picks.
          Pick a character below; the cards that fail are stamped <code>FAIL</code> and
          fall out of the running.
        </p>
      </section>

      <Stage2Demo />
    </>
  )
}
