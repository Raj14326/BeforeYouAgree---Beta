import type { CategoryFinding, RiskLevel } from '@/types'

export type PersonalisedRiskScore = {
  score: number
  detectionScore: number
  preferenceScore: number
  categoryBonus: number
  primaryCategoryId: string | null
  primaryCategoryName: string | null
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

/** Map a personalised score to the level displayed in the clause card. */
export function personalisedRiskLevel(score: number): RiskLevel {
  if (score >= 75) return 'high'
  if (score >= 45) return 'medium'
  return 'low'
}

/**
 * Combine model/rule strength with the user's preference order.
 *
 * This is a relevance score, not a probability of legal harm:
 * - detection strength contributes up to 70 points;
 * - the highest-ranked matching preference contributes up to 20 points;
 * - additional matching categories contribute up to 10 points.
 */
export function personalisedRiskScore(
  categories: CategoryFinding[],
  categoryPriority: string[],
  enabledCategoryIds: Set<string>,
): PersonalisedRiskScore {
  const enabledMatches = categories.filter((category) => enabledCategoryIds.has(category.id))
  if (!enabledMatches.length) {
    return {
      score: 0,
      detectionScore: 0,
      preferenceScore: 0,
      categoryBonus: 0,
      primaryCategoryId: null,
      primaryCategoryName: null,
    }
  }

  const rank = new Map(categoryPriority.map((id, index) => [id, index]))
  const rankedMatches = [...enabledMatches].sort(
    (a, b) =>
      (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  )
  const primaryCategory = rankedMatches[0]!
  const primaryRank = rank.get(primaryCategory.id)
  const lastRank = Math.max(categoryPriority.length - 1, 1)

  const strongestDetection = Math.max(...enabledMatches.map((category) => clamp(category.score, 0, 1)))
  const detectionScore = Math.round(strongestDetection * 70)
  const preferenceScore =
    primaryRank === undefined ? 0 : Math.round(20 * (1 - primaryRank / lastRank))
  const categoryBonus = Math.min(Math.max(enabledMatches.length - 1, 0) * 5, 10)

  return {
    score: clamp(detectionScore + preferenceScore + categoryBonus, 0, 100),
    detectionScore,
    preferenceScore,
    categoryBonus,
    primaryCategoryId: primaryCategory.id,
    primaryCategoryName: primaryCategory.name,
  }
}
