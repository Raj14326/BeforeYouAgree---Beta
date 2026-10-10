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
        comparisons: [{
          categoryId: 'privacy_third_party_sharing',
          categoryName: 'Third-party data sharing',
          conclusion: 'both',
          assessments: [
            { documentId: 'a', relativeRisk: 'higher' },
            { documentId: 'b', relativeRisk: 'lower' },
          ],
          summary: 'Both describe providing personal information to advertising companies.',
          evidenceIds: ['E1', 'E2', 'invented'],
        }],
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
  })
})
