import {
  EntityTypeValues,
  type EntityTypeValue,
  type HostAdapter,
  type UID,
} from '../viv'

// ---- World shape ------------------------------------------------------

export type EntityRecord = Record<string, unknown> & {
  entityType?: EntityTypeValue
  id?: UID
  name?: string
  location?: UID
}

export interface WorldState {
  timestamp: number
  entities: Record<UID, EntityRecord>
  characters: UID[]
  locations: UID[]
  items: UID[]
  actions: UID[]
  vivInternalState: unknown
  // Per-character running narrative log.
  chronicle: ChronicleEntry[]
}

export interface ChronicleEntry {
  actionID: UID
  actionName: string
  initiatorID: UID
  timestamp: number
  report: string
  reactionsQueued?: number
}

// Each stage may need a slightly larger state shape (e.g. tipsy in stage 4).
// To keep the host code identical across stages we just initialize *all* the
// per-character properties used by *any* stage. That mirrors a real project
// where you'd flesh out your character schema gradually.

const CHARACTERS: Array<{ id: UID; name: string }> = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
  { id: 'carol', name: 'Carol' },
]

export function createInitialWorld(opts: {
  initialMood?: number
  withTavern?: boolean
}): WorldState {
  const state: WorldState = {
    timestamp: 0,
    entities: {},
    characters: [],
    locations: [],
    items: [],
    actions: [],
    vivInternalState: null,
    chronicle: [],
  }

  const tavernID: UID = 'tavern'
  state.locations.push(tavernID)
  state.entities[tavernID] = {
    entityType: EntityTypeValues.Location,
    id: tavernID,
    name: 'The Crooked Tankard',
    is_tavern: !!opts.withTavern,
  }

  for (const c of CHARACTERS) {
    state.characters.push(c.id)
    state.entities[c.id] = {
      entityType: EntityTypeValues.Character,
      id: c.id,
      name: c.name,
      location: tavernID,
      mood: opts.initialMood ?? 0,
      tipsy: 0,
      memories: {},
    }
  }

  if (opts.withTavern) {
    for (const aleID of ['ale-1', 'ale-2', 'ale-3'] as const) {
      state.items.push(aleID)
      state.entities[aleID] = {
        entityType: EntityTypeValues.Item,
        id: aleID,
        name: 'a tankard of ale',
        location: tavernID,
      }
    }
  }

  return state
}

// ---- Adapter ---------------------------------------------------------

const setIn = (obj: EntityRecord, path: string | string[], value: unknown): void => {
  const parts = Array.isArray(path) ? path : String(path).split('.')
  let cur: Record<string, unknown> = obj as Record<string, unknown>
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {}
    cur = cur[k] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = value
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
      if (state.entities[id] === undefined) throw new Error(`no entity: ${id}`)
      setIn(state.entities[id], path, value)
    },
    saveActionData: (id, data) => {
      if (state.entities[id] === undefined) state.actions.push(id)
      state.entities[id] = data as EntityRecord
    },
    getCurrentTimestamp: () => state.timestamp,
    getEntityIDs: (type, locationID) => {
      if (locationID) {
        if (type === EntityTypeValues.Character) {
          return state.characters.filter((id) => state.entities[id].location === locationID)
        }
        if (type === EntityTypeValues.Item) {
          return state.items.filter((id) => state.entities[id].location === locationID)
        }
        throw new Error(`invalid type for location query: ${type}`)
      }
      switch (type) {
        case EntityTypeValues.Character:
          return [...state.characters]
        case EntityTypeValues.Item:
          return [...state.items]
        case EntityTypeValues.Location:
          return [...state.locations]
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
      const e = state.entities[characterID] as EntityRecord & {
        memories?: Record<string, unknown>
      }
      e.memories = e.memories ?? {}
      e.memories[actionID] = memory
    },
    saveItemInscriptions: (itemID, inscriptions) => {
      ;(state.entities[itemID] as EntityRecord & { inscriptions?: unknown }).inscriptions = inscriptions
    },
    enums: {
      // Numeric scale used by importance / salience throughout the demo.
      // Authors pick the scale -- the runtime just needs each name defined.
      LOW: 1,
      MODERATE: 3,
      HIGH: 5,
      EXTREME: 10,
      LIFE_CHANGING: 25,
    },
    debug: { validateAPICalls: true, watchlists: {} },
  }
}

// Snapshot helpers for the playground UI.
export function snapshotCharacters(state: WorldState): Array<EntityRecord> {
  return state.characters.map((id) => structuredClone(state.entities[id]))
}

export function actionRecord(state: WorldState, actionID: UID): EntityRecord | undefined {
  return state.entities[actionID]
}
