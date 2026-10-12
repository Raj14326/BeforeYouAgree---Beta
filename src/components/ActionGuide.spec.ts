import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import ActionGuide from './ActionGuide.vue'
import type { Analysis, RiskFinding } from '@/types'

function finding(categoryIds: string[], predictedLabel: RiskFinding['predictedLabel'] = 'risky'): RiskFinding {
  return {
    text: categoryIds.join(' '),
    start: 0,
    end: 0,
    occurrenceCount: 1,
    occurrenceStarts: [],
    categories: categoryIds.map((id) => ({ id, name: id, score: 0.9 })),
    predictedLabel,
    riskLevel: 'high',
    riskLevelMessage: '',
    reviewCategories: [],
  }
}

function analysisOf(findings: RiskFinding[]): Analysis {
  return { model: 'm', clauseCount: findings.length, riskyClauseCount: findings.length, findings }
}

function mountGuide(findings: RiskFinding[]) {
  return mount(ActionGuide, {
    attachTo: document.body,
    props: { analysis: analysisOf(findings), serviceName: 'Acme' },
  })
}

describe('ActionGuide', () => {
  beforeAll(() => {
    // jsdom has no showModal/close; open/close just toggle the attribute.
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('is hidden when no flagged clause has a category', () => {
    const wrapper = mountGuide([finding(['arbitration'], 'not_risky'), finding([])])
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('shows one tab per flagged category, privacy combined, most-flagged first', async () => {
    const wrapper = mountGuide([
      finding(['arbitration']),
      finding(['privacy_location_tracking', 'privacy_third_party_sharing']),
      finding(['privacy_broad_collection']),
      finding(['jurisdiction'], 'not_risky'),
    ])
    await wrapper.get('button').trigger('click')

    const tabs = [...document.body.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent?.trim())
    expect(tabs).toEqual(['Privacy 2', 'Arbitration 1'])
    expect(document.body.querySelector('[role="tabpanel"]')?.textContent).toContain('lodge a free privacy complaint')
    wrapper.unmount()
  })

  it('switches the guidance when another tab is chosen', async () => {
    const wrapper = mountGuide([finding(['arbitration']), finding(['arbitration']), finding(['choice_of_law'])])
    await wrapper.get('button').trigger('click')

    const choiceOfLaw = document.body.querySelector<HTMLButtonElement>('#action-guide-tab-choice_of_law')!
    choiceOfLaw.click()
    await wrapper.vm.$nextTick()

    expect(choiceOfLaw.getAttribute('aria-selected')).toBe('true')
    expect(document.body.querySelector('[role="tabpanel"]')?.textContent).toContain('foreign law')
    wrapper.unmount()
  })
})
