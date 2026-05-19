// Data for the causal-graph lesson.
//
// A fixed 19-event story template (gossip in a small social world)
// demonstrates all four ways the Viv runtime builds causal links.
// Character names are randomisable via a seed without changing the
// causal structure, so learners can see that the graph topology is
// independent of which specific character fills each role.

export type CauseMethod = 'action-role' | 'reaction' | 'knowledge-relay' | 'inscription'

export const METHOD_COLOR: Record<CauseMethod, string> = {
  'action-role':      '#2563eb',
  'reaction':         '#16a34a',
  'knowledge-relay':  '#d97706',
  'inscription':      '#9333ea',
}

export const METHOD_LABEL: Record<CauseMethod, string> = {
  'action-role':     'action role',
  'reaction':        'reaction',
  'knowledge-relay': 'knowledge relay',
  'inscription':     'inscription',
}

export interface CausalLink {
  causeStep: number    // 1-indexed step that caused this event
  method: CauseMethod
  via?: string         // e.g. "relay-rumor t09" for knowledge-relay bridges
  label: string        // e.g. "note produced by" / "queued by"
}

export interface ChronicleEvent {
  step: number
  action: string
  initiator: string   // display name of the character who acts
  report: string
  causes: CausalLink[]
}

// Four named character slots: W = writer, T = talker, R = reader, D = wanderer.
// The seed selects a permutation so that every reroll assigns the same four
// names to different narrative roles.
const NAMES = ['Alice', 'Bob', 'Carol', 'Diana'] as const

const PERMS: [number, number, number, number][] = [
  [0, 1, 2, 3],
  [1, 2, 3, 0],
  [2, 3, 0, 1],
  [3, 0, 1, 2],
]

export function getCharacters(seed: number): [string, string, string, string] {
  const p = PERMS[seed % PERMS.length]
  return [NAMES[p[0]], NAMES[p[1]], NAMES[p[2]], NAMES[p[3]]]
}

export function buildChronicle(seed: number): ChronicleEvent[] {
  const [W, T, R, D] = getCharacters(seed)

  return [
    // ── background noise ────────────────────────────────────────────────
    {
      step: 1, action: 'chat', initiator: T,
      report: `${T} chats with ${W}`,
      causes: [],
    },

    // ── THE SEED EVENT ───────────────────────────────────────────────────
    // All three causal storylines branch out of this single action.
    {
      step: 2, action: 'write-note', initiator: W,
      report: `${W} writes a note about ${T}`,
      causes: [],
    },

    // ── background noise ────────────────────────────────────────────────
    {
      step: 3, action: 'chat', initiator: R,
      report: `${R} chats with ${D}`,
      causes: [],
    },

    // ── STORYLINE 1: action-role chain ───────────────────────────────────
    // read-note casts the note item as a role.  The item points back to the
    // write-note action that produced it, so write-note becomes a cause of
    // read-note automatically.
    {
      step: 4, action: 'read-note', initiator: R,
      report: `${R} reads the note about ${T}`,
      causes: [
        { causeStep: 2, method: 'action-role', label: 'note was produced by' },
      ],
    },
    {
      step: 5, action: 'confront', initiator: R,
      report: `${R} confronts ${W}`,
      causes: [
        { causeStep: 4, method: 'reaction', label: 'queued by' },
      ],
    },
    {
      step: 6, action: 'apologize', initiator: W,
      report: `${W} apologizes to ${R}`,
      causes: [
        { causeStep: 5, method: 'reaction', label: 'queued by' },
      ],
    },
    {
      step: 7, action: 'forgive', initiator: R,
      report: `${R} forgives ${W}`,
      causes: [
        { causeStep: 6, method: 'reaction', label: 'queued by' },
      ],
    },

    // ── background noise ────────────────────────────────────────────────
    {
      step: 8, action: 'chat', initiator: D,
      report: `${D} chats with ${T}`,
      causes: [],
    },

    // ── STORYLINE 2: knowledge-relay chain ──────────────────────────────
    // relay-rumor carries knowledge about the write-note event.  When the
    // runtime processes that knowledge it records both the relay action AND
    // the original write-note as causes of the resulting reaction.
    {
      step: 9, action: 'relay-rumor', initiator: T,
      report: `${T} tells ${D} about the note`,
      causes: [],
    },
    {
      step: 10, action: 'disturbed', initiator: D,
      report: `${D} is disturbed by what they heard`,
      causes: [
        { causeStep: 9,  method: 'knowledge-relay', label: 'relayed via' },
        { causeStep: 2,  method: 'knowledge-relay', label: 'knowledge of' },
      ],
    },
    {
      step: 11, action: 'confront', initiator: D,
      report: `${D} confronts ${W}`,
      causes: [
        { causeStep: 10, method: 'reaction', label: 'queued by' },
      ],
    },
    {
      step: 12, action: 'argue', initiator: W,
      report: `${W} argues with ${D}`,
      causes: [
        { causeStep: 11, method: 'reaction', label: 'queued by' },
      ],
    },

    // ── STORYLINE 3: inscription chain ──────────────────────────────────
    // inscribe-tome encodes knowledge about write-note into a physical item.
    // show-tome delivers that item to T.  When T reads it, the runtime
    // records both show-tome (the delivery action) AND write-note (the
    // knowledge the inscription encodes) as causes of read-tome.
    {
      step: 13, action: 'inscribe-tome', initiator: R,
      report: `${R} inscribes the tome with the story`,
      causes: [],
    },
    {
      step: 14, action: 'show-tome', initiator: R,
      report: `${R} shows ${T} the inscribed tome`,
      causes: [],
    },
    {
      step: 15, action: 'read-tome', initiator: T,
      report: `${T} reads the inscription about ${W}'s note`,
      causes: [
        { causeStep: 14, method: 'inscription', label: 'prompted by', via: `show-tome t14` },
        { causeStep: 2,  method: 'inscription', label: 'inscription concerns' },
      ],
    },
    {
      step: 16, action: 'tell-all', initiator: T,
      report: `${T} tells everyone about the note`,
      causes: [
        { causeStep: 15, method: 'reaction', label: 'queued by' },
      ],
    },
    {
      step: 17, action: 'embarrassed', initiator: W,
      report: `${W} is embarrassed by the revelation`,
      causes: [
        { causeStep: 16, method: 'reaction', label: 'queued by' },
      ],
    },

    // ── convergence ─────────────────────────────────────────────────────
    {
      step: 18, action: 'reconcile', initiator: D,
      report: `${D} reconciles with ${W}`,
      causes: [
        { causeStep: 12, method: 'reaction', label: 'queued by' },
      ],
    },
    // The celebration is caused by both the forgive (storyline 1) and the
    // reconcile (storyline 2), showing storyline convergence.
    {
      step: 19, action: 'celebrate', initiator: W,
      report: `${W}, ${T}, ${R}, and ${D} celebrate together`,
      causes: [
        { causeStep: 7,  method: 'reaction', label: 'triggered by' },
        { causeStep: 18, method: 'reaction', label: 'and by' },
      ],
    },
  ]
}

// ── Sifting patterns ──────────────────────────────────────────────────────
//
// Each pattern names a narrative arc shape and identifies which chronicle
// steps fill its roles.  In a real Viv host you would call
// constructSiftingMatchDiagram with the pattern and the causal graph; here
// the bindings are pre-computed from the fixed story template.

export type StepRef = { step: number; action: string }

export interface StorylineEdge {
  from: StepRef
  to: StepRef
  method: CauseMethod
  viaLabel?: string   // e.g. "via relay-rumor (t09)"
}

export interface Storyline {
  name: string
  description: string
  method: CauseMethod    // the non-reaction method that opens this arc
  color: string
  nodes: StepRef[]
  edges: StorylineEdge[]
  convergesToStep?: number
}

export function getStorylines(chronicle: ChronicleEvent[]): Storyline[] {
  const ev = (step: number): StepRef => {
    const e = chronicle.find(c => c.step === step)!
    return { step, action: e.action }
  }

  return [
    {
      name: 'Direct Confrontation',
      description: 'The note item is cast as a role, linking the reading directly to its author.',
      method: 'action-role',
      color: METHOD_COLOR['action-role'],
      nodes: [2, 4, 5, 6, 7].map(ev),
      edges: [
        { from: ev(2), to: ev(4), method: 'action-role' },
        { from: ev(4), to: ev(5), method: 'reaction' },
        { from: ev(5), to: ev(6), method: 'reaction' },
        { from: ev(6), to: ev(7), method: 'reaction' },
      ],
      convergesToStep: 19,
    },
    {
      name: 'Relayed Rumour',
      description: 'Knowledge about the note travels through a relay action; both the relay and the original note become causes of the resulting reaction.',
      method: 'knowledge-relay',
      color: METHOD_COLOR['knowledge-relay'],
      nodes: [2, 10, 11, 12, 18].map(ev),
      edges: [
        { from: ev(2), to: ev(10), method: 'knowledge-relay', viaLabel: 'via relay-rumor (t09)' },
        { from: ev(10), to: ev(11), method: 'reaction' },
        { from: ev(11), to: ev(12), method: 'reaction' },
        { from: ev(12), to: ev(18), method: 'reaction' },
      ],
      convergesToStep: 19,
    },
    {
      name: 'Inscribed Revelation',
      description: 'The note story is inscribed into a tome; when the tome is shown and read, both the delivery action and the original note are causes of the reading.',
      method: 'inscription',
      color: METHOD_COLOR['inscription'],
      nodes: [2, 15, 16, 17].map(ev),
      edges: [
        { from: ev(2), to: ev(15), method: 'inscription', viaLabel: 'via show-tome (t14)' },
        { from: ev(15), to: ev(16), method: 'reaction' },
        { from: ev(16), to: ev(17), method: 'reaction' },
      ],
    },
  ]
}
