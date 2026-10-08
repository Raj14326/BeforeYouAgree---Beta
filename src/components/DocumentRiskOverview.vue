<script setup lang="ts">
/**
 * DocumentRiskOverview.vue: the score/flagged-share/plain-language-summary
 * "top half" of a Privacy Nutrition Card, extracted so the compare view can
 * show it alone (no per-document category scorecard — that's shared across
 * every compared document instead, see CategoryComparisonTable.vue).
 */
import { computed } from 'vue'
import { documentRiskScore } from '@/lib/document-risk-score'
import { personalisedRiskLevel } from '@/lib/personalised-risk-score'
import { riskLevelBadgeClass, riskLevelPhrase } from '@/lib/risk-level'
import type { Analysis } from '@/types'

const { analysis, categoryPriority, enabledCategoryIds, riskPreferencesEnabled } = defineProps<{
  analysis: Analysis
  categoryPriority: string[]
  enabledCategoryIds: Set<string>
  riskPreferencesEnabled: boolean
}>()

const risk = computed(() =>
  documentRiskScore(analysis, categoryPriority, enabledCategoryIds, riskPreferencesEnabled),
)

const level = computed(() => personalisedRiskLevel(risk.value.score))
const levelLabel = computed(() => `${level.value[0]!.toUpperCase()}${level.value.slice(1)} risk`)

/** Bootstrap "alert" tint matching the score's risk level, so the banner agrees with the badge above it. */
const summaryClass = computed(() => {
  if (level.value === 'high') return 'alert-danger'
  if (level.value === 'medium') return 'alert-warning'
  return 'alert-success'
})
</script>

<template>
  <div class="document-risk-overview" v-bind="$attrs">
    <div class="row g-2 mb-2">
      <div class="col-sm-6">
        <div class="nutrition-tile h-100">
          <div class="display-6 fw-bold lh-1">{{ risk.score }} / 100</div>
          <div class="d-flex align-items-center gap-2 mt-2">
            <span class="small text-body-secondary">document risk</span>
            <span class="badge" :class="riskLevelBadgeClass(level)">{{ levelLabel }}</span>
          </div>
        </div>
      </div>
      <div class="col-sm-6">
        <div class="nutrition-tile h-100">
          <div class="d-flex justify-content-between align-items-baseline">
            <span class="fs-5 fw-semibold">{{ analysis.riskyClauseCount }} / {{ analysis.clauseCount }}</span>
            <span class="badge text-bg-secondary">{{ risk.flaggedShare }}% flagged</span>
          </div>
          <div
            class="progress mt-2"
            role="progressbar"
            aria-label="Share of clauses flagged as risky"
            :aria-valuenow="risk.flaggedShare"
            aria-valuemin="0"
            aria-valuemax="100"
            style="height: 8px"
          >
            <div class="progress-bar" :class="risk.severityClass" :style="{ width: `${risk.flaggedShare}%` }"></div>
          </div>
          <div class="small text-body-secondary mt-2">clauses flagged as risky</div>
        </div>
      </div>
    </div>

    <p class="alert small py-2 px-3 mb-0" :class="summaryClass" role="status">
      {{ riskLevelPhrase(risk.score) }}
    </p>
  </div>
</template>

<style scoped>
.nutrition-tile {
  padding: 0.85rem 1rem;
  border-radius: var(--bs-border-radius);
  background-color: var(--bs-tertiary-bg);
}
</style>
