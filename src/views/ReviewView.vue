<script setup lang="ts">
/**
 * ReviewView.vue: step 3 of the flow — the full analysis of one document:
 * nutrition card, flagged clauses, original text with highlights, version
 * history, add-to-compare, beside the risk-preference sidebar.
 *
 * Two routes land here:
 *  - `/service/:servicePath/:termType` (optional `?version=` for an archived
 *    version) — a catalogue document, loaded from the route so refreshes and
 *    shared links work; already-analysed documents come from the session
 *    cache without refetching.
 *  - `/review/upload` — the user's own pasted/uploaded document. Its text
 *    only lives in the session, so a cold load sends the user back to the
 *    landing page's upload form.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import ClausesPanel from '@/components/ClausesPanel.vue'
import FlowBar from '@/components/FlowBar.vue'
import OriginalDocumentPanel from '@/components/OriginalDocumentPanel.vue'
import RiskPreferenceSidebar from '@/components/RiskPreferenceSidebar.vue'
import ServiceDocumentCard from '@/components/ServiceDocumentCard.vue'
import { useDocumentSession } from '@/composables/useDocumentSession'
import { useRiskPreferences } from '@/composables/useRiskPreferences'
import { useTheme } from '@/composables/useTheme'
import { buildDocumentViewHtml, clauseId } from '@/lib/document-view'
import { reviewRoute, serviceRoute, startRoute } from '@/lib/flow-routes'
import type { RiskFinding } from '@/types'

const route = useRoute()
const router = useRouter()
const { theme, toggleTheme } = useTheme()
const { enabledCategoryIds, categoryPriority, riskPreferencesEnabled } = useRiskPreferences()
const session = useDocumentSession()
const {
  selectedService,
  isUpload,
  isServiceLoading,
  serviceError,
  retrievals,
  analyses,
  analysingTerm,
  retrievalErrors,
  analysisErrors,
  findingFilters,
  openHistoryTerm,
  versions,
  selectedVersions,
  loadingHistoryTerm,
  activeTerm,
} = session

const originalDocOpen = ref(false)
/** Set when the route names a document this service doesn't have (or hasn't archived). */
const documentMissing = ref(false)

const isUploadRoute = computed(() => route.name === 'review-upload')
const servicePath = computed(() => (isUploadRoute.value ? null : String(route.params.servicePath)))
const termType = computed(() => (isUploadRoute.value ? activeTerm.value : String(route.params.termType)))
const term = computed(() => (termType.value ? selectedService.value?.terms[termType.value] : undefined))
const analysis = computed(() => (termType.value ? analyses.value[termType.value] : undefined))

watch(
  () => [route.name, route.params.servicePath, route.params.termType, route.query.version],
  syncFromRoute,
  { immediate: true },
)

/** Load whatever the route names into the session (a no-op for anything already cached). */
async function syncFromRoute() {
  originalDocOpen.value = false
  documentMissing.value = false

  if (isUploadRoute.value) {
    if (!isUpload.value) void router.replace(startRoute('upload'))
    return
  }

  const path = String(route.params.servicePath)
  const requestedTerm = String(route.params.termType)
  const name = typeof route.query.name === 'string' ? route.query.name : path
  const version = typeof route.query.version === 'string' && route.query.version ? route.query.version : null
  await session.loadService({ path, name })
  // The route may have moved on while the service was loading.
  if (String(route.params.servicePath) !== path || String(route.params.termType) !== requestedTerm) return
  if (!selectedService.value) return
  documentMissing.value = !session.openDocument(requestedTerm, version)
}

const documentHtml = computed(() => {
  if (!termType.value) return ''
  return buildDocumentViewHtml(
    retrievals.value[termType.value]?.content ?? '',
    analyses.value[termType.value],
    termType.value,
    retrievals.value[termType.value]?.contexts,
  )
})

const originalDocumentId = computed(
  () => `original-document-view-${(termType.value ?? '').replace(/[^a-z0-9_-]/gi, '-')}`,
)

/** Load the archived version picked in the History popover by putting it in the URL (the route watcher does the rest). */
function retrieveSelectedVersion() {
  const type = termType.value
  const versionUrl = type ? selectedVersions.value[type] : ''
  if (!type || !versionUrl || !servicePath.value) return
  openHistoryTerm.value = null
  void router.push(reviewRoute(servicePath.value, type, selectedService.value?.name, versionUrl))
}

/**
 * Expand the original-document panel and scroll to/flash the `<mark>` for a
 * clause; respects `prefers-reduced-motion`.
 */
async function showInText(finding: RiskFinding) {
  const type = termType.value
  if (!type) return
  const index = analyses.value[type]?.findings.indexOf(finding) ?? -1
  if (index < 0) return
  originalDocOpen.value = true
  await nextTick()
  const element = document.getElementById(clauseId(type, index))
  if (!element) return
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
  element.classList.add('clause-mark-active')
  window.setTimeout(() => element.classList.remove('clause-mark-active'), 1600)
}
</script>

<template>
  <AppHeader :theme="theme" @toggle-theme="toggleTheme" />
  <FlowBar />

  <main class="container app-shell my-4 my-md-5">
    <div v-if="serviceError" class="alert alert-warning" role="alert">
      {{ serviceError }} Try searching for it again above.
    </div>

    <div v-else-if="isServiceLoading" class="d-flex align-items-center gap-2 text-body-secondary" role="status">
      <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Loading document…
    </div>

    <div v-else-if="documentMissing && selectedService && servicePath" class="alert alert-warning" role="alert">
      {{ selectedService.name }} doesn't have that document archived.
      <RouterLink :to="serviceRoute(servicePath, selectedService.name)">See its available documents</RouterLink>.
    </div>

    <template v-else-if="selectedService && termType && term">
      <div class="mb-4">
        <p class="eyebrow mb-1">STEP 3 · REVIEW</p>
        <h1 class="h2 fw-bold mb-0">
          {{ selectedService.name }}
          <span v-if="!isUpload" class="text-body-secondary fw-semibold">· {{ session.documentLabel(termType) }}</span>
        </h1>
      </div>

      <div class="layout-grid">
        <RiskPreferenceSidebar
          v-model:enabled-category-ids="enabledCategoryIds"
          v-model:category-priority="categoryPriority"
          v-model:risk-preferences-enabled="riskPreferencesEnabled"
        />

        <div class="main-column">
          <ServiceDocumentCard
            :service-name="selectedService.name"
            :term-type="termType"
            :title="isUpload ? 'Uploaded document' : session.documentLabel(termType)"
            :term="term"
            :retrieval="retrievals[termType]"
            :has-analysis="Boolean(analysis)"
            :full-document-open="originalDocOpen"
            :is-loading="session.isInitialLoading(termType)"
            :is-analysing="Boolean(analysingTerm[termType])"
            :retrieval-error="retrievalErrors[termType] || ''"
            :analysis-error="analysisErrors[termType] || ''"
            :history-open="openHistoryTerm === termType"
            :versions="versions[termType]"
            :selected-version="selectedVersions[termType] || ''"
            :loading-history="loadingHistoryTerm === termType"
            :is-compared="session.isCurrentCompared(termType)"
            :is-version-compared="session.isSelectedVersionCompared(termType)"
            @toggle-full-document="originalDocOpen = !originalDocOpen"
            @toggle-history="session.toggleHistory(termType)"
            @update:selected-version="selectedVersions[termType] = $event"
            @retrieve-version="retrieveSelectedVersion"
            @add-to-compare="session.addCurrentToCompare(termType)"
            @add-version-to-compare="session.addVersionToCompare(termType)"
          >
            <ClausesPanel
              v-if="analysis"
              :key="termType"
              :analysis="analysis"
              :filter="findingFilters[termType] || 'risky'"
              :enabled-category-ids="enabledCategoryIds"
              :category-priority="categoryPriority"
              :risk-preferences-enabled="riskPreferencesEnabled"
              @update:filter="findingFilters[termType] = $event"
              @show-in-text="showInText"
            />
            <div
              v-else-if="session.isInitialLoading(termType) || analysingTerm[termType]"
              class="review-placeholder d-flex align-items-center gap-2 text-body-secondary"
              role="status"
            >
              <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
              Analysing this document for risky clauses…
            </div>

            <OriginalDocumentPanel
              :html="documentHtml"
              :open="originalDocOpen"
              :panel-id="originalDocumentId"
              :has-risky-findings="Boolean(analysis?.riskyClauseCount)"
            />
          </ServiceDocumentCard>
        </div>
      </div>
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

.review-placeholder {
  padding: 1.25rem 1rem;
}
</style>
