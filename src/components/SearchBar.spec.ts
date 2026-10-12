import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SearchBar from './SearchBar.vue'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

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

  it('selects an exact featured service case-insensitively without waiting for suggestions', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: 'au:optus', name: 'Optus', source: 'australian' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(SearchBar, {
      props: {
        services: [],
        isCatalogueLoading: false,
        isServiceLoading: false,
        catalogueIsFallback: false,
      },
    })

    await wrapper.get('input').setValue('oPtUs')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ name: 'Optus', path: 'au:optus' })
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('search='), expect.any(Object))
  })
})
