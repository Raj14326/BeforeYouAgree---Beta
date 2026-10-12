<script setup lang="ts">
/**
 * ClausesPanel.vue: fixed-size, scrollable list of clause cards for the
 * active document (chunk 3).
 */
import { computed, ref, watch } from 'vue'
import { categoryColor } from '@/lib/category-colors'
import { personalisedRiskScore } from '@/lib/personalised-risk-score'
import { PRIVACY_CATEGORIES, PRIVACY_GROUP, TOS_CATEGORIES } from '@/lib/risk-categories'
import type { Analysis, RiskFinding } from '@/types'
import ClauseCard from './ClauseCard.vue'
import PrivacyNutritionCard from './PrivacyNutritionCard.vue'

const { analysis, filter, enabledCategoryIds, categoryPriority, riskPreferencesEnabled } = defineProps<{
  analysis: Analysis | null
  filter: RiskFinding['predictedLabel']
  enabledCategoryIds: Set<string>
  categoryPriority: string[]
  riskPreferencesEnabled: boolean
}>()

const emit = defineEmits<{
  'update:filter': [value: RiskFinding['predictedLabel']]
  'show-in-text': [finding: RiskFinding]
}>()

/**
 * Scorecard row the user clicked in PrivacyNutritionCard (a TOS category id,
 * or `privacy` for the combined Privacy row). While set, the list shows every
 * clause tagged with it- ignoring the risky/not-risky view and preference
 * toggles- so it matches the scorecard's count. Cleared on a new analysis.
 */
const focusedCategoryId = ref<string | null>(null)
watch(
  () => analysis,
  () => (focusedCategoryId.value = null),
)

const focusedCategory = computed(() =>
  focusedCategoryId.value === PRIVACY_GROUP.id
    ? PRIVACY_GROUP
    : TOS_CATEGORIES.find((category) => category.id === focusedCategoryId.value),
)

const PRIVACY_IDS = new Set(PRIVACY_CATEGORIES.map((category) => category.id))

function matchesFocus(finding: RiskFinding, focusId: string) {
  return finding.categories.some((category) =>
    focusId === PRIVACY_GROUP.id ? PRIVACY_IDS.has(category.id) : category.id === focusId,
  )
}

// A finding with no matched categories is never hidden by the category
// toggles; one with categories is shown if at least one of them is enabled.
const visibleFindings = computed(() => {
  const priority = new Map(categoryPriority.map((id, index) => [id, index]))
  const focusId = focusedCategoryId.value
  return (
    analysis?.findings
      .filter((finding) =>
        focusId
          ? matchesFocus(finding, focusId)
          : (filter === 'risky'
              ? finding.predictedLabel === 'risky' || finding.reviewCategories.length > 0
              : finding.predictedLabel === 'not_risky' && finding.reviewCategories.length === 0) &&
            (!riskPreferencesEnabled || finding.categories.length === 0 ||
              finding.categories.some((category) => enabledCategoryIds.has(category.id))),
      )
      .map((finding, originalIndex) => ({ finding, originalIndex }))
      .sort((a, b) => {
        if (!riskPreferencesEnabled) {
          const score = (finding: RiskFinding) =>
            personalisedRiskScore(
              finding.categories,
              categoryPriority,
              enabledCategoryIds,
              false,
            ).score
          return score(b.finding) - score(a.finding) || a.originalIndex - b.originalIndex
        }
        const rank = (finding: RiskFinding) =>
          Math.min(
            ...finding.categories
              .filter((category) => enabledCategoryIds.has(category.id))
              .map((category) => priority.get(category.id) ?? Number.MAX_SAFE_INTEGER),
          )
        return rank(a.finding) - rank(b.finding) || a.originalIndex - b.originalIndex
      })
      .map(({ finding }) => finding) ?? []
  )
})

function labelCount(label: RiskFinding['predictedLabel']) {
  return analysis?.findings.filter((finding) => label === 'risky'
    ? finding.predictedLabel === 'risky' || finding.reviewCategories.length > 0
    : finding.predictedLabel === 'not_risky' && finding.reviewCategories.length === 0).length ?? 0
}
</script>

<template>
  <section class="card shadow-sm clauses-panel">
    <div class="card-body">
      <div v-if="!analysis" class="text-body-secondary small py-2">
        Select a document above to see its risk analysis here.
      </div>
      <template v-else>
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h2 class="h6 mb-0">Risk analysis</h2>
          <div v-if="focusedCategory" class="category-focus-chip" role="status">
            <span class="category-focus-dot" :style="{ backgroundColor: categoryColor(focusedCategory.id) }"></span>
            <span class="small">
              <span class="fw-semibold">{{ focusedCategory.name }}</span>
              <span class="text-body-secondary">
                · {{ visibleFindings.length }} {{ visibleFindings.length === 1 ? 'clause' : 'clauses' }}
              </span>
            </span>
            <button
              type="button"
              class="btn-close category-focus-clear"
              :aria-label="`Clear ${focusedCategory.name} filter`"
              @click="focusedCategoryId = null"
            ></button>
          </div>
          <div v-else class="d-flex align-items-center gap-2" data-tour="clause-filter">
            <label for="clause-filter" class="small text-body-secondary">View</label>
            <select
              id="clause-filter"
              class="form-select form-select-sm"
              style="width: auto"
              :value="filter"
              @change="emit('update:filter', ($event.target as HTMLSelectElement).value as RiskFinding['predictedLabel'])"
            >
              <option value="risky">Risky / needs review ({{ labelCount('risky') }})</option>
              <option value="not_risky">Not risky ({{ labelCount('not_risky') }})</option>
            </select>
          </div>
        </div>

        <PrivacyNutritionCard
          v-model:focused-category-id="focusedCategoryId"
          :analysis="analysis"
          :category-priority="categoryPriority"
          :enabled-category-ids="enabledCategoryIds"
          :risk-preferences-enabled="riskPreferencesEnabled"
          class="mb-3"
          data-tour="nutrition-card"
        />

        <div v-if="!visibleFindings.length" class="text-body-secondary small">
          {{ filter === 'risky' ? 'No clauses were flagged as risky or needing review.' : 'Every analysed clause was flagged as risky or needing review.' }}
        </div>
        <div v-else class="clauses-scroll">
          <div
            v-for="(finding, index) in visibleFindings"
            :key="`${finding.start}-${finding.end}-${finding.text}`"
            class="clause-fade-in"
            :data-tour="index === 0 ? 'first-clause' : undefined"
          >
            <ClauseCard
              :finding="finding"
              :category-priority="categoryPriority"
              :enabled-category-ids="enabledCategoryIds"
              :risk-preferences-enabled="riskPreferencesEnabled"
              @show-in-text="emit('show-in-text', finding)"
            />
          </div>
        </div>

        <p class="text-body-secondary small mb-0 mt-2">
          Automated prediction, labelled by category where applicable; not legal advice.
        </p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.clauses-scroll {
  max-height: 460px;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.category-focus-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem 0.25rem 0.75rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 999px;
  background-color: var(--bs-tertiary-bg);
}

.category-focus-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  flex: none;
}

.category-focus-clear {
  font-size: 0.6rem;
  padding: 0.35rem;
}

/*
 * Plain CSS fade on mount (replaced motion-v stagger + FLIP, which could leave
 * cards stuck at opacity 0). Re-sorting keeps keyed elements, so only newly
 * shown cards fade; if the animation never runs, the card is simply visible.
 */
.clause-fade-in {
  animation: clause-fade-in 200ms ease-out;
}

@keyframes clause-fade-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .clause-fade-in {
    animation: none;
  }
}
</style>
