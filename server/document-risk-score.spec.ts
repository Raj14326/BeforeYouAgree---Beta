import { describe, expect, it } from 'vitest'
import { calculateOverallRiskScore } from './document-risk-score.ts'

const riskyFinding = (score: number) => ({
  text: 'The service may terminate your account without prior notice.',
  predictedLabel: 'risky' as const,
  riskLevel: 'medium' as const,
  categories: [{ id: 'category', score }],
})

describe('calculateOverallRiskScore', () => {
  it('returns zero for a document without flagged clauses', () => {
    expect(calculateOverallRiskScore(10, [])).toBe(0)
  })

  it('balances flagged severity, substantive coverage and a saturating count bonus', () => {
    const safe = Array.from({ length: 9 }, () => ({
      text: 'These ordinary terms explain how you may use the service.',
      predictedLabel: 'not_risky' as const,
      riskLevel: 'low' as const,
      categories: [],
    }))
    expect(calculateOverallRiskScore(10, [riskyFinding(0.8), ...safe], { category: 0.5 })).toBe(40)
    expect(calculateOverallRiskScore(10, [
      ...Array.from({ length: 8 }, () => riskyFinding(0.8)),
      ...safe.slice(0, 2),
    ], { category: 0.5 })).toBe(64)
  })

  it('does not dilute risk when headings or tiny fragments are present', () => {
    const findings = [riskyFinding(0.8), riskyFinding(0.7)]
    const headings = Array.from({ length: 20 }, (_, index) => ({
      text: `Heading ${index}`,
      predictedLabel: 'not_risky' as const,
      riskLevel: 'low' as const,
      categories: [],
    }))
    expect(calculateOverallRiskScore(22, [...findings, ...headings], { category: 0.5 })).toBe(
      calculateOverallRiskScore(2, findings, { category: 0.5 }),
    )
  })

  it('uses the strongest category score for each flagged clause', () => {
    expect(calculateOverallRiskScore(2, [{
      predictedLabel: 'risky',
      text: 'The service applies several significant restrictions to your account.',
      riskLevel: 'medium',
      categories: [{ id: 'a', score: 0.4 }, { id: 'b', score: 0.9 }],
    }], { a: 0.5, b: 0.5 })).toBe(75)
  })

  it('increases severity for high-risk and multi-category clauses', () => {
    const medium = calculateOverallRiskScore(4, [riskyFinding(0.8)], { category: 0.5 })
    const highAndBroad = calculateOverallRiskScore(4, [{
      predictedLabel: 'risky',
      text: 'The service applies several significant restrictions to your account.',
      riskLevel: 'high',
      categories: [
        { id: 'category', score: 0.8 },
        { id: 'second', score: 0.7 },
        { id: 'third', score: 0.7 },
      ],
    }], { category: 0.5, second: 0.5, third: 0.5 })

    expect(highAndBroad).toBeGreaterThan(medium)
  })
})
