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
