import Stage6Demo from '../sandbox/Stage6Demo'
import { HighlightedViv } from '../sandbox/highlight'

interface Props {
  source: string
}

export default function Queries({ source }: Props) {
  return (
    <>
      <section className="prose" id="queries">
        <h2>Gating actions on the chronicle with queries</h2>
        <p>
          The story still feels disorderly. Tease and cheer_up can fire on turn 1, before
          anyone has even said hello. We want greeting to come <em>first</em>, and we want
          it to be a per-pair handshake: Alice and Bob have to greet each other before
          they can tease or cheer up <em>each other</em>, but their hello should not
          unlock anything for the Bob-Carol pair.
        </p>
        <p>
          Conditions can do more than read entity properties. They can also run a{' '}
          <a
            href="https://viv.sifty.studio/reference/language/15-queries.html"
            target="_blank"
            rel="noreferrer"
          >
            query
          </a>{' '}
          over the chronicle, the runtime's record of every action that has fired so far.
          A query is a named pattern; a condition that runs the query passes when at
          least one chronicle entry matches.
        </p>
        <p>
          A query can take roles of its own. We declare <code>greeted-with</code> with two
          character roles, <code>@a</code> and <code>@b</code>, and ask for any greet
          where both of them were active. tease and cheer_up bind their own cast into the
          query (<code>@a: @teaser, @b: @target</code>), so the gate is per-pair. greet
          also embargoes the same pair so the runtime will not pick the same direction
          twice.
        </p>
        <HighlightedViv code={source} />
        <p>
          The demo runs the same five turns. At each turn we show the state of all three
          character pairs; tease and cheer_up only become available for a pair once a
          green check sits next to it.
        </p>
      </section>

      <Stage6Demo />
    </>
  )
}
