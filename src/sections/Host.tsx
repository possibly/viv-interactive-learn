import { HighlightedTs } from '../sandbox/highlight'

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

export default function Host() {
  return (
    <section className="prose" id="host">
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
  )
}
