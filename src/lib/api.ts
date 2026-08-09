import { useEffect, useRef, useState } from 'react'

/**
 * Posts the form state and returns whatever the server works out from it.
 *
 * Typed marks stay in local state so the inputs never lag; only the derived
 * numbers wait on the round trip, and the previous answer stays on screen while
 * the next one is in flight so nothing flickers.
 */
export function useApi<T>(path: string, body: unknown, delay = 180) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(true)
  const key = JSON.stringify(body)
  const first = useRef(true)

  useEffect(() => {
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
