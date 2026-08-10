import { useMemo, useState } from 'react'
import { ForecastView } from '@/lib/types'

/**
 * Boundary history and next-session forecast.
 *
 * One hue per grade, in a fixed order. Checked against this surface with the
 * data-viz palette validator: every hue sits in the dark lightness band, clears
 * 3:1 on the surface, and the worst adjacent pair holds ΔE 8.4 under simulated
 * colour blindness. Each line also carries its grade as a label at the right
 * edge, so colour is never the only thing telling them apart.
 */

const RAMP = ['#9085e9', '#199e70', '#3987e5', '#c98500', '#d95926', '#d55181']
const SURFACE = '#0f1118'
const GRID = '#232634'
const MUTED = '#9aa3b8'

const W = 820
const H = 360
const PAD = { top: 18, right: 58, bottom: 54, left: 44 }

type Series = ForecastView['series'][number]

export function BoundaryChart({
  series, target, max, caption,
}: {
  series: Series[]
  target: string
  max: number
  caption: string
}) {
  const [range, setRange] = useState<number>(12)
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)

  const sessions = useMemo(() => {
    const all: string[] = []
    for (const s of series) for (const p of s.history) if (!all.includes(p.session)) all.push(p.session)
    return range === 0 ? all : all.slice(-range)
  }, [series, range])

  const cols = [...sessions, target]
  const values = series.flatMap((s) =>
    s.history.filter((p) => sessions.includes(p.session)).map((p) => p.value)
      .concat([s.point]))

  if (!cols.length || values.length < 2) {
    return <p className="text-sm text-muted">Not enough published sessions to chart this one yet.</p>
  }

  const lo = Math.max(0, Math.floor((Math.min(...values) - 6) / 5) * 5)
  const hi = Math.min(max, Math.ceil((Math.max(...values) + 6) / 5) * 5)
  const span = Math.max(1, hi - lo)

  const x = (i: number) => PAD.left + (i * (W - PAD.left - PAD.right)) / Math.max(1, cols.length - 1)
  const y = (v: number) => PAD.top + (1 - (v - lo) / span) * (H - PAD.top - PAD.bottom)

  const ticks = niceTicks(lo, hi, 5)
  const forecastX = x(cols.length - 1)

  // The last real session and the forecast sit one column apart, which is too
  // close to label on one line. So the axis has two rows: real sessions on the
  // upper row, spaced by pixels and stepping back from the newest, and the
  // forecast alone on the lower row. Neither can collide with the other.
  const colWidth = (W - PAD.left - PAD.right) / Math.max(1, cols.length - 1)
  const labelStep = Math.max(1, Math.ceil(62 / Math.max(1, colWidth)))
  const newest = cols.length - 2
  const labelled = new Set<number>()
  for (let i = newest; i >= 0; i -= labelStep) labelled.add(i)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="inline-flex gap-1 p-0.5 rounded-lg bg-black/30 border border-line">
          {[6, 12, 0].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={
                'px-2.5 h-7 rounded-md text-xs font-semibold transition-colors ' +
                (range === r ? 'bg-brand text-white' : 'text-muted hover:text-ink')
              }
            >
              {r === 0 ? 'All' : `Last ${r}`}
            </button>
          ))}
        </div>
        <button
          onClick={() => setTable((t) => !t)}
          className="text-xs font-semibold text-muted hover:text-ink transition-colors"
        >
          {table ? 'Show chart' : 'Show table'}
        </button>
      </div>

      {/* The readout lives here rather than floating over the plot, where it
          used to sit on top of the grade labels at the right edge. */}
      {!table && (
        <div className="min-h-[26px] mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {hover == null ? (
            <span className="text-muted/60">Hover the chart for the marks behind any session.</span>
          ) : (
            <>
              <span className="font-semibold">
                {cols[hover]}
                {hover === cols.length - 1 && <span className="text-muted font-normal"> forecast</span>}
              </span>
              {series.map((s, si) => {
                const v = hover === cols.length - 1
                  ? s.point
                  : s.history.find((h) => h.session === cols[hover])?.value
                return (
                  <span key={s.grade} className="inline-flex items-center gap-1 tabular-nums">
                    <span className="h-2 w-2 rounded-full" style={{ background: RAMP[Math.min(si, RAMP.length - 1)] }} />
                    <span className="text-muted">{s.label}</span>
                    <span>{v ?? 'n/a'}</span>
                  </span>
                )
              })}
            </>
          )}
        </div>
      )}

      {!table && (
        <div className="relative">
          <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full min-w-[560px] h-auto"
            role="img"
            aria-label={`Grade boundary history and forecast for ${target}`}
            onMouseLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
                <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill={MUTED}>{t}</text>
              </g>
            ))}

            {/* The forecast column sits behind everything as a tinted band. */}
            <rect
              x={forecastX - (W - PAD.left - PAD.right) / Math.max(1, cols.length - 1) / 2}
              y={PAD.top}
              width={(W - PAD.left - PAD.right) / Math.max(1, cols.length - 1)}
              height={H - PAD.top - PAD.bottom}
              fill="#4f8cff"
              opacity={0.06}
            />

            {cols.map((s, i) =>
              labelled.has(i) ? (
                <text key={s} x={x(i)} y={H - PAD.bottom + 17} textAnchor="middle" fontSize={11} fill={MUTED}>
                  {s}
                </text>
              ) : null,
            )}
            <text
              x={forecastX}
              y={H - PAD.bottom + 37}
              textAnchor="end"
              fontSize={11}
              fontWeight={700}
              fill="#eef1f8"
            >
              {target}
            </text>
            <line
              x1={forecastX} x2={forecastX}
              y1={H - PAD.bottom + 4} y2={H - PAD.bottom + 26}
              stroke={GRID} strokeWidth={1}
            />

            {series.map((s, si) => {
              const color = RAMP[Math.min(si, RAMP.length - 1)]
              const pts = sessions
                .map((sess, i) => {
                  const p = s.history.find((h) => h.session === sess)
                  return p ? { i, v: p.value } : null
                })
                .filter((p): p is { i: number; v: number } => p !== null)
              if (!pts.length) return null
              const last = pts[pts.length - 1]
              const f = { point: s.point }
              return (
                <g key={s.grade}>
                  {f && (
                    <>
                      <line
                        x1={x(last.i)} y1={y(last.v)} x2={forecastX} y2={y(f.point)}
                        stroke={color} strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round"
                      />
                      <circle cx={forecastX} cy={y(f.point)} r={5} fill={color} stroke={SURFACE} strokeWidth={2} />
                    </>
                  )}
                  <polyline
                    points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <text
                    x={W - PAD.right + 10}
                    y={y(f ? f.point : last.v) + 4}
                    fontSize={12}
                    fontWeight={700}
                    fill="#eef1f8"
                  >
                    {s.label}
                  </text>
                </g>
              )
            })}

            {hover != null && (
              <line
                x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom}
                stroke="#4f8cff" strokeWidth={1} opacity={0.7}
              />
            )}

            {/* Hit areas are a full column wide so hovering never needs precision. */}
            {cols.map((s, i) => (
              <rect
                key={`hit-${s}`}
                x={x(i) - (W - PAD.left - PAD.right) / Math.max(1, cols.length - 1) / 2}
                y={PAD.top}
                width={(W - PAD.left - PAD.right) / Math.max(1, cols.length - 1)}
                height={H - PAD.top - PAD.bottom}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            ))}
          </svg>
          </div>

        </div>
      )}

      {table && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="text-muted text-left">
                <th className="py-1.5 pr-3 font-semibold">Session</th>
                {series.map((s) => <th key={s.grade} className="py-1.5 pr-3 font-semibold">{s.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {sessions.map((sess) => (
                <tr key={sess} className="border-t border-line/50">
                  <td className="py-1.5 pr-3 text-muted">{sess}</td>
                  {series.map((s) => (
                    <td key={s.grade} className="py-1.5 pr-3">
                      {s.history.find((h) => h.session === sess)?.value ?? 'n/a'}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-line">
                <td className="py-1.5 pr-3 font-semibold">{target}</td>
                {series.map((s) => (
                  <td key={s.grade} className="py-1.5 pr-3 font-semibold">
                    {s.point}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3">
        {series.map((s, si) => (
          <span key={s.grade} className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: RAMP[Math.min(si, RAMP.length - 1)] }} />
            Grade {s.label}
          </span>
        ))}
      </div>

      <p className="text-xs text-muted/80 leading-relaxed mt-3">{caption}</p>
    </div>
  )
}

function niceTicks(lo: number, hi: number, count: number) {
  const raw = (hi - lo) / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || mag * 10
  const out: number[] = []
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(Math.round(t))
  return out
}
