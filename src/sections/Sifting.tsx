import Stage7Demo from '../sandbox/Stage7Demo'
import { HighlightedTs, HighlightedViv } from '../sandbox/highlight'

interface Props {
  source: string
}

const HOST_SIFT = `// One new runtime call. Pass a pattern name (and any role
// bindings you want to fix); the runtime walks the chronicle and
// returns a single match, or null if nothing fits.

import { runSiftingPattern } from "viv-runtime";

const match = await runSiftingPattern({
  patternName: "comfort-arc",
  precastBindings: {
    target: ["bob"],
    teaser: ["alice"],
    comforter: ["carol"],
  },
});

// match is { target: ["bob"], teaser: ["alice"],
//            comforter: ["carol"],
//            "the-tease":   [<actionID>],
//            "the-comfort": [<actionID>] }
// or null if no comfort-arc exists for that triple.
`

export default function Sifting({ source }: Props) {
  return (
    <>
      <section className="prose" id="sifting">
        <h2>Finding stories in the chronicle</h2>
        <p>
          So far the chronicle has been a record of what happened, with each
          new action read by queries to gate the <em>next</em> action. Story
          sifting is the inverse: we describe a multi-action storyline shape
          we'd like to recognize, and the runtime tells us where in the
          chronicle that shape actually appears.
        </p>
        <p>
          A{' '}
          <a
            href="https://viv.sifty.studio/reference/language/16-sifting-patterns/"
            target="_blank"
            rel="noreferrer"
          >
            sifting pattern
          </a>{' '}
          is like a query, but it can pin <em>multiple</em> actions at once
          and place causal/temporal relations (<code>preceded</code>,{' '}
          <code>caused</code>, <code>triggered</code>) between them. A single
          match binds character roles <em>and</em> action variables to
          specific entities and chronicle entries.
        </p>
        <p>
          We declare a <code>comfort-arc</code>: a tease, then a cheer-up,
          where both involve the same target but the comforter is somebody
          other than the teaser. Two helper queries (<code>teases-of</code>{' '}
          and <code>cheer-ups-of</code>) supply each action variable's
          casting pool, and the condition <code>@the-tease preceded
          @the-comfort</code> requires the comfort to come after the tease.
        </p>
        <HighlightedViv code={source} />
        <p>
          Pattern roles are unique entities by default, the same way action
          roles are. Declaring <code>@teaser</code> and <code>@comforter</code>{' '}
          as separate roles is what guarantees the comforter is a different
          person than the teaser.
        </p>
        <p>
          On the host side, all that's new is a single runtime call. Pass a
          pattern name and (optionally) role bindings to fix; the runtime
          walks the chronicle and returns one match, or <code>null</code>.
        </p>
        <HighlightedTs code={HOST_SIFT} />
        <p>
          One detail to be aware of: <code>runSiftingPattern</code> returns
          a <em>single</em> match, even if the chronicle contains many. To
          enumerate all the comfort-arcs in a given run, the host iterates
          over candidate role bindings and asks once per triple. The demo
          below does this for our three friends -- six (target, teaser,
          comforter) permutations, one call each.
        </p>
      </section>

      <section className="prose">
        <h3>Watch the chronicle, then watch the sifter</h3>
        <p>
          The demo runs eight turns of the same simulation as the previous
          stage to populate a chronicle. Then for every (target, teaser,
          comforter) triple it asks the runtime "is there a comfort-arc for
          these three?" Each match becomes a story card on the right; the
          chronicle on the left tags every entry that participated in a
          match. Reroll to sample a new chronicle.
        </p>
      </section>

      <Stage7Demo />
    </>
  )
}
