import Stage14Demo from '../sandbox/Stage14Demo'
import { HighlightedTs, HighlightedViv } from '../sandbox/highlight'

interface Props {
  source: string
}

const HOST_ITEMS = `// getEntityIDs must now return item IDs when type === "item".
// The runtime uses them to fill item roles exactly the same way
// it uses character IDs to fill character roles.

getEntityIDs(type, locationID) {
  if (type === "character") return [...characters];
  if (type === "item")      return [...items];   // ← new
  return [];
},

// Item property changes arrive through the same callback as
// character property changes — updateEntityProperty works for
// any entity type.

updateEntityProperty(id, path, value) {
  let cur = entities[id];
  for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
  cur[path[path.length - 1]] = value;
},
`

export default function ItemsInventory({ source }: Props) {
  return (
    <>
      <section className="prose" id="items-inventory">
        <h2>Items and a basic inventory</h2>
        <p>
          So far every entity in the world has been a character. Viv supports a
          third entity type: <strong>items</strong>. Items live at a location and
          can participate in actions just like characters do — declared with{' '}
          <code>as: item</code> in a role block.
        </p>
        <p>
          The tavern below stocks three beers. Three actions create a small item
          lifecycle:
        </p>
        <ul>
          <li>
            <code>buy-beer</code> — casts a <em>free</em> beer (
            <code>@beer.held == false</code>) into the <code>@beer</code> role,
            marks it held, and increments the buyer's <code>beers</code> counter.
          </li>
          <li>
            <code>give-beer</code> — transfers a beer between two characters.
            No item role needed here: the "beer" is implicit in the character
            counters, which is a common shortcut when the specific item instance
            doesn't matter.
          </li>
          <li>
            <code>drink-beer</code> — casts a <em>held</em> beer (
            <code>@beer.held == true</code>), marks it free again, and
            decrements the drinker's counter. The beer cycles back to the bar.
          </li>
        </ul>
        <HighlightedViv code={source} />
        <p>
          The host only needs two changes to support items. The runtime calls
          existing callbacks — no new ones are required yet:
        </p>
        <HighlightedTs code={HOST_ITEMS} />
        <p>
          Item roles, conditions, and effects use exactly the same syntax as
          their character equivalents. The runtime doesn't treat items specially
          during casting — it just uses <code>getEntityIDs("item", location)</code>{' '}
          instead of <code>getEntityIDs("character", location)</code> to build the
          candidate pool.
        </p>
      </section>

      <section className="prose">
        <h3>Watch the beer lifecycle</h3>
        <p>
          Each turn one character acts. The bar stock panel on the left shows
          each beer flipping between <em>free</em> and <em>held</em>; the
          inventory column on the right tracks each character's count. The
          chronicle tags every <code>buy-beer</code> and <code>drink-beer</code>{' '}
          entry with which specific beer was cast into the <code>@beer</code> role.
        </p>
      </section>

      <Stage14Demo />
    </>
  )
}
