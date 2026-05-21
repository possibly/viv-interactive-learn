import AlgorithmDemo from '../sandbox/AlgorithmDemo'
import HeadingLink from '../sandbox/HeadingLink'

export default function SelectActionWalkthrough() {
  return (
    <>
      <section className="prose" id="select-action">
        <h2>
          How <code>selectAction</code> works
          <HeadingLink id="select-action" />
        </h2>
        <p>
          Pick a character below to see the four steps the runtime performs inside that
          single <code>await</code>. The first three are computed and displayed; the
          fourth hands off to the real <code>selectAction</code>, which writes to the
          chronicle below.
        </p>
      </section>

      <AlgorithmDemo />
    </>
  )
}
