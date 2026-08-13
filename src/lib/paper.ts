// The legacy build is transpiled for older browsers and, crucially, polyfills
// Promise.withResolvers in both the main thread and the worker. pdf.js 6 uses
// it, and without the polyfill getDocument throws on iOS Safari below 17.4 and
// older Android webviews, which is why papers failed to open on phones while
// working on desktop.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
// Not the package's own worker: pdf.js 6 ships one full of syntax older phones
// cannot parse, and being a standalone asset it escapes every build transform.
// scripts/build-worker.mjs lowers it to ES2019 and emits it into public/.
const worker = '/pdf.worker.mjs'

pdfjs.GlobalWorkerOptions.workerSrc = worker

/**
 * Question paper and mark scheme handling, entirely in the browser.
 *
 * Nothing is uploaded. The file the student picks is read with FileReader,
 * rendered to canvases locally, and never leaves the machine, which is also why
 * this works for any board and for school mocks that no archive has.
 *
 * Question detection reads the text layer and looks for a question number in
 * the left margin. Question papers put a bare number there; mark schemes put
 * the number in the first column of their table. Both give a page and a vertical
 * offset, which is enough to scroll either document to a given question.
 */

export type Anchor = { question: number; page: number; y: number }
export type PageSize = { width: number; height: number }
export type LoadedPaper = {
  doc: pdfjs.PDFDocumentProxy
  pages: number
  anchors: Anchor[]
  label: string
  /** Unscaled page dimensions, so placeholders and scroll offsets are exact. */
  sizes: PageSize[]
}

export type PaperKind = 'qp' | 'ms'

export async function loadPdf(
  source: File | string,
  label: string,
  kind: PaperKind = 'qp',
): Promise<LoadedPaper> {
  const data = typeof source === 'string'
    ? { url: source }
    : { data: new Uint8Array(await source.arrayBuffer()) }
  const doc = await pdfjs.getDocument(data).promise
  // Fetch every page once, in parallel, and reuse them for both the size
  // measurements and the question detection. Previously each page was fetched
  // sequentially for sizing and then fetched again inside detection, so a long
  // paper made a lot of serial round-trips to the worker before anything showed.
  const pages = await Promise.all(
    Array.from({ length: doc.numPages }, (_, i) => doc.getPage(i + 1)))
  const sizes: PageSize[] = pages.map((pg) => {
    const v = pg.getViewport({ scale: 1 })
    return { width: v.width, height: v.height }
  })
  // Question detection is a convenience, not the paper. If it fails on some
  // browser, still show the document rather than refusing to open it at all.
  let anchors: Anchor[] = []
  try {
    anchors = (await findQuestions(pages, kind)).anchors
  } catch (e) {
    console.warn('Question detection failed; opening the paper without it.', e)
  }
  return { doc, pages: doc.numPages, anchors, label, sizes }
}

/**
 * A question number in the left margin. Papers write a bare "1"; mark schemes
 * write "1", "1.", "1(a)", or a nested "24(a)(i)" in the first column of their
 * table, so a number followed by any run of "(x)" sub-part groups must count —
 * otherwise the first matched row for a question can be a later sub-part
 * (24(b)) and the mark-scheme slice starts mid-answer.
 */
const NUMBER = /^(\d{1,2})(?:\s*\(\s*[a-z0-9]+\s*\))*\s*[.):]?\s*$/i

/** `rot` marks rotated text — the "DO NOT WRITE IN THIS AREA" side rules. */
type Item = { str: string; x: number; y: number; rot: boolean }

/**
 * Mark schemes lay their answers out in a table whose first column is headed
 * "Question Number", and every question number sits underneath that heading.
 * Locating the heading gives the exact column to read, which is far more
 * reliable than guessing at a margin width, because mark scheme tables are
 * indented further than a question paper's margin and by varying amounts.
 *
 * pdf.js often splits the heading into separate "Question" and "Number" runs,
 * so matching the first word alone is enough.
 */
function questionColumn(items: Item[]) {
  for (const item of items) {
    if (/^question\s*(number|no\.?)?$/i.test(item.str)) {
      // Narrow on purpose. The answer column begins a little over 50pt to the
      // right, and a wider band would swallow marks and answer text.
      return { x: item.x, y: item.y, width: 45 }
    }
  }
  return null
}

type Cand = { n: number; page: number; y: number; x: number; w: number; h: number }

async function findQuestions(
  pages: pdfjs.PDFPageProxy[],
  kind: PaperKind,
): Promise<{ anchors: Anchor[]; textItems: number }> {
  // Pass 1: every bare integer that could be a question number, in reading
  // order (pages top-to-bottom, and within a page sorted by vertical position
  // rather than trusting the PDF's content-stream order).
  let cands: Cand[] = []

  // Pull every page's text in parallel so the worker can pipeline the parsing,
  // rather than awaiting one page's text before requesting the next.
  const contents = await Promise.all(pages.map((pg) => pg.getTextContent()))
  let textItems = 0
  for (const c of contents) textItems += (c?.items?.length ?? 0)
  for (let idx = 0; idx < pages.length; idx++) {
    const p = idx + 1
    const page = pages[idx]
    const viewport = page.getViewport({ scale: 1 })
    const content = contents[idx]

    const items: Item[] = (content.items as { str?: string; transform: number[] }[])
      .filter((i) => typeof i.str === 'string')
      .map((i) => ({
        str: (i.str as string).trim(),
        x: i.transform[4],
        y: i.transform[5],
        rot: Math.abs(i.transform[1]) > 0.01 || Math.abs(i.transform[2]) > 0.01,
      }))

    // Mark schemes repeat the "Question Number" heading on every answer page;
    // its column is re-found per page because it can shift. A page with no
    // heading is guidance, not answers, so it carries no question numbers.
    const column = kind === 'ms' ? questionColumn(items) : null
    if (kind === 'ms' && !column) continue

    // The footer sits at the reference barcode (e.g. *N34431RA02020*) Edexcel
    // prints on every page. Anchoring the cut to the barcode, not to page
    // height, survives odd page sizes: the last page of 6PH01 is tall enough
    // that a fixed bottom margin left its footer "20" looking like a Q20.
    let footerCut = Infinity
    for (const it of items) {
      if (/^\*[0-9A-Z]{4,}\*$/i.test(it.str)) footerCut = Math.min(footerCut, viewport.height - it.y - 40)
    }

    const pageCands: Cand[] = []
    for (const item of items) {
      if (!item.str || item.str.length > 12) continue   // room for "24(a)(iii)"
      if (item.rot) continue                            // side rules, not questions
      const m = NUMBER.exec(item.str)
      if (!m) continue
      const n = Number(m[1])
      if (n < 1 || n > 40) continue
      const yTop = viewport.height - item.y
      // A question number never sits in the header or footer band. Barcodes,
      // page numbers, and reference codes do — e.g. the "20" beside the footer
      // barcode on the last page of 6PH01, which otherwise reads as a Q20 that
      // doesn't exist. Only applied to question papers; mark schemes rely on
      // the column gate instead.
      if (kind !== 'ms' && (yTop < 30 || yTop > viewport.height - 45 || yTop >= footerCut)) continue
      // A question number opens its line. "Step 1", "Test 2" and "Titration 3"
      // are numbers with a word to their left on the same baseline, and a
      // practical paper is full of them — WCH16's numbered method steps formed a
      // tidier 1,2,3,4 run than the questions themselves and used to win.
      // Rotated side-rules and bare markers (the * on a QWC question like *15)
      // sit to the left too, so only real text counts as opening the line first.
      if (kind !== 'ms' && items.some((o) => o !== item && !o.rot
        && /[A-Za-z0-9]/.test(o.str)
        && Math.abs(o.y - item.y) <= 3 && o.x < item.x - 1)) continue
      if (column && !(item.x >= column.x - 10 && item.x <= column.x + column.width && item.y < column.y)) continue
      pageCands.push({ n, page: p, y: yTop, x: item.x, w: viewport.width, h: viewport.height })
    }
    pageCands.sort((a, b) => a.y - b.y)
    cands.push(...pageCands)
  }

  // Question papers: choose the left-hand column of numbers, measured as a
  // fraction of page width so portrait and landscape are handled the same way.
  // A paper has two such columns — the questions (1, 2, 3, …) and the page
  // numbers (often 2, 4, 6, … down one side of a double-sided print). Picking
  // by count would choose the page numbers when there are more of them, so
  // instead pick the column whose numbers best form the 1, 2, 3, … run.
  // Running page numbers sit on the same baseline low on the page, page after
  // page. A question can begin low on a page, but it will not land on the same
  // line across many pages, so a repeated bottom-of-page row is a footer. The
  // barcode cut above only catches footers that carry a barcode; Biology U1A
  // prints a bare page number a few points from the question margin, close
  // enough to fold into the question column and make the run read Q1, page 2,
  // Q3, page 4 — which is exactly what put "question 4" on a page number.
  const footerRows = new Map<number, Set<number>>()
  for (const c of cands) {
    if (c.y <= c.h * 0.8) continue
    const row = Math.round(c.y / 2)
    const pages = footerRows.get(row)
    if (pages) pages.add(c.page)
    else footerRows.set(row, new Set([c.page]))
  }
  cands = cands.filter((c) => !(c.y > c.h * 0.8
    && (footerRows.get(Math.round(c.y / 2))?.size ?? 0) >= 3))

  let band = cands
  if (kind !== 'ms') {
    const left = cands.filter((c) => c.x / c.w <= 0.32)

    // Each distinct left-margin column is a candidate for "the questions".
    const centers: number[] = []
    for (const c of left) {
      const f = c.x / c.w
      if (!centers.some((k) => Math.abs(k - f) <= 0.02)) centers.push(f)
    }

    // Score a column by how far through the paper its run reaches, not by how
    // long the run is. Questions are spread over the whole booklet, while a
    // numbered list — method steps, table rows — is packed onto one or two
    // pages, however tidily it counts. Length breaks a tie, then the leftmost
    // column wins, because a question number sits further out than body text.
    let best: { center: number; pages: number; length: number } | null = null
    for (const center of centers) {
      const column = left.filter((c) => Math.abs(c.x / c.w - center) <= 0.02)
      const run: Cand[] = []
      let expected = 1
      for (const c of column) if (c.n === expected) { run.push(c); expected += 1 }
      if (!run.length) continue

      // A long run whose number is a fixed offset from its own page index is a
      // page-number column (page N shows N, or N-1, …), not the questions —
      // real questions span and share pages, so their offset drifts.
      const offsets = new Set(run.map((r) => r.n - r.page))
      if (run.length >= 8 && offsets.size === 1) continue

      const pages = new Set(run.map((r) => r.page)).size
      if (!best
        || pages > best.pages
        || (pages === best.pages && run.length > best.length)
        || (pages === best.pages && run.length === best.length && center < best.center)) {
        best = { center, pages, length: run.length }
      }
    }
    band = best ? left.filter((c) => Math.abs(c.x / c.w - best!.center) <= 0.02) : []
  }

  const found: Anchor[] = []
  if (kind === 'ms') {
    // Mark schemes are messier than papers: multiple-choice answer blocks,
    // sub-parts like "13(a)", multi-page answers, and questions whose number
    // never appears as a clean token. A strict run would stop at the first
    // gap, so take a forward-tolerant one — strictly increasing, small gaps
    // allowed — and let anchorFor fill in the questions that were never found.
    let last = 0
    for (const c of band) {
      if (c.n > last && c.n <= last + 8) { found.push({ question: c.n, page: c.page, y: c.y }); last = c.n }
    }
  } else {
    // Papers are clean: strict 1, 2, 3, … keeps a page-number column (2, 4, 6…)
    // from slipping through as if it were the questions.
    let expected = 1
    for (const c of band) {
      if (c.n === expected) { found.push({ question: c.n, page: c.page, y: c.y }); expected += 1 }
    }
  }
  return { anchors: found, textItems }
}

export function anchorFor(anchors: Anchor[], question: number) {
  const exact = anchors.find((a) => a.question === question)
  if (exact) return exact
  // No exact match — common in sparse mark schemes where a question's number
  // was never a clean token. Fall back to the nearest detected question at or
  // below the one asked for, so the mark scheme lands in the right region
  // rather than nowhere. Last resort: the first anchor.
  let below: Anchor | undefined
  for (const a of anchors) {
    if (a.question <= question && (!below || a.question > below.question)) below = a
  }
  return below ?? anchors[0]
}

export function questionList(qp: Anchor[], ms: Anchor[]) {
  // The question paper is what the student navigates, so it decides which
  // questions exist. Fall back to the mark scheme only when the paper yielded
  // nothing — this stops a mark scheme that over-detects (extra table rows,
  // subtotals) from adding phantom question buttons the paper doesn't have.
  const source = qp.length ? qp : ms
  return [...new Set(source.map((a) => a.question))].sort((a, b) => a - b)
}

/**
 * Render one page into an existing canvas at a given CSS width.
 *
 * The backing store is always at least 2x the CSS size, even on a 1x display.
 * Exam papers are dense small type, and rendering at device scale alone is what
 * made this look soft.
 */
export async function renderInto(
  canvas: HTMLCanvasElement,
  doc: pdfjs.PDFDocumentProxy,
  pageNumber: number,
  cssWidth: number,
) {
  const page = await doc.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: cssWidth / base.width })
  const dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 1))

  canvas.width = Math.floor(viewport.width * dpr)
  canvas.height = Math.floor(viewport.height * dpr)
  canvas.style.width = `${Math.floor(viewport.width)}px`
  canvas.style.height = `${Math.floor(viewport.height)}px`

  const ctx = canvas.getContext('2d', { alpha: false })!
  await page.render({
    canvas,
    canvasContext: ctx,
    viewport,
    transform: [dpr, 0, 0, dpr, 0, 0],
  }).promise
}

/** A stable key per file, so progress survives a reload without a server. */
export async function paperKey(source: File | string) {
  const basis = typeof source === 'string' ? source : `${source.name}:${source.size}:${source.lastModified}`
  // Web Crypto is missing in some in-app webviews and non-secure contexts, where
  // crypto.subtle.digest would throw and take the whole paper open down with it.
  // The key only namespaces saved progress, so a plain string hash is a fine
  // fallback when subtle crypto isn't there.
  try {
    if (globalThis.crypto?.subtle) {
      const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(basis))
      return [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('')
    }
  } catch { /* fall through to the simple hash */ }
  let h = 0
  for (let i = 0; i < basis.length; i++) h = (Math.imul(h, 31) + basis.charCodeAt(i)) | 0
  return (h >>> 0).toString(16).padStart(8, '0')
}
