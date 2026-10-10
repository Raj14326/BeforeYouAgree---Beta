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

export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const MAX_TEXT_LENGTH = 500_000
const MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024
const MAX_DOCX_ENTRIES = 5_000
const MIME_TYPES: Record<string, Set<string>> = {
  txt: new Set(['text/plain']),
  pdf: new Set(['application/pdf']),
  docx: new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
}

/** Lowercased file extension (no dot), or '' if the name has none. */
function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName)
  return (match?.[1] ?? '').toLowerCase()
}

function validateMetadata(file: File) {
  const extension = extensionOf(file.name)
  if (!(extension in MIME_TYPES))
    throw new Error('Unsupported file type. Please upload a .txt, .pdf, or .docx file.')
  if (!file.size) throw new Error('The selected file is empty.')
  if (file.size > MAX_FILE_BYTES) throw new Error('The selected file exceeds the 10 MB limit.')
  const allowedTypes = MIME_TYPES[extension]!
  if (file.type && file.type !== 'application/octet-stream' && !allowedTypes.has(file.type.toLowerCase()))
    throw new Error(`The file contents do not match the .${extension} extension.`)
  return extension
}

function validateDocxArchive(buffer: ArrayBuffer) {
  if (buffer.byteLength < 22) throw new Error('The DOCX archive is invalid.')
  const view = new DataView(buffer)
  let eocd = -1
  for (let offset = buffer.byteLength - 22; offset >= Math.max(0, buffer.byteLength - 65_557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset
      break
    }
  }
  if (eocd < 0) throw new Error('The DOCX archive is invalid.')

  const entries = view.getUint16(eocd + 10, true)
  const directorySize = view.getUint32(eocd + 12, true)
  const directoryOffset = view.getUint32(eocd + 16, true)
  if (entries > MAX_DOCX_ENTRIES || directoryOffset + directorySize > buffer.byteLength)
    throw new Error('The DOCX archive is too large or invalid.')

  let offset = directoryOffset
  let expandedBytes = 0
  let hasDocumentXml = false
  const decoder = new TextDecoder()
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > buffer.byteLength || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error('The DOCX archive is invalid.')
    const flags = view.getUint16(offset + 8, true)
    const compression = view.getUint16(offset + 10, true)
    const expanded = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const next = offset + 46 + nameLength + extraLength + commentLength
    if ((flags & 1) || ![0, 8].includes(compression) || expanded === 0xffffffff || next > buffer.byteLength)
      throw new Error('Encrypted or unsupported DOCX files cannot be processed.')
    expandedBytes += expanded
    if (expandedBytes > MAX_DOCX_UNCOMPRESSED_BYTES)
      throw new Error('The DOCX expands beyond the safe processing limit.')
    const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLength))
    if (name === 'word/document.xml') hasDocumentXml = true
    offset = next
  }
  if (!hasDocumentXml) throw new Error('The file is not a valid DOCX document.')
}

function ensureTextLimit(text: string) {
  if (text.length > MAX_TEXT_LENGTH)
    throw new Error(`The extracted text exceeds ${MAX_TEXT_LENGTH.toLocaleString()} characters.`)
  return text
}

async function extractFromPdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  if (new TextDecoder('ascii').decode(buffer.slice(0, 5)) !== '%PDF-')
    throw new Error('The file is not a valid PDF document.')
  const task = getDocument({ data: buffer, stopAtErrors: true, maxImageSize: 16_000_000 })
  const pdf = await task.promise
  try {
    if (pdf.numPages > 1_000) throw new Error('The PDF has too many pages to process safely.')
    const pages: string[] = []
    let length = 0
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const text = textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ')
      length += text.length + 2
      if (length > MAX_TEXT_LENGTH) throw new Error('The extracted PDF text is too large to analyze.')
      pages.push(text)
      page.cleanup()
    }
    return pages.join('\n\n')
  } finally {
    await task.destroy()
  }
}

async function extractFromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  validateDocxArchive(arrayBuffer)
  const result = await mammoth.extractRawText({ arrayBuffer })
  return ensureTextLimit(result.value)
}

/**
 * Read `file` and return its plain text. Throws a user-facing `Error` for an
 * unsupported extension or a file that fails to parse (corrupt, encrypted, …).
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const extension = validateMetadata(file)
  try {
    if (extension === 'txt') {
      const bytes = new Uint8Array(await file.slice(0, 4_096).arrayBuffer())
      if (bytes.includes(0)) throw new Error('The file does not appear to be plain text.')
      return ensureTextLimit(await file.text())
    }
    if (extension === 'pdf') return await extractFromPdf(file)
    if (extension === 'docx') return await extractFromDocx(file)
  } catch (cause) {
    if (cause instanceof Error && /(?:limit|large|exceeds|valid|match|encrypted|unsupported|plain text)/i.test(cause.message))
      throw cause
    throw new Error('This file could not be read. Try a different file or paste the text instead.')
  }
  throw new Error('Unsupported file type.')
}
