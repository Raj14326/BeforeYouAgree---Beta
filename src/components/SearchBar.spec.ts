import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SearchBar from './SearchBar.vue'

describe('SearchBar autocomplete popup', () => {
  it('keeps the popup border outside the scrollable options list', async () => {
    const wrapper = mount(SearchBar, {
      props: {
        services: Array.from({ length: 12 }, (_, index) => ({
          name: `Service ${index + 1}`,
          path: String(index + 1),
        })),
        isCatalogueLoading: false,
        isServiceLoading: false,
        catalogueIsFallback: false,
      },
    })

    await wrapper.get('#service').trigger('focus')

    const popup = wrapper.get('.autocomplete-popup')
    expect(popup.get('.autocomplete-options').element.parentElement).toBe(popup.element)
  })
})
