<script setup lang="ts">
/**
 * ServiceDocumentCard.vue: chunk 2, one card per document type (Terms,
 * Privacy, …) of the selected service. Clicking the card body makes it the
 * active document (driving the clauses/original-text sections below) and,
 * the first time, triggers the parent to retrieve and analyse its text —
 * nothing is fetched until the card is clicked. This card just reflects
 * that state and offers "Analyse again" + "History".
 */
import type { Analysis, Retrieval, Term, VersionOption } from '@/types'
import BrandAvatar from './BrandAvatar.vue'

const {
  serviceName,
  termType,
  term,
  retrieval,
  analysis,
  isActive,
  isLoading,
  isAnalysing,
  retrievalError,
  analysisError,
  historyOpen,
  versions,
  selectedVersion,
  loadingHistory,
} = defineProps<{
  serviceName: string
  termType: string
  term: Term
  retrieval: Retrieval | undefined
  analysis: Analysis | undefined
  isActive: boolean
  isLoading: boolean
  isAnalysing: boolean
  retrievalError: string
  analysisError: string
  historyOpen: boolean
  versions: VersionOption[] | undefined
  selectedVersion: string
  loadingHistory: boolean
}>()

const emit = defineEmits<{
  activate: []
  'analyse-again': []
  'toggle-history': []
  'update:selectedVersion': [value: string]
  'retrieve-version': []
}>()

/** Format an ISO timestamp for display in en-AU, or a fallback phrase when null. */
function formattedUpdatedAt(value: string | null) {
  if (!value) return 'an unknown date'
  return new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
}
</script>

<template>
  <article
    class="card shadow-sm document-card"
    :class="{ 'document-card-active': isActive }"
    @click="emit('activate')"
  >
    <div class="card-body d-flex flex-wrap align-items-center gap-3">
      <BrandAvatar :service-name="serviceName" size="lg" />

      <div class="flex-grow-1" style="min-width: 200px">
        <h3 class="h6 mb-1 text-capitalize">{{ termType.replace(/_/g, ' ') }}</h3>

        <div v-if="!term.available" class="small text-body-secondary">Not archived</div>
        <div v-else-if="isLoading" class="small text-body-secondary">
          <span class="spinner-border spinner-border-sm me-1"></span> Retrieving and analysing…
        </div>
        <div v-else class="d-flex flex-wrap align-items-center gap-2 small text-body-secondary">
          <span>{{ formattedUpdatedAt(term.updatedAt) }}</span>
          <template v-if="retrieval">
            <span aria-hidden="true">·</span>
            <span>{{ retrieval.characterCount.toLocaleString() }} characters</span>
          </template>
          <template v-if="term.sourceUrl">
            <span aria-hidden="true">·</span>
            <a :href="term.sourceUrl" target="_blank" rel="noreferrer" @click.stop>
              Source <i class="bi bi-box-arrow-up-right small"></i>
            </a>
          </template>
        </div>

        <div v-if="retrievalError" class="text-danger small mt-1">{{ retrievalError }}</div>
        <div v-if="analysisError" class="text-danger small mt-1">{{ analysisError }}</div>
      </div>

      <div class="d-flex align-items-center gap-2 position-relative" @click.stop>
        <button
          type="button"
          class="btn btn-sm btn-outline-primary"
          :disabled="!retrieval || isLoading || isAnalysing"
          @click="emit('analyse-again')"
        >
          <span v-if="isAnalysing" class="spinner-border spinner-border-sm me-1"></span>
          <i v-else class="bi bi-arrow-repeat me-1" aria-hidden="true"></i>
          {{ isAnalysing ? 'Analysing…' : 'Analyse again' }}
        </button>

        <button
          v-if="term.historyAvailable"
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :aria-expanded="historyOpen"
          @click="emit('toggle-history')"
        >
          <i class="bi bi-clock-history me-1"></i>History
        </button>

        <div v-if="historyOpen" class="history-popover shadow">
          <label class="form-label small mb-1">Older versions</label>
          <select
            class="form-select form-select-sm mb-2"
            :value="selectedVersion"
            :disabled="loadingHistory"
            @change="emit('update:selectedVersion', ($event.target as HTMLSelectElement).value)"
          >
            <option value="" disabled>
              {{ loadingHistory ? 'Loading dates…' : 'Select a date' }}
            </option>
            <option v-for="version in versions || []" :key="version.id" :value="version.url">
              {{ version.label }}
            </option>
          </select>
          <button
            type="button"
            class="btn btn-sm btn-primary w-100"
            :disabled="!selectedVersion || isLoading"
            @click="emit('retrieve-version')"
          >
            Retrieve
          </button>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.document-card {
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.document-card-active {
  border-color: var(--bs-primary);
  box-shadow: 0 0 0 0.2rem rgba(var(--bs-primary-rgb), 0.15);
}

.history-popover {
  position: absolute;
  top: calc(100% + 0.4rem);
  right: 0;
  z-index: 20;
  width: 260px;
  padding: 0.75rem;
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
  background-color: var(--bs-body-bg);
}
</style>
