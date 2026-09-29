import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import VuetifyNutritionCard from './VuetifyNutritionCard.vue'
import { vuetify } from '@/prototype/plugins/vuetify'
import { findCatalogueDocument } from '@/prototype/fixtures/document-catalogue'

// Service 1's ToS fixture has 6 detected categories (out of 9 scorecard
// rows) — more than the top-3 default, so it exercises the expand toggle.
const analysis = findCatalogueDocument('service-1-terms')!.analysis

function mountCard() {
  return mount(VuetifyNutritionCard, {
    global: { plugins: [vuetify] },
    props: { analysis },
  })
}

describe('VuetifyNutritionCard progressive disclosure', () => {
  it('shows only the top 3 detected categories by default', () => {
    const wrapper = mountCard()
    expect(wrapper.findAll('.v-list-item').length).toBe(3)
  })

  it('shows every category after clicking "Show all"', async () => {
    const wrapper = mountCard()
    const showAllButton = wrapper.findAll('button').find((button) => button.text().includes('Show all'))
    expect(showAllButton).toBeTruthy()

    await showAllButton!.trigger('click')

    // 8 TOS categories + 1 combined "Privacy" row.
    expect(wrapper.findAll('.v-list-item').length).toBe(9)
  })
})
