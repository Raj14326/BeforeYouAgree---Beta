import { describe, expect, it } from 'vitest'
import { personalisedRiskLevel, personalisedRiskScore } from './personalised-risk-score'

const priorities = ['unilateral_change', 'arbitration', 'content_removal']

describe('personalised risk score', () => {
  it('weights detection strength at 70% and a first preference at 20%', () => {
    expect(
      personalisedRiskScore(
        [{ id: 'unilateral_change', name: 'Unilateral change', score: 0.8 }],
        priorities,
        new Set(priorities),
      ).score,
    ).toBe(76)
  })

  it('scores the same detection lower when its preference is ranked last', () => {
    expect(
      personalisedRiskScore(
        [{ id: 'content_removal', name: 'Content removal', score: 0.8 }],
        priorities,
        new Set(priorities),
      ).score,
    ).toBe(56)
  })

  it('adds five points per additional enabled category, capped at ten', () => {
    const result = personalisedRiskScore(
      [
        { id: 'unilateral_change', name: 'Unilateral change', score: 0.8 },
        { id: 'arbitration', name: 'Arbitration', score: 0.7 },
        { id: 'content_removal', name: 'Content removal', score: 0.6 },
        { id: 'another', name: 'Another category', score: 0.9 },
      ],
      [...priorities, 'another'],
      new Set([...priorities, 'another']),
    )

    expect(result.score).toBe(93)
    expect(result.categoryBonus).toBe(10)
  })

  it('ignores disabled category matches and returns zero with no enabled matches', () => {
    expect(
      personalisedRiskScore(
        [{ id: 'unilateral_change', name: 'Unilateral change', score: 1 }],
        priorities,
        new Set(['arbitration']),
      ),
    ).toMatchObject({ score: 0, primaryCategoryId: null })
  })

  it('maps the personalised score to low, medium and high display levels', () => {
    expect(personalisedRiskLevel(0)).toBe('low')
    expect(personalisedRiskLevel(44)).toBe('low')
    expect(personalisedRiskLevel(45)).toBe('medium')
    expect(personalisedRiskLevel(74)).toBe('medium')
    expect(personalisedRiskLevel(75)).toBe('high')
    expect(personalisedRiskLevel(100)).toBe('high')
  })
})
