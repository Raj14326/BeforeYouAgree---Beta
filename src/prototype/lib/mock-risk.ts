// Shared score computation for every /prototype screen that shows a
// document's risk — RiskScoreSummary.vue (used by both VuetifyNutritionCard
// and CompareScoreCard) and CategoryComparisonTable all key off this so a
// given document scores identically everywhere it appears.
import { documentRiskScore } from '@/lib/document-risk-score'
import { personalisedRiskLevel } from '@/lib/personalised-risk-score'
import { ALL_CATEGORY_IDS } from '@/lib/risk-categories'
import type { Analysis, RiskLevel } from '@/types'

const ALL_IDS_SET = new Set(ALL_CATEGORY_IDS)

export type MockRisk = {
  score: number
  flaggedShare: number
  severityClass: 'bg-danger' | 'bg-warning' | 'bg-success'
  level: RiskLevel
}

// No preference sidebar in these prototype screens — score every document
// the same way, against every category, so results are comparable across
// documents (important once several sit side by side in Compare).
export function computeMockRisk(analysis: Analysis): MockRisk {
  const risk = documentRiskScore(analysis, ALL_CATEGORY_IDS, ALL_IDS_SET, false)
  return { ...risk, level: personalisedRiskLevel(risk.score) }
}
