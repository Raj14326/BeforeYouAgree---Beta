import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ClausesPanel from './ClausesPanel.vue'
import type { Analysis, RiskFinding } from '@/types'

function finding(text: string, categoryId: string, score: number): RiskFinding {
  return {
    text,
    start: 0,
    end: text.length,
    occurrenceCount: 1,
    occurrenceStarts: [0],
    categories: [{ id: categoryId, name: categoryId, score }],
    predictedLabel: 'risky',
    riskLevel: 'medium',
    riskLevelMessage: 'Model-detected risk',
    reviewCategories: [],
  }
}

const analysis: Analysis = {
  model: 'test',
  clauseCount: 2,
  riskyClauseCount: 2,
  findings: [
    finding('Priority category but lower score', 'unilateral_change', 0.5),
    finding('Lower priority category but higher score', 'arbitration', 0.9),
  ],
}

describe('ClausesPanel ordering', () => {
  it('uses descending risk score while preferences are off and priority order when on', async () => {
    const wrapper = mount(ClausesPanel, {
      props: {
        analysis,
        filter: 'risky',
        enabledCategoryIds: new Set(['unilateral_change', 'arbitration']),
        categoryPriority: ['unilateral_change', 'arbitration'],
        riskPreferencesEnabled: false,
      },
    })

    const clauseTexts = () => wrapper.findAll('.clause-card-text').map((node) => node.text())
    expect(clauseTexts()).toEqual([
      'Lower priority category but higher score',
      'Priority category but lower score',
    ])

    await wrapper.setProps({ riskPreferencesEnabled: true })
    expect(clauseTexts()).toEqual([
      'Priority category but lower score',
      'Lower priority category but higher score',
    ])
  })
})

describe('ClausesPanel scorecard category focus', () => {
  it('shows only the clicked category and clears back to the full list', async () => {
    const wrapper = mount(ClausesPanel, {
      props: {
        analysis,
        filter: 'risky',
        enabledCategoryIds: new Set(['unilateral_change', 'arbitration']),
        categoryPriority: ['unilateral_change', 'arbitration'],
        riskPreferencesEnabled: false,
      },
    })
    const clauseTexts = () => wrapper.findAll('.clause-card-text').map((node) => node.text())

    const arbitrationRow = wrapper.get('[aria-label="Show only Arbitration clauses"]')
    await arbitrationRow.trigger('click')
    expect(clauseTexts()).toEqual(['Lower priority category but higher score'])
    expect(arbitrationRow.attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('#clause-filter').exists()).toBe(false)

    await wrapper.get('[aria-label="Clear Arbitration filter"]').trigger('click')
    expect(clauseTexts()).toHaveLength(2)
    expect(wrapper.find('#clause-filter').exists()).toBe(true)

    // Clicking the focused row again also clears it.
    await arbitrationRow.trigger('click')
    await arbitrationRow.trigger('click')
    expect(clauseTexts()).toHaveLength(2)
  })
})
