// Deterministic colour per risk category, so a given category's dot reads
// the same everywhere it appears (clause cards, the preference sidebar).
// Not tied to risk level (that's red/amber/green elsewhere) — this is purely
// a "which of the ~18 categories is this" identifier.
const PALETTE = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#64748b', // slate
]

/** Hash a category id to a stable index into {@link PALETTE}. */
export function categoryColor(id: string): string {
  let hash = 0
  for (let index = 0; index < id.length; index++) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]!
}
