// Module-singleton "compare list" for the prototype only — a simplified
// stand-in for the real future useCompareList composable described in
// .claude/plans/glittery-strolling-moore.md. Lets "Add to compare" on the
// search flow and the /prototype/compare screen share one reactive list, so
// the demo reads as one connected system instead of two static mocks.
import { computed, ref } from 'vue'
import type { Analysis } from '@/types'

export type MockCompareEntry = {
  id: string
  serviceName: string
  documentLabel: string
  documentText: string
  analysis: Analysis
}

// Starts empty (not pre-seeded) so "Add to compare" in the search flow is a
// real, visible step in the demo — the point being demonstrated is that
// action itself, not a pre-populated Compare screen.
const entries = ref<MockCompareEntry[]>([])

export function useMockCompareList() {
  function add(entry: MockCompareEntry) {
    if (entries.value.some((existing) => existing.id === entry.id)) return
    entries.value = [...entries.value, entry]
  }

  function remove(id: string) {
    entries.value = entries.value.filter((entry) => entry.id !== id)
  }

  function isAdded(id: string) {
    return entries.value.some((entry) => entry.id === id)
  }

  return {
    entries: computed(() => entries.value),
    add,
    remove,
    isAdded,
  }
}
