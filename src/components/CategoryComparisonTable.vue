<script setup lang="ts">
/**
 * One shared scorecard comparing every compared document at once: rows are
 * risk categories, columns are documents — replaces each compare card
 * repeating its own category list (see DocumentRiskOverview.vue), so "what's
 * detected across all of these" reads as a single comparison. Styled to
 * match PrivacyNutritionCard.vue's own scorecard table.
 */
import { computed } from 'vue'
import type { CompareEntry } from '@/composables/useCompareList'
import { aggregateScorecardRows } from '@/lib/category-aggregation'
import { categoryColor } from '@/lib/category-colors'

const { entries } = defineProps<{ entries: CompareEntry[] }>()

// aggregateScorecardRows always returns the same fixed taxonomy in the same
// order regardless of the analysis, so rows line up positionally across
// every entry's own call.
const rowsByEntry = computed(() => entries.map((entry) => aggregateScorecardRows(entry.analysis)))
const categoryDefs = computed(() => rowsByEntry.value[0] ?? [])
</script>

<template>
  <div v-if="entries.length" class="card shadow-sm">
    <div class="card-body">
      <h2 class="h6 mb-1">Risk category comparison</h2>
      <p class="small text-body-secondary mb-3">Which categories were detected, across every compared document</p>
      <div class="table-responsive">
        <table class="table table-sm comparison-table mb-0">
          <thead>
            <tr>
              <th scope="col" class="category-col">Risk category</th>
              <th v-for="entry in entries" :key="entry.id" scope="col" class="text-center">
                {{ entry.serviceName }}
                <div class="small text-body-secondary fw-normal">{{ entry.displayName }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(def, rowIndex) in categoryDefs" :key="def.id">
              <td class="category-col">
                <span class="category-dot" :style="{ backgroundColor: categoryColor(def.id) }"></span>
                {{ def.name }}
              </td>
              <td v-for="(entry, colIndex) in entries" :key="entry.id" class="text-center">
                <span v-if="rowsByEntry[colIndex]![rowIndex]!.detected" class="badge rounded-pill text-bg-danger">
                  {{ rowsByEntry[colIndex]![rowIndex]!.occurrences }}
                </span>
                <span v-else class="text-body-tertiary" aria-label="Not detected">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.comparison-table {
  --bs-table-bg: transparent;
}

.category-col {
  position: sticky;
  left: 0;
  background-color: var(--bs-body-bg);
  white-space: nowrap;
}

.category-dot {
  display: inline-block;
  flex: none;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  margin-right: 0.5rem;
}
</style>
