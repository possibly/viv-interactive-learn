// Each stage = one .viv source file + its compiled bundle. We fetch both
// at runtime so the Source / Bundle tabs always show the real artifacts
// committed in /public.

export interface Stage {
  id: number
  slug: string
  title: string
  blurb: string
  vivPath: string
  bundlePath: string
  withTavern: boolean
  initialMood: number
  // Things to highlight in the playground for this stage.
  introduces: string[]
}

const base = import.meta.env.BASE_URL

export const STAGES: Stage[] = [
  {
    id: 1,
    slug: 'hello',
    title: '1 - Hello',
    blurb:
      'One action, two roles, two effects. Everyone in the tavern can greet anyone else. ' +
      'Step the simulation and watch greetings ripple through the cast.',
    vivPath: `${base}vivsrc/stage1.viv`,
    bundlePath: `${base}bundles/stage1.json`,
    withTavern: false,
    initialMood: 0,
    introduces: ['action', 'roles', 'effects', 'gloss / report'],
  },
  {
    id: 2,
    slug: 'conditions',
    title: '2 - Conditions',
    blurb:
      'A second action -- gossip -- that only fires when the gossiper is in a foul mood. ' +
      'Now Viv has to choose, and conditions decide who is *eligible* for what.',
    vivPath: `${base}vivsrc/stage2.viv`,
    bundlePath: `${base}bundles/stage2.json`,
    withTavern: false,
    initialMood: 0,
    introduces: ['multiple actions', 'conditions', '`anywhere` roles'],
  },
  {
    id: 3,
    slug: 'importance',
    title: '3 - Importance',
    blurb:
      'Adds a `befriend` action gated on positive moods, and tags every action with ' +
      'an importance level. The runtime now knows which moments matter.',
    vivPath: `${base}vivsrc/stage3.viv`,
    bundlePath: `${base}bundles/stage3.json`,
    withTavern: false,
    initialMood: 4,
    introduces: ['importance', 'saliences', 'narrative weight'],
  },
  {
    id: 4,
    slug: 'place',
    title: '4 - Place',
    blurb:
      'Locations and items enter the picture: the Crooked Tankard has tankards of ale on the table, ' +
      'and `drink-ale` requires both. Role casting handles the proximity check for free.',
    vivPath: `${base}vivsrc/stage4.viv`,
    bundlePath: `${base}bundles/stage4.json`,
    withTavern: true,
    initialMood: 4,
    introduces: ['location roles', 'item roles', 'spatial conditions'],
  },
  {
    id: 5,
    slug: 'consequences',
    title: '5 - Consequences',
    blurb:
      'An `insult` queues a `retort` reaction with the victim precast as the retorter. ' +
      'Actions cause actions; the chronicle becomes a chain, not a flat list.',
    vivPath: `${base}vivsrc/stage5.viv`,
    bundlePath: `${base}bundles/stage5.json`,
    withTavern: true,
    initialMood: -4, // start a little grumpy so insults are eligible
    introduces: ['reactions', 'reserved actions', 'precast roles', 'causal chains'],
  },
]
