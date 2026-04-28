import {
  EntityTypeValues,
  type EntityTypeValue,
  type HostAdapter,
  type UID,
} from '../viv'

// The minimal world: three friends in a tavern, no moods, no items.
// The runtime queries the host through the adapter; for stage 1 it
// only ever needs to know which characters exist.

export type EntityRecord = Record<string, unknown> & {
  entityType?: EntityTypeValue
  id?: UID
  name?: string
}

export interface WorldState {
  entities: Record<UID, EntityRecord>
  characters: UID[]
  actions: UID[]
  vivInternalState: unknown
  // Diegetic clock. We advance it once per new action so that the
  // runtime's `preceded` relation has a strict temporal order to
  // work with. Without this, all actions would share timestamp 0
  // and `preceded` would fall back to a partial-order policy that
  // can match pairs in either chronological direction.
  turn: number
}

export interface ChronicleEntry {
  actionID: UID
  actionName: string
  initiatorID: UID
  report: string
}

const CHARACTERS: Array<{ id: UID; name: string }> = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
  { id: 'carol', name: 'Carol' },
]

const STAGE2_CHEERFUL: Record<UID, boolean> = {
  alice: true,
  bob: false,
  carol: true,
}

export function createInitialWorld(): WorldState {
  const state: WorldState = {
    entities: {},
    characters: [],
    actions: [],
    vivInternalState: null,
    turn: 0,
  }
  for (const c of CHARACTERS) {
    state.characters.push(c.id)
    state.entities[c.id] = {
      entityType: EntityTypeValues.Character,
      id: c.id,
      name: c.name,
      // `location` is one of the few fields the runtime always reads
      // (it checks role-presence by comparing locations). Everyone is
      // in the tavern, so they all share the same location.
      location: 'tavern',
      // Memories accumulate as the runtime calls saveCharacterMemory
      // (stage 9 onward); earlier stages just leave this empty.
      memories: {},
    }
  }
  return state
}

export function createStage2World(): WorldState {
  const state = createInitialWorld()
  for (const id of state.characters) {
    state.entities[id].cheerful = STAGE2_CHEERFUL[id] ?? false
  }
  return state
}

export function createStage3World(): WorldState {
  // Same starting traits as stage 2: alice ✓, bob ✗, carol ✓.
  return createStage2World()
}

// Stage 11 (tropes): each character carries two list properties --
// `dislikes` and `admires` -- listing the IDs of the other
// characters they feel that way about. Empty by default so neither
// trope fits out of the box; the user toggles relationships on to
// see eligibility change.
export interface RelationLists {
  dislikes: UID[]
  admires: UID[]
}

export type RelationMatrix = Record<UID, RelationLists>

export const STAGE11_DEFAULT_RELATIONS: RelationMatrix = {
  alice: { dislikes: [], admires: [] },
  bob: { dislikes: [], admires: [] },
  carol: { dislikes: [], admires: [] },
}

export function createStage11World(
  relations: RelationMatrix = STAGE11_DEFAULT_RELATIONS,
): WorldState {
  const state = createInitialWorld()
  for (const id of state.characters) {
    state.entities[id].dislikes = [...(relations[id]?.dislikes ?? [])]
    state.entities[id].admires = [...(relations[id]?.admires ?? [])]
  }
  return state
}

export const STAGE2_CHARACTERS: Array<{ id: UID; name: string; cheerful: boolean }> =
  CHARACTERS.map((c) => ({ ...c, cheerful: STAGE2_CHEERFUL[c.id] ?? false }))

export const STAGE11_CHARACTERS: Array<{ id: UID; name: string }> = CHARACTERS.map((c) => ({
  id: c.id,
  name: c.name,
}))

export function makeAdapter(state: WorldState): HostAdapter {
  return {
    provisionActionID: () => crypto.randomUUID(),
    getEntityView: (id) => {
      if (state.entities[id] === undefined) throw new Error(`no entity: ${id}`)
      return structuredClone(state.entities[id])
    },
    getEntityLabel: (id) => {
      if (state.entities[id] === undefined) throw new Error(`no entity: ${id}`)
      return String(state.entities[id].name ?? id)
    },
    updateEntityProperty: (id, path, value) => {
      // Stage 1 has no effects, so this never fires; we still implement
      // it because the adapter contract requires it whenever the bundle
      // contains entity-data assignments. Future stages will use it.
      if (state.entities[id] === undefined) throw new Error(`no entity: ${id}`)
      const parts = Array.isArray(path) ? path : String(path).split('.')
      let cur = state.entities[id] as Record<string, unknown>
      for (let i = 0; i < parts.length - 1; i++) {
        const k = parts[i]
        if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {}
        cur = cur[k] as Record<string, unknown>
      }
      cur[parts[parts.length - 1]] = value
    },
    saveActionData: (id, data) => {
      // The runtime can call saveActionData more than once for the
      // same action (its causes/caused fields update as later
      // actions reference it), so only advance the clock the first
      // time we see a given action ID.
      if (state.entities[id] === undefined) {
        state.actions.push(id)
        state.turn += 1
      }
      state.entities[id] = data as EntityRecord
    },
    getCurrentTimestamp: () => state.turn,
    getEntityIDs: (type, locationID) => {
      // Stage 1 has only the tavern, so when the runtime asks "who's
      // at locationID?" we hand back everyone of that type.
      void locationID
      switch (type) {
        case EntityTypeValues.Character:
          return [...state.characters]
        case EntityTypeValues.Item:
          return []
        case EntityTypeValues.Location:
          return []
        case EntityTypeValues.Action:
          return [...state.actions]
        default:
          throw new Error(`invalid entity type: ${type}`)
      }
    },
    getVivInternalState: () => structuredClone(state.vivInternalState),
    saveVivInternalState: (s) => {
      state.vivInternalState = structuredClone(s)
    },
    saveCharacterMemory: (characterID, actionID, memory) => {
      // Each character keeps a memory book of actions they were
      // actively involved in. The runtime calls this once per
      // active role per action; bystanders aren't tracked unless
      // a `bystanders` role was declared on the action.
      if (state.entities[characterID] === undefined) return
      const ent = state.entities[characterID]
      if (!ent.memories || typeof ent.memories !== 'object') {
        ent.memories = {}
      }
      ;(ent.memories as Record<UID, unknown>)[actionID] = memory
    },
    saveItemInscriptions: () => {},
    debug: { validateAPICalls: true, watchlists: {} },
  }
}

export function characterEntities(state: WorldState): EntityRecord[] {
  return state.characters.map((id) => state.entities[id])
}

export function actionRecord(state: WorldState, actionID: UID): EntityRecord | undefined {
  return state.entities[actionID]
}
