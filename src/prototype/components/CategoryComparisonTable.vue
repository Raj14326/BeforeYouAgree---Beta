<script setup lang="ts">
// One shared scorecard comparing every compared document at once: rows are
// risk categories, columns are documents — replaces each card repeating its
// own category list, so "what's detected across all of these" reads as a
// single comparison instead of N separate lists.
import { computed } from 'vue'
import { aggregateScorecardRows } from '@/lib/category-aggregation'
import { categoryColor } from '@/lib/category-colors'
import type { MockCompareEntry } from '@/prototype/composables/useMockCompareList'

const { entries } = defineProps<{ entries: MockCompareEntry[] }>()

// aggregateScorecardRows always returns the same 9-row taxonomy in the same
// order (8 TOS categories + 1 combined Privacy row) regardless of the
// analysis, so rows line up positionally across every entry's own call.
const rowsByEntry = computed(() => entries.map((entry) => aggregateScorecardRows(entry.analysis)))
const categoryDefs = computed(() => rowsByEntry.value[0] ?? [])
</script>

<template>
  <v-card v-if="entries.length" variant="elevated" elevation="2" rounded="lg">
    <v-card-item>
      <template #title>Risk category comparison</template>
      <template #subtitle>Which categories were detected, across every compared document</template>
    </v-card-item>
    <v-card-text class="pa-0">
      <v-table density="comfortable" class="comparison-table">
        <thead>
          <tr>
            <th class="category-col">Risk category</th>
            <th v-for="entry in entries" :key="entry.id" class="text-center">
              {{ entry.serviceName }}
              <div class="text-caption text-medium-emphasis font-weight-regular">{{ entry.documentLabel }}</div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(def, rowIndex) in categoryDefs" :key="def.id">
            <td class="category-col">
              <span class="category-dot" :style="{ backgroundColor: categoryColor(def.id) }" aria-hidden="true" />
              {{ def.name }}
            </td>
            <td v-for="(entry, colIndex) in entries" :key="entry.id" class="text-center">
              <v-chip
                v-if="rowsByEntry[colIndex]![rowIndex]!.detected"
                size="small"
                color="error"
                variant="tonal"
                prepend-icon="mdi-check-circle"
              >
                {{ rowsByEntry[colIndex]![rowIndex]!.occurrences }}
              </v-chip>
              <span v-else class="text-medium-emphasis" aria-label="Not detected">—</span>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.comparison-table {
  background: transparent;
}

.category-col {
  position: sticky;
  left: 0;
  background: rgb(var(--v-theme-surface));
  white-space: nowrap;
}

.category-dot {
  display: inline-block;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  margin-right: 0.5rem;
}
</style>
