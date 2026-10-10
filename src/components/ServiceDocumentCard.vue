<script setup lang="ts">
/**
 * ServiceDocumentCard.vue: the document under review in ReviewView — its
 * title, retrieval status and actions (add to compare, full document,
 * version history, take action) — with the analysis panels passed in through
 * the default slot below the toolbar.
 */
import type { Analysis, Retrieval, Term, VersionOption } from '@/types'
import ActionGuide from './ActionGuide.vue'
import BrandAvatar from './BrandAvatar.vue'

const {
  serviceName,
  termType,
  title,
  term,
  retrieval,
  analysis,
  fullDocumentOpen,
  isLoading,
  isAnalysing,
  retrievalError,
  analysisError,
  historyOpen,
  versions,
  selectedVersion,
  loadingHistory,
  isCompared,
  isVersionCompared,
} = defineProps<{
  serviceName: string
  termType: string
  /** Heading for the card, e.g. "Terms of service" or an upload's file name. */
  title: string
  term: Term
  retrieval: Retrieval | undefined
  analysis: Analysis | undefined
  fullDocumentOpen: boolean
  isLoading: boolean
  isAnalysing: boolean
  retrievalError: string
  analysisError: string
  historyOpen: boolean
  versions: VersionOption[] | undefined
  selectedVersion: string
  loadingHistory: boolean
  /** Whether the currently loaded version of this document is already in the compare list. */
  isCompared: boolean
  /** Whether the version selected in the History popover is already in the compare list. */
  isVersionCompared: boolean
}>()

const emit = defineEmits<{
  'toggle-full-document': []
  'toggle-history': []
  'update:selectedVersion': [value: string]
  'retrieve-version': []
  /** Add the loaded document to compare, or remove it if it's already there. */
  'toggle-compare': []
  /** Same, for the version selected in the History popover. */
  'toggle-version-compare': []
}>()

/** Format an ISO timestamp for display in en-AU, or a fallback phrase when null. */
function formattedUpdatedAt(value: string | null) {
  if (!value) return 'an unknown date'
  return new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
}

function originalDocumentId(value: string) {
  return `original-document-view-${value.replace(/[^a-z0-9_-]/gi, '-')}`
}
</script>

<template>
  <article class="card shadow-sm document-card">
    <div class="card-body d-flex flex-wrap align-items-center gap-3">
      <BrandAvatar :service-name="serviceName" size="lg" />

      <div class="flex-grow-1" style="min-width: 200px">
        <h2 class="h6 mb-1">{{ title }}</h2>

        <div v-if="!term.available" class="small text-body-secondary">Not archived</div>
        <div v-else-if="isLoading || isAnalysing" class="small text-primary" role="status" aria-live="polite">
          <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
          {{ isAnalysing ? 'Analysing document…' : 'Retrieving document…' }}
        </div>
        <div v-else class="d-flex flex-wrap align-items-center gap-2 small text-body-secondary">
          <span>{{ formattedUpdatedAt(term.updatedAt) }}</span>
          <template v-if="retrieval">
            <span aria-hidden="true">·</span>
            <span>{{ retrieval.characterCount.toLocaleString() }} characters</span>
          </template>
          <template v-if="term.sourceUrl">
            <span aria-hidden="true">·</span>
            <a :href="term.sourceUrl" target="_blank" rel="noreferrer">
              Source <i class="bi bi-box-arrow-up-right small"></i>
            </a>
          </template>
        </div>

        <div v-if="retrievalError" class="text-danger small mt-1">{{ retrievalError }}</div>
        <div v-if="analysisError" class="text-danger small mt-1">{{ analysisError }}</div>
      </div>

      <div class="d-flex flex-wrap justify-content-end align-items-center gap-2 position-relative">
        <button
          v-if="retrieval"
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :aria-expanded="fullDocumentOpen"
          :aria-controls="originalDocumentId(termType)"
          @click="emit('toggle-full-document')"
        >
          <i class="bi bi-file-text me-1" aria-hidden="true"></i>
          {{ fullDocumentOpen ? 'Hide full document' : 'Read full document' }}
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

        <!-- Next-step actions sit at the right end, compare last. -->
        <ActionGuide v-if="analysis" :analysis="analysis" :service-name="serviceName" />

        <button
          v-if="analysis"
          type="button"
          class="btn btn-sm compare-button"
          :class="isCompared ? 'compare-button--added' : 'btn-primary'"
          :aria-pressed="isCompared"
          :title="isCompared ? 'Click to remove from compare' : undefined"
          @click="emit('toggle-compare')"
        >
          <template v-if="isCompared">
            <!-- Hover/focus swaps "Added" for "Remove" so the click's effect is clear. -->
            <span class="compare-button-added-label">
              <i class="bi bi-check-circle-fill me-1" aria-hidden="true"></i>Added to compare
            </span>
            <span class="compare-button-remove-label" aria-hidden="true">
              <i class="bi bi-x-circle-fill me-1"></i>Remove from compare
            </span>
          </template>
          <template v-else>
            <i class="bi bi-plus-circle-fill me-1" aria-hidden="true"></i>Add to compare
          </template>
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
          <button
            type="button"
            class="btn btn-sm w-100 mt-2"
            :class="isVersionCompared ? 'btn-outline-danger' : 'btn-outline-secondary'"
            :disabled="!selectedVersion"
            @click="emit('toggle-version-compare')"
          >
            {{ isVersionCompared ? 'Remove this version from compare' : 'Add this version to compare' }}
          </button>
        </div>
      </div>
    </div>

    <div class="document-card-details">
      <slot></slot>
    </div>
  </article>
</template>

<style scoped>
.document-card-details {
  border-top: 1px solid var(--bs-border-color-translucent);
  border-radius: 0 0 var(--bs-card-border-radius) var(--bs-card-border-radius);
}

.document-card-details :deep(.clauses-panel) {
  border: 0;
  border-radius: 0;
  box-shadow: none !important;
}

.document-card-details :deep(.original-document-panel) {
  padding: 0 1rem 1rem;
}

.compare-button {
  font-weight: 600;
}

.compare-button.btn-primary {
  box-shadow: 0 0.25rem 0.75rem rgba(var(--bs-primary-rgb), 0.3);
}

/* Added state: calm success tint; hover/focus turns it into a remove action. */
.compare-button--added {
  display: inline-grid;
  border: 1px solid rgba(var(--bs-success-rgb), 0.5);
  background-color: rgba(var(--bs-success-rgb), 0.12);
  color: var(--bs-success-text-emphasis);
}

/* Both labels share one grid cell so the button keeps the wider label's width and doesn't jump on hover. */
.compare-button--added > span {
  grid-area: 1 / 1;
}

.compare-button-remove-label {
  visibility: hidden;
}

.compare-button--added:hover,
.compare-button--added:focus-visible {
  border-color: rgba(var(--bs-danger-rgb), 0.55);
  background-color: rgba(var(--bs-danger-rgb), 0.1);
  color: var(--bs-danger-text-emphasis);
}

.compare-button--added:hover .compare-button-added-label,
.compare-button--added:focus-visible .compare-button-added-label {
  visibility: hidden;
}

.compare-button--added:hover .compare-button-remove-label,
.compare-button--added:focus-visible .compare-button-remove-label {
  visibility: visible;
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
