import { useEffect, useState } from 'react'

/** Cached GET, for answers that are identical for every visitor. */
const cache = new Map<string, unknown>()

export function useApiGet<T>(path: string, params: Record<string, string | null | undefined>) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null) as [string, string][],
  ).toString()
  const url = `${path}?${qs}`
  const cached = cache.get(url) as T | undefined
  const [data, setData] = useState<T | null>(cached ?? null)

  useEffect(() => {
    const hit = cache.get(url) as T | undefined
    if (hit) { setData(hit); return }
    let cancelled = false
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: T) => { cache.set(url, d); if (!cancelled) setData(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [url])

  return data
}
