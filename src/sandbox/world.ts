import {
  EntityTypeValues,
  type EntityTypeValue,
  type HostAdapter,
  type UID,
} from '../viv'

// The minimal world: three friends, no spatial state, no moods, no
// items. The runtime queries the host through the adapter; for stage 1
// it only ever needs to know which characters exist.

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

export function createInitialWorld(): WorldState {
  const state: WorldState = {
    entities: {},
    characters: [],
    actions: [],
    vivInternalState: null,
  }
  for (const c of CHARACTERS) {
    state.characters.push(c.id)
    state.entities[c.id] = {
      entityType: EntityTypeValues.Character,
      id: c.id,
      name: c.name,
      // `location` is one of the few fields the runtime always reads
      // (it checks role-presence by comparing locations). Keeping it
      // `null` for every character means "everyone's in the same
      // unmodelled space" -- equivalent to a single shared room, but
      // without us having to invent one yet.
      location: null,
    }
  }
  return state
}

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
      if (state.entities[id] === undefined) state.actions.push(id)
      state.entities[id] = data as EntityRecord
    },
    getCurrentTimestamp: () => 0,
    getEntityIDs: (type, locationID) => {
      // No location modelled at stage 1: when the runtime asks "who's
      // at locationID?", we give it everyone of that type. Adapters
      // conventionally treat an unset locationID the same way.
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
    saveCharacterMemory: () => {},
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
