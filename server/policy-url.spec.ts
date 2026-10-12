// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { fetchPolicyUrl } from './policy-url.ts'
import { htmlToStructuredText } from './html-to-plain-text.ts'

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

  it('drops executable HTML while treating SQL-looking content as ordinary text', () => {
    const result = htmlToStructuredText(`
      <script>globalThis.compromised = true</script>
      <nav onclick="globalThis.compromised = true">Navigation</nav>
      <h1 onmouseover="globalThis.compromised = true">Privacy Policy</h1>
      <p><img src=x onerror="globalThis.compromised = true">We collect account details.</p>
      <p>'; DROP TABLE users; --</p>
    `)

    expect(result.content).not.toContain('globalThis.compromised')
    expect(result.content).not.toContain('Navigation')
    expect(result.content).toContain('Privacy Policy')
    expect(result.content).toContain("'; DROP TABLE users; --")
  })
})
