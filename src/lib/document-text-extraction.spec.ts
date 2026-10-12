import { describe, expect, it } from 'vitest'
import { extractTextFromFile, MAX_FILE_BYTES, MAX_TEXT_LENGTH } from './document-text-extraction'

function fileFrom(name: string, content: string, type = 'text/plain') {
  return new File([content], name, { type })
}

describe('extractTextFromFile', () => {
  it('reads a .txt file as plain text', async () => {
    const file = fileFrom('terms.txt', 'Hello, these are the terms.')
    await expect(extractTextFromFile(file)).resolves.toBe('Hello, these are the terms.')
  })

  it('is case-insensitive about the extension', async () => {
    const file = fileFrom('TERMS.TXT', 'Shouting terms.')
    await expect(extractTextFromFile(file)).resolves.toBe('Shouting terms.')
  })

  it('rejects an unsupported extension', async () => {
    const file = fileFrom('terms.rtf', 'rich text')
    await expect(extractTextFromFile(file)).rejects.toThrow(/unsupported file type/i)
  })

  it('rejects a file with no extension', async () => {
    const file = fileFrom('terms', 'no extension')
    await expect(extractTextFromFile(file)).rejects.toThrow(/unsupported file type/i)
  })

  it('rejects files over 10 MB before reading them', async () => {
    const file = new File([new Uint8Array(MAX_FILE_BYTES + 1)], 'terms.txt', { type: 'text/plain' })
    await expect(extractTextFromFile(file)).rejects.toThrow(/10 MB limit/i)
  })

  it('rejects mismatched MIME types and binary files disguised as text', async () => {
    await expect(extractTextFromFile(fileFrom('terms.pdf', 'not a pdf', 'text/plain')))
      .rejects.toThrow(/do not match/i)
    await expect(extractTextFromFile(new File([new Uint8Array([65, 0, 66])], 'terms.txt', { type: 'text/plain' })))
      .rejects.toThrow(/plain text/i)
  })

  it('limits extracted text to the API maximum', async () => {
    const file = fileFrom('terms.txt', 'a'.repeat(MAX_TEXT_LENGTH + 1))
    await expect(extractTextFromFile(file)).rejects.toThrow(/exceeds/i)
  })
})
