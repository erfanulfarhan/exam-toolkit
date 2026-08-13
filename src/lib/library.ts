/**
 * Turning a folder of past papers into something you can pick from.
 *
 * Archives name papers as <unit>_<paper>_<type>_<date>, e.g. 6PH01_01_que_20090113
 * for the January 2009 Unit 1 question paper and 6PH01_01_rms_20090312 for its
 * mark scheme. The two dates never match, because mark schemes are published a
 * couple of months after the exam sits, so pairing has to work on the session
 * rather than the filename date.
 *
 * Nothing here touches the network. Files come from a folder the student picks,
 * which keeps the promise the practice page already makes.
 */

export type PaperType = 'qp' | 'ms' | 'report'

export type LibFile = {
  /** Set for a file on disk. A paper in the bucket carries `key` instead. */
  file?: File
  key?: string
  name: string
  level: string
  subject: string
  unit: string
  paper: string
  type: PaperType
  /** YYYYMMDD as written in the filename, '' when absent. */
  date: string
}

export type PaperPair = {
  key: string
  level: string
  subject: string
  unit: string
  paper: string
  session: string
  year: number
  qp: LibFile
  ms?: LibFile
}

/** What the viewer shows about the open paper, and seeds "Mark the paper" with. */
export type PaperMeta = {
  level: string
  subject: string
  unit: string
  session: string
  year: number
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

/**
 * Read a paper's type from its name.
 *
 * The archive uses at least two naming schemes: the Pearson code form
 * (6PH01_01_que_20090113) and a human-readable form
 * (Questionpaper-Unit1(6001)-January2009). Both are matched off one
 * space-and-punctuation-stripped string. Mark scheme is tested first, because
 * "MarkschemewithExaminerreport" contains both words and is really the scheme.
 */
function readType(base: string): PaperType | null {
  const compact = base.toLowerCase().replace(/\s+/g, '')
  const tokens = base.toLowerCase().split(/[_\s-]+/).filter(Boolean)
  const hasToken = (set: Set<string>) => tokens.some((t) => set.has(t))
  const MS = new Set(['ms', 'rms', 'msc', 'mark', 'markscheme'])
  const QP = new Set(['que', 'qp', 'qus', 'qup'])
  const RP = new Set(['rep', 'pef'])
  // Mark scheme first: "MarkschemewithExaminerreport" contains both words.
  if (/markscheme|markingscheme/.test(compact) || hasToken(MS)) return 'ms'
  if (/questionpaper|sourcebooklet/.test(compact) || hasToken(QP)) return 'qp'
  if (/examiner/.test(compact) || hasToken(RP)) return 'report'
  return null
}

const MONTH_WORD = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec'

/**
 * Turn whatever date a string carries into YYYYMMDD.
 *
 * Handles a literal 8-digit stamp (Pearson form) and a month-name form in
 * either order — "January2009" / "Jun 2012" and "2010 january" / "2011-Jun",
 * the latter being how the folder path names a sitting. Month-name dates get
 * day 01; pairing and session bucketing only look at year and month. Requiring
 * the month and year to sit together avoids picking up a bare spec year like
 * the "(2009)" in "Further Pure Mathematics (2009)".
 */
function readDate(text: string): string {
  // Not \b — an underscore is a word char, so \b never fires against _20090113.
  const stamp = text.match(/(?:^|[^0-9])(\d{8})(?:[^0-9]|$)/)
  if (stamp) return stamp[1]
  const monthYear = text.match(new RegExp(`(${MONTH_WORD})[a-z]*\\.?\\s*'?(\\d{4})`, 'i'))
  if (monthYear) return `${monthYear[2]}${MONTHS[monthYear[1].toLowerCase().slice(0, 3)]}01`
  const yearMonth = text.match(new RegExp(`(\\d{4})\\s*[-_ ]?\\s*(${MONTH_WORD})[a-z]*`, 'i'))
  if (yearMonth) return `${yearMonth[1]}${MONTHS[yearMonth[2].toLowerCase().slice(0, 3)]}01`
  return ''
}

/**
 * Deliberately loose. Unit codes vary by spec (6PH01, 4MA0, WMA11, 6001,
 * WAC01) and files come in more than one naming scheme, so this looks for the
 * parts it recognises instead of insisting on one shape.
 */
export function parseParts(filename: string, context = '') {
  const base = filename.replace(/\.pdf$/i, '')
  const type = readType(base)
  if (!type) return null

  // Prefer a date in the filename; fall back to the folder path (which names
  // the sitting, e.g. ".../2010 january/..."), so papers aren't left "Undated".
  const date = readDate(base) || readDate(context)

  // Unit for grouping: a parenthesised code (6001, WAC01) wins, then a
  // Pearson-style code token (6PH01, 4MA1, WMA11), then a "Unit N" label, then
  // a compact "U1"/"U2A" form (as in 26_06_QP_U1). The compact form is last so
  // it doesn't hijack a real code, but ahead of the first-token fallback — that
  // fallback is what used to file "26_06_QP_U1" under the bogus unit "26".
  // A short code sitting right next to the QP/MS marker is the unit in the
  // compact schemes — Maths_D1_QP, 26_06_QP_FP1, Maths_M1A_MS.
  const toks = base.split(/[_\s-]+/).filter(Boolean)
  const marker = toks.findIndex((t) => /^(qp|ms|que|rms|msc|mark|markscheme|questionpaper)$/i.test(t))
  const unitTok = /^[A-Za-z]{1,3}\d{1,2}[A-Za-z]?$/
  let adjacent = ''
  if (marker >= 0) {
    for (const j of [marker + 1, marker - 1]) {
      if (j >= 0 && j < toks.length && unitTok.test(toks[j])) { adjacent = toks[j]; break }
    }
  }

  let unit = ''
  const paren = base.match(/\(([0-9A-Za-z]{3,7})\)/)
  const code = base.match(/\b([0-9]?[A-Za-z]{2,3}[0-9]{1,2}[A-Za-z]?)\b/)
  const unitLabel = base.match(/unit\s*([0-9]+[A-Za-z]?)/i)
  const uForm = base.match(/(?:^|[_\s-])U(\d{1,2}[A-Za-z]?)(?=$|[_\s.-])/i)
  if (paren) unit = paren[1].toUpperCase()
  else if (adjacent) unit = adjacent.toUpperCase()
  else if (code) unit = code[1].toUpperCase()
  else if (unitLabel) unit = `Unit ${unitLabel[1]}`
  else if (uForm) unit = `Unit ${uForm[1].toUpperCase()}`
  else unit = (toks[0] || '').toUpperCase()

  // Paper number: an explicit "Unit N" / "Paper N", else the Pearson paper
  // segment (the 01 in 6PH01_01_que), else default.
  let paper = ''
  const paperLabel = base.match(/(?:unit|paper)\s*([0-9]+)/i)
  const segments = base.split(/[_\s]+/)
  if (paperLabel) paper = paperLabel[1]
  else if (/^[0-9]?[A-Za-z]{2,3}[0-9]/.test(segments[0]) && /^[0-9]{1,2}$/.test(segments[1] || '')) paper = segments[1]
  paper = paper || '01'

  return { unit, paper, type, date }
}

export function parseName(file: File, subject: string, level: string): LibFile | null {
  const parts = parseParts(file.name, file.webkitRelativePath || '')
  return parts ? { file, name: file.name, subject, level, ...parts } : null
}

export function parseEntry(name: string, subject: string, level: string, key: string): LibFile | null {
  const parts = parseParts(name, key)
  return parts ? { key, name, subject, level, ...parts } : null
}

/**
 * Which sitting a paper belongs to. Edexcel runs January, May/June and
 * October/November, so the month is enough once you allow for papers that
 * straddle the boundary of a session.
 */
export function sessionOf(date: string): { session: string; year: number } {
  if (!/^\d{8}$/.test(date)) return { session: 'Undated', year: 0 }
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(4, 6))
  if (month <= 4) return { session: 'January', year }
  if (month <= 8) return { session: 'May/June', year }
  return { session: 'October/November', year }
}

/**
 * Match each question paper to its mark scheme.
 *
 * The mark scheme is the one for the same unit and paper published soonest
 * after the exam. Taking the nearest date in either direction would pick up the
 * previous session's scheme when a session is missing its own.
 */
export function pairPapers(files: LibFile[]): PaperPair[] {
  const schemes = files.filter((f) => f.type === 'ms')
  const pairs: PaperPair[] = []

  for (const qp of files.filter((f) => f.type === 'qp')) {
    const candidates = schemes
      .filter((m) => m.unit === qp.unit && m.paper === qp.paper && m.date >= qp.date)
      .sort((a, b) => a.date.localeCompare(b.date))

    const { session, year } = sessionOf(qp.date)
    pairs.push({
      key: `${qp.level}/${qp.subject}/${qp.unit}/${qp.paper}/${qp.date}`,
      level: qp.level,
      subject: qp.subject,
      unit: qp.unit,
      paper: qp.paper,
      session,
      year,
      qp,
      ms: candidates[0],
    })
  }

  // Newest sitting first (the ones people drill), then paper 1 before paper 2
  // within a sitting. Undated papers have an empty date, which sorts last.
  return pairs.sort((a, b) =>
    b.qp.date.localeCompare(a.qp.date)
    || a.paper.localeCompare(b.paper, undefined, { numeric: true }),
  )
}

export function groupBySubject(pairs: PaperPair[]) {
  const out = new Map<string, Map<string, PaperPair[]>>()
  for (const pair of pairs) {
    if (!out.has(pair.subject)) out.set(pair.subject, new Map())
    const units = out.get(pair.subject)!
    if (!units.has(pair.unit)) units.set(pair.unit, [])
    units.get(pair.unit)!.push(pair)
  }
  return out
}

export type SessionGroup = { key: string; label: string; papers: PaperPair[] }

const SHORT_SESSION: Record<string, string> = {
  January: 'Jan', 'May/June': 'May/June', 'October/November': 'Oct/Nov',
}

/**
 * Group a subject's papers by sitting, newest first — the browse shape a
 * student expects (pick the session, see that session's papers). Grouping by
 * session keeps each list short and consistent even though the archive spans
 * several specifications with different unit codes.
 */
export function groupBySession(pairs: PaperPair[]): SessionGroup[] {
  const buckets = new Map<string, PaperPair[]>()
  for (const p of pairs) {
    const key = p.year ? `${p.year}-${p.session}` : 'undated'
    const list = buckets.get(key)
    if (list) list.push(p)
    else buckets.set(key, [p])
  }
  const groups = [...buckets.values()].map((papers) => {
    const p0 = papers[0]
    const label = p0.year ? `${SHORT_SESSION[p0.session] ?? p0.session} ${p0.year}` : 'Undated'
    const rep = papers.reduce((m, x) => (x.qp.date > m ? x.qp.date : m), '')
    papers.sort((a, b) =>
      a.unit.localeCompare(b.unit, undefined, { numeric: true })
      || a.paper.localeCompare(b.paper, undefined, { numeric: true }))
    return { key: p0.year ? `${p0.year}-${p0.session}` : 'undated', label, rep, papers }
  })
  groups.sort((a, b) => b.rep.localeCompare(a.rep))   // newest sitting first
  return groups.map(({ key, label, papers }) => ({ key, label, papers }))
}

/**
 * Maths unit codes carry a module, not a unit number: WMA11 is Pure 1, WME01 is
 * Mechanics 1 and WST01 is Statistics 1, so all three would collapse into a
 * bogus "Unit 1" if the digit were read the way it is for every other subject.
 * These families keep their own names instead.
 */
const MODULE_FAMILY: Record<string, string> = {
  MA: 'P', PM: 'P', ME: 'M', ST: 'S', FM: 'FP', DM: 'D',
}

/**
 * The unit a paper belongs to, as one name.
 *
 * The archive writes the same unit several ways — "Unit 1", "U1", and the spec
 * codes 6BI01, WBI01 and WBI11 — which left a subject split across groups that
 * are really the same thing. The last digit of an Edexcel code is the unit, so
 * WBI11 and WBI12 are units 1 and 2 of Biology, and both spec generations fold
 * onto the same name.
 *
 * The key is for grouping, the label for showing. Anything unrecognised (most
 * Cambridge codes) is left exactly as it was rather than guessed at.
 */
export function unitGroup(unit: string): { key: string; label: string } {
  const u = (unit || '').trim().toUpperCase()
  if (!u) return { key: 'other', label: 'Papers' }

  const plain = u.match(/^(?:UNIT\s*|U)(\d{1,2})([A-Z]?)$/)
  if (plain) {
    const n = Number(plain[1])
    return { key: `unit-${n}${plain[2]}`, label: `Unit ${n}${plain[2]}` }
  }

  // 6PH01, WPH01, WPH11, WBI12, WMA11 — <era><subject><spec><unit>.
  const code = u.match(/^[6W]([A-Z]{2})[01](\d)([A-Z]?)$/)
  if (code) {
    const module = MODULE_FAMILY[code[1]]
    const n = Number(code[2])
    if (module) return { key: `${module}${n}`, label: `${module}${n}` }
    // A spec runs to six units. A higher digit is a different kind of
    // assessment on an older spec — WCH07, 6PH08 — not a seventh unit, so it
    // keeps its own code rather than being invented into one.
    if (n >= 1 && n <= 6) return { key: `unit-${n}${code[3]}`, label: `Unit ${n}${code[3]}` }
    return { key: u, label: unit }
  }

  // Already-compact module names: P3, M1, S2, D1, FP1.
  const module = u.match(/^(FP|P|M|S|D|C)(\d{1,2})$/)
  if (module) return { key: `${module[1]}${Number(module[2])}`, label: `${module[1]}${Number(module[2])}` }

  return { key: u, label: unit }
}

/**
 * A paper reduced to what the viewer needs to open and label it: the sources to
 * stream, the metadata to show, and a short "Jan 2020 · Unit 1" caption. The
 * viewer keeps the whole subject's list so a student can step to the next paper
 * without going back to the library.
 */
export type PaperChoice = {
  key: string
  label: string
  qp: File | string
  ms?: File | string
  meta: PaperMeta
}

function choiceLabel(p: PaperPair): string {
  const sitting = p.year ? `${SHORT_SESSION[p.session] ?? p.session} ${p.year}` : 'Undated'
  return `${sitting} · ${p.unit}`
}

/** A subject's pairs turned into switchable choices, keeping the newest-first order. */
export function paperChoices(pairs: PaperPair[]): PaperChoice[] {
  return pairs.map((p) => ({
    key: p.key,
    label: choiceLabel(p),
    qp: sourceOf(p.qp),
    ms: p.ms ? sourceOf(p.ms) : undefined,
    meta: { level: p.level, subject: p.subject, unit: p.unit, session: p.session, year: p.year },
  }))
}

/**
 * The subject a path belongs to, given the segments below the picked root.
 *
 * The second segment, not the file's immediate parent, because archives nest a
 * session folder under the subject: IAL/Physics/2010 june/<file>.
 */
export function subjectFromPath(segments: string[]): string {
  const parts = segments.filter(Boolean)
  if (parts.length >= 3) return parts[1]
  if (parts.length === 2) return parts[0]
  return 'Papers'
}

/** The level (IAL/IGCSE/…) a path sits under — the first segment, best effort. */
export function levelFromPath(segments: string[]): string {
  const parts = segments.filter(Boolean)
  return parts.length >= 3 ? parts[0] : ''
}

/** Walk a picked directory, tracking the trail so subjects resolve correctly. */
export async function readDirectory(
  handle: FileSystemDirectoryHandle,
  trail: string[] = [],
): Promise<LibFile[]> {
  const found: LibFile[] = []
  for await (const entry of (handle as any).values()) {
    if (entry.kind === 'directory') {
      found.push(...(await readDirectory(entry, [...trail, entry.name])))
    } else if (entry.name.toLowerCase().endsWith('.pdf')) {
      const segs = [...trail, entry.name]
      const parsed = parseName(await entry.getFile(), subjectFromPath(segs), levelFromPath(segs))
      if (parsed) found.push(parsed)
    }
  }
  return found
}

/** What loadPdf should read: the file itself, or the route that streams it. */
export function sourceOf(entry: LibFile): File | string {
  return entry.file ?? `/api/paper?key=${encodeURIComponent(entry.key || '')}`
}

export type SubjectRef = { board: string; level: string; subject: string; prefix: string }

/**
 * The library's level → subject structure — fetched on open. This lists only
 * folder prefixes, never the files inside, so it stays fast no matter how many
 * papers the bucket holds. Files for a subject are fetched separately, only
 * when that subject is opened (see fetchSubjectFiles).
 *
 * `configured: false` means no storage is wired up yet; `locked: true` means a
 * password is required (both routes fail closed with 401).
 */
export async function fetchSubjects(): Promise<{
  configured: boolean
  locked: boolean
  subjects: SubjectRef[]
}> {
  const res = await fetch('/api/papers')
  if (res.status === 401) return { configured: true, locked: true, subjects: [] }
  if (!res.ok) throw new Error('The library could not be read.')
  const data = await res.json() as { configured: boolean; subjects?: SubjectRef[] }
  return { configured: data.configured, locked: false, subjects: data.subjects || [] }
}

/** The papers under one subject, fetched only when that subject is opened. */
export async function fetchSubjectFiles(ref: SubjectRef): Promise<LibFile[]> {
  const res = await fetch(`/api/papers?prefix=${encodeURIComponent(ref.prefix)}`)
  if (!res.ok) throw new Error('Those papers could not be read.')
  const data = await res.json() as {
    files?: { key: string; name: string; subject: string; level: string }[]
  }
  const out: LibFile[] = []
  for (const row of data.files || []) {
    const parsed = parseEntry(row.name, row.subject || ref.subject, row.level || ref.level, row.key)
    if (parsed) out.push(parsed)
  }
  return out
}

/** Trade the password for the cookie the storage routes look for. */
export async function unlock(password: string): Promise<void> {
  const res = await fetch('/api/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (res.status === 401) throw new Error('Wrong password.')
  if (!res.ok) throw new Error(await res.text() || 'Could not unlock the library.')
}

/**
 * Send one paper up.
 *
 * Base64 over JSON rather than a presigned PUT, so the bucket needs no CORS
 * policy. Papers are a few hundred kilobytes, well inside the request limit.
 */
export async function uploadPaper(file: File, key: string): Promise<void> {
  const buffer = await file.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buffer)
  // Chunked because spreading a large array into fromCharCode blows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  const res = await fetch('/api/papers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, data: btoa(binary) }),
  })
  if (!res.ok) throw new Error(await res.text() || 'Upload failed.')
}

export function readFileList(files: FileList): LibFile[] {
  const found: LibFile[] = []
  for (const file of Array.from(files)) {
    if (!file.name.toLowerCase().endsWith('.pdf')) continue
    // webkitRelativePath starts with the picked folder itself, which is not
    // part of the level/subject structure.
    const parts = (file.webkitRelativePath || '').split('/').slice(1)
    const parsed = parseName(file, subjectFromPath(parts), levelFromPath(parts))
    if (parsed) found.push(parsed)
  }
  return found
}
