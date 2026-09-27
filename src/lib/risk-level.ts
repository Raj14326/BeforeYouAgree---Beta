import type { RiskLevel } from '@/types'

/** Bootstrap badge colour for a clause's model-detected risk level. */
export function riskLevelBadgeClass(riskLevel: RiskLevel) {
  if (riskLevel === 'high') return 'text-bg-danger'
  if (riskLevel === 'medium') return 'text-bg-warning'
  return 'text-bg-success'
}

/** CSS colour for a risk level, used for the clause card's left edge strip. */
export function riskLevelColor(riskLevel: RiskLevel) {
  if (riskLevel === 'high') return 'var(--bs-danger)'
  if (riskLevel === 'medium') return 'var(--bs-warning)'
  return 'var(--bs-success)'
}

/**
 * Plain-language summary of a 0-100 document risk score, for the Privacy
 * Nutrition Card. Thresholds match {@link import('./personalised-risk-score').personalisedRiskLevel}.
 */
export function riskLevelPhrase(score: number): string {
  if (score >= 75) return 'This document is high-risk — it uses many clauses common in one-sided agreements.'
  if (score >= 45) return 'This document carries some risk — a few clauses are worth reading closely.'
  return 'This document looks relatively low-risk based on what was found.'
}
