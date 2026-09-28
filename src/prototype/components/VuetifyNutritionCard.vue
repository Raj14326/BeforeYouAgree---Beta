<script setup lang="ts">
/**
 * Material-3-styled sibling of PrivacyNutritionCard.vue for the /prototype
 * screens. Deliberately not a reskin of that component — it drives the same
 * real scoring functions but adds two inclusive-design refinements the
 * shipped card doesn't have yet: a Simple/Detailed language toggle, and
 * progressive disclosure (top concerns first) instead of a flat category
 * list.
 */
import { computed, ref } from 'vue'
import { riskLevelPhrase } from '@/lib/risk-level'
import { aggregateScorecardRows } from '@/lib/category-aggregation'
import { categoryColor } from '@/lib/category-colors'
import { simpleSummaryPhrase } from '@/prototype/copy/risk-summary-copy'
import { detailedCategoryDescription } from '@/prototype/copy/category-detail-copy'
import { computeMockRisk } from '@/prototype/lib/mock-risk'
import RiskScoreSummary from '@/prototype/components/RiskScoreSummary.vue'
import type { Analysis } from '@/types'

const { analysis } = defineProps<{ analysis: Analysis }>()

const risk = computed(() => computeMockRisk(analysis))

const copyMode = ref<'simple' | 'detailed'>('simple')
const summary = computed(() =>
  copyMode.value === 'simple' ? simpleSummaryPhrase(risk.value.level) : riskLevelPhrase(risk.value.score),
)

const scorecardRows = computed(() => aggregateScorecardRows(analysis))
const detectedRows = computed(() =>
  [...scorecardRows.value].filter((row) => row.detected).sort((a, b) => b.occurrences - a.occurrences),
)
const notDetectedRows = computed(() => scorecardRows.value.filter((row) => !row.detected))

const TOP_COUNT = 3
const showAll = ref(false)
const visibleRows = computed(() =>
  showAll.value ? [...detectedRows.value, ...notDetectedRows.value] : detectedRows.value.slice(0, TOP_COUNT),
)
const hiddenCount = computed(() => scorecardRows.value.length - visibleRows.value.length)

function descriptionFor(row: (typeof scorecardRows.value)[number]) {
  return copyMode.value === 'simple' ? row.description : detailedCategoryDescription(row.id, row.description)
}
</script>

<template>
  <v-card variant="elevated" elevation="2" rounded="lg" class="pa-1">
    <v-card-text>
      <RiskScoreSummary :analysis="analysis" :summary="summary" />

      <v-btn-toggle
        v-model="copyMode"
        mandatory
        density="comfortable"
        color="primary"
        class="mb-4"
        aria-label="Language detail level"
      >
        <v-btn value="simple" size="small">Simple words</v-btn>
        <v-btn value="detailed" size="small">Detailed</v-btn>
      </v-btn-toggle>

      <div class="text-subtitle-2 mb-2">Risk categories</div>
      <v-list density="compact" class="bg-transparent pa-0">
        <v-list-item v-for="row in visibleRows" :key="row.id" class="px-0">
          <template #prepend>
            <span
              class="category-dot"
              :style="{ backgroundColor: row.detected ? categoryColor(row.id) : 'transparent', borderColor: categoryColor(row.id) }"
              aria-hidden="true"
            />
          </template>
          <v-list-item-title>{{ row.name }}</v-list-item-title>
          <v-list-item-subtitle>{{ descriptionFor(row) }}</v-list-item-subtitle>
          <template #append>
            <v-chip v-if="row.detected" size="small" color="error" variant="tonal" prepend-icon="mdi-check-circle">
              {{ row.occurrences }}
            </v-chip>
            <span v-else class="text-medium-emphasis text-body-2" aria-label="Not detected">—</span>
          </template>
        </v-list-item>
      </v-list>

      <v-btn
        v-if="hiddenCount > 0 || showAll"
        variant="text"
        size="small"
        color="primary"
        class="mt-2"
        @click="showAll = !showAll"
      >
        {{ showAll ? 'Show top concerns only' : `Show all ${scorecardRows.length} categories (${hiddenCount} more)` }}
      </v-btn>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.category-dot {
  display: inline-block;
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 50%;
  border: 2px solid;
  margin-top: 0.35rem;
}
</style>
