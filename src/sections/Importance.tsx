import ImportanceLab from '../sandbox/ImportanceLab'
import Stage4Demo from '../sandbox/Stage4Demo'
import { HighlightedViv } from '../sandbox/highlight'

interface Props {
  source: string
  importance: Record<string, number>
  setImportance: (next: Record<string, number>) => void
}

export default function Importance({ source, importance, setImportance }: Props) {
  return (
    <>
      <section className="prose" id="importance">
        <h2>Steering selection with importance</h2>
        <p>
          Step 4 has been picking uniformly: every passing cast got the same{' '}
          <code>1/N</code> chance. Now we want to extend our simulation: we want our
          friends to tease and cheer each other up more often than they say hello. Viv
          expresses that with{' '}
          <a
            href="https://viv.sifty.studio/reference/language/10-actions/#importance"
            target="_blank"
            rel="noreferrer"
          >
            importance
          </a>
          : a number declared per action. The runtime weights its random pick by
          importance, so a higher number is more likely to fire.
        </p>
        <p>
          We give greeting an importance of <strong>1</strong>, and tease and cheer_up
          each an importance of <strong>3</strong>.
        </p>
        <HighlightedViv code={source} />
        <p>
          Nothing in the host changes for this. Importance lives entirely in the bundle
          and is consumed by the runtime's picker.
        </p>
        <p>
          Drag the sliders below to retune each action's importance. The bar shows the
          expected share of the picker's choices for the values you set.
        </p>
        <ImportanceLab importance={importance} setImportance={setImportance} />
      </section>

      <Stage4Demo importance={importance} />
    </>
  )
}
