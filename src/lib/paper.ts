import * as pdfjs from 'pdfjs-dist'
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

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
export type LoadedPaper = {
  doc: pdfjs.PDFDocumentProxy
  pages: number
  anchors: Anchor[]
  label: string
}

export async function loadPdf(source: File | string, label: string): Promise<LoadedPaper> {
  const data = typeof source === 'string'
    ? { url: source }
    : { data: new Uint8Array(await source.arrayBuffer()) }
  const doc = await pdfjs.getDocument(data).promise
  return { doc, pages: doc.numPages, anchors: await findQuestions(doc), label }
}

/** A bare or bracketed question number sitting in the left margin. */
const NUMBER = /^(\d{1,2})\s*(?:\(?[a-z]\)?)?[.)]?$/i

async function findQuestions(doc: pdfjs.PDFDocumentProxy): Promise<Anchor[]> {
  const found: Anchor[] = []
  let highest = 0

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()

    for (const item of content.items as { str: string; transform: number[] }[]) {
      const text = (item.str || '').trim()
      if (!text) continue
      const m = NUMBER.exec(text)
      if (!m) continue

      const x = item.transform[4]
      const y = item.transform[5]
      // Left margin only. Anything further in is part of the question text.
      if (x > viewport.width * 0.16) continue

      const n = Number(m[1])
      // Questions run upward. This rejects mark totals and stray numbers.
      if (n !== highest + 1 || n > 40) continue

      highest = n
      found.push({ question: n, page: p, y: viewport.height - y })
    }
  }
  return found
}

export function anchorFor(anchors: Anchor[], question: number) {
  return anchors.find((a) => a.question === question)
}

export function questionList(qp: Anchor[], ms: Anchor[]) {
  const numbers = new Set([...qp.map((a) => a.question), ...ms.map((a) => a.question)])
  return [...numbers].sort((a, b) => a - b)
}

/** Render one page to a canvas at the given width. */
export async function renderPage(doc: pdfjs.PDFDocumentProxy, pageNumber: number, width: number) {
  const page = await doc.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const scale = width / base.width
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  const ratio = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.floor(viewport.width * ratio)
  canvas.height = Math.floor(viewport.height * ratio)
  canvas.style.width = '100%'
  canvas.style.height = 'auto'
  const ctx = canvas.getContext('2d')!
  await page.render({
    canvas,
    canvasContext: ctx,
    viewport,
    transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
  }).promise
  return { canvas, scale }
}

/** A stable key per file, so progress survives a reload without a server. */
export async function paperKey(source: File | string) {
  const basis = typeof source === 'string' ? source : `${source.name}:${source.size}:${source.lastModified}`
  const bytes = new TextEncoder().encode(basis)
  const digest = await crypto.subtle.digest('SHA-1', bytes)
  return [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('')
}
