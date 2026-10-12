import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RiskPreferencePanel from './RiskPreferencePanel.vue'
import { ALL_CATEGORY_IDS } from '@/lib/risk-categories'

function mountPanel() {
  return mount(RiskPreferencePanel, {
    attachTo: document.body,
    props: {
      enabledCategoryIds: new Set(ALL_CATEGORY_IDS),
      categoryPriority: [...ALL_CATEGORY_IDS],
      riskPreferencesEnabled: true,
    },
  })
}

describe('RiskPreferencePanel information popover', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('opens category information after hovering for half a second', async () => {
    const wrapper = mountPanel()
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
    const wrapper = mountPanel()
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
    const wrapper = mountPanel()
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

  it('turns preferences off without changing individual toggles or order', async () => {
    const enabled = new Set(ALL_CATEGORY_IDS.filter((id) => id !== 'unilateral_change'))
    const priority = [...ALL_CATEGORY_IDS].reverse()
    const wrapper = mount(RiskPreferencePanel, {
      props: {
        enabledCategoryIds: enabled,
        categoryPriority: priority,
        riskPreferencesEnabled: true,
      },
    })

    await wrapper.get('[aria-label="Enable risk preferences"]').setValue(false)
    await wrapper.setProps({ riskPreferencesEnabled: false })

    expect(wrapper.emitted('update:riskPreferencesEnabled')).toEqual([[false]])
    expect(wrapper.emitted('update:enabledCategoryIds')).toBeUndefined()
    expect(wrapper.emitted('update:categoryPriority')).toBeUndefined()
    expect(wrapper.get<HTMLInputElement>('#pref-unilateral_change').element.checked).toBe(false)
  })

  it('turns every category back on when preferences are turned on', async () => {
    const wrapper = mount(RiskPreferencePanel, {
      props: {
        enabledCategoryIds: new Set(ALL_CATEGORY_IDS.filter((id) => id !== 'unilateral_change')),
        categoryPriority: [...ALL_CATEGORY_IDS],
        riskPreferencesEnabled: false,
      },
    })

    await wrapper.get('[aria-label="Enable risk preferences"]').setValue(true)
    await wrapper.setProps({ riskPreferencesEnabled: true })

    expect(wrapper.get<HTMLInputElement>('#pref-unilateral_change').element.checked).toBe(true)
    const emitted = wrapper.emitted<[Set<string>]>('update:enabledCategoryIds')
    expect([...(emitted?.at(-1)?.[0] ?? [])].sort()).toEqual([...ALL_CATEGORY_IDS].sort())
  })
})
