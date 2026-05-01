import Stage15Demo from '../sandbox/Stage15Demo'
import { HighlightedTs, HighlightedViv } from '../sandbox/highlight'

interface Props {
  source: string
}

const HOST_ITEMS = `// Two new adapter responsibilities for items.

const adapter = {
  // ...callbacks from before...

  // getEntityIDs must now return item IDs when type === "item".
  // The runtime uses them to fill item roles, the same way it uses
  // character IDs to fill character roles.
  getEntityIDs(type, locationID) {
    if (type === "character") return [...characters];
    if (type === "item")      return [...items];      // ← new
    return [];
  },

  // The runtime calls this after every inscription effect fires,
  // passing the item ID and the full updated inscriptions array.
  saveItemInscriptions(itemID, inscriptions) {
    entities[itemID].inscriptions = inscriptions;    // ← new
  },
};
`

export default function Items({ source }: Props) {
  return (
    <>
      <section className="prose" id="items">
        <h2>Items: physical objects that carry history</h2>
        <p>
          So far every entity in the world has been a character. Viv supports a
          third entity type:{' '}
          <strong>items</strong> — physical objects that live at a location and
          can participate in actions. The canonical use-case is a written artefact:
          a notice board, a journal, a letter, a tombstone.
        </p>
        <p>
          An item role is declared with <code>as: item</code>. During casting,
          the runtime fills it from whatever items are present at the initiator's
          location (via the <code>getEntityIDs</code> adapter callback, now
          called with <code>type === "item"</code>).
        </p>
        <p>
          Two new effect keywords unlock the item's storytelling power:
        </p>
        <ul>
          <li>
            <strong>
              <code>@journal inscribe @this</code>
            </strong>{' '}
            — appends this action's ID to the item's <code>inscriptions</code>{' '}
            array. The journal becomes a ledger of everything that happened to it.
            The runtime calls <code>saveItemInscriptions</code> on the host adapter
            immediately after the effect fires.
          </li>
          <li>
            <strong>
              <code>@reader inspect @journal</code>
            </strong>{' '}
            — transfers the item's history to a character. For every action
            inscribed on the item, the reader gains a memory entry just as if
            they had actively participated. Knowledge travels from object to mind.
          </li>
        </ul>
        <HighlightedViv code={source} />
        <p>
          On the host side, two adapter callbacks gain new responsibilities:
        </p>
        <HighlightedTs code={HOST_ITEMS} />
        <p>
          That's all the host needs to add. The runtime handles casting, the
          inscription bookkeeping, and the memory transfer during inspection —
          the host just stores what it's handed and returns item IDs when asked.
        </p>
      </section>

      <section className="prose">
        <h3>See inscription and inspection in action</h3>
        <p>
          Step through turns to watch characters greet, write in, and read the
          journal naturally — <code>read-journal</code> is a regular action
          that <code>selectAction</code> can pick just like any other. Watch the
          journal's inscriptions list grow, and when a character reads it the
          knowledge panel on the right shows entries tagged{' '}
          <em>via journal</em> — memories transferred from the item, not from
          direct participation. Use the buttons in the controls to force a
          specific character to read right now.
        </p>
      </section>

      <Stage15Demo />
    </>
  )
}
