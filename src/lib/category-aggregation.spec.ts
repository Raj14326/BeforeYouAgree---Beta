import { describe, expect, it } from 'vitest'
import { aggregateScorecardRows } from './category-aggregation'
import { PRIVACY_CATEGORIES, TOS_CATEGORIES } from './risk-categories'
import type { Analysis, RiskFinding } from '@/types'

function finding(categories: Array<{ id: string; score: number }>): RiskFinding {
  return {
    text: 'text',
    start: 0,
    end: 4,
    occurrenceCount: 1,
    occurrenceStarts: [0],
    categories: categories.map((category) => ({ ...category, name: category.id })),
    predictedLabel: 'risky',
    riskLevel: 'medium',
    riskLevelMessage: 'Model-detected risk',
    reviewCategories: [],
  }
}

describe('aggregateScorecardRows', () => {
  it('returns one row per TOS category plus a single combined Privacy row', () => {
    const rows = aggregateScorecardRows(null)
    expect(rows).toHaveLength(TOS_CATEGORIES.length + 1)
    expect(rows.slice(0, -1).map((row) => row.id)).toEqual(TOS_CATEGORIES.map((category) => category.id))
    expect(rows[rows.length - 1]!.id).toBe('privacy')
  })

  it('marks a TOS row detected only when its own id appears', () => {
    const analysis: Analysis = {
      model: 'm',
      clauseCount: 2,
      riskyClauseCount: 2,
      findings: [finding([{ id: 'arbitration', score: 0.6 }]), finding([{ id: 'arbitration', score: 0.9 }])],
    }
    const rows = aggregateScorecardRows(analysis)
    const arbitration = rows.find((row) => row.id === 'arbitration')
    expect(arbitration).toMatchObject({ detected: true, maxScore: 0.9, occurrences: 2 })
    const undetected = rows.filter((row) => row.id !== 'arbitration' && row.id !== 'privacy')
    expect(undetected.every((row) => !row.detected)).toBe(true)
  })

  it('marks the Privacy row detected when any of the 11 privacy sub-categories appear', () => {
    const analysis: Analysis = {
      model: 'm',
      clauseCount: 1,
      riskyClauseCount: 1,
      findings: [
        finding([
          { id: 'privacy_location_tracking', score: 0.4 },
          { id: 'privacy_broad_collection', score: 0.7 },
        ]),
      ],
    }
    const rows = aggregateScorecardRows(analysis)
    const privacy = rows.find((row) => row.id === 'privacy')
    expect(privacy).toMatchObject({ detected: true, maxScore: 0.7, occurrences: 2 })
    expect(PRIVACY_CATEGORIES.some((category) => category.id === 'privacy_broad_collection')).toBe(true)
  })

  it('treats a null or empty analysis as nothing detected', () => {
    expect(aggregateScorecardRows(null).every((row) => !row.detected)).toBe(true)
    expect(
      aggregateScorecardRows({ model: 'm', clauseCount: 0, riskyClauseCount: 0, findings: [] }).every(
        (row) => !row.detected,
      ),
    ).toBe(true)
  })
})
