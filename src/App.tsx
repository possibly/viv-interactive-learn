import { useState } from 'react'
import BringInViv from './sections/BringInViv'
import Conditions from './sections/Conditions'
import Effects from './sections/Effects'
import Embargoes from './sections/Embargoes'
import Goal from './sections/Goal'
import Host from './sections/Host'
import Importance from './sections/Importance'
import Queries from './sections/Queries'
import SelectActionWalkthrough from './sections/SelectActionWalkthrough'
import WireRuntime from './sections/WireRuntime'
import TocNav, { type TocSection } from './sandbox/TocNav'
import { useVivSources } from './sandbox/useVivSources'

const VIV_KEYS = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6'] as const

const TOC_SECTIONS: TocSection[] = [
  { id: 'goal', label: 'What we want our characters to do' },
  { id: 'host', label: 'Start with the host' },
  { id: 'viv-intro', label: 'Now bring in Viv' },
  { id: 'wire', label: 'Wire the runtime into the host' },
  { id: 'select-action', label: 'How selectAction works' },
  { id: 'conditions', label: 'Gating actions with conditions' },
  { id: 'effects', label: 'Actions that change the world' },
  { id: 'importance', label: 'Steering selection with importance' },
  { id: 'embargoes', label: 'Keeping an action from happening twice' },
  { id: 'queries', label: 'Gating actions on the chronicle with queries' },
]

const INITIAL_IMPORTANCE: Record<string, number> = {
  greet: 1,
  tease: 3,
  cheer_up: 3,
}

export default function App() {
  const sources = useVivSources(VIV_KEYS)
  const [importance, setImportance] = useState<Record<string, number>>(INITIAL_IMPORTANCE)

  return (
    <div className="page">
      <header className="hero">
        <h1>
          <span className="brand">Viv</span>: a tour of the authoring layer
        </h1>
        <p className="lede">
          Viv is a small DSL and runtime for <em>emergent narrative</em>. You declare what
          characters can do; the runtime decides who does what, when, and what fell out of
          it. This page is a guided walk through the authoring layer, starting from the
          smallest possible thing and growing.
        </p>
      </header>

      <TocNav sections={TOC_SECTIONS} />

      <Goal />
      <Host />
      <BringInViv source={sources.stage1} />
      <WireRuntime />
      <SelectActionWalkthrough />
      <Conditions source={sources.stage2} />
      <Effects source={sources.stage3} />
      <Importance
        source={sources.stage4}
        importance={importance}
        setImportance={setImportance}
      />
      <Embargoes source={sources.stage5} />
      <Queries source={sources.stage6} />

      <footer className="page-footer">
        <p className="dim">
          Sandbox uses the upstream{' '}
          <a
            href="https://github.com/possibly/viv/tree/browser/runtime"
            target="_blank"
            rel="noreferrer"
          >
            browser/runtime
          </a>{' '}
          build of Viv (v0.10.x). Source for this page lives in <code>/src</code>; the{' '}
          <code>.viv</code> source and compiled bundle live in{' '}
          <code>/public/vivsrc</code> and <code>/public/bundles</code>.
        </p>
      </footer>
    </div>
  )
}
