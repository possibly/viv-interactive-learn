import { useEffect, useState } from 'react'

// Fetches a set of /vivsrc/<key>.viv files in parallel and returns
// the texts keyed by name, with a placeholder while loading. Lets
// the page render every section's source highlight without each
// section file having to handle its own fetch lifecycle.

const PLACEHOLDER = 'Loading...'

export function useVivSources<K extends string>(keys: readonly K[]): Record<K, string> {
  const [sources, setSources] = useState<Record<K, string>>(
    () => Object.fromEntries(keys.map((k) => [k, PLACEHOLDER])) as Record<K, string>,
  )

  useEffect(() => {
    let cancelled = false
    void Promise.all(
      keys.map((k) =>
        fetch(`${import.meta.env.BASE_URL}vivsrc/${k}.viv`).then((r) => r.text()),
      ),
    )
      .then((texts) => {
        if (cancelled) return
        const next = Object.fromEntries(keys.map((k, i) => [k, texts[i]])) as Record<
          K,
          string
        >
        setSources(next)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // keys is a stable constant array passed in from a module-level
    // declaration, so it's safe to skip the deps lint here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return sources
}
