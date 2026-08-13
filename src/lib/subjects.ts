/**
 * The subjects each board actually offers, so adding one is a choice from a
 * list rather than a spelling test. Edexcel's lists are taken from the grade
 * boundary data the site already holds; Cambridge's from the paper archive.
 *
 * A student can still type anything: an unusual subject, or one a board has
 * since retired, is added as written rather than refused.
 */
import { Board, Level } from './gpa'

const EDEXCEL_O = [
  'Accounting', 'Arabic (First Language)', 'Art and Design', 'Bangla', 'Bangladesh Studies',
  'Biology', 'Business', 'Chemistry', 'Chinese', 'Commerce', 'Computer Science', 'Economics',
  'English Language A', 'English Language B', 'English Literature', 'English as a Second Language',
  'French', 'Further Pure Mathematics', 'Geography', 'German', 'Global Citizenship', 'History',
  'Human Biology', 'ICT', 'Islamic Studies', 'Mathematics A', 'Mathematics B', 'Pakistan Studies',
  'Physics', 'Religious Studies', 'Science (Double Award)', 'Science (Single Award)', 'Sinhala',
  'Spanish', 'Swahili', 'Tamil',
]

const EDEXCEL_A = [
  'Accounting', 'Applied ICT', 'Arabic', 'Biology', 'Business', 'Chemistry', 'Economics',
  'English Language', 'English Literature', 'French', 'Further Mathematics', 'Geography',
  'German', 'Greek', 'History', 'Information Technology', 'Law', 'Mathematics', 'Physics',
  'Psychology', 'Pure Mathematics', 'Religious Studies', 'Spanish',
]

const CAMBRIDGE_O = [
  'Accounting', 'Additional Mathematics', 'Bangladesh Studies', 'Bengali', 'Biology',
  'Business Studies', 'Chemistry', 'Computer Science', 'Economics', 'English First Language',
  'English Literature', 'English as a Second Language', 'Environmental Management', 'French',
  'Geography', 'German', 'History', 'ICT', 'Islamiyat', 'Mathematics', 'Physics', 'Sociology',
]

const CAMBRIDGE_A = [
  'Accounting', 'Biology', 'Business', 'Chemistry', 'Computer Science', 'Economics',
  'English Language', 'English Literature', 'Environmental Management', 'French', 'Geography',
  'Further Mathematics', 'History', 'Information Technology', 'Law', 'Mathematics', 'Physics',
  'Psychology', 'Sociology',
]

export function subjectsFor(board: Board, level: Level): string[] {
  if (board === 'cambridge') return level === 'o' ? CAMBRIDGE_O : CAMBRIDGE_A
  return level === 'o' ? EDEXCEL_O : EDEXCEL_A
}

/**
 * Subjects worth offering for what has been typed.
 *
 * Matches on the start of any word, not just the start of the name, so typing
 * "p" reaches Physics and Further Pure Mathematics alike, and "math" reaches
 * every maths paper whatever it is called.
 */
export function suggest(board: Board, level: Level, query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return subjectsFor(board, level)
  return subjectsFor(board, level).filter((s) =>
    s.toLowerCase().split(/[^a-z0-9]+/).some((word) => word.startsWith(q)))
}
