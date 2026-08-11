import { ExamsView } from '@/lib/types'
import { duration, prettyDate } from '@/lib/format'

/**
 * The printable exam routine.
 *
 * Hidden on screen and revealed only by the print stylesheet. It carries the
 * fields a candidate actually needs on paper: their name and numbers, every
 * paper in order, and an empty column to tick off as each one is sat.
 */
export function PrintRoutine({ view }: { view: ExamsView }) {
  return (
    <div className="print-sheet text-black">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: '15pt', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Examination routine
          </div>
          <div style={{ fontSize: '9pt' }}>
            {view.series} · Edexcel {view.qualification === 'IAL' ? 'International A Level' : 'International GCSE'}
          </div>
        </div>
        <div style={{ fontSize: '9pt', textAlign: 'right' }}>
          {view.summary.papers} papers · {duration(view.summary.minutes)} in exams
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div className="print-box" style={{ flex: 2, padding: '7px 9px' }}>
          <div style={{ fontSize: '7.5pt', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Candidate name
          </div>
          <div style={{ height: 22 }} />
        </div>
        <div className="print-box" style={{ flex: 1, padding: '7px 9px' }}>
          <div style={{ fontSize: '7.5pt', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Centre no.
          </div>
          <div style={{ height: 22 }} />
        </div>
        <div className="print-box" style={{ flex: 1, padding: '7px 9px' }}>
          <div style={{ fontSize: '7.5pt', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Candidate no.
          </div>
          <div style={{ height: 22 }} />
        </div>
      </div>

      <table className="print-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Duration</th>
            <th>Subject</th>
            <th>Component</th>
            <th>Code</th>
            <th style={{ width: '13%' }}>Sat</th>
          </tr>
        </thead>
        <tbody>
          {view.exams.map((e) => (
            <tr key={e.code + e.paper + e.date}>
              <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{prettyDate(e.date)}</td>
              <td style={{ fontWeight: 600 }}>{e.session === 'Morning' ? 'AM' : 'PM'}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{duration(e.minutes)}</td>
              <td style={{ fontWeight: 600 }}>{e.subject}</td>
              <td>{e.title}</td>
              <td style={{ fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap' }}>
                {e.code} {e.paper}
              </td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12, fontSize: '8pt' }}>
        Sessions are as published by Pearson. Start times differ by timezone, so your centre confirms
        the exact time. Unofficial: check against your statement of entry.
      </div>
    </div>
  )
}
