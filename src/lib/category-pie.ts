// Geometry for the Privacy Nutrition Card's donut chart: turns scorecard
// rows into SVG stroke-dasharray/dashoffset pairs for a ring of <circle>
// segments. Colour is left to the caller (reuse categoryColor(id), same as
// the scorecard table's dots) — this module only computes layout.
import type { CategoryPresence } from '@/lib/category-aggregation'

/** Radius (SVG user units) the donut ring is drawn at; callers must use a matching viewBox. */
export const PIE_RADIUS = 48
export const PIE_CIRCUMFERENCE = 2 * Math.PI * PIE_RADIUS

/** Gap (SVG user units) left between adjacent segments — the design system's 2px surface-gap spacer. */
const SEGMENT_GAP = 2

export type PieSlice = {
  id: string
  name: string
  count: number
  /** Rounded share of total occurrences across all included rows, 0-100. */
  percentage: number
  dasharray: string
  dashoffset: number
}

/**
 * One slice per row with at least one occurrence (a zero-occurrence category
 * has nothing to draw), ordered as given, each proportional to its share of
 * total occurrences. Returns `[]` when nothing was detected.
 */
export function buildCategoryPieSlices(rows: CategoryPresence[]): PieSlice[] {
  const detected = rows.filter((row) => row.occurrences > 0)
  const total = detected.reduce((sum, row) => sum + row.occurrences, 0)
  if (!total) return []

  const gapTotal = detected.length > 1 ? detected.length * SEGMENT_GAP : 0
  const usableCircumference = PIE_CIRCUMFERENCE - gapTotal

  let cumulative = 0
  return detected.map((row) => {
    const length = (row.occurrences / total) * usableCircumference
    const dashoffset = -cumulative
    cumulative += length + SEGMENT_GAP
    return {
      id: row.id,
      name: row.name,
      count: row.occurrences,
      percentage: Math.round((row.occurrences / total) * 100),
      dasharray: `${length} ${PIE_CIRCUMFERENCE - length}`,
      dashoffset,
    }
  })
}
