import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RiskPreferenceSidebar from './RiskPreferenceSidebar.vue'
import { ALL_CATEGORY_IDS } from '@/lib/risk-categories'

function mountSidebar() {
  return mount(RiskPreferenceSidebar, {
    attachTo: document.body,
    props: {
      enabledCategoryIds: new Set(ALL_CATEGORY_IDS),
      categoryPriority: [...ALL_CATEGORY_IDS],
      riskPreferencesEnabled: true,
    },
  })
}

describe('RiskPreferenceSidebar information popover', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    )
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('opens category information after hovering for half a second', async () => {
    const wrapper = mountSidebar()
    const trigger = wrapper.get('[aria-label="About Limitation of liability"]')

    await trigger.trigger('mouseenter')
    vi.advanceTimersByTime(499)
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()

    vi.advanceTimersByTime(1)
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toContain(
      'Won’t pay you back for problems it causes.',
    )

    wrapper.unmount()
  })

  it('cancels opening when the pointer leaves before one second', async () => {
    const wrapper = mountSidebar()
    const trigger = wrapper.get('[aria-label="About Limitation of liability"]')

    await trigger.trigger('mouseenter')
    vi.advanceTimersByTime(250)
    await trigger.trigger('mouseleave')
    vi.advanceTimersByTime(250)
    await wrapper.vm.$nextTick()

    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
    wrapper.unmount()
  })

  it('closes the information and has no close button when the pointer leaves', async () => {
    const wrapper = mountSidebar()
    const trigger = wrapper.get('[aria-label="About Limitation of liability"]')

    await trigger.trigger('mouseenter')
    vi.advanceTimersByTime(500)
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull()
    expect(document.body.querySelector('[role="tooltip"] button')).toBeNull()

    await trigger.trigger('mouseleave')
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
    wrapper.unmount()
  })

  it('turns preferences off and on without changing individual toggles or order', async () => {
    const enabled = new Set(ALL_CATEGORY_IDS.filter((id) => id !== 'unilateral_change'))
    const priority = [...ALL_CATEGORY_IDS].reverse()
    const wrapper = mount(RiskPreferenceSidebar, {
      props: {
        enabledCategoryIds: enabled,
        categoryPriority: priority,
        riskPreferencesEnabled: true,
      },
    })

    const master = wrapper.get('[aria-label="Enable risk preferences"]')
    await master.setValue(false)
    await wrapper.setProps({ riskPreferencesEnabled: false })
    await master.setValue(true)

    expect(wrapper.emitted('update:riskPreferencesEnabled')).toEqual([[false], [true]])
    expect(wrapper.emitted('update:enabledCategoryIds')).toBeUndefined()
    expect(wrapper.emitted('update:categoryPriority')).toBeUndefined()
    expect(wrapper.get<HTMLInputElement>('#pref-unilateral_change').element.checked).toBe(false)
  })
})
