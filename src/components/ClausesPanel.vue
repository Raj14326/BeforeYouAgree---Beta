<script setup lang="ts">
/**
 * ClausesPanel.vue: fixed-size, scrollable list of clause cards for the
 * active document (chunk 3).
 */
import { computed } from 'vue'
import type { Analysis, RiskFinding } from '@/types'
import ClauseCard from './ClauseCard.vue'

const { analysis, filter } = defineProps<{
  analysis: Analysis | null
  filter: RiskFinding['predictedLabel']
}>()

const emit = defineEmits<{
  'update:filter': [value: RiskFinding['predictedLabel']]
  'show-in-text': [finding: RiskFinding]
}>()

const visibleFindings = computed(
  () => analysis?.findings.filter((finding) => finding.predictedLabel === filter) ?? [],
)

function labelCount(label: RiskFinding['predictedLabel']) {
  return analysis?.findings.filter((finding) => finding.predictedLabel === label).length ?? 0
}

/** Percentage of analysed clauses flagged risky, for the progress bar. */
const flaggedShare = computed(() => {
  if (!analysis?.clauseCount) return 0
  return Math.round((analysis.riskyClauseCount / analysis.clauseCount) * 100)
})

/** Bootstrap colour for the progress bar: red ≥ 25% flagged, amber ≥ 10%, else green. */
const severityClass = computed(() => {
  if (flaggedShare.value >= 25) return 'bg-danger'
  if (flaggedShare.value >= 10) return 'bg-warning'
  return 'bg-success'
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
            <div class="display-6 fw-bold">{{ analysis.riskyClauseCount }}</div>
            <div class="small text-body-secondary">
              risky {{ analysis.riskyClauseCount === 1 ? 'clause' : 'clauses' }}
            </div>
          </div>
          <div class="flex-grow-1" style="min-width: 220px">
            <p class="small mb-1">{{ flaggedShare }}% of {{ analysis.clauseCount }} clauses flagged</p>
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
        <div v-else class="clauses-scroll">
          <ClauseCard
            v-for="(finding, index) in visibleFindings"
            :key="`${finding.text}-${index}`"
            :finding="finding"
            @show-in-text="emit('show-in-text', finding)"
          />
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
</style>
