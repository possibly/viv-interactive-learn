import { HighlightedTs } from '../sandbox/highlight'

const HOST_WITH_VIV = `import { initializeVivRuntime, selectAction, EntityType } from "viv-runtime";

// ...entities map and characters list from before...

// The adapter bridges the runtime and the host: it answers
// questions about entities and stores action records. (A few
// bookkeeping callbacks are omitted for space.)
const adapter = {
  getEntityIDs: (type) =>
    type === EntityType.Character ? characters : [],
  getEntityView: (id) => structuredClone(entities[id]),
  saveActionData: (id, data) => { entities[id] = data; },
};

initializeVivRuntime({ contentBundle, adapter });

// The game loop: hand selectAction one character at a time.
// Everything else (which action, which cast, which effects) is the
// runtime's job.

while (true) {
  for (const character of characters) {
    await selectAction({ initiatorID: character });
  }
}
`

export default function WireRuntime() {
  return (
    <section className="prose" id="wire">
      <h2>Wire the runtime into the host</h2>
      <p>
        Three additions to the host: import the runtime, initialize it, and let it drive
        the loop.
      </p>
      <HighlightedTs code={HOST_WITH_VIV} />
      <p>
        The <code>adapter</code> referenced in <code>initializeVivRuntime</code> is the
        small bridge that lets the runtime read and write our entities through callbacks
        (<code>getEntityIDs</code>, <code>updateEntityProperty</code>, and friends).
      </p>
    </section>
  )
}
