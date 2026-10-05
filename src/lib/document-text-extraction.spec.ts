import { describe, expect, it } from 'vitest'
import { extractTextFromFile } from './document-text-extraction'

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
})
