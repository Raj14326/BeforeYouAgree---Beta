// Shared helpers for building fixture RiskFindings whose start/end offsets
// are computed for real against a full documentText, rather than hand-typed
// — so highlighting in MockOriginalDocument.vue works on genuine substring
// matches, the same way lib/document-view.ts's buildDocumentViewHtml does
// for the real app.
import type { CategoryFinding, RiskFinding } from '@/types'

export type FindingSpec = { text: string; categories: CategoryFinding[] }

function findingDefaults(spec: FindingSpec): Omit<RiskFinding, 'start' | 'end' | 'occurrenceStarts'> {
  return {
    text: spec.text,
    occurrenceCount: 1,
    predictedLabel: 'risky',
    riskLevel: 'medium',
    riskLevelMessage: 'Flagged by the model as worth reviewing.',
    reviewCategories: spec.categories.map((category) => category.id),
    categories: spec.categories,
  }
}

/** Locate each finding's text verbatim inside documentText and fill in real start/end offsets. */
export function withOffsets(documentText: string, specs: FindingSpec[]): RiskFinding[] {
  return specs.map((spec) => {
    const start = documentText.indexOf(spec.text)
    if (start === -1) {
      throw new Error(`Fixture finding text not found in its documentText: "${spec.text}"`)
    }
    const end = start + spec.text.length
    return { ...findingDefaults(spec), start, end, occurrenceStarts: [start] }
  })
}
