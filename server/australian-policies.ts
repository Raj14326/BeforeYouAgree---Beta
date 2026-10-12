const DEFAULT_API_URL = 'https://privacy.theucu.com/api/v1'

export type AustralianEntitySummary = {
  slug: string
  name: string
  category?: string
  latest_grade?: string
  logo_url?: string | null
}

export type AustralianEntity = AustralianEntitySummary & {
  privacy_policy_url?: string | null
  last_scan_date?: string | null
  last_changed_date?: string | null
  scan_id?: string | null
}

function apiUrl(path: string) {
  const base = (process.env.AU_PRIVACY_SCORE_API_URL || DEFAULT_API_URL).replace(/\/$/, '')
  return `${base}${path}`
}

function headers() {
  const result: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'BeforeYouAgree/1.0',
  }
  if (process.env.AU_PRIVACY_SCORE_API_KEY)
    result.Authorization = `Bearer ${process.env.AU_PRIVACY_SCORE_API_KEY}`
  return result
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(apiUrl(path), {
    headers: headers(),
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`Australian policy catalogue returned HTTP ${response.status}.`)
  return await response.json() as T
}

export function listAustralianEntities(query: string, limit: number) {
  const params = new URLSearchParams({ limit: String(Math.min(limit, 50)) })
  if (query) params.set('q', query)
  return getJson<AustralianEntitySummary[]>(`/entities?${params}`)
}

export function getAustralianEntity(slug: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/i.test(slug)) throw new Error('Invalid Australian service ID.')
  return getJson<AustralianEntity>(`/entities/${encodeURIComponent(slug)}`)
}
