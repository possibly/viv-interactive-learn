import Stage5Demo from '../sandbox/Stage5Demo'
import { HighlightedViv } from '../sandbox/highlight'

interface Props {
  source: string
}

export default function Embargoes({ source }: Props) {
  return (
    <>
      <section className="prose" id="embargoes">
        <h2>Keeping an action from happening twice</h2>
        <p>
          With importance dialed in, our friends now tease and cheer up plenty often, but
          they also greet whenever the picker rolls that way. We want greeting to be a
          one-time thing: once anyone has said hello, the simulation should move on.
        </p>
        <p>
          Viv expresses this with{' '}
          <a
            href="https://viv.sifty.studio/reference/language/10-actions/#embargoes"
            target="_blank"
            rel="noreferrer"
          >
            embargoes
          </a>
          : a per-action declaration that prevents the action from being targeted again
          for some duration after it fires. An embargo carries a <code>time</code> field,
          which is either <code>forever</code> (the action is locked out for the rest of
          the run) or a time period like <code>3 hours</code> or <code>2 weeks</code>.
          Time periods are measured against the host's clock, supplied through the
          adapter's <code>getCurrentTimestamp</code> callback.
        </p>
        <p>
          We give greeting a <code>forever</code> embargo. Tease and cheer_up stay
          unrestricted.
        </p>
        <HighlightedViv code={source} />
        <p>
          The demo runs five turns, rotating through Alice, Bob, Carol, Alice, Bob and
          calling <code>selectAction</code> once per turn. The eligible-actions strip
          shrinks as soon as greet fires.
        </p>
      </section>

      <Stage5Demo />
    </>
  )
}
