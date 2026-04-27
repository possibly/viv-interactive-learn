import { HighlightedViv } from '../sandbox/highlight'

interface Props {
  source: string
}

export default function BringInViv({ source }: Props) {
  return (
    <section className="prose" id="viv-intro">
      <h2>Now bring in Viv</h2>
      <p>
        <strong>Viv is a small DSL for declaring what's possible</strong>; the runtime
        decides who does what when. You write the actions once, their roles, their
        conditions, their effects, and the runtime carries the picking, the casting,
        and the bookkeeping.
      </p>
      <p>For our friends, that's a single action: someone greets someone else.</p>
      <HighlightedViv code={source} />
      <p>
        The action declares the two roles it needs cast (the initiator and the
        recipient) and how to describe what happened for the chronicle. No conditions,
        no effects, a greet always succeeds and just records itself.
      </p>
      <aside className="callout">
        <p>
          <strong>Where did <code>@greeter</code> come from?</strong> It is not a
          built-in name. It is one of the two roles this action declared in its{' '}
          <code>roles:</code> block (the other is <code>@friend</code>). Each action
          defines its own role names, and only those names are in scope inside that
          action's report, conditions, and effects. There is no global list of
          bindings; if you want a different name, you rename the role. See{' '}
          <a
            href="https://viv.sifty.studio/reference/language/09-roles/#role-reference"
            target="_blank"
            rel="noreferrer"
          >
            Roles &rsaquo; Role reference
          </a>{' '}
          for the syntax.
        </p>
      </aside>
    </section>
  )
}
