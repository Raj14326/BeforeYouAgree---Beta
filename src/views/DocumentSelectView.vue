<script setup lang="ts">
/**
 * DocumentSelectView.vue: step 2 of the flow, at `/service/:servicePath`.
 * A brand banner for the chosen service, then one card per document type
 * (Terms, Privacy, …); choosing one opens it in ReviewView. Nothing is
 * retrieved or analysed here — that only happens for the document the user
 * actually opens.
 *
 * The service comes from the route, so a refresh or shared link reloads it;
 * the session cache means coming back here from Review doesn't refetch.
 */
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BrandAvatar from '@/components/BrandAvatar.vue'
import FlowBar from '@/components/FlowBar.vue'
import { useDocumentSession } from '@/composables/useDocumentSession'
import { useTheme } from '@/composables/useTheme'
import { reviewRoute } from '@/lib/flow-routes'

const route = useRoute()
const router = useRouter()
const { theme, toggleTheme } = useTheme()
const {
  selectedService,
  isServiceLoading,
  serviceError,
  termEntries,
  analyses,
  analysisErrors,
  retrievalErrors,
  isInitialLoading,
  analysingTerm,
  loadService,
  documentLabel,
} = useDocumentSession()

const servicePath = computed(() => String(route.params.servicePath))
const hintedName = computed(() => (typeof route.query.name === 'string' ? route.query.name : servicePath.value))
const availableCount = computed(() => termEntries.value.filter(([, term]) => term.available).length)

watch(
  servicePath,
  (path) => {
    void loadService({ path, name: hintedName.value })
  },
  { immediate: true },
)

function openDocument(termType: string) {
  void router.push(reviewRoute(servicePath.value, termType, selectedService.value?.name))
}

/** Format an ISO timestamp for display in en-AU, or a fallback phrase when null. */
function formattedUpdatedAt(value: string | null) {
  if (!value) return 'Last updated date unknown'
  const date = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' }).format(new Date(value))
  return `Updated ${date}`
}
</script>

<template>
  <AppHeader :theme="theme" @toggle-theme="toggleTheme" />
  <FlowBar />

  <main class="container app-shell my-4 my-md-5">
    <div v-if="serviceError" class="alert alert-warning" role="alert">
      {{ serviceError }} Try searching for it again above.
    </div>

    <div v-else-if="isServiceLoading || !selectedService" class="service-banner card border-0 shadow-sm mb-4" role="status">
      <div class="card-body p-4 d-flex align-items-center gap-3">
        <span class="spinner-border text-primary" aria-hidden="true"></span>
        <span>Loading {{ hintedName }}'s documents…</span>
      </div>
    </div>

    <template v-else>
      <section class="service-banner card border-0 shadow-sm mb-4">
        <div class="card-body p-4 p-md-5 d-flex flex-wrap align-items-center gap-3 gap-md-4">
          <BrandAvatar :service-name="selectedService.name" size="xl" />
          <div class="flex-grow-1">
            <p class="eyebrow mb-1">STEP 2 · CHOOSE A DOCUMENT</p>
            <h1 class="h2 fw-bold mb-1">{{ selectedService.name }}</h1>
            <p class="text-body-secondary mb-0">
              {{ availableCount }} of {{ termEntries.length }}
              {{ termEntries.length === 1 ? 'document' : 'documents' }} available to review.
              Pick the one you're about to agree to.
            </p>
          </div>
        </div>
      </section>

      <div v-if="!termEntries.length" class="alert alert-light border" role="status">
        ToS;DR doesn't have any documents archived for {{ selectedService.name }} yet.
      </div>

      <ul v-else class="document-choices list-unstyled mb-0">
        <li v-for="[termType, term] in termEntries" :key="termType">
          <button
            type="button"
            class="document-choice card shadow-sm w-100 text-start"
            :disabled="!term.available"
            @click="openDocument(termType)"
          >
            <span class="card-body d-flex align-items-center gap-3 w-100">
              <span class="document-choice-icon" aria-hidden="true">
                <i class="bi" :class="term.available ? 'bi-file-earmark-text' : 'bi-file-earmark-x'"></i>
              </span>
              <span class="flex-grow-1 min-w-0">
                <span class="d-block fw-semibold">{{ documentLabel(termType) }}</span>
                <span class="d-block small text-body-secondary">
                  <template v-if="!term.available">Not archived, so it can't be reviewed</template>
                  <template v-else>{{ formattedUpdatedAt(term.updatedAt) }}</template>
                </span>
              </span>
              <span v-if="isInitialLoading(termType) || analysingTerm[termType]" class="small text-primary">
                <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Analysing…
              </span>
              <span v-else-if="analyses[termType]" class="badge text-bg-success-subtle text-success-emphasis">
                <i class="bi bi-check-lg me-1" aria-hidden="true"></i>Analysed
              </span>
              <span
                v-else-if="analysisErrors[termType] || retrievalErrors[termType]"
                class="badge text-bg-warning-subtle text-warning-emphasis"
              >
                Couldn't load
              </span>
              <span v-if="term.available" class="document-choice-cta">
                Review <i class="bi bi-arrow-right ms-1" aria-hidden="true"></i>
              </span>
            </span>
          </button>
        </li>
      </ul>
    </template>
  </main>
</template>

<style scoped>
.eyebrow {
  color: var(--bs-link-color);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.service-banner {
  border-radius: var(--bs-border-radius-xl);
  background: linear-gradient(135deg, rgba(var(--bs-primary-rgb), 0.12), rgba(var(--bs-primary-rgb), 0.02));
}

.document-choices {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.document-choice {
  padding: 0;
  color: inherit;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.document-choice:not(:disabled):hover,
.document-choice:not(:disabled):focus-visible {
  border-color: var(--bs-primary);
  box-shadow: 0 0 0 0.2rem rgba(var(--bs-primary-rgb), 0.15) !important;
  transform: translateY(-1px);
}

.document-choice:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.document-choice-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.6rem;
  background: rgba(var(--bs-primary-rgb), 0.1);
  color: var(--bs-link-color);
  font-size: 1.2rem;
}

.document-choice-cta {
  flex: none;
  color: var(--bs-link-color);
  font-weight: 600;
  font-size: 0.9rem;
}

.min-w-0 {
  min-width: 0;
}

@media (prefers-reduced-motion: reduce) {
  .document-choice:not(:disabled):hover,
  .document-choice:not(:disabled):focus-visible {
    transform: none;
  }
}
</style>
