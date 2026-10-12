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
export type DocumentContext = {
  start: number
  end: number
  text: string
  headingStart?: number
  headingEnd?: number
}
export type Retrieval = {
  format: 'plain_text'
  id: string
  serviceId: string
  termType: string
  sourceUrl: string | null
  fetchDate: string | null
  characterCount: number
  content: string
  contexts?: DocumentContext[]
  repository: string
  repositoryUrl: string
}
export type CategoryFinding = { id: string; name: string; score: number }
export type RiskLevel = 'low' | 'medium' | 'high'
export type RiskFinding = {
  text: string
  context?: string
  contextualText?: string
  start: number
  end: number
  occurrenceCount: number
  occurrenceStarts: number[]
  categories: CategoryFinding[]
  categoryScores?: Record<string, number>
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

export type ComparisonEvidence = {
  id: string
  documentId: string
  documentName: string
  categoryId: string
  categoryName: string
  source: 'flagged' | 'retrieved'
  text: string
  context?: string
  confidence?: number
  similarity?: number
}
export type ComparisonSummary = {
  winnerDocumentId: string | null
  winnerDocumentName: string
  overview: string
  comparisons: Array<{
    categoryId: string
    categoryName: string
    conclusion: 'both' | 'one_only' | 'different' | 'insufficient'
    betterDocumentId: string | null
    betterDocumentName: string
    summary: string
    evidenceIds: string[]
  }>
  caveat: string
  evidence: ComparisonEvidence[]
  model: string
}

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  high: 'High risk',
  medium: 'Medium risk',
  low: 'Low risk',
}
