<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CompareSummaryStatus } from '@/composables/useCompareSummary'
import type { ComparisonSummary } from '@/types'

const props = defineProps<{
  status: CompareSummaryStatus
  summary: ComparisonSummary | null
  error: string
  documentCount: number
  hasPrivateDocument: boolean
}>()
const emit = defineEmits<{ generate: [] }>()
const consent = ref(false)
const canGenerate = computed(() =>
  props.documentCount >= 2 && props.documentCount <= 4 && (!props.hasPrivateDocument || consent.value),
)
</script>

<template>
  <section class="card border-info-subtle shadow-sm mb-4" aria-labelledby="ai-comparison-heading">
    <div class="card-body">
      <div class="d-flex flex-wrap align-items-start justify-content-between gap-3">
        <div>
          <h2 id="ai-comparison-heading" class="h5 mb-1">AI clause comparison</h2>
          <p class="small text-body-secondary mb-0">
            Groq receives only flagged clauses and locally retrieved candidates, not complete documents.
          </p>
        </div>
        <button type="button" class="btn btn-primary" :disabled="!canGenerate || status === 'loading'" @click="emit('generate')">
          <span v-if="status === 'loading'" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
          {{ status === 'loading' ? 'Comparing…' : 'Generate AI comparison' }}
        </button>
      </div>

      <div v-if="documentCount < 2" class="alert alert-light border mt-3 mb-0" role="status">
        Add at least two documents to generate a comparison.
      </div>
      <div v-else-if="documentCount > 4" class="alert alert-warning mt-3 mb-0" role="status">
        AI comparison supports up to four documents at a time.
      </div>
      <div v-if="hasPrivateDocument" class="form-check mt-3">
        <input id="groq-private-consent" v-model="consent" class="form-check-input" type="checkbox" />
        <label class="form-check-label small" for="groq-private-consent">
          I understand that selected excerpts from my uploaded or pasted document will be sent to Groq.
        </label>
      </div>
      <div v-if="status === 'error'" class="alert alert-secondary mt-3 mb-0" role="alert">{{ error }}</div>

      <template v-if="status === 'ready' && summary">
        <div class="alert alert-info mt-3 mb-3">
          <h3 class="h6 mb-1">
            {{ summary.winnerDocumentId ? `${summary.winnerDocumentName} appears better overall` : 'No clear overall winner' }}
          </h3>
          <p class="mb-0">{{ summary.overview }}</p>
        </div>
        <div v-for="comparison in summary.comparisons" :key="comparison.categoryId" class="border-top py-3">
          <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
            <h3 class="h6 mb-0">{{ comparison.categoryName }}</h3>
            <span v-if="comparison.betterDocumentId" class="badge text-bg-success">
              Better: {{ comparison.betterDocumentName }}
            </span>
            <span v-else class="badge text-bg-secondary">No clear winner</span>
          </div>
          <p class="mb-0">{{ comparison.summary }}</p>
        </div>
        <p class="small text-body-secondary mb-0">{{ summary.caveat }}</p>
      </template>
    </div>
  </section>
</template>
