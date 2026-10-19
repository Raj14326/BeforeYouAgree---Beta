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
      flaggedClauseCount: 0,
      severityClass: 'bg-success',
    })
    expect(documentRiskScore({ model: 'm', clauseCount: 0, riskyClauseCount: 0, findings: [] }, priorities, allEnabled, true)).toEqual({
      score: 0,
      flaggedShare: 0,
      flaggedClauseCount: 0,
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
      flaggedClauseCount: 0,
      severityClass: 'bg-success',
    })
  })

  it('adds preference emphasis to the backend-compatible baseline', () => {
    const analysis: Analysis = {
      model: 'm',
      clauseCount: 4,
      riskyClauseCount: 1,
      findings: [finding('risky', 'unilateral_change', 0.8)],
    }
    expect(documentRiskScore(analysis, priorities, allEnabled, true)).toEqual({
      score: 62,
      flaggedShare: 25,
      flaggedClauseCount: 1,
      severityClass: 'bg-danger',
    })
  })

  it('uses the backend score unchanged when preferences are off', () => {
    const analysis: Analysis = {
      model: 'm',
      clauseCount: 10,
      riskyClauseCount: 1,
      overallRiskScore: 42,
      findings: [finding('risky', 'unilateral_change', 0.8)],
    }

    expect(documentRiskScore(analysis, priorities, allEnabled, false).score).toBe(42)
  })

  it('does not reduce the baseline or hide underlying findings when a preference is disabled', () => {
    const analysis: Analysis = {
      model: 'm',
      clauseCount: 10,
      riskyClauseCount: 2,
      overallRiskScore: 50,
      findings: [
        finding('risky', 'unilateral_change', 0.8),
        finding('risky', 'arbitration', 0.8),
      ],
    }

    expect(documentRiskScore(analysis, priorities, new Set(['arbitration']), true)).toMatchObject({
      score: 50,
      flaggedClauseCount: 2,
      flaggedShare: 20,
    })
  })

  it('raises the score when many findings match the top-ranked Privacy preference', () => {
    const privacyFindings = Array.from({ length: 3 }, () =>
      finding('risky', 'privacy_location_tracking', 0.8),
    )
    const analysis: Analysis = {
      model: 'm',
      clauseCount: 10,
      riskyClauseCount: 4,
      overallRiskScore: 50,
      findings: [...privacyFindings, finding('risky', 'arbitration', 0.8)],
    }
    const enabled = new Set(['privacy_location_tracking', 'arbitration', 'unilateral_change'])
    const privacyFirst = ['privacy_location_tracking', 'unilateral_change', 'arbitration']
    const privacyLast = ['unilateral_change', 'arbitration', 'privacy_location_tracking']

    expect(documentRiskScore(analysis, privacyFirst, enabled, true).score).toBe(61)
    expect(documentRiskScore(analysis, privacyLast, enabled, true).score).toBe(52)
    expect(documentRiskScore(analysis, privacyFirst, enabled, false).score).toBe(50)
  })

  it('gives substantially different scores when flagged coverage differs', () => {
    const analysisFor = (riskyClauseCount: number): Analysis => ({
      model: 'm',
      clauseCount: 10,
      riskyClauseCount,
      findings: Array.from({ length: riskyClauseCount }, () =>
        finding('risky', 'unilateral_change', 0.8),
      ),
    })

    expect(documentRiskScore(analysisFor(1), priorities, allEnabled, false).score).toBe(38)
    expect(documentRiskScore(analysisFor(8), priorities, allEnabled, false).score).toBe(80)
  })

  it('picks the progress-bar severity class from the flagged share thresholds', () => {
    const analysisFor = (riskyClauseCount: number, clauseCount: number): Analysis => ({
      model: 'm',
      clauseCount,
      riskyClauseCount,
      findings: Array.from({ length: riskyClauseCount }, () =>
        finding('risky', 'unilateral_change', 0.8),
      ),
    })
    expect(documentRiskScore(analysisFor(0, 100), priorities, allEnabled, true).severityClass).toBe('bg-success')
    expect(documentRiskScore(analysisFor(10, 100), priorities, allEnabled, true).severityClass).toBe('bg-warning')
    expect(documentRiskScore(analysisFor(25, 100), priorities, allEnabled, true).severityClass).toBe('bg-danger')
  })
})
