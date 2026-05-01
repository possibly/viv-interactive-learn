import Stage13Demo from '../sandbox/Stage13Demo'
import { HighlightedViv } from '../sandbox/highlight'

interface Props {
  source: string
}

export default function PlanAdaptation({ source }: Props) {
  return (
    <>
      <section className="prose" id="plan-adaptation">
        <h2>Plans that react to a changing world</h2>
        <p>
          Stage 12's <code>grudge-arc</code> has a small but important hole: a phase's
          queue instruction is fire-and-forget, and so the planner can race through all
          three phases on consecutive ticks, dropping{' '}
          <code>stew</code>, <code>retaliate</code>, and{' '}
          <code>apologise</code> onto the action queue back to back. The world the plan
          reacted to is the world at <em>queue</em> time. If the offender re-teases the
          victim a turn later -- right between the strike action firing and the regret
          phase running -- it doesn't matter. The apology is already queued.
        </p>
        <p>
          That's not a fundamental limitation; it's authoring. Plans have several
          mechanisms for adapting to the live world:
        </p>
        <ul>
          <li>
            <strong>Reaction windows</strong> (<code>all:</code>, <code>any:</code>,{' '}
            <code>untracked:</code>) wrap one or more queue instructions so the phase
            blocks until those constructs actually complete (or fail) before advancing.
            That's what gives every later phase a chance to evaluate against fresh
            world state.
          </li>
          <li>
            <strong>Conditionals inside phases</strong> (<code>if</code>/{' '}
            <code>elif</code>/<code>else</code>) read the live host state at phase-run
            time, so a phase can branch on whatever is true the moment the planner
            reaches it.
          </li>
          <li>
            <strong><code>fail;</code></strong> terminates a plan immediately. Inside an{' '}
            <code>if</code>, it's the &ldquo;abort the rest of the arc&rdquo; lever.
          </li>
          <li>
            <strong><code>wait: timeout: ... until: ...</code></strong> blocks a phase
            for up to a time period, exiting early when a condition becomes true. Good
            for &ldquo;wait until the victim cools off, but no more than a week&rdquo;.
          </li>
          <li>
            <strong>Abandonment conditions</strong> on individual queued actions tell
            the runtime to drop a queued action if its conditions become true before
            it gets targeted -- a way to revoke a specific reaction without aborting
            the whole plan.
          </li>
        </ul>
        <p>
          For the grudge arc, the natural fix is a combination of the first three. We
          wrap each beat in <code>all: ... close</code> so the phase blocks until the
          action fires; we also have <code>retaliate</code> set{' '}
          <code>@avenger.cheerful = true</code> -- the small vindication the avenger
          gets from striking back -- so the regret phase has something to read against;
          and we gate the regret phase with{' '}
          <code>if !@victim.cheerful: fail;</code>. If the offender re-teased between
          strike and regret, the avenger's vindication is wiped and the apology never
          queues.
        </p>
        <HighlightedViv code={source} />
        <p>The shape of what changed:</p>
        <ul>
          <li>
            <strong><code>all: ... close</code> on every beat.</strong> Each phase used
            to issue a <code>queue</code> and advance; now it issues the queue inside an
            <code>all:</code> window which holds the phase open until the action
            completes. Without this, the if-check inside <code>&gt;regret</code> would
            run on the same tick that <code>&gt;stew</code> queued -- before the user
            (or the simulation) could even change anything.
          </li>
          <li>
            <strong><code>retaliate</code> grew an effect.</strong> It now sets{' '}
            <code>@avenger.cheerful = true</code> in addition to the usual{' '}
            <code>@bully.cheerful = false</code>. The narrative is "vindication"; the
            mechanical purpose is to give <code>&gt;regret</code> a freshly-set value
            to read against -- one that a re-tease will visibly clobber.
          </li>
          <li>
            <strong><code>&gt;regret</code> branches.</strong>{' '}
            <code>if !@victim.cheerful: fail;</code> is the entire adaptation: a plain
            host-property check, the same expression language as action conditions,
            wrapped in the standard <code>if/end</code> block.{' '}
            <code>fail;</code> immediately terminates the plan.
          </li>
        </ul>
      </section>

      <section className="prose">
        <h3>Trigger, step, re-tease</h3>
        <p>
          The same buttons as Stage 12, with one new affordance: clicking the same{' '}
          <em>(teaser → target)</em> button a second time, while a grudge-arc against
          that victim is mid-arc, will re-tease them. Watch the{' '}
          <strong>cheerful</strong> chip flip to ✗ and the in-flight plan card switch
          from <em>awaiting regret</em> to <em>failed at &gt;regret</em>. The chronicle
          will show the second tease tagged{' '}
          <em>will fail an in-flight plan</em>, and -- crucially -- you'll never see an
          <code>apologise</code> for that pair.
        </p>
        <p className="dim">
          A clean run for comparison: trigger <em>Bob → Alice</em>, then step through
          three of Alice's turns without re-teasing. The plan card will tick through
          stew → strike → regret in order, and the chronicle will end on Alice's
          apology. Then click <em>Reset</em> and try the re-tease variant: trigger
          once, step until <code>retaliate</code> appears, click the same button again,
          and step. The plan dies at regret and Alice falls back on general action
          selection.
        </p>
        <Stage13Demo />
      </section>
    </>
  )
}
