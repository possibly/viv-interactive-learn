// Wrapper around the vendored Viv browser runtime.
//
// The upstream `runtimes/js` package on npm is Node-flavoured (depends on
// `ajv` + `semver`). The `browser/runtime` branch publishes a pre-bundled
// ESM build that just works in a page, so we vendor that file verbatim
// at `src/vendor/viv-runtime.js` and let Vite chunk it like any other
// dependency.
//
// We type the surface we use because the vendor file ships no .d.ts.

// @ts-expect-error vendor file has no types; we declare the shape below.
import * as vivRuntime from './vendor/viv-runtime.js'

export type UID = string

export const EntityTypeValues = {
  Character: 'character',
  Item: 'item',
  Location: 'location',
  Action: 'action',
} as const

export type EntityTypeValue = (typeof EntityTypeValues)[keyof typeof EntityTypeValues]

export interface ContentBundle {
  readonly [key: string]: unknown
}

export interface HostAdapterDebugSettings {
  validateAPICalls?: boolean
  watchlists?: Record<string, unknown>
}

export interface HostAdapter {
  provisionActionID: () => UID
  getEntityView: (id: UID) => unknown
  getEntityLabel: (id: UID) => string
  updateEntityProperty: (id: UID, path: string | string[], value: unknown) => void
  saveActionData: (id: UID, data: unknown) => void
  getCurrentTimestamp: () => number
  getEntityIDs: (type: EntityTypeValue, locationID?: UID) => UID[]
  getVivInternalState: () => unknown
  saveVivInternalState: (s: unknown) => void
  saveCharacterMemory?: (characterID: UID, actionID: UID, memory: unknown) => void
  saveItemInscriptions?: (itemID: UID, inscriptions: unknown) => void
  enums?: Record<string, number | string>
  debug?: HostAdapterDebugSettings
}

export interface InitializeArgs {
  contentBundle: ContentBundle
  adapter: HostAdapter
}

export interface SelectActionArgs {
  initiatorID: UID
}

// attemptAction lets the host force a specific action to fire with
// specified bindings. Useful for deterministic demo setup; in real
// use it covers things like player-driven actions.
export interface AttemptActionArgs {
  actionName: string
  initiatorID?: UID
  precastBindings?: Record<string, UID[]>
  causes?: UID[]
  suppressConditions?: true
}

// runSiftingPattern returns a single match if one is found, else null.
// A match is a mapping from role names (both pattern roles and the
// pattern's action variables) to arrays of UIDs. Action variables
// resolve to action IDs, character roles to character IDs.
export type SiftingMatch = Record<string, UID[]>

export interface RunSiftingPatternArgs {
  patternName: string
  precastBindings?: Record<string, UID[]>
  searchDomain?: UID
}

interface VivModule {
  initializeVivRuntime: (args: InitializeArgs) => unknown
  selectAction: (args: SelectActionArgs) => Promise<UID | null>
  attemptAction: (args: AttemptActionArgs) => Promise<UID | null>
  runSiftingPattern: (args: RunSiftingPatternArgs) => Promise<SiftingMatch | null>
  EntityType: Record<string, EntityTypeValue>
}

const viv = vivRuntime as unknown as VivModule

// loadViv is async only for backward compat with earlier dynamic-import path.
export function loadViv(): Promise<VivModule> {
  return Promise.resolve(viv)
}
