/** Shared formatting. The site uses a 12 hour clock throughout. */
export function clock12(hour24: number, minutes = 0) {
  const period = hour24 >= 12 ? 'pm' : 'am'
  const h = hour24 % 12 === 0 ? 12 : hour24 % 12
  return minutes ? `${h}:${String(minutes).padStart(2, '0')} ${period}` : `${h}:00 ${period}`
}

export function prettyDate(iso: string) {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function duration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}
