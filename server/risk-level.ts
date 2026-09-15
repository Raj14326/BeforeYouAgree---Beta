/**
 * Convert per-category model scores into a simple user-facing risk level.
 *
 * The model scores are independent, uncalibrated category scores. This module
 * therefore compares each score with that category's tuned decision threshold
 * from `risk_config.json`; it never presents a raw score as a legal-risk
 * probability.
 *
 * Ported from `bert_multilabel/ml_service/risk_level.py`.
 */

export const HIGH_CONFIDENCE_MARGIN = 0.15
const REVIEW_MARGIN = 0.08

export type RiskLevel = 'low' | 'medium' | 'high'

export type RiskLevelResult = {
  riskLevel: RiskLevel
  riskLevelMessage: string
  detectedCategories: string[]
  reviewCategories: string[]
}

/**
 * Return a risk-level payload for one clause.
 *
 * `high` means either two or more categories were detected, or one score
 * clearly exceeded its own threshold. `medium` means at least one category
 * was detected, or a score is close enough to a threshold to review. `low`
 * means no category was detected and none is close to its threshold.
 */
export function classifyRiskLevel(
  scores: Record<string, number>,
  thresholds: Record<string, number>,
  {
    reviewMargin = REVIEW_MARGIN,
    highConfidenceMargin = HIGH_CONFIDENCE_MARGIN,
  }: { reviewMargin?: number; highConfidenceMargin?: number } = {},
): RiskLevelResult {
  const unknown = Object.keys(scores).filter((category) => !(category in thresholds))
  if (unknown.length) {
    throw new Error(`Missing thresholds for categories: ${unknown.sort().join(', ')}`)
  }
  if (reviewMargin < 0 || highConfidenceMargin < 0) {
    throw new Error('Risk-level margins must be non-negative')
  }

  const detectedCategories: string[] = []
  const reviewCategories: string[] = []
  let clearlyDetected = false

  for (const [category, score] of Object.entries(scores)) {
    const threshold = thresholds[category]!
    if (score >= threshold) detectedCategories.push(category)
    if (Math.abs(score - threshold) <= reviewMargin) reviewCategories.push(category)
    if (score >= threshold + highConfidenceMargin) clearlyDetected = true
  }

  if (detectedCategories.length >= 2 || clearlyDetected) {
    return {
      riskLevel: 'high',
      riskLevelMessage: 'High model-detected risk',
      detectedCategories,
      reviewCategories,
    }
  }
  if (detectedCategories.length || reviewCategories.length) {
    return {
      riskLevel: 'medium',
      riskLevelMessage: 'Medium model-detected risk',
      detectedCategories,
      reviewCategories,
    }
  }
  return {
    riskLevel: 'low',
    riskLevelMessage: 'Low model-detected risk',
    detectedCategories,
    reviewCategories,
  }
}
