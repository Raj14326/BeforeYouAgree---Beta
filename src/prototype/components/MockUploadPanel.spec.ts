import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MockUploadPanel from './MockUploadPanel.vue'
import { vuetify } from '@/prototype/plugins/vuetify'

function mountPanel() {
  return mount(MockUploadPanel, { global: { plugins: [vuetify] } })
}

async function analyze(wrapper: ReturnType<typeof mountPanel>, text: string) {
  await wrapper.get('textarea').setValue(text)
  const analyzeButton = wrapper.findAll('button').find((button) => button.text().includes('Analyze (preview)'))
  expect(analyzeButton).toBeTruthy()
  await analyzeButton!.trigger('click')
}

describe('MockUploadPanel mock analysis states', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    )
    // jsdom has no ResizeObserver; Vuetify's VTabs (via VSlideGroup) needs one.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows the designed error state for short pasted text', async () => {
    const wrapper = mountPanel()
    await analyze(wrapper, 'too short')

    await vi.advanceTimersByTimeAsync(900)

    expect(wrapper.text()).toContain("This doesn't look like an agreement")
    expect(wrapper.find('[aria-live="polite"]').text()).toContain("Couldn't analyze this text")
  })

  it('shows a result with the nutrition card, clauses, and original document for long pasted text', async () => {
    const wrapper = mountPanel()
    await analyze(wrapper, 'x'.repeat(200))

    await vi.advanceTimersByTimeAsync(1400)

    expect(wrapper.text()).toContain('document risk score')
    expect(wrapper.text()).toContain('Flagged clauses')
    expect(wrapper.text()).toContain('Show full document text')
    expect(wrapper.find('[aria-live="polite"]').text()).toContain('Analysis complete')
  })
})
