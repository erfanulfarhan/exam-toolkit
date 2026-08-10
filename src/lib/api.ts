import { useEffect, useRef, useState } from 'react'

/**
 * Posts the form state and returns whatever the server works out from it.
 *
 * Typed marks stay in local state so the inputs never lag; only the derived
 * numbers wait on the round trip, and the previous answer stays on screen while
 * the next one is in flight so nothing flickers.
 */
/**
 * Answers depend only on the request and the dataset, and the dataset only
 * changes on deploy, so an exact repeat of a request can be replayed from
 * memory. Going back to a state you have already seen costs nothing.
 */
const cache = new Map<string, unknown>()

export function useApi<T>(path: string, body: unknown, delay = 80) {
  const key = JSON.stringify(body)
  const cached = cache.get(`${path}:${key}`) as T | undefined
  const [data, setData] = useState<T | null>(cached ?? null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(!cached)
  const first = useRef(true)

  useEffect(() => {
    const hit = cache.get(`${path}:${key}`) as T | undefined
    if (hit) {
      setData(hit)
      setError(false)
      setBusy(false)
      first.current = false
      return
    }
    let cancelled = false
    setBusy(true)
    const wait = first.current ? 0 : delay
    first.current = false
    const timer = setTimeout(() => {
      fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: key,
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: T) => {
          cache.set(`${path}:${key}`, d)
          if (cancelled) return
          setData(d)
          setError(false)
          setBusy(false)
        })
        .catch(() => {
          if (cancelled) return
          setError(true)
          setBusy(false)
        })
    }, wait)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [path, key, delay])

  return { data, busy, error }
}
