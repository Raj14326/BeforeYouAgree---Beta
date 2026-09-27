<script setup lang="ts">
/**
 * ClausesPanel.vue: fixed-size, scrollable list of clause cards for the
 * active document (chunk 3).
 */
import { computed } from 'vue'
import { motion } from 'motion-v'
import { personalisedRiskScore } from '@/lib/personalised-risk-score'
import type { Analysis, RiskFinding } from '@/types'
import ClauseCard from './ClauseCard.vue'
import PrivacyNutritionCard from './PrivacyNutritionCard.vue'

/**
 * Cards fade/slide in one after another once analysis finishes. The base
 * stagger is 0.12s per card, but that alone would take ~2.4s+ across 20+
 * cards, so it's capped so the whole sequence still finishes within ~900ms.
 */
const STAGGER_CHILDREN = 0.12
const DELAY_CHILDREN = 0.2
const MAX_STAGGER_TOTAL_S = 0.9

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

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

// A finding with no matched categories is never hidden by the category
// toggles; one with categories is shown if at least one of them is enabled.
const visibleFindings = computed(() => {
  const priority = new Map(categoryPriority.map((id, index) => [id, index]))
  return (
    analysis?.findings
      .filter(
      (finding) =>
        finding.predictedLabel === filter &&
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
  return analysis?.findings.filter((finding) => finding.predictedLabel === label).length ?? 0
}

/** staggerChildren shrinks as the list grows so the full sequence stays under MAX_STAGGER_TOTAL_S. */
const containerVariants = computed(() => {
  const count = visibleFindings.value.length
  const staggerChildren =
    count > 1
      ? Math.min(STAGGER_CHILDREN, (MAX_STAGGER_TOTAL_S - DELAY_CHILDREN) / (count - 1))
      : STAGGER_CHILDREN
  return {
    hidden: {},
    show: { transition: { staggerChildren, delayChildren: DELAY_CHILDREN } },
  }
})
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
          <div class="d-flex align-items-center gap-2">
            <label for="clause-filter" class="small text-body-secondary">View</label>
            <select
              id="clause-filter"
              class="form-select form-select-sm"
              style="width: auto"
              :value="filter"
              @change="emit('update:filter', ($event.target as HTMLSelectElement).value as RiskFinding['predictedLabel'])"
            >
              <option value="risky">Risky ({{ labelCount('risky') }})</option>
              <option value="not_risky">Not risky ({{ labelCount('not_risky') }})</option>
            </select>
          </div>
        </div>

        <PrivacyNutritionCard
          :analysis="analysis"
          :category-priority="categoryPriority"
          :enabled-category-ids="enabledCategoryIds"
          :risk-preferences-enabled="riskPreferencesEnabled"
          class="mb-3"
        />

        <div v-if="!visibleFindings.length" class="text-body-secondary small">
          {{ filter === 'risky' ? 'No clauses were flagged as risky.' : 'Every analysed clause was flagged as risky.' }}
        </div>
        <motion.div
          v-else
          class="clauses-scroll"
          :variants="containerVariants"
          initial="hidden"
          animate="show"
        >
          <motion.div
            v-for="finding in visibleFindings"
            :key="`${finding.start}-${finding.end}`"
            layout="position"
            :variants="cardVariants"
            :transition="{ type: 'spring', stiffness: 500, damping: 40 }"
          >
            <ClauseCard
              :finding="finding"
              :category-priority="categoryPriority"
              :enabled-category-ids="enabledCategoryIds"
              :risk-preferences-enabled="riskPreferencesEnabled"
              @show-in-text="emit('show-in-text', finding)"
            />
          </motion.div>
        </motion.div>

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
</style>
