<script setup lang="ts">
/**
 * Placeholder banner for the LLM-generated risk/safety comparison summary,
 * shown above the compare cards. Backed by useCompareSummary.ts, which is
 * currently a stub (always 'idle') reserved for a teammate's in-progress
 * LLM integration — only that composable needs to change later, not this
 * component.
 */
import type { CompareSummaryStatus } from '@/composables/useCompareSummary'

defineProps<{
  status: CompareSummaryStatus
  summary: string | null
}>()
</script>

<template>
  <div v-if="status === 'loading'" class="alert alert-info d-flex align-items-center gap-2 mb-4" role="status">
    <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
    Summarising risk across these documents…
  </div>
  <div v-else-if="status === 'ready' && summary" class="alert alert-info mb-4" role="status">
    {{ summary }}
  </div>
  <div v-else-if="status === 'error'" class="alert alert-secondary mb-4" role="status">
    The AI risk comparison summary couldn't be generated. The cards and table below are unaffected.
  </div>
  <div v-else class="alert alert-info mb-4" role="status">
    AI risk comparison summary — coming soon. Scores and categories below are already fully computed.
  </div>
</template>
