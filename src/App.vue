<script setup lang="ts">
/**
 * App.vue: the main Before You Agree user interface.
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
import logoUrl from './assets/BYA_logo.png'
import QuickGuide from './components/QuickGuide.vue'
import SearchBar from './components/SearchBar.vue'
import ServiceDocumentCard from './components/ServiceDocumentCard.vue'
import ClausesPanel from './components/ClausesPanel.vue'
import OriginalDocumentPanel from './components/OriginalDocumentPanel.vue'
import RiskPreferenceSidebar from './components/RiskPreferenceSidebar.vue'
import { apiUrl } from '@/lib/api'
import { buildDocumentViewHtml, clauseId } from '@/lib/document-view'
import { ALL_CATEGORY_IDS } from '@/lib/risk-categories'
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

const services = ref<Service[]>([])
const selectedService = ref<Declaration | null>(null)
const isCatalogueLoading = ref(true)
const isServiceLoading = ref(false)
const catalogueIsFallback = ref(false)
const retrievingTerm = ref<Record<string, boolean>>({})
const analysingTerm = ref<Record<string, boolean>>({})
const retrievals = ref<Record<string, Retrieval>>({})
const retrievalErrors = ref<Record<string, string>>({})
const analyses = ref<Record<string, Analysis>>({})
const findingFilters = ref<Record<string, RiskFinding['predictedLabel']>>({})
/** Which risk categories currently pass the sidebar filter; starts with every category enabled. */
const enabledCategoryIds = ref<Set<string>>(new Set(ALL_CATEGORY_IDS))
/** Category order chosen in the sidebar; earlier categories sort their matching clauses first. */
const categoryPriority = ref<string[]>([...ALL_CATEGORY_IDS])
const analysisErrors = ref<Record<string, string>>({})
/** The document type whose clauses/original text are shown in chunks 3–4. */
const activeTerm = ref<string | null>(null)
const originalDocOpen = ref(false)
const theme = ref<'light' | 'dark'>(
  document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light',
)
const openHistoryTerm = ref<string | null>(null)
const versions = ref<Record<string, VersionOption[]>>({})
const selectedVersions = ref<Record<string, string>>({})
const loadingHistoryTerm = ref<string | null>(null)
const error = ref('')
const resultsSection = ref<HTMLElement | null>(null)

// ---------------------------------------------------------------------------
// Computed
// ---------------------------------------------------------------------------

/** `[termType, Term]` pairs for the selected service, in API order. */
const termEntries = computed(
  () => Object.entries(selectedService.value?.terms ?? {}) as Array<[string, Term]>,
)

const activeAnalysis = computed(() => (activeTerm.value ? analyses.value[activeTerm.value] : undefined))

const activeFilter = computed<RiskFinding['predictedLabel']>(
  () => (activeTerm.value && findingFilters.value[activeTerm.value]) || 'risky',
)

const activeDocumentHtml = computed(() => {
  if (!activeTerm.value) return ''
  return buildDocumentViewHtml(
    retrievals.value[activeTerm.value]?.content ?? '',
    analyses.value[activeTerm.value],
    activeTerm.value,
  )
})

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(loadCatalogue)

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
    const response = await fetch(apiUrl(versionUrl || term.latestUrl))
    const payload = (await response.json()) as Retrieval | { error: string }
    if (!response.ok) throw new Error('error' in payload ? payload.error : 'Retrieval failed')
    retrievals.value[termType] = payload as Retrieval
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
    const response = await fetch(apiUrl('/api/analyze'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: retrieval.content,
        serviceName: selectedService.value?.name,
        documentType: termType,
      }),
    })
    const payload = (await response.json()) as Analysis | { error?: string }
    if (!response.ok)
      throw new Error('error' in payload && payload.error ? payload.error : 'Analysis failed.')
    analyses.value[termType] = payload as Analysis
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

  if (activeTerm.value !== termType) {
    activeTerm.value = termType
    originalDocOpen.value = false
  }

  if (!retrievals.value[termType] && !retrievingTerm.value[termType] && !analysingTerm.value[termType]) {
    void autoLoadAndAnalyse(termType)
  }
}

function setActiveFilter(label: RiskFinding['predictedLabel']) {
  if (activeTerm.value) findingFilters.value[activeTerm.value] = label
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
</script>

<!--
  Structure: header (brand + quick guide + theme toggle) · two-column layout —
  the risk-preference sidebar (chunk 5) on the left, and on the right: the
  search bar (1), one card per document type (2), the active document's
  clauses (3), and its original text (4).
-->
<template>
  <header class="border-bottom bg-body sticky-top">
    <div class="container app-shell py-3 d-flex align-items-center flex-wrap gap-2">
      <a href="/" class="brand-lockup" aria-label="Before You Agree - home">
        <img :src="logoUrl" alt="" class="brand-logo" />
        <span class="brand-wordmark">Before You Agree</span>
      </a>
      <div class="ms-auto d-flex align-items-center gap-2">
        <QuickGuide />
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
          @click="toggleTheme"
        >
          <i class="bi" :class="theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-stars-fill'"></i>
        </button>
      </div>
    </div>
  </header>

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
      />

      <div class="main-column">
        <SearchBar
          :services="services"
          :is-catalogue-loading="isCatalogueLoading"
          :is-service-loading="isServiceLoading"
          :catalogue-is-fallback="catalogueIsFallback"
          @select="selectService"
        />

        <div v-if="error" class="alert alert-warning" role="alert">{{ error }}</div>

        <section v-if="selectedService" ref="resultsSection" class="document-cards">
          <ServiceDocumentCard
            v-for="[termType, term] in termEntries"
            :key="termType"
            :service-name="selectedService.name"
            :term-type="termType"
            :term="term"
            :retrieval="retrievals[termType]"
            :analysis="analyses[termType]"
            :is-active="activeTerm === termType"
            :is-loading="isInitialLoading(termType)"
            :is-analysing="Boolean(analysingTerm[termType])"
            :retrieval-error="retrievalErrors[termType] || ''"
            :analysis-error="analysisErrors[termType] || ''"
            :history-open="openHistoryTerm === termType"
            :versions="versions[termType]"
            :selected-version="selectedVersions[termType] || ''"
            :loading-history="loadingHistoryTerm === termType"
            @activate="activateAndLoad(termType)"
            @analyse-again="analyseTerm(termType)"
            @toggle-history="toggleHistory(termType)"
            @update:selected-version="selectedVersions[termType] = $event"
            @retrieve-version="retrieveSelectedVersion(termType)"
          />
        </section>

        <ClausesPanel
          v-if="activeTerm"
          :analysis="activeAnalysis ?? null"
          :filter="activeFilter"
          :enabled-category-ids="enabledCategoryIds"
          :category-priority="categoryPriority"
          @update:filter="setActiveFilter"
          @show-in-text="showInText"
        />

        <OriginalDocumentPanel
          :html="activeDocumentHtml"
          :open="originalDocOpen"
          :has-risky-findings="Boolean(activeAnalysis?.riskyClauseCount)"
          @toggle="originalDocOpen = !originalDocOpen"
        />
      </div>
    </div>
  </main>
</template>
