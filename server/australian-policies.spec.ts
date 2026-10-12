// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAustralianEntity, listAustralianEntities } from './australian-policies.ts'

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.AU_PRIVACY_SCORE_API_KEY
})

describe('Australian policy catalogue client', () => {
  it('searches the public catalogue and caps its documented page size', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { slug: 'commbank', name: 'CommBank', latest_grade: 'B' },
    ]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(listAustralianEntities('commonwealth bank', 100)).resolves.toHaveLength(1)
    const requestUrl = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(requestUrl.searchParams.get('q')).toBe('commonwealth bank')
    expect(requestUrl.searchParams.get('limit')).toBe('50')
  })

  it('keeps an optional API key on the server request', async () => {
    process.env.AU_PRIVACY_SCORE_API_KEY = 'server-secret'
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      slug: 'commbank', name: 'CommBank', privacy_policy_url: 'https://example.com/privacy',
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await getAustralianEntity('commbank')
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe('Bearer server-secret')
  })
})
