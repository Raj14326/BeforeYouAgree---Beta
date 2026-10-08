/**
 * Fetch+parse bodies extracted from AppView.vue's retrieveTerm/analyseTerm
 * so a caller can get a Retrieval/Analysis back as a plain return value
 * instead of having it assigned into AppView.vue's live `retrievals`/
 * `analyses` maps. Needed so "add this archived version to compare" can
 * fetch+analyse a document without disturbing whatever's currently active
 * on the page. retrieveTerm/analyseTerm keep their existing signatures and
 * side effects — they just call these internally now.
 */
import { apiUrl } from '@/lib/api'
import type { Analysis, Retrieval } from '@/types'

export async function fetchRetrieval(url: string): Promise<Retrieval> {
  const response = await fetch(apiUrl(url))
  const payload = (await response.json()) as Retrieval | { error: string }
  if (!response.ok) throw new Error('error' in payload ? payload.error : 'Retrieval failed')
  return payload as Retrieval
}

export async function fetchAnalysis(
  content: string,
  contexts: Array<{ start: number; end: number; text: string }> | undefined,
  serviceName: string | undefined,
  termType: string,
): Promise<Analysis> {
  const response = await fetch(apiUrl('/api/analyze'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, contexts, serviceName, documentType: termType }),
  })
  const payload = (await response.json()) as Analysis | { error?: string }
  if (!response.ok) throw new Error('error' in payload && payload.error ? payload.error : 'Analysis failed.')
  return payload as Analysis
}
