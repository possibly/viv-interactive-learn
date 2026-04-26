// String snippets shown in the playground's "Host code" tab.
//
// These are slightly trimmed versions of the real adapter / bootstrap
// code in `world.ts` and `Sandbox.tsx`. We keep them as literal strings
// (instead of pulling them in via raw imports) so that the displayed
// shape stays purposefully *minimal* for teaching. The big idea: the
// host code is the same across stages -- only the bundle changes.

export const HOST_BOOTSTRAP = `// One-time bootstrap (identical across every stage of the demo).
// Only the content bundle changes; the host stays put.

import { initializeVivRuntime, selectAction, EntityType } from "viv-runtime";

const STATE = {
  timestamp: 0,
  entities: {},
  characters: ["alice", "bob", "carol"],
  locations: ["tavern"],
  items: [],
  actions: [],
  vivInternalState: null,
};

const ADAPTER = {
  provisionActionID: () => crypto.randomUUID(),
  getEntityView:    (id) => structuredClone(STATE.entities[id]),
  getEntityLabel:   (id) => STATE.entities[id].name,
  updateEntityProperty: (id, path, value) => setIn(STATE.entities[id], path, value),
  saveActionData:   (id, data) => { STATE.entities[id] = data; STATE.actions.push(id); },
  getCurrentTimestamp: () => STATE.timestamp,
  getEntityIDs: (type, locationID) => /* filter STATE arrays */,
  getVivInternalState: () => structuredClone(STATE.vivInternalState),
  saveVivInternalState: (s) => { STATE.vivInternalState = structuredClone(s); },
  saveCharacterMemory: (cid, aid, mem) => { STATE.entities[cid].memories[aid] = mem; },
};

const bundle = await fetch("./bundle.json").then(r => r.json());
initializeVivRuntime({ contentBundle: bundle, adapter: ADAPTER });

// Run a "tick": let each character try to do something.
for (const cid of STATE.characters) {
  await selectAction({ initiatorID: cid });
}
STATE.timestamp += 10;
`

export const STEP_LOOP = `// What "Step" does in the playground:
async function step() {
  const cid = STATE.characters[turnIndex % STATE.characters.length];
  // Viv picks an action that 'cid' can take, casts the other roles,
  // checks conditions, runs effects, and persists everything via the
  // adapter. The returned actionID is null only when no action targets.
  const actionID = await selectAction({ initiatorID: cid });
  if (actionID) chronicle.push(STATE.entities[actionID]);
  turnIndex++;
}
`

// Hand-written equivalents of stages 1 & 2 -- "what would I write if I
// just kept this in the host?" -- as a foil for the section that argues
// for the DSL.

export const HOST_ONLY_STAGE_1 = `// Hand-rolled equivalent of Stage 1 -- one greeting, no DSL.
// Looks lean! ~15 lines for the whole thing.

function tick(state) {
  for (const greeter of state.characters) {
    const others = state.characters.filter((c) => c !== greeter);
    const friend = others[Math.floor(Math.random() * others.length)];
    state[greeter].mood += 5;
    state[friend].mood += 5;
    chronicle.push(\`\${greeter} smiles and waves at \${friend}\`);
  }
}
`

export const HOST_ONLY_STAGE_2 = `// Hand-rolled equivalent of Stage 2 -- now with conditions.
// Already rougher: each new action grows the if/else and the
// "who is even eligible?" search has to be repeated by hand.

function tick(state) {
  for (const cid of state.characters) {
    const me = state[cid];
    const eligible = [];

    // hello: always eligible.
    for (const other of state.characters) {
      if (other !== cid) eligible.push({ kind: "hello", roles: { friend: other } });
    }

    // gossip: only when in a foul mood.
    if (me.mood < 0) {
      for (const listener of state.characters) {
        if (listener === cid) continue;
        for (const subject of state.characters) {
          if (subject === cid || subject === listener) continue;
          eligible.push({ kind: "gossip", roles: { listener, subject } });
        }
      }
    }

    if (!eligible.length) continue;
    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    applyEffects(state, cid, pick);
    chronicle.push(report(cid, pick));
  }
}

// ...and you still need an applyEffects table, a report renderer per
// kind, salience weighting, location filtering, reaction queuing, ...
// each new feature touches every action by hand.
`

export const HOST_ONLY_TAKEAWAY = `// At Stage 1, hand-rolling is fine.
// At Stage 2, you start typing the same shape over and over.
// At Stage 4, every action grows a copy of "find the right items in
//   the right room", and your conditions and effects drift apart.
// At Stage 5, you reinvent a queue, a causality model, and a way to
//   serialise it for story sifting.
//
// That is roughly the slope Viv is built around. The DSL is not magic --
// it's the surface area that lets the runtime (a) cast roles and check
// conditions for you, (b) own the action queue, and (c) carry causal
// metadata so that sifting can find emergent arcs later.
`
