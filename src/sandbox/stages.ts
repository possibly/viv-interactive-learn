// One stage for now. Kept as an array because (a) the picker UI already
// supports multiple, and (b) we'll grow this back up once the basics
// are landing well.

export interface Stage {
  id: number
  slug: string
  title: string
  blurb: string
  vivPath: string
  bundlePath: string
  withTavern: boolean
  initialMood: number
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
]
