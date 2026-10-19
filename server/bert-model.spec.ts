// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

const inference = vi.hoisted(() => ({ rows: [] as number[][] }))

vi.mock('@huggingface/transformers', () => ({
  env: { allowRemoteModels: true },
  AutoTokenizer: {
    from_pretrained: vi.fn(async () => (texts: string[]) => ({ texts })),
  },
  AutoModelForSequenceClassification: {
    from_pretrained: vi.fn(async () => async (inputs: { texts: string[] }) => ({
      logits: {
        data: new Float32Array(
          inputs.texts.flatMap(() => inference.rows.shift() ?? Array(8).fill(-10)),
        ),
      },
    })),
  },
}))

import { splitClauses } from './clauses.ts'
import { analyzeWithBert } from './bert-model.ts'

afterEach(() => {
  inference.rows = []
})

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

  it('classifies unique clauses locally and retains repeated source offsets', async () => {
    inference.rows = [[3, -10, -10, -10, -10, -10, -10, -10]]
    const clause = 'We limit our liability for every loss or damage.'
    const result = await analyzeWithBert(`${clause}\n\n${clause}`)

    expect(result.sourceClauseCount).toBe(2)
    expect(result.clauseCount).toBe(1)
    expect(result.riskyClauseCount).toBe(1)
    expect(result.findings[0]!.predictedLabel).toBe('risky')
    expect(result.findings[0]!.occurrenceCount).toBe(2)
    expect(result.findings[0]!.occurrenceStarts).toEqual([0, clause.length + 2])
    expect(result.coverage).toBe('complete')
  })

  it('does not mark a clause risky when all local model scores are below review range', async () => {
    inference.rows = [Array(8).fill(-10)]
    const result = await analyzeWithBert('You may download a copy of your account information.')

    expect(result.riskyClauseCount).toBe(0)
    expect(result.findings[0]!.predictedLabel).toBe('not_risky')
    expect(result.findings[0]!.riskLevel).toBe('low')
  })

  it('combines deterministic privacy rules with local model results', async () => {
    inference.rows = [Array(8).fill(-10)]
    const result = await analyzeWithBert(
      'We may collect personal information including your account information.',
    )

    expect(result.riskyClauseCount).toBe(1)
    expect(result.findings[0]!.categories.map(({ id }) => id)).toContain('privacy_broad_collection')
  })
})
