import Stage9Demo from '../sandbox/Stage9Demo'
import { HighlightedTs, HighlightedViv } from '../sandbox/highlight'

interface Props {
  source: string
}

const HOST_MEMORY = `// One adapter callback we previously stubbed out: saveCharacterMemory.
// The runtime calls it once per actively-involved character, per
// action, with the per-character memory record.

const adapter = {
  // ...callbacks from before...

  saveCharacterMemory(characterID, actionID, memory) {
    entities[characterID].memories ??= {};
    entities[characterID].memories[actionID] = memory;
  },
};

// And one new use of runSiftingPattern: pass searchDomain to sift
// from a single character's perspective.

const fromAlice = await runSiftingPattern({
  patternName: "comfort-arc",
  searchDomain: "alice",
});

// Same chronicle. Different result, because Alice's memory only
// contains actions she was actively involved in.
`

export default function Memory({ source }: Props) {
  return (
    <>
      <section className="prose" id="memory">
        <h2>What's in a character's head</h2>
        <p>
          The chronicle is the global record. Each character also has
          their own filtered view of it: a memory book of actions they
          were actively involved in, with a per-character{' '}
          <a
            href="https://viv.sifty.studio/reference/language/10-actions/#saliences"
            target="_blank"
            rel="noreferrer"
          >
            salience
          </a>{' '}
          score for each one.
        </p>
        <p>
          The new authoring move is a <code>saliences:</code> block on
          each action. The salience can default to one number and then
          override per role -- here, being teased registers stronger
          (5) than teasing somebody else (3), and a passing greet barely
          registers (2 for the participants, 1 for everybody else).
        </p>
        <HighlightedViv code={source} />
        <p>
          The host has been quietly given a new responsibility too:
          implementing the <code>saveCharacterMemory</code> callback
          we'd been stubbing out. The runtime hands the host a memory
          record per active character per action; the host stores it
          wherever it likes.
        </p>
        <HighlightedTs code={HOST_MEMORY} />
        <p>
          A memory record carries the per-character{' '}
          <code>salience</code>, the action ID, the
          <code> formationTimestamp</code>, any associations, and a
          <code> forgotten</code> flag for memory-fade. The character
          entity now has a <code>memories</code> field keyed by action
          ID -- a private chronicle that's a subset of the global one.
        </p>
        <p>
          On the sifting side, <code>runSiftingPattern</code> grew an
          optional <code>searchDomain</code> argument. Pass a character
          ID and the pattern is run over <em>that character's</em>{' '}
          memories instead of the global chronicle. Same pattern, but
          a comfort-arc can be visible to its target and invisible to a
          bystander, because they don't share the same source data.
        </p>
      </section>

      <section className="prose">
        <h3>Same chronicle, different stories per POV</h3>
        <p>
          Ten turns build a chronicle. The middle panel below shows
          each character's memory book, with a salience badge on each
          entry. The bottom panel reruns the comfort-arc sifting
          pattern from each POV: globally over the chronicle, and once
          per character. Reroll until you find a chronicle where the
          POVs disagree.
        </p>
      </section>

      <Stage9Demo />
    </>
  )
}
