<script setup lang="ts">
/**
 * AppView.vue: the "Before You Agree" tool — search, retrieve, and analyse.
 *
 * Search for a service, then click a document card to retrieve and analyse
 * that one document (nothing is fetched for the others until clicked); read
 * the flagged clauses for whichever document is currently active, in
 * context against the original text.
 *
 * It talks only to the backend API (see `server/index.ts`); `VITE_API_URL` sets
 * the base URL (empty in dev, where Vite proxies `/api`). When the catalogue
 * endpoint is unreachable the UI falls back to {@link FALLBACK_SERVICES} so the
 * page is still usable.
 *
 * Layout: a header (brand + quick guide + theme toggle), then a two-column
 * grid — the risk-preference sidebar (chunk 5, placeholder) on the left, and
 * on the right: the search bar (1), one card per document type (2), the
 * active document's clauses (3), and its original text (4).
 */

import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import SearchBar from '@/components/SearchBar.vue'
import DocumentUploadPanel from '@/components/DocumentUploadPanel.vue'
import ServiceDocumentCard from '@/components/ServiceDocumentCard.vue'
import ClausesPanel from '@/components/ClausesPanel.vue'
import OriginalDocumentPanel from '@/components/OriginalDocumentPanel.vue'
import RiskPreferenceSidebar from '@/components/RiskPreferenceSidebar.vue'
import { pendingReopen, useCompareList } from '@/composables/useCompareList'
import { useRiskPreferences } from '@/composables/useRiskPreferences'
import { apiUrl } from '@/lib/api'
import { fetchAnalysis, fetchRetrieval } from '@/lib/document-fetch'
import { buildDocumentViewHtml, clauseId } from '@/lib/document-view'
import type { Analysis, Declaration, Retrieval, RiskFinding, Service, Term, VersionOption } from '@/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Offline service list used when `GET /api/services` fails on load. */
const FALLBACK_SERVICES: Service[] = [
  'Amazon',
  'Apple',
  'Discord',
  'Dropbox',
  'Facebook',
  'GitHub',
  'Google',
  'Instagram',
  'LinkedIn',
  'Microsoft',
  'Netflix',
  'PayPal',
  'Reddit',
  'Spotify',
  'TikTok',
  'Twitch',
  'Uber',
  'WhatsApp',
  'X',
  'YouTube',
].map((name) => ({ name, path: `declarations/${name}.json` }))

// ---------------------------------------------------------------------------
// Reactive state
//    Per-document maps below are keyed by term type ("terms", "privacy", …) so
//    several documents can be retrieved and analysed independently at once.
// ---------------------------------------------------------------------------

const route = useRoute()
const { enabledCategoryIds, categoryPriority, riskPreferencesEnabled } = useRiskPreferences()
const compareList = useCompareList()

const services = ref<Service[]>([])
const selectedService = ref<Declaration | null>(null)
/** `Service.path` for the currently selected catalogue service; `selectedService` itself drops it after load. Needed to rebuild a CompareSourceRef. */
const currentServicePath = ref<string | null>(null)
const isCatalogueLoading = ref(true)
const isServiceLoading = ref(false)
const catalogueIsFallback = ref(false)
const retrievingTerm = ref<Record<string, boolean>>({})
const analysingTerm = ref<Record<string, boolean>>({})
const retrievals = ref<Record<string, Retrieval>>({})
const retrievalErrors = ref<Record<string, string>>({})
const analyses = ref<Record<string, Analysis>>({})
const findingFilters = ref<Record<string, RiskFinding['predictedLabel']>>({})
const analysisErrors = ref<Record<string, string>>({})
/** The single document card currently expanded to show its analysis. */
const activeTerm = ref<string | null>(null)
const originalDocOpen = ref(false)
const theme = ref<'light' | 'dark'>(
  document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light',
)
const openHistoryTerm = ref<string | null>(null)
const versions = ref<Record<string, VersionOption[]>>({})
const selectedVersions = ref<Record<string, string>>({})
/** `null` = latest; a URL = which archived version is currently loaded for that term. Set by autoLoadAndAnalyse. */
const loadedVersionUrl = ref<Record<string, string | null>>({})
/**
 * Which "Add to compare" buttons have already been clicked for their
 * current content, for button feedback. This is separate from
 * compareList's own dedup (which only has a stable identity for catalogue
 * documents) so an upload — which the store always lets through as a new
 * entry — still gets "Added to compare" feedback instead of silently doing
 * nothing on repeat clicks.
 */
const addedTermTypes = ref<Set<string>>(new Set())
/** Same idea as {@link addedTermTypes}, keyed by `${termType}:${versionUrl}` for the History popover's own button. */
const addedVersionKeys = ref<Set<string>>(new Set())
const loadingHistoryTerm = ref<string | null>(null)
const error = ref('')
const resultsSection = ref<HTMLElement | null>(null)
/** Whether the search card or the upload-your-own card is shown. */
const searchMode = ref<'catalogue' | 'upload'>('catalogue')

/** Single term key used for an uploaded/pasted document (it has no other term types). */
const UPLOAD_TERM_TYPE = 'document'

// ---------------------------------------------------------------------------
// Computed
// ---------------------------------------------------------------------------

/** `[termType, Term]` pairs for the selected service, in API order. */
const termEntries = computed(
  () => Object.entries(selectedService.value?.terms ?? {}) as Array<[string, Term]>,
)

function documentHtml(termType: string) {
  return buildDocumentViewHtml(
    retrievals.value[termType]?.content ?? '',
    analyses.value[termType],
    termType,
    retrievals.value[termType]?.contexts,
  )
}

function originalDocumentId(termType: string) {
  return `original-document-view-${termType.replace(/[^a-z0-9_-]/gi, '-')}`
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(async () => {
  await loadCatalogue()
  await hydrateFromCompareReopen()
})

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/** Load the full service catalogue once on mount; on failure use {@link FALLBACK_SERVICES}. */
async function loadCatalogue() {
  try {
    const response = await fetch(apiUrl('/api/services'))
    if (!response.ok) throw new Error('Catalogue unavailable')
    const payload = (await response.json()) as { data: Array<{ id: string; name: string }> }
    services.value = payload.data.map((service) => ({ ...service, path: service.id }))
    if (!services.value.length) throw new Error('No services found')
  } catch {
    services.value = FALLBACK_SERVICES
    catalogueIsFallback.value = true
  } finally {
    isCatalogueLoading.value = false
  }
}

/**
 * Load one service's declaration and show its document cards. Resets every
 * per-document map (retrievals, analyses, history, …) so nothing leaks from
 * the previously viewed service, then auto-retrieves and auto-analyses every
 * available document in the background.
 */
async function selectService(service: Service) {
  isServiceLoading.value = true
  selectedService.value = null
  currentServicePath.value = service.path
  retrievals.value = {}
  retrievalErrors.value = {}
  analyses.value = {}
  findingFilters.value = {}
  analysisErrors.value = {}
  retrievingTerm.value = {}
  analysingTerm.value = {}
  openHistoryTerm.value = null
  versions.value = {}
  selectedVersions.value = {}
  loadedVersionUrl.value = {}
  addedTermTypes.value = new Set()
  addedVersionKeys.value = new Set()
  activeTerm.value = null
  originalDocOpen.value = false
  error.value = ''

  try {
    const response = await fetch(apiUrl(`/api/service/${encodeURIComponent(service.path)}`))
    if (!response.ok) throw new Error('Declaration unavailable')
    const payload = (await response.json()) as {
      name: string
      terms: Array<{ type: string } & Term>
    }
    selectedService.value = {
      name: payload.name,
      terms: Object.fromEntries(payload.terms.map(({ type, ...term }) => [type, term])),
    }
    // Nothing is retrieved or analysed yet — that happens per document, on
    // first click (see activateAndLoad), so selecting a service doesn't
    // fan out an API call per document type.
    isServiceLoading.value = false
    await nextTick()
    resultsSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch {
    error.value = `We could not retrieve ${service.name} from ToS;DR right now.`
    isServiceLoading.value = false
  }
}

/**
 * Handle a user-supplied document (pasted or extracted from an uploaded
 * file, see DocumentUploadPanel). Builds a synthetic single-term
 * declaration whose content is already in hand — skipping `retrieveTerm` —
 * then runs it through the same `analyseTerm` as a catalogue document.
 */
async function handleUpload({ name, content }: { name: string; content: string }) {
  selectedService.value = null
  currentServicePath.value = null
  retrievals.value = {}
  retrievalErrors.value = {}
  analyses.value = {}
  findingFilters.value = {}
  analysisErrors.value = {}
  retrievingTerm.value = {}
  analysingTerm.value = {}
  openHistoryTerm.value = null
  versions.value = {}
  selectedVersions.value = {}
  loadedVersionUrl.value = {}
  addedTermTypes.value = new Set()
  addedVersionKeys.value = new Set()
  activeTerm.value = null
  originalDocOpen.value = false
  error.value = ''

  selectedService.value = {
    name,
    terms: {
      [UPLOAD_TERM_TYPE]: {
        sourceUrl: null,
        available: true,
        latestUrl: null,
        updatedAt: null,
        historyAvailable: false,
        historyUrl: null,
      },
    },
  }
  retrievals.value[UPLOAD_TERM_TYPE] = {
    format: 'plain_text',
    id: 'uploaded',
    serviceId: 'uploaded',
    termType: UPLOAD_TERM_TYPE,
    sourceUrl: null,
    fetchDate: new Date().toISOString(),
    characterCount: content.length,
    content,
    repository: '',
    repositoryUrl: '',
  }
  activeTerm.value = UPLOAD_TERM_TYPE

  await nextTick()
  resultsSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  await analyseTerm(UPLOAD_TERM_TYPE)
}

/**
 * Fetch a document's plain text. Pass `versionUrl` to load a specific
 * archived version; otherwise the term's `latestUrl` is used. Clears any
 * prior analysis for this term so the viewer starts from raw text.
 */
async function retrieveTerm(termType: string, versionUrl?: string) {
  if (!selectedService.value) return
  retrievingTerm.value[termType] = true
  retrievalErrors.value[termType] = ''
  try {
    const term = selectedService.value.terms[termType]
    if (!term?.latestUrl) throw new Error('No archived version is available for this document.')
    retrievals.value[termType] = await fetchRetrieval(versionUrl || term.latestUrl)
    delete analyses.value[termType]
    delete findingFilters.value[termType]
    analysisErrors.value[termType] = ''
    if (activeTerm.value === termType) originalDocOpen.value = false
  } catch (cause) {
    retrievalErrors.value[termType] =
      cause instanceof Error ? cause.message : 'The document could not be retrieved.'
  } finally {
    retrievingTerm.value[termType] = false
  }
}

/**
 * Send the retrieved text to `POST /api/analyze`, store the findings, and
 * default the findings filter to "risky".
 */
async function analyseTerm(termType: string) {
  const retrieval = retrievals.value[termType]
  if (!retrieval || analysingTerm.value[termType]) return
  analysingTerm.value[termType] = true
  analysisErrors.value[termType] = ''
  try {
    analyses.value[termType] = await fetchAnalysis(
      retrieval.content,
      retrieval.contexts,
      selectedService.value?.name,
      termType,
    )
    findingFilters.value[termType] = 'risky'
  } catch (cause) {
    analysisErrors.value[termType] =
      cause instanceof Error ? cause.message : 'The document could not be analysed.'
  } finally {
    analysingTerm.value[termType] = false
  }
}

/** Retrieve a document (optionally a specific archived version) then immediately analyse it. */
async function autoLoadAndAnalyse(termType: string, versionUrl?: string) {
  await retrieveTerm(termType, versionUrl)
  loadedVersionUrl.value[termType] = versionUrl ?? null
  addedTermTypes.value.delete(termType)
  if (retrievals.value[termType]) await analyseTerm(termType)
}

// ---------------------------------------------------------------------------
// View helpers
// ---------------------------------------------------------------------------

/** True only for a document's very first automatic retrieve+analyse pass. */
function isInitialLoading(termType: string) {
  return (
    !retrievals.value[termType] &&
    Boolean(retrievingTerm.value[termType] || analysingTerm.value[termType])
  )
}

/**
 * Make a document card active (driving the clauses/original-text sections)
 * and, on its first click, retrieve and analyse it — API calls only happen
 * for documents the user actually opens, not for every document type as
 * soon as a service is selected.
 */
function activateAndLoad(termType: string) {
  const term = selectedService.value?.terms[termType]
  if (!term?.available) return

  if (activeTerm.value === termType) {
    activeTerm.value = null
    originalDocOpen.value = false
    return
  }

  activeTerm.value = termType
  originalDocOpen.value = false

  if (!retrievals.value[termType] && !retrievingTerm.value[termType] && !analysingTerm.value[termType]) {
    void autoLoadAndAnalyse(termType)
  }
}

/** Activate a document and open/close its full text from the document card. */
function toggleFullDocument(termType: string) {
  if (activeTerm.value !== termType) {
    activeTerm.value = termType
    originalDocOpen.value = true
    return
  }
  originalDocOpen.value = !originalDocOpen.value
}

/**
 * Expand the original-document panel and scroll to/flash the `<mark>` for a
 * clause in the active document; respects `prefers-reduced-motion`.
 */
async function showInText(finding: RiskFinding) {
  const termType = activeTerm.value
  if (!termType) return
  const index = analyses.value[termType]?.findings.indexOf(finding) ?? -1
  if (index < 0) return
  originalDocOpen.value = true
  await nextTick()
  const element = document.getElementById(clauseId(termType, index))
  if (!element) return
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
  element.classList.add('clause-mark-active')
  window.setTimeout(() => element.classList.remove('clause-mark-active'), 1600)
}

/** Flip light/dark, apply it via `data-bs-theme` on `<html>`, and persist to localStorage. */
function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-bs-theme', theme.value)
  try {
    localStorage.setItem('bya-theme', theme.value)
  } catch {
    // Storage can be unavailable (private mode); the toggle still applies this session.
  }
}

/**
 * Toggle the version-history popover for a term. On first open, fetch the
 * list of archived versions and preselect the newest; results are cached in
 * `versions` so reopening does not refetch.
 */
async function toggleHistory(termType: string) {
  if (openHistoryTerm.value === termType) {
    openHistoryTerm.value = null
    return
  }
  openHistoryTerm.value = termType
  const term = selectedService.value?.terms[termType]
  if (!term?.historyUrl || versions.value[termType]) return
  loadingHistoryTerm.value = termType
  retrievalErrors.value[termType] = ''
  try {
    const response = await fetch(apiUrl(term.historyUrl))
    const payload = (await response.json()) as { data?: VersionOption[]; error?: string }
    if (!response.ok) throw new Error(payload.error || 'Version history could not be retrieved.')
    versions.value[termType] = payload.data || []
    selectedVersions.value[termType] = versions.value[termType]?.[0]?.url || ''
  } catch (cause) {
    retrievalErrors.value[termType] =
      cause instanceof Error ? cause.message : 'Version history could not be retrieved.'
  } finally {
    loadingHistoryTerm.value = null
  }
}

/** Retrieve and re-analyse the archived version chosen in the history picker, then close it. */
async function retrieveSelectedVersion(termType: string) {
  const versionUrl = selectedVersions.value[termType]
  if (!versionUrl) return
  openHistoryTerm.value = null
  await autoLoadAndAnalyse(termType, versionUrl)
}

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

function compareDisplayName(termType: string, versionLabel?: string | null) {
  const typeLabel = termType === UPLOAD_TERM_TYPE ? 'Uploaded document' : termType.replace(/_/g, ' ')
  const capitalised = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)
  return versionLabel ? `${capitalised} (${versionLabel})` : capitalised
}

function catalogueSourceRef(termType: string, versionUrl?: string) {
  if (!currentServicePath.value || !selectedService.value) return null
  return {
    kind: 'catalogue' as const,
    servicePath: currentServicePath.value,
    serviceName: selectedService.value.name,
    termType,
    versionUrl,
  }
}

/** Add whatever's currently loaded for this card — the active version for a catalogue document, or the upload's own text. */
function addCurrentToCompare(termType: string) {
  const analysis = analyses.value[termType]
  const service = selectedService.value
  if (!analysis || !service) return

  if (termType === UPLOAD_TERM_TYPE) {
    const content = retrievals.value[termType]?.content
    if (content == null) return
    compareList.add({
      displayName: compareDisplayName(termType),
      serviceName: service.name,
      documentType: termType,
      analysis,
      sourceRef: { kind: 'upload', name: service.name, content },
    })
    addedTermTypes.value.add(termType)
    return
  }

  const versionUrl = loadedVersionUrl.value[termType] ?? undefined
  const sourceRef = catalogueSourceRef(termType, versionUrl)
  if (!sourceRef) return
  const versionLabel = versionUrl
    ? versions.value[termType]?.find((version) => version.url === versionUrl)?.label ?? null
    : null
  compareList.add({
    displayName: compareDisplayName(termType, versionLabel),
    serviceName: service.name,
    documentType: termType,
    analysis,
    sourceRef,
  })
  addedTermTypes.value.add(termType)
}

/** Add the archived version currently selected in the History popover, without disturbing the active document. */
async function addVersionToCompare(termType: string) {
  const versionUrl = selectedVersions.value[termType]
  const service = selectedService.value
  if (!versionUrl || !service) return
  const sourceRef = catalogueSourceRef(termType, versionUrl)
  if (!sourceRef) return
  try {
    const retrieval = await fetchRetrieval(versionUrl)
    const analysis = await fetchAnalysis(retrieval.content, retrieval.contexts, service.name, termType)
    const versionLabel = versions.value[termType]?.find((version) => version.url === versionUrl)?.label ?? null
    compareList.add({
      displayName: compareDisplayName(termType, versionLabel),
      serviceName: service.name,
      documentType: termType,
      analysis,
      sourceRef,
    })
    addedVersionKeys.value.add(`${termType}:${versionUrl}`)
  } catch (cause) {
    retrievalErrors.value[termType] =
      cause instanceof Error ? cause.message : 'That version could not be added to compare.'
  }
}

/** Whether the "Add to compare" button for this card's current content has already been clicked. */
function isCurrentCompared(termType: string) {
  return addedTermTypes.value.has(termType)
}

/** Whether the History popover's "Add this version" button for the selected version has already been clicked. */
function isSelectedVersionCompared(termType: string) {
  const versionUrl = selectedVersions.value[termType]
  if (!versionUrl) return false
  return addedVersionKeys.value.has(`${termType}:${versionUrl}`)
}

/**
 * Re-enter a document from a compare card's "See details". An uploaded
 * entry replays its already-in-hand text through handleUpload (no fetch);
 * a catalogue entry drives the existing select/activate/retrieve functions
 * from its route query, exactly like a normal user click-through.
 */
async function hydrateFromCompareReopen() {
  if (pendingReopen.value) {
    const upload = pendingReopen.value
    pendingReopen.value = null
    await handleUpload({ name: upload.name, content: upload.content })
    return
  }

  const { servicePath, termType, versionUrl, serviceName } = route.query
  if (typeof servicePath !== 'string' || typeof termType !== 'string') return
  const service: Service = services.value.find((candidate) => candidate.path === servicePath) ?? {
    name: typeof serviceName === 'string' ? serviceName : servicePath,
    path: servicePath,
  }
  await selectService(service)
  activateAndLoad(termType)
  if (typeof versionUrl === 'string' && versionUrl) {
    selectedVersions.value[termType] = versionUrl
    await retrieveSelectedVersion(termType)
  }
}
</script>

<!--
  Structure: header (brand + quick guide + Compare link + theme toggle) ·
  two-column layout — the risk-preference sidebar (chunk 5) on the left, and
  on the right: the search bar (1), one card per document type (2), the
  active document's clauses (3), and its original text (4).
-->
<template>
  <AppHeader :theme="theme" :compare-count="compareList.entries.value.length" @toggle-theme="toggleTheme" />

  <main class="container app-shell my-4 my-md-5">
    <div class="mb-4 mb-md-5">
      <h1 class="h2 fw-bold mb-2">Read what you're agreeing to</h1>
      <p class="text-body-secondary fs-5 mb-0">
        Find a digital service and review the terms and policies behind it.
      </p>
    </div>

    <div class="layout-grid">
      <RiskPreferenceSidebar
        v-model:enabled-category-ids="enabledCategoryIds"
        v-model:category-priority="categoryPriority"
        v-model:risk-preferences-enabled="riskPreferencesEnabled"
      />

      <div class="main-column">
        <div class="btn-group mb-3" role="group" aria-label="Choose how to find a document">
          <button
            type="button"
            class="btn"
            :class="searchMode === 'catalogue' ? 'btn-primary' : 'btn-outline-secondary'"
            @click="searchMode = 'catalogue'"
          >
            Search a service
          </button>
          <button
            type="button"
            class="btn"
            :class="searchMode === 'upload' ? 'btn-primary' : 'btn-outline-secondary'"
            @click="searchMode = 'upload'"
          >
            Upload your own
          </button>
        </div>

        <SearchBar
          v-if="searchMode === 'catalogue'"
          :services="services"
          :is-catalogue-loading="isCatalogueLoading"
          :is-service-loading="isServiceLoading"
          :catalogue-is-fallback="catalogueIsFallback"
          @select="selectService"
        />
        <DocumentUploadPanel v-else @submit="handleUpload" />

        <div v-if="error" class="alert alert-warning" role="alert">{{ error }}</div>

        <section v-if="selectedService" ref="resultsSection" class="document-cards">
          <ServiceDocumentCard
            v-for="[termType, term] in termEntries"
            :key="termType"
            :service-name="selectedService.name"
            :term-type="termType"
            :term="term"
            :retrieval="retrievals[termType]"
            :has-analysis="Boolean(analyses[termType])"
            :is-active="activeTerm === termType"
            :full-document-open="activeTerm === termType && originalDocOpen"
            :is-loading="isInitialLoading(termType)"
            :is-analysing="Boolean(analysingTerm[termType])"
            :retrieval-error="retrievalErrors[termType] || ''"
            :analysis-error="analysisErrors[termType] || ''"
            :history-open="openHistoryTerm === termType"
            :versions="versions[termType]"
            :selected-version="selectedVersions[termType] || ''"
            :loading-history="loadingHistoryTerm === termType"
            :is-compared="isCurrentCompared(termType)"
            :is-version-compared="isSelectedVersionCompared(termType)"
            @activate="activateAndLoad(termType)"
            @toggle-full-document="toggleFullDocument(termType)"
            @toggle-history="toggleHistory(termType)"
            @update:selected-version="selectedVersions[termType] = $event"
            @retrieve-version="retrieveSelectedVersion(termType)"
            @add-to-compare="addCurrentToCompare(termType)"
            @add-version-to-compare="addVersionToCompare(termType)"
          >
            <ClausesPanel
              :key="termType"
              :analysis="analyses[termType] ?? null"
              :filter="findingFilters[termType] || 'risky'"
              :enabled-category-ids="enabledCategoryIds"
              :category-priority="categoryPriority"
              :risk-preferences-enabled="riskPreferencesEnabled"
              @update:filter="findingFilters[termType] = $event"
              @show-in-text="showInText"
            />

            <OriginalDocumentPanel
              :html="documentHtml(termType)"
              :open="activeTerm === termType && originalDocOpen"
              :panel-id="originalDocumentId(termType)"
              :has-risky-findings="Boolean(analyses[termType]?.riskyClauseCount)"
            />
          </ServiceDocumentCard>
        </section>
      </div>
    </div>
  </main>
</template>
