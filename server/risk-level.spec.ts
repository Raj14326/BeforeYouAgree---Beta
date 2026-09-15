// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { classifyRiskLevel } from './risk-level.ts'

const THRESHOLDS = { a: 0.8, b: 0.6 }

describe('clause risk-level classification', () => {
  it('is high for a clear detection', () => {
    const result = classifyRiskLevel({ a: 0.96, b: 0.1 }, THRESHOLDS)
    expect(result.riskLevel).toBe('high')
    expect(result.detectedCategories).toEqual(['a'])
  })

  it('is high for multiple detected categories', () => {
    const result = classifyRiskLevel({ a: 0.81, b: 0.61 }, THRESHOLDS)
    expect(result.riskLevel).toBe('high')
  })

  it('is medium for one detected or near-threshold category', () => {
    const detected = classifyRiskLevel({ a: 0.81, b: 0.1 }, THRESHOLDS)
    const review = classifyRiskLevel({ a: 0.74, b: 0.1 }, THRESHOLDS)
    expect(detected.riskLevel).toBe('medium')
    expect(review.riskLevel).toBe('medium')
    expect(review.reviewCategories).toEqual(['a'])
  })

  it('is low when no category is detected or needs review', () => {
    const result = classifyRiskLevel({ a: 0.3, b: 0.1 }, THRESHOLDS)
    expect(result.riskLevel).toBe('low')
  })

  it('throws when a score has no matching threshold', () => {
    expect(() => classifyRiskLevel({ a: 0.5, c: 0.5 }, THRESHOLDS)).toThrow(/Missing thresholds/)
  })
})
