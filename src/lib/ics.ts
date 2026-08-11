import { RoutineView } from '@/lib/types'

/**
 * Export the plan as a calendar file.
 *
 * Times are written without a timezone, which the iCalendar spec calls a
 * floating time: every calendar app shows it at that clock time wherever the
 * student is, which is what you want for a study block.
 */
const KIND_LABEL: Record<string, string> = { learn: 'Learn', review: 'Review', paper: 'Timed paper' }

function stamp(date: string, minutesFromMidnight: number) {
  const h = String(Math.floor(minutesFromMidnight / 60)).padStart(2, '0')
  const m = String(minutesFromMidnight % 60).padStart(2, '0')
  return `${date.replace(/-/g, '')}T${h}${m}00`
}

function escape(text: string) {
  return text.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')
}

export function routineToIcs(view: RoutineView, startHour = 16) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Edexcel Toolkit//Study routine//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Study routine',
  ]

  for (const day of view.days) {
    for (const subject of day.exams) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:exam-${day.date}-${subject.replace(/\W/g, '')}@edexcel-toolkit`,
        `DTSTART;VALUE=DATE:${day.date.replace(/-/g, '')}`,
        `SUMMARY:${escape(subject)} exam`,
        'END:VEVENT',
      )
    }

    let cursor = startHour * 60
    day.sessions.forEach((s, i) => {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${day.date}-${i}-${s.code}@edexcel-toolkit`,
        `DTSTART:${stamp(day.date, cursor)}`,
        `DTEND:${stamp(day.date, cursor + s.minutes)}`,
        `SUMMARY:${escape(`${s.code} ${KIND_LABEL[s.kind]}: ${s.title}`)}`,
        `DESCRIPTION:${escape(`${s.subject} · ${s.minutes} minutes`)}`,
        'END:VEVENT',
      )
      cursor += s.minutes + 15   // a break between blocks
    })
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcs(view: RoutineView, startHour = 16) {
  const blob = new Blob([routineToIcs(view, startHour)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'study-routine.ics'
  a.click()
  URL.revokeObjectURL(url)
}
