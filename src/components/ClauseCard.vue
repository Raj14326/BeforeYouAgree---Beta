<script setup lang="ts">
/**
 * ClauseCard.vue: one flagged/unflagged clause inside the clauses panel
 * (chunk 3). Two horizontal sections with only spacing between them (no
 * divider): clause details on the left, a risk-score placeholder on the
 * right. A coloured strip on the left edge shows the risk level.
 */
import { categoryColor } from '@/lib/category-colors'
import { personalisedRiskLevel, personalisedRiskScore } from '@/lib/personalised-risk-score'
import { riskLevelBadgeClass, riskLevelColor } from '@/lib/risk-level'
import type { RiskFinding } from '@/types'
import { computed } from 'vue'

const { finding, categoryPriority, enabledCategoryIds, riskPreferencesEnabled } = defineProps<{
  finding: RiskFinding
  categoryPriority: string[]
  enabledCategoryIds: Set<string>
  riskPreferencesEnabled: boolean
}>()

const personalisedScore = computed(() =>
  personalisedRiskScore(
    finding.categories,
    categoryPriority,
    enabledCategoryIds,
    riskPreferencesEnabled,
  ),
)
const displayedRiskLevel = computed(() => personalisedRiskLevel(personalisedScore.value.score))
const displayedRiskLabel = computed(
  () =>
    `${displayedRiskLevel.value[0]!.toUpperCase()}${displayedRiskLevel.value.slice(1)}${riskPreferencesEnabled ? ' personalised' : ''} risk`,
)

const scoreLabel = computed(() => {
  const category = personalisedScore.value.primaryCategoryName
  if (!riskPreferencesEnabled) {
    return `Risk score ${personalisedScore.value.score} out of 100. Risk preferences are off.`
  }
  return category
    ? `Personalised risk score ${personalisedScore.value.score} out of 100. Highest priority match: ${category}.`
    : 'Personalised risk score 0 out of 100. No enabled risk categories matched.'
})

const emit = defineEmits<{
  'show-in-text': []
}>()
</script>

<template>
  <article class="clause-card" :style="{ '--clause-strip-color': riskLevelColor(displayedRiskLevel) }">
    <div class="clause-card-main">
      <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
        <span
          class="badge"
          :class="riskLevelBadgeClass(displayedRiskLevel)"
          :title="scoreLabel"
        >
          {{ displayedRiskLabel }}
        </span>
        <span v-if="finding.occurrenceCount > 1" class="badge text-bg-secondary">
          Appears {{ finding.occurrenceCount }} times
        </span>
      </div>

      <p class="clause-card-text mb-2">{{ finding.text }}</p>

      <div class="d-flex flex-wrap align-items-center gap-3">
        <span
          v-for="category in finding.categories"
          :key="category.id"
          class="clause-category"
        >
          <span class="clause-category-dot" :style="{ backgroundColor: categoryColor(category.id) }"></span>
          {{ category.name }}
        </span>
        <button
          v-if="finding.predictedLabel === 'risky'"
          type="button"
          class="btn btn-sm btn-link p-0"
          @click="emit('show-in-text')"
        >
          Show in original text
        </button>
      </div>
    </div>

    <div class="clause-card-score" :aria-label="scoreLabel" :title="scoreLabel">
      <div class="clause-card-score-value">{{ personalisedScore.score }}</div>
      <div class="clause-card-score-label">
        {{ riskPreferencesEnabled ? 'Personalised risk' : 'Risk score' }}
      </div>
    </div>
  </article>
</template>

<style scoped>
.clause-card {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 1rem;
  padding: 0.9rem 1rem 0.9rem 1.15rem;
  border: 1px solid var(--bs-border-color-translucent);
  border-radius: var(--bs-border-radius);
  background-color: var(--bs-body-bg);
  margin-bottom: 0.65rem;
  overflow: hidden;
}

.clause-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 0.3rem;
  background-color: var(--clause-strip-color);
}

.clause-card-main {
  flex: 1 1 auto;
  min-width: 0;
}

.clause-card-text {
  font-size: 0.9rem;
  line-height: 1.55;
}

.clause-category {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--bs-secondary-color);
}

.clause-category-dot {
  flex: none;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
}

.clause-card-score {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 4.5rem;
  border-left: 1px dashed var(--bs-border-color);
  padding-left: 1rem;
  text-align: center;
}

.clause-card-score-value {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--bs-secondary-color);
}

.clause-card-score-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--bs-secondary-color);
}
</style>
