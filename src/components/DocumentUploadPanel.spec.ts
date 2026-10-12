import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DocumentUploadPanel from './DocumentUploadPanel.vue'

describe('DocumentUploadPanel', () => {
  afterEach(() => vi.restoreAllMocks())
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

  it('fetches a policy URL and emits the extracted document', async () => {
    const content = 'A readable policy clause. '.repeat(10)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      name: 'Example privacy policy',
      content,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const wrapper = mount(DocumentUploadPanel)

    await wrapper.get('button:nth-of-type(3)').trigger('click')
    await wrapper.get('input[type="url"]').setValue('https://example.com/privacy')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/fetch-policy', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/privacy' }),
    }))
    expect(wrapper.emitted('submit')).toEqual([[{ name: 'Example privacy policy', content }]])
  })

  it('shows a safe error when fetching fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: 'The policy website denied access to this page.',
    }), { status: 403, headers: { 'Content-Type': 'application/json' } }))
    const wrapper = mount(DocumentUploadPanel)

    await wrapper.get('button:nth-of-type(3)').trigger('click')
    await wrapper.get('input[type="url"]').setValue('https://example.com/policy')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('denied access')
    expect(wrapper.get('[role="alert"]').text()).toContain('pasting the text directly')
  })
})
