import { ref, watch, type Ref } from 'vue'
import type { CompareEntry } from '@/composables/useCompareList'
import { apiUrl } from '@/lib/api'
import type { ComparisonSummary } from '@/types'

export type CompareSummaryStatus = 'idle' | 'loading' | 'ready' | 'error'

export function useCompareSummary(entries: Ref<CompareEntry[]>) {
  const status = ref<CompareSummaryStatus>('idle')
  const summary = ref<ComparisonSummary | null>(null)
  const error = ref('')
  let controller: AbortController | undefined

  watch(() => entries.value.map(({ id }) => id).join('|'), () => {
    controller?.abort()
    status.value = 'idle'
    summary.value = null
    error.value = ''
  })

  async function generate() {
    if (entries.value.length < 2 || entries.value.length > 4) return
    controller?.abort()
    controller = new AbortController()
    status.value = 'loading'
    summary.value = null
    error.value = ''
    try {
      const response = await fetch(apiUrl('/api/compare-summary'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          documents: entries.value.map((entry) => ({
            id: entry.id,
            name: `${entry.serviceName} — ${entry.displayName}`,
            documentType: entry.documentType,
            content: entry.content,
            contexts: entry.contexts,
            findings: entry.analysis.findings.map((finding) => ({
              start: finding.start,
              end: finding.end,
              predictedLabel: finding.predictedLabel,
              categories: finding.categories,
              categoryScores: finding.categoryScores,
            })),
          })),
        }),
      })
      const payload = await response.json() as ComparisonSummary | { error?: string }
      if (!response.ok) throw new Error('error' in payload && payload.error ? payload.error : 'AI comparison failed.')
      summary.value = payload as ComparisonSummary
      status.value = 'ready'
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      error.value = cause instanceof Error ? cause.message : 'AI comparison failed.'
      status.value = 'error'
    }
  }

  return { status, summary, error, generate }
}
