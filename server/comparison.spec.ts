// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { compareWithGroq, comparisonEvidence, type ComparisonDocument } from './comparison.ts'

const documents: ComparisonDocument[] = [
  {
    id: 'a',
    name: 'Service A',
    documentType: 'privacy',
    content: 'We share personal information with advertising partners.',
    findings: [{
      text: 'We share personal information with advertising partners.',
      start: 0,
      end: 56,
      predictedLabel: 'risky',
      categories: [{ id: 'privacy_third_party_sharing', name: 'Third-party data sharing', score: 0.96 }],
    }],
  },
  {
    id: 'b',
    name: 'Service B',
    documentType: 'privacy',
    content: 'Marketing providers may receive personal information to deliver advertisements.\n\nUnrelated account help is available.',
    findings: [],
  },
]

afterEach(() => vi.unstubAllGlobals())

describe('comparison evidence', () => {
  it('keeps flagged clauses and retrieves related unflagged clauses from the other document', () => {
    const evidence = comparisonEvidence(documents)
    expect(evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ documentId: 'a', source: 'flagged' }),
      expect.objectContaining({ documentId: 'b', source: 'retrieved', text: expect.stringContaining('Marketing providers') }),
    ]))
  })

  it('sends only selected evidence to Groq and accepts citations to known evidence', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        overview: 'Both documents provide evidence of sharing.',
        overrides: [],
        caveat: 'This comparison is limited to the supplied evidence.',
      }) } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await compareWithGroq(documents, 'secret', 'test-model')
    expect(result.winnerDocumentId).toBe('b')
    expect(result.comparisons[0]?.evidenceIds).toEqual(['E1', 'E2'])
    const request = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(request.store).toBe(false)
    expect(request.messages[1].content).not.toContain('Unrelated account help')
    const prompt = JSON.parse(request.messages[1].content)
    expect(prompt.matchedClauses).toHaveLength(1)
    expect(new Set(prompt.matchedClauses[0].clauses.map((item: { documentId: string }) => item.documentId)))
      .toEqual(new Set(['a', 'b']))
    expect(request.messages[0].content).toContain('Do not summarize every category separately')
    expect(prompt.categories[0].assessments).toEqual(expect.arrayContaining([
      expect.objectContaining({ documentId: 'a', score: 0.96, relativeRisk: 'higher' }),
      expect.objectContaining({ documentId: 'b', score: 0, relativeRisk: 'lower' }),
    ]))
  })

  it('accepts a Groq override only when it cites every compared document', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        overview: 'The clause meaning changes the result.',
        overrides: [{
          categoryId: 'privacy_third_party_sharing',
          betterDocumentId: 'a',
          reason: 'Service A is safer based on the meaning of both cited clauses.',
          evidenceIds: ['E1', 'E2'],
        }],
        caveat: 'Limited to supplied evidence.',
      }) } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await compareWithGroq(documents, 'secret', 'test-model')

    expect(result.comparisons[0]?.betterDocumentId).toBe('a')
    expect(result.winnerDocumentId).toBe('a')
  })

  it('retries a failed response with a smaller request', async () => {
    const multiCategoryDocuments = structuredClone(documents)
    multiCategoryDocuments[0]!.findings[0]!.categories.push({
      id: 'privacy_retention',
      name: 'Data retention',
      score: 0.91,
    })
    const completion = new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        overview: 'The documents differ.',
        overrides: [],
        caveat: 'Limited to supplied evidence.',
      }) } }],
    }), { status: 200 })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('request too large', { status: 413 }))
      .mockResolvedValueOnce(completion)
    vi.stubGlobal('fetch', fetchMock)

    await compareWithGroq(multiCategoryDocuments, 'secret', 'test-model')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const first = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    const retry = JSON.parse(fetchMock.mock.calls[1]![1].body as string)
    expect(first.max_completion_tokens).toBe(450)
    expect(retry.max_completion_tokens).toBe(350)
    const retryPrompt = JSON.parse(retry.messages[1].content)
    expect(retryPrompt.matchedClauses).toHaveLength(2)
  })

  it('returns a stable error after the initial attempt and three retries fail', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response('upstream failure', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(compareWithGroq(documents, 'secret', 'test-model'))
      .rejects.toThrow('AI summary could not be provided.')
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})
