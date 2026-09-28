// Document-level risk score + flagged-clause progress bar, extracted from
// ClausesPanel.vue so other views (e.g. a future side-by-side comparison)
// can compute the same score for an Analysis without going through that
// component.
import { personalisedRiskScore } from '@/lib/personalised-risk-score'
import type { Analysis } from '@/types'

export type DocumentRiskScore = {
  score: number
  flaggedShare: number
  severityClass: 'bg-danger' | 'bg-warning' | 'bg-success'
}

const EMPTY_SCORE: DocumentRiskScore = { score: 0, flaggedShare: 0, severityClass: 'bg-success' }

/** Bootstrap colour for the progress bar: red ≥ 25% flagged, amber ≥ 10%, else green. */
function severityClassFor(flaggedShare: number): DocumentRiskScore['severityClass'] {
  if (flaggedShare >= 25) return 'bg-danger'
  if (flaggedShare >= 10) return 'bg-warning'
  return 'bg-success'
}

/**
 * Document-level risk score: blends average personalised severity across
 * risky clauses with how much of the document was flagged, so a handful of
 * severe clauses in an otherwise clean document don't read as high-risk.
 */
export function documentRiskScore(
  analysis: Analysis | null | undefined,
  categoryPriority: string[],
  enabledCategoryIds: Set<string>,
  riskPreferencesEnabled: boolean,
): DocumentRiskScore {
  if (!analysis?.clauseCount) return EMPTY_SCORE

  const flaggedShare = Math.round((analysis.riskyClauseCount / analysis.clauseCount) * 100)
  const riskyFindings = analysis.findings.filter((finding) => finding.predictedLabel === 'risky')
  if (!riskyFindings.length) return { score: 0, flaggedShare, severityClass: severityClassFor(flaggedShare) }

  const total = riskyFindings.reduce(
    (sum, finding) =>
      sum +
      personalisedRiskScore(finding.categories, categoryPriority, enabledCategoryIds, riskPreferencesEnabled)
        .score,
    0,
  )
  const avgSeverity = total / riskyFindings.length
  const score = Math.round(0.7 * avgSeverity + 0.3 * flaggedShare)

  return { score, flaggedShare, severityClass: severityClassFor(flaggedShare) }
}
