type ScoredFinding = {
  text: string
  predictedLabel: 'risky' | 'not_risky'
  riskLevel: 'low' | 'medium' | 'high'
  categories: Array<{ id: string; score: number }>
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const RISK_LEVEL_SEVERITY = { low: 0.25, medium: 0.6, high: 0.9 } as const

/** Convert a category score to its distance above that category's decision threshold. */
function thresholdAdjustedStrength(score: number, threshold: number) {
  const boundedThreshold = clamp(threshold)
  if (boundedThreshold >= 1) return score >= 1 ? 1 : 0
  return clamp((clamp(score) - boundedThreshold) / (1 - boundedThreshold))
}

/**
 * Clause severity combines model confidence above the tuned threshold, the
 * backend's threshold-aware risk level, and a small multi-category premium.
 */
function clauseSeverity(finding: ScoredFinding, thresholds: Record<string, number>) {
  const detectionStrength = Math.max(
    0,
    ...finding.categories.map(({ id, score }) =>
      thresholdAdjustedStrength(score, thresholds[id] ?? 0.5),
    ),
  )
  const riskLevelStrength = RISK_LEVEL_SEVERITY[finding.riskLevel]
  const categoryBreadth = Math.min(Math.max(finding.categories.length - 1, 0) * 0.05, 0.1)
  return clamp(0.65 * detectionStrength + 0.25 * riskLevelStrength + categoryBreadth)
}

/** Exclude headings and tiny fragments from document coverage. */
function isSubstantiveClause(finding: ScoredFinding) {
  if (finding.predictedLabel === 'risky') return true
  const text = finding.text.trim()
  return text.length >= 50 || text.split(/\s+/).filter(Boolean).length >= 6
}

/**
 * Authoritative, preference-neutral document score returned by the API.
 * Severity remains the main signal, while prevalence is measured only against
 * substantive clauses so headings and tiny fragments cannot dilute the score.
 * Maximum severity and repeated findings have deliberately capped influence.
 */
export function calculateOverallRiskScore(
  clauseCount: number,
  findings: ScoredFinding[],
  thresholds: Record<string, number> = {},
): number {
  if (!clauseCount) return 0
  const risky = findings.filter((finding) => finding.predictedLabel === 'risky')
  if (!risky.length) return 0

  const severities = risky.map((finding) => clauseSeverity(finding, thresholds))
  const averageSeverity = severities.reduce((sum, severity) => sum + severity, 0) / severities.length
  const maximumSeverity = Math.max(...severities)
  const substantiveClauseCount = Math.max(findings.filter(isSubstantiveClause).length, risky.length)
  const flaggedCoverage = clamp(risky.length / substantiveClauseCount)
  const findingCountFactor = 1 - Math.exp(-risky.length / 3)

  return Math.round(100 * (
    0.5 * averageSeverity +
    0.15 * maximumSeverity +
    0.25 * flaggedCoverage +
    0.1 * findingCountFactor
  ))
}
