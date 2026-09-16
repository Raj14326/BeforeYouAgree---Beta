import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ClauseCard from './ClauseCard.vue'
import type { RiskFinding } from '@/types'

const finding: RiskFinding = {
  text: 'We may change these terms at any time.',
  start: 0,
  end: 38,
  occurrenceCount: 1,
  occurrenceStarts: [0],
  categories: [{ id: 'unilateral_change', name: 'Unilateral change', score: 0.8 }],
  predictedLabel: 'risky',
  riskLevel: 'high',
  riskLevelMessage: 'High model-detected risk',
  reviewCategories: [],
}

describe('ClauseCard personalised score', () => {
  it('shows a preference-adjusted score with an accessible explanation', () => {
    const wrapper = mount(ClauseCard, {
      props: {
        finding,
        categoryPriority: ['unilateral_change', 'arbitration', 'content_removal'],
        enabledCategoryIds: new Set(['unilateral_change', 'arbitration', 'content_removal']),
        riskPreferencesEnabled: true,
      },
    })

    const score = wrapper.get('[aria-label^="Personalised risk score"]')
    expect(score.text()).toContain('76')
    expect(score.text()).toContain('Personalised risk')
    expect(score.attributes('aria-label')).toContain('Unilateral change')
    expect(wrapper.get('.badge').text()).toBe('High personalised risk')
    expect(wrapper.text()).not.toContain('High risk')
  })

  it('derives the displayed level from preference order instead of the backend level', () => {
    const wrapper = mount(ClauseCard, {
      props: {
        finding: {
          ...finding,
          // The backend calls this high, but its personalised score is 56 when ranked last.
          riskLevel: 'high',
          categories: [{ id: 'content_removal', name: 'Content removal', score: 0.8 }],
        },
        categoryPriority: ['unilateral_change', 'arbitration', 'content_removal'],
        enabledCategoryIds: new Set(['unilateral_change', 'arbitration', 'content_removal']),
        riskPreferencesEnabled: true,
      },
    })

    expect(wrapper.get('.badge').text()).toBe('Medium personalised risk')
    expect(wrapper.get('[aria-label^="Personalised risk score"]').text()).toContain('56')
  })

  it('removes the preference bonus when risk preferences are off', () => {
    const wrapper = mount(ClauseCard, {
      props: {
        finding,
        categoryPriority: ['unilateral_change', 'arbitration', 'content_removal'],
        enabledCategoryIds: new Set<string>(),
        riskPreferencesEnabled: false,
      },
    })

    expect(wrapper.get('[aria-label^="Risk score"]').text()).toContain('56')
    expect(wrapper.get('.badge').text()).toBe('Medium risk')
  })
})
