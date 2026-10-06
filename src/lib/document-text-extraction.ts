/**
 * Extract plain text from a user-provided file (`.txt`, `.pdf`, `.docx`) in
 * the browser, so an uploaded document can be sent to `POST /api/analyze`
 * exactly like catalogue-retrieved text. Each file type is parsed by a
 * client-side library — the server stays dependency-free (see
 * `server/index.ts`'s header comment).
 */
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import mammoth from 'mammoth'

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href

/** Lowercased file extension (no dot), or '' if the name has none. */
function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName)
  return (match?.[1] ?? '').toLowerCase()
}

async function extractFromPdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: buffer }).promise
  const pageTexts: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    pageTexts.push(
      textContent.items.map((item) => ('str' in item ? item.str : '')).join(' '),
    )
  }
  return pageTexts.join('\n\n')
}

async function extractFromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

/**
 * Read `file` and return its plain text. Throws a user-facing `Error` for an
 * unsupported extension or a file that fails to parse (corrupt, encrypted, …).
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const extension = extensionOf(file.name)
  try {
    if (extension === 'txt') return await file.text()
    if (extension === 'pdf') return await extractFromPdf(file)
    if (extension === 'docx') return await extractFromDocx(file)
  } catch {
    throw new Error('This file could not be read. Try a different file or paste the text instead.')
  }
  throw new Error('Unsupported file type. Please upload a .txt, .pdf, or .docx file.')
}
