import { useEffect, useState } from 'react'

// A sticky in-page table of contents shown as a select. Lives just
// under the hero. As the reader scrolls, an IntersectionObserver
// updates the dropdown to reflect whichever section is currently in
// view; choosing a different option scrolls smoothly to that section.

export interface TocSection {
  id: string
  label: string
}

interface Props {
  sections: TocSection[]
}

export default function TocNav({ sections }: Props) {
  const [currentId, setCurrentId] = useState<string>(sections[0]?.id ?? '')

  useEffect(() => {
    const ids = sections.map((s) => s.id)
    // Track which sections are intersecting; on each change, pick the
    // topmost intersecting one so the dropdown reflects "what you're
    // looking at right now".
    const seen = new Map<string, IntersectionObserverEntry>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            seen.set(e.target.id, e)
          } else {
            seen.delete(e.target.id)
          }
        }
        const visible = ids
          .map((id) => seen.get(id))
          .filter((e): e is IntersectionObserverEntry => !!e)
        if (visible.length === 0) return
        const top = visible.sort(
          (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
        )[0]
        setCurrentId(top.target.id)
      },
      // Trigger when the section's top crosses ~80px from the
      // viewport top (just under the sticky nav), and consider it
      // out-of-view once it's past 60% from the bottom.
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    )

    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [sections])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav className="toc-nav" aria-label="Page sections">
      <label className="toc-nav-label">
        <span className="toc-nav-prefix">Section:</span>
        <select
          value={currentId}
          onChange={(e) => scrollTo(e.target.value)}
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </nav>
  )
}
