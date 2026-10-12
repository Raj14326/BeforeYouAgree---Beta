import { describe, expect, it } from 'vitest'
import { documentRiskScore } from './document-risk-score'
import type { Analysis, RiskFinding } from '@/types'

const priorities = ['unilateral_change', 'arbitration']
const allEnabled = new Set(priorities)

function finding(predictedLabel: RiskFinding['predictedLabel'], categoryId: string, score: number): RiskFinding {
  return {
    text: 'text',
    start: 0,
    end: 4,
    occurrenceCount: 1,
    occurrenceStarts: [0],
    categories: [{ id: categoryId, name: categoryId, score }],
    predictedLabel,
    riskLevel: 'medium',
    riskLevelMessage: 'Model-detected risk',
    reviewCategories: [],
  }
}

describe('documentRiskScore', () => {
  it('returns an all-zero, low-severity result for a null or empty analysis', () => {
    expect(documentRiskScore(null, priorities, allEnabled, true)).toEqual({
      score: 0,
      flaggedShare: 0,
      severityClass: 'bg-success',
    })
    expect(documentRiskScore({ model: 'm', clauseCount: 0, riskyClauseCount: 0, findings: [] }, priorities, allEnabled, true)).toEqual({
      score: 0,
      flaggedShare: 0,
      severityClass: 'bg-success',
    })
  })

  it('returns zero score but a non-zero flagged share when nothing is labelled risky', () => {
    const analysis: Analysis = {
      model: 'm',
      clauseCount: 4,
      riskyClauseCount: 0,
      findings: [finding('not_risky', 'unilateral_change', 0.9)],
    }
    expect(documentRiskScore(analysis, priorities, allEnabled, true)).toEqual({
      score: 0,
      flaggedShare: 0,
      severityClass: 'bg-success',
    })
  })

  it('blends average personalised severity (70%) with flagged share (30%)', () => {
    const analysis: Analysis = {
      model: 'm',
      clauseCount: 4,
      riskyClauseCount: 1,
      findings: [finding('risky', 'unilateral_change', 0.8)],
    }
    // personalisedRiskScore for this finding: detection 56 + preference 20 = 76 (see personalised-risk-score.spec.ts)
    // flaggedShare: round(1/4 * 100) = 25
    // score: round(0.7 * 76 + 0.3 * 25) = round(53.2 + 7.5) = 61
    expect(documentRiskScore(analysis, priorities, allEnabled, true)).toEqual({
      score: 61,
      flaggedShare: 25,
      severityClass: 'bg-danger',
    })
  })

  it('picks the progress-bar severity class from the flagged share thresholds', () => {
    const analysisFor = (riskyClauseCount: number, clauseCount: number): Analysis => ({
      model: 'm',
      clauseCount,
      riskyClauseCount,
      findings: [],
    })
    expect(documentRiskScore(analysisFor(0, 100), priorities, allEnabled, true).severityClass).toBe('bg-success')
    expect(documentRiskScore(analysisFor(10, 100), priorities, allEnabled, true).severityClass).toBe('bg-warning')
    expect(documentRiskScore(analysisFor(25, 100), priorities, allEnabled, true).severityClass).toBe('bg-danger')
  })
})
