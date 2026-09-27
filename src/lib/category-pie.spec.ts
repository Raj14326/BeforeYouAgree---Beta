import { describe, expect, it } from 'vitest'
import { buildCategoryPieSlices, PIE_CIRCUMFERENCE } from './category-pie'
import type { CategoryPresence } from './category-aggregation'

function row(id: string, occurrences: number): CategoryPresence {
  return { id, name: id, description: '', detected: occurrences > 0, maxScore: 0, occurrences }
}

describe('buildCategoryPieSlices', () => {
  it('returns nothing when no category was detected', () => {
    expect(buildCategoryPieSlices([row('a', 0), row('b', 0)])).toEqual([])
  })

  it('omits zero-occurrence rows and splits the ring by share of total occurrences', () => {
    const slices = buildCategoryPieSlices([row('a', 3), row('b', 0), row('c', 1)])
    expect(slices.map((slice) => slice.id)).toEqual(['a', 'c'])
    expect(slices[0]!.percentage).toBe(75)
    expect(slices[1]!.percentage).toBe(25)
  })

  it('a single detected category fills the whole ring (minus no gap, since there is nothing to separate)', () => {
    const [slice] = buildCategoryPieSlices([row('a', 5)])
    expect(slice!.percentage).toBe(100)
    const [length] = slice!.dasharray.split(' ').map(Number)
    expect(length).toBeCloseTo(PIE_CIRCUMFERENCE, 5)
    expect(slice!.dashoffset).toBeCloseTo(0, 5)
  })

  it('leaves a small gap between segments and keeps dasharray lengths summing to the circumference', () => {
    const slices = buildCategoryPieSlices([row('a', 1), row('b', 1), row('c', 1)])
    for (const slice of slices) {
      const [length, remainder] = slice.dasharray.split(' ').map(Number)
      expect(length! + remainder!).toBeCloseTo(PIE_CIRCUMFERENCE, 5)
    }
    // Each later slice's offset accounts for the prior slices' lengths plus a gap.
    expect(slices[1]!.dashoffset).toBeLessThan(slices[0]!.dashoffset)
    expect(slices[2]!.dashoffset).toBeLessThan(slices[1]!.dashoffset)
  })
})
