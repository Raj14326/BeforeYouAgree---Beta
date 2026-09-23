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

/** Percentage of analysed clauses flagged risky, for the progress bar. */
const flaggedShare = computed(() => {
  if (!analysis?.clauseCount) return 0
  return Math.round((analysis.riskyClauseCount / analysis.clauseCount) * 100)
})

/**
 * Document-level risk score: blends average personalised severity across
 * risky clauses with how much of the document was flagged, so a handful of
 * severe clauses in an otherwise clean document don't read as high-risk.
 */
const documentRiskScore = computed(() => {
  const riskyFindings = analysis?.findings.filter((finding) => finding.predictedLabel === 'risky') ?? []
  if (!riskyFindings.length) return 0
  const total = riskyFindings.reduce(
    (sum, finding) =>
      sum +
      personalisedRiskScore(
        finding.categories,
        categoryPriority,
        enabledCategoryIds,
        riskPreferencesEnabled,
      ).score,
    0,
  )
  const avgSeverity = total / riskyFindings.length
  return Math.round(0.7 * avgSeverity + 0.3 * flaggedShare.value)
})

/** Bootstrap colour for the progress bar: red ≥ 25% flagged, amber ≥ 10%, else green. */
const severityClass = computed(() => {
  if (flaggedShare.value >= 25) return 'bg-danger'
  if (flaggedShare.value >= 10) return 'bg-warning'
  return 'bg-success'
})

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

        <div class="d-flex flex-wrap align-items-center gap-3 mb-3">
          <div class="text-center lh-1">
            <div class="display-6 fw-bold">{{ documentRiskScore }}</div>
            <div class="small text-body-secondary">document risk score</div>
          </div>
          <div class="flex-grow-1" style="min-width: 220px">
            <p class="small mb-1">
              {{ analysis.riskyClauseCount }}/{{ analysis.clauseCount }} clauses flagged ({{ flaggedShare }}%)
            </p>
            <div
              class="progress"
              role="progressbar"
              aria-label="Share of clauses flagged as risky"
              :aria-valuenow="flaggedShare"
              aria-valuemin="0"
              aria-valuemax="100"
              style="height: 10px"
            >
              <div class="progress-bar" :class="severityClass" :style="{ width: `${flaggedShare}%` }"></div>
            </div>
          </div>
        </div>

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
            v-for="(finding, index) in visibleFindings"
            :key="`${finding.text}-${index}`"
            :variants="cardVariants"
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
