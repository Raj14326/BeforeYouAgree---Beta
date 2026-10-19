// Document-level risk score + flagged-clause progress bar, extracted from
// ClausesPanel.vue so other views (e.g. a future side-by-side comparison)
// can compute the same score for an Analysis without going through that
// component.
import type { Analysis } from '@/types'

export type DocumentRiskScore = {
  score: number
  flaggedShare: number
  flaggedClauseCount: number
  severityClass: 'bg-danger' | 'bg-warning' | 'bg-success'
}

const EMPTY_SCORE: DocumentRiskScore = { score: 0, flaggedShare: 0, flaggedClauseCount: 0, severityClass: 'bg-success' }

/** Bootstrap colour for the progress bar: red ≥ 25% flagged, amber ≥ 10%, else green. */
function severityClassFor(flaggedShare: number): DocumentRiskScore['severityClass'] {
  if (flaggedShare >= 25) return 'bg-danger'
  if (flaggedShare >= 10) return 'bg-warning'
  return 'bg-success'
}

/**
 * Document-level risk score: blends average personalised severity across
 * risky clauses with how much of the document was flagged. Flagged coverage
 * carries the larger weight so documents with different numbers of risky
 * clauses do not collapse to a similar score merely because their detected
 * categories have similar confidence.
 */
export function documentRiskScore(
  analysis: Analysis | null | undefined,
  categoryPriority: string[],
  enabledCategoryIds: Set<string>,
  riskPreferencesEnabled: boolean,
): DocumentRiskScore {
  if (!analysis?.clauseCount) return EMPTY_SCORE

  const riskyFindings = analysis.findings.filter((finding) => finding.predictedLabel === 'risky')
  if (!riskyFindings.length) return EMPTY_SCORE

  const flaggedClauseCount = analysis.riskyClauseCount
  const flaggedShare = Math.round((flaggedClauseCount / analysis.clauseCount) * 100)
  // The API is authoritative. The fallback only supports older saved analyses
  // and test fixtures created before overallRiskScore was added.
  const averageDetection = riskyFindings.reduce(
    (sum, finding) => sum + Math.max(0, ...finding.categories.map(({ score }) => score)),
    0,
  ) / riskyFindings.length * 100
  const baseScore = analysis.overallRiskScore ?? Math.round(0.4 * averageDetection + 0.6 * flaggedShare)

  if (!riskPreferencesEnabled) {
    return { score: baseScore, flaggedShare, flaggedClauseCount, severityClass: severityClassFor(flaggedShare) }
  }

  // Privacy is one top-level preference in the UI, even though its individual
  // rule categories are stored as separate IDs. Collapse them into one rank so
  // moving Privacy to the top emphasizes every privacy finding equally.
  const preferenceGroups = categoryPriority.filter(
    (id, index) => !id.startsWith('privacy_') || !categoryPriority.slice(0, index).some((earlier) => earlier.startsWith('privacy_')),
  )
  const groupId = (id: string) => id.startsWith('privacy_') ? 'privacy' : id
  const groupedPriority = preferenceGroups.map(groupId)
  const lastRank = Math.max(groupedPriority.length - 1, 1)
  const preferenceMatch = riskyFindings.reduce((sum, finding) => {
    const weights = finding.categories
      .filter(({ id }) => enabledCategoryIds.has(id))
      .map(({ id, score }) => {
        const rank = groupedPriority.indexOf(groupId(id))
        return rank < 0 ? 0 : Math.max(0, Math.min(1, score)) * (1 - rank / lastRank)
      })
    return sum + Math.max(0, ...weights)
  }, 0) / riskyFindings.length

  // Preferences are an emphasis layered onto the backend result. They can
  // raise the score toward 100, but never hide or reduce underlying risk.
  const preferenceBoost = Math.round((100 - baseScore) * 0.35 * preferenceMatch)
  const score = Math.min(100, baseScore + preferenceBoost)

  return { score, flaggedShare, flaggedClauseCount, severityClass: severityClassFor(flaggedShare) }
}
