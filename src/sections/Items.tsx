import Stage15Demo from '../sandbox/Stage15Demo'
import { HighlightedTs, HighlightedViv } from '../sandbox/highlight'

interface Props {
  source: string
}

const HOST_ITEMS = `// One new adapter callback for inscription.
// getEntityIDs and updateEntityProperty already handle items — the
// only addition is saving the updated inscriptions array when the
// runtime calls back after an inscription effect fires.

saveItemInscriptions(itemID, inscriptions) {
  entities[itemID].inscriptions = inscriptions;
},
`

export default function Items({ source }: Props) {
  return (
    <>
      <section className="prose" id="items">
        <h2>Items that record history</h2>
        <p>
          The beer section showed items participating in actions and carrying
          mutable properties. Two more effect keywords turn an item into a
          historical record:
        </p>
        <ul>
          <li>
            <strong>
              <code>@journal inscribe @this</code>
            </strong>{' '}
            — appends this action's ID to the item's <code>inscriptions</code>{' '}
            array. Every write leaves a permanent entry; the journal becomes a
            ledger of everything that happened to it. The runtime calls{' '}
            <code>saveItemInscriptions</code> on the host adapter after each
            inscription.
          </li>
          <li>
            <strong>
              <code>@reader inspect @journal</code>
            </strong>{' '}
            — transfers that ledger to a character. For every action already
            inscribed on the item, the reader gains a memory entry just as if
            they had actively participated. Knowledge travels from object to mind.
          </li>
        </ul>
        <HighlightedViv code={source} />
        <p>
          The only new host responsibility is <code>saveItemInscriptions</code>.
          Everything else — <code>getEntityIDs</code>, <code>updateEntityProperty</code>,{' '}
          <code>saveCharacterMemory</code> — is already in place:
        </p>
        <HighlightedTs code={HOST_ITEMS} />
      </section>

      <section className="prose">
        <h3>See inscription and inspection in action</h3>
        <p>
          Step through turns to watch characters write in and read the journal
          naturally. Watch the journal's inscriptions list grow on the left, and
          when a character reads it the knowledge panel shows entries tagged{' '}
          <em>via journal</em> — memories transferred from the item, not from
          direct participation. Use the buttons to force a specific character to
          read right now.
        </p>
      </section>

      <Stage15Demo />
    </>
  )
}
