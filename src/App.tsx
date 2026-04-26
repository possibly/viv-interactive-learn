import { useMemo, useState } from 'react'
import Sandbox from './sandbox/Sandbox'
import AlgorithmDemo from './sandbox/AlgorithmDemo'
import { STAGES } from './sandbox/stages'

export default function App() {
  const [activeStageId, setActiveStageId] = useState<number>(STAGES[0].id)
  const activeStage = useMemo(
    () => STAGES.find((s) => s.id === activeStageId) ?? STAGES[0],
    [activeStageId],
  )

  return (
    <div className="page">
      <header className="hero">
        <h1>
          <span className="brand">Viv</span>: a tour of the authoring layer
        </h1>
        <p className="lede">
          Viv is a small DSL and runtime for <em>emergent narrative</em>. You declare what
          characters can do; the runtime decides who does what, when, and what fell out of it.
          This page is a guided walk through the authoring layer, starting from the
          smallest possible thing and growing.
        </p>
        <p className="meta">
          The runtime running below is the upstream{' '}
          <code>browser/runtime</code> branch of{' '}
          <a href="https://github.com/possibly/viv" target="_blank" rel="noreferrer">
            possibly/viv
          </a>
          , vendored verbatim. Each <code>.viv</code> source was compiled with{' '}
          <code>vivc</code> and committed alongside its JSON output, so the page itself
          never needs the Python compiler.
        </p>
      </header>

      <section className="prose">
        <h2>What we're building</h2>
        <p>
          A small tavern. Three regulars -- <strong>Alice</strong>, <strong>Bob</strong>, and{' '}
          <strong>Carol</strong> -- hang around the Crooked Tankard. Each tick we ask Viv:
          "given everything you know, what would <em>this</em> character plausibly do right
          now?" The runtime's answer comes from a four-step process:
        </p>
        <ol>
          <li>
            Look at every action defined in the bundle for which this character could be the{' '}
            <strong>initiator</strong>.
          </li>
          <li>
            <strong>Cast the remaining roles</strong> from entities the host adapter tells
            the runtime about (typically nearby characters and items).
          </li>
          <li>
            Evaluate each action's <strong>conditions</strong> against the current state;
            discard the casts that fail.
          </li>
          <li>
            <strong>Pick one</strong> of the surviving casts (weighted later, uniform for
            now), run its <strong>effects</strong>, and save the action record via the
            adapter's <code>saveActionData</code>.
          </li>
        </ol>
        <p>
          Below is a walk-through of those four steps, run on stage 1's only action,{' '}
          <code>hello</code>. Pick an initiator, then click your way through. The "Run via{' '}
          <code>selectAction</code>" button at the end hands the same scenario to the real
          runtime so you can see the answers agree.
        </p>
      </section>

      <AlgorithmDemo />

      <section className="prose">
        <h2>The same thing, in the actual runtime</h2>
        <p>
          The walkthrough above narrates what <code>selectAction</code> does, with the
          intermediate working set exposed for inspection. The sandbox below is the same
          algorithm, just running freely: pick a stage, hit <em>Step</em>, and watch the
          chronicle fill in. At stage 1 there is only one action, so the chronicle is a
          monotone sequence of greetings and everyone gets cheered up.
        </p>
        <p>
          The tabs swap among the actual artifacts the runtime is using -- the{' '}
          <code>.viv</code> source, the host TypeScript, and the compiled JSON bundle.
        </p>
      </section>

      <StagePicker
        stages={STAGES}
        active={activeStageId}
        onChange={setActiveStageId}
      />

      <div className="sandbox-anchor">
        <Sandbox stage={activeStage} />
        <p className="dim sandbox-hint">{activeStage.blurb}</p>
      </div>

      <section className="prose stub">
        <h2>What comes next</h2>
        <p>
          The next pass adds a second action with conditions, then importance, then
          location-aware roles, then reactions. Once the Stage 1 walkthrough above feels
          right we'll re-introduce them one by one alongside their own algorithm panels.
        </p>
      </section>

      <footer className="page-footer">
        <p className="dim">
          Sandbox uses the upstream{' '}
          <a href="https://github.com/possibly/viv/tree/browser/runtime" target="_blank" rel="noreferrer">
            browser/runtime
          </a>{' '}
          build of Viv (v0.10.x). Source for this page lives in{' '}
          <code>/src</code>; the <code>.viv</code> sources and compiled bundles live in{' '}
          <code>/public/vivsrc</code> and <code>/public/bundles</code>.
        </p>
      </footer>
    </div>
  )
}

function StagePicker({
  stages,
  active,
  onChange,
}: {
  stages: typeof STAGES
  active: number
  onChange: (id: number) => void
}) {
  const single = stages.length <= 1
  return (
    <div className={`stage-picker${single ? ' single' : ''}`}>
      <label>
        <span>Sandbox stage:</span>
        <select value={active} onChange={(e) => onChange(Number(e.target.value))}>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
