<script setup lang="ts">
// Visual-only mock: a shared, working local compare list (add/remove really
// work) but not wired to a real backend — the real, unbuilt Phase B feature
// is described in .claude/plans/glittery-strolling-moore.md.
import CompareScoreCard from '@/prototype/components/CompareScoreCard.vue'
import CategoryComparisonTable from '@/prototype/components/CategoryComparisonTable.vue'
import { useMockCompareList } from '@/prototype/composables/useMockCompareList'

const { entries, remove } = useMockCompareList()
</script>

<template>
  <div>
    <h1 class="text-h4 font-weight-bold mb-1">Compare</h1>
    <p class="text-body-2 text-medium-emphasis mb-6">
      Documents added to your compare list. Add more from the <router-link to="/prototype">search flow</router-link>,
      or click "See details" to reopen a document's full analysis.
    </p>

    <template v-if="entries.length">
      <v-row class="mb-6">
        <v-col v-for="entry in entries" :key="entry.id" cols="12" md="6" lg="4">
          <CompareScoreCard :entry="entry" @remove="remove(entry.id)" />
        </v-col>
      </v-row>

      <CategoryComparisonTable :entries="[...entries]" />
    </template>

    <v-empty-state
      v-else
      icon="mdi-view-column-outline"
      title="Nothing to compare"
      text="Add a document from the search flow to start comparing."
    />
  </div>
</template>
