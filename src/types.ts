/**
 * Shapes of the JSON payloads served by `server/index.ts`, shared by
 * `App.vue` and its child components.
 */

export type Term = {
  sourceUrl: string | null
  available: boolean
  latestUrl: string | null
  updatedAt: string | null
  historyAvailable: boolean
  historyUrl: string | null
}
export type Declaration = { name: string; terms: Record<string, Term> }
export type Service = { name: string; path: string }
export type VersionOption = { id: string; updatedAt: string | null; label: string; url: string }
export type Retrieval = {
  format: 'plain_text'
  id: string
  serviceId: string
  termType: string
  sourceUrl: string | null
  fetchDate: string | null
  characterCount: number
  content: string
  repository: string
  repositoryUrl: string
}
export type CategoryFinding = { id: string; name: string; score: number }
export type RiskLevel = 'low' | 'medium' | 'high'
export type RiskFinding = {
  text: string
  start: number
  end: number
  occurrenceCount: number
  occurrenceStarts: number[]
  categories: CategoryFinding[]
  predictedLabel: 'risky' | 'not_risky'
  riskLevel: RiskLevel
  riskLevelMessage: string
  reviewCategories: string[]
}
export type Analysis = {
  model: string
  clauseCount: number
  riskyClauseCount: number
  findings: RiskFinding[]
}

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  high: 'High risk',
  medium: 'Medium risk',
  low: 'Low risk',
}
