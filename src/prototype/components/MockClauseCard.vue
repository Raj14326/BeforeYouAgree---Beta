<script setup lang="ts">
// Material-3 sibling of ClauseCard.vue — one flagged clause. Severity is
// derived from the clause's strongest matched category score (no preference
// sidebar on these screens) rather than a personalised score.
import { computed } from 'vue'
import { categoryColor } from '@/lib/category-colors'
import SeverityChip from '@/prototype/components/SeverityChip.vue'
import type { RiskFinding, RiskLevel } from '@/types'

const { finding } = defineProps<{ finding: RiskFinding }>()
defineEmits<{ 'show-in-text': [] }>()

const level = computed<RiskLevel>(() => {
  const maxScore = Math.max(0, ...finding.categories.map((category) => category.score))
  if (maxScore >= 0.8) return 'high'
  if (maxScore >= 0.5) return 'medium'
  return 'low'
})
</script>

<template>
  <v-card variant="outlined" rounded="lg" class="mb-3">
    <v-card-text>
      <div class="d-flex flex-wrap align-center ga-2 mb-2">
        <SeverityChip :level="level" />
        <v-chip v-if="finding.occurrenceCount > 1" size="small" variant="tonal">
          Appears {{ finding.occurrenceCount }} times
        </v-chip>
      </div>

      <p class="text-body-2 mb-3">{{ finding.text }}</p>

      <div class="d-flex flex-wrap align-center ga-4">
        <span v-for="category in finding.categories" :key="category.id" class="d-flex align-center ga-2 text-caption">
          <span class="category-dot" :style="{ backgroundColor: categoryColor(category.id) }" aria-hidden="true" />
          {{ category.name }}
        </span>
        <v-btn variant="text" size="small" color="primary" class="ml-auto" @click="$emit('show-in-text')">
          Show in original text
        </v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.category-dot {
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
}
</style>
