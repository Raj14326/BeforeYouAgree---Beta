// Aggregates an Analysis's per-clause category tags into the Privacy
// Nutrition Card's scorecard rows: each individual TOS category, plus a
// single combined "Privacy" row rather than all 11 privacy sub-categories,
// so the table stays a manageable, consistent size for every document.
import { PRIVACY_CATEGORIES, PRIVACY_GROUP, TOS_CATEGORIES, type CategoryDef } from '@/lib/risk-categories'
import type { Analysis } from '@/types'

export type CategoryPresence = {
  id: string
  name: string
  description: string
  detected: boolean
  /** Highest CategoryFinding.score (0-1) seen across the ids this row covers; 0 if absent. */
  maxScore: number
  /** Number of findings that carry one of the ids this row covers. */
  occurrences: number
}

export function aggregateScorecardRows(analysis: Analysis | null | undefined): CategoryPresence[] {
  const stats = new Map<string, { maxScore: number; occurrences: number }>()
  for (const finding of analysis?.findings ?? []) {
    for (const category of finding.categories) {
      const entry = stats.get(category.id) ?? { maxScore: 0, occurrences: 0 }
      entry.maxScore = Math.max(entry.maxScore, category.score)
      entry.occurrences += 1
      stats.set(category.id, entry)
    }
  }

  function rowFor(def: CategoryDef, ids: string[]): CategoryPresence {
    let maxScore = 0
    let occurrences = 0
    for (const id of ids) {
      const entry = stats.get(id)
      if (!entry) continue
      maxScore = Math.max(maxScore, entry.maxScore)
      occurrences += entry.occurrences
    }
    return { id: def.id, name: def.name, description: def.description, detected: occurrences > 0, maxScore, occurrences }
  }

  return [
    ...TOS_CATEGORIES.map((def) => rowFor(def, [def.id])),
    rowFor(
      PRIVACY_GROUP,
      PRIVACY_CATEGORIES.map((category) => category.id),
    ),
  ]
}
