import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DocumentUploadPanel from './DocumentUploadPanel.vue'

describe('DocumentUploadPanel', () => {
  it('disables submit until at least 120 characters are pasted, then emits on submit', async () => {
    const wrapper = mount(DocumentUploadPanel)
    const submitButton = wrapper.get('button[type="submit"]')
    const textarea = wrapper.get('textarea')

    expect((submitButton.element as HTMLButtonElement).disabled).toBe(true)

    await textarea.setValue('short')
    expect((submitButton.element as HTMLButtonElement).disabled).toBe(true)

    const longText = 'A '.repeat(65) // 130 characters
    await textarea.setValue(longText)
    expect((submitButton.element as HTMLButtonElement).disabled).toBe(false)

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toEqual([[{ name: 'Your document', content: longText.trim() }]])
  })

  it('switches to file mode and disables submit until a file is chosen', async () => {
    const wrapper = mount(DocumentUploadPanel)
    await wrapper.get('button:nth-of-type(2)').trigger('click')

    const submitButton = wrapper.get('button[type="submit"]')
    expect((submitButton.element as HTMLButtonElement).disabled).toBe(true)
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('input[type="file"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('maximum 10 MB')
  })
})
