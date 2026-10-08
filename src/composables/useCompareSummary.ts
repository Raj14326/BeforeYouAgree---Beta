/**
 * Placeholder for the LLM-generated risk/safety comparison summary shown as
 * a banner above the compare cards. No network call yet — this just fixes
 * the contract (`status`/`summary`) so the component and the real
 * implementation can be built independently. Swap the body of this function
 * for a real call once that's ready; ComparisonSummaryBanner.vue does not
 * need to change.
 */
import { ref, type Ref } from 'vue'
import type { CompareEntry } from '@/composables/useCompareList'

export type CompareSummaryStatus = 'idle' | 'loading' | 'ready' | 'error'

export function useCompareSummary(_entries: Ref<CompareEntry[]>) {
  const status = ref<CompareSummaryStatus>('idle')
  const summary = ref<string | null>(null)

  return { status, summary }
}
