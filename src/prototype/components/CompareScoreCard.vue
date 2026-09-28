<script setup lang="ts">
// The "top part" of a nutrition card for one Compare entry — score, severity,
// flagged-clause bar, summary — plus a "See details" button instead of the
// category list. Clicking it reopens the full analysis on the home page,
// standing in for the real future feature: reopening a compared document
// from a stored snapshot rather than re-analysing it.
import { simpleSummaryPhrase } from '@/prototype/copy/risk-summary-copy'
import { computeMockRisk } from '@/prototype/lib/mock-risk'
import RiskScoreSummary from '@/prototype/components/RiskScoreSummary.vue'
import type { MockCompareEntry } from '@/prototype/composables/useMockCompareList'

const { entry } = defineProps<{ entry: MockCompareEntry }>()
defineEmits<{ remove: [] }>()

const summary = simpleSummaryPhrase(computeMockRisk(entry.analysis).level)
</script>

<template>
  <v-card variant="elevated" elevation="2" rounded="lg">
    <v-card-item>
      <template #title>{{ entry.serviceName }}</template>
      <template #subtitle>{{ entry.documentLabel }}</template>
      <template #append>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          :aria-label="`Remove ${entry.serviceName} — ${entry.documentLabel} from compare`"
          @click="$emit('remove')"
        />
      </template>
    </v-card-item>
    <v-card-text>
      <RiskScoreSummary :analysis="entry.analysis" :summary="summary" />
      <v-btn
        variant="tonal"
        color="primary"
        block
        :active="false"
        :to="{ name: 'prototype-home', query: { entry: entry.id } }"
      >
        See details
      </v-btn>
    </v-card-text>
  </v-card>
</template>
