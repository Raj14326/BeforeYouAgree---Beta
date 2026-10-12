// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { fetchPolicyUrl } from './policy-url.ts'

describe('policy URL fetching', () => {
  it('rejects local addresses before making a request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    await expect(fetchPolicyUrl('http://127.0.0.1/policy')).rejects.toMatchObject({
      code: 'SSRF_BLOCKED',
    })
    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockRestore()
  })

  it('rejects unsupported URL schemes', async () => {
    await expect(fetchPolicyUrl('file:///etc/passwd')).rejects.toThrow('public HTTP or HTTPS')
  })
})
