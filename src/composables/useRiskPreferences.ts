/**
 * Risk-preference state (category filter/order/toggle), extracted out of
 * AppView.vue so CompareView.vue — a sibling route, not a child — can score
 * compared documents with the same live preferences the user sees in
 * AppView.vue's sidebar. Module-scope singleton, same reasoning as
 * useCompareList.ts: it must survive route changes within the SPA session.
 */
import { ref } from 'vue'
import { ALL_CATEGORY_IDS } from '@/lib/risk-categories'

/** Which risk categories currently pass the sidebar filter; starts with every category enabled. */
const enabledCategoryIds = ref<Set<string>>(new Set(ALL_CATEGORY_IDS))
/** Whether category filtering, ordering and preference bonuses are currently applied. */
const riskPreferencesEnabled = ref(false)
/** Category order chosen in the sidebar; earlier categories sort their matching clauses first. */
const categoryPriority = ref<string[]>([...ALL_CATEGORY_IDS])

export function useRiskPreferences() {
  return { enabledCategoryIds, riskPreferencesEnabled, categoryPriority }
}
