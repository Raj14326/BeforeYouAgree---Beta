// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { splitClauses } from './clauses.ts'
import { analyzeWithBert } from './bert-model.ts'

afterEach(() => vi.unstubAllGlobals())
const modelInfo = {
  architecture: 'LEGAL-BERT-Small', baseModel: 'fixture/model',
  baseModelUrl: 'https://huggingface.co/fixture/model', modelRevision: 'abc',
  trainingDataset: 'fixture/data', datasetUrl: 'https://huggingface.co/datasets/fixture/data',
  datasetRevision: 'def', datasetLicense: 'CC-BY-4.0', language: 'English',
  scope: 'test scope', scoreMeaning: 'uncalibrated',
}

describe('BERT document adapter', () => {
  it('preserves repeated text, short clauses and UTF-16 offsets', () => {
    const content = '  😀 No refunds.\r\n\r\nNo refunds.\n1. We will not sell data.\n2. Unless you consent.  '
    const clauses = splitClauses(content)
    expect(clauses).toHaveLength(4)
    for (const clause of clauses) expect(content.slice(clause.start, clause.end)).toBe(clause.text)
    expect(clauses[1]!.start).toBeGreaterThan(clauses[0]!.end)
    expect(clauses[2]!.text).toContain('not sell')
  })

  it('runs sentence-level segmentation while preserving exact text', () => {
    const clauses = splitClauses('We can terminate access. However, we must first give notice.')
    expect(clauses).toHaveLength(2)
    expect(clauses.map(item => item.text)).toEqual(['We can terminate access.', 'However, we must first give notice.'])
  })

  it('anchors out-of-order model results by ID and does not round before classifying', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: 'fixture', modelInfo, threshold: 0.6, findings: [
        { clauseId: 'clause-1', riskProbability: 0.59999999, predictedLabel: 'not_risky', needsReview: true, windowCount: 1 },
        { clauseId: 'clause-0', riskProbability: 0.9, predictedLabel: 'risky', needsReview: false, windowCount: 2 },
      ],
    }))))
    const result = await analyzeWithBert('No refunds.\n\nNo refunds.')
    expect(result.riskyClauseCount).toBe(1)
    expect(result.findings[1]!.predictedLabel).toBe('not_risky')
    expect(result.findings[1]!.start).toBe(13)
    expect(result.coverage).toBe('complete')
  })

  it('rejects missing findings instead of showing partial coverage as safe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ model: 'x', modelInfo, threshold: 0.5, findings: [] }))))
    await expect(analyzeWithBert('No refunds.')).rejects.toMatchObject({ statusCode: 502 })
  })

  it('does not silently fall back to NB when inference is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(analyzeWithBert('No refunds.')).rejects.toMatchObject({ statusCode: 503 })
  })

  it('rejects duplicate IDs and non-finite/out-of-range scores', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: 'x', modelInfo, threshold: 0.5, findings: [{ clauseId: 'clause-0', riskProbability: 1.1, predictedLabel: 'risky', needsReview: false, windowCount: 1 }],
    }))))
    await expect(analyzeWithBert('No refunds.')).rejects.toMatchObject({ statusCode: 502 })
  })
})
