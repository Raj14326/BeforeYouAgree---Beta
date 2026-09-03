<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'

type Term = {
  sourceUrl: string | null
  available: boolean
  latestUrl: string | null
  updatedAt: string | null
  historyAvailable: boolean
  historyUrl: string | null
}
type Declaration = { name: string; terms: Record<string, Term> }
type Service = { name: string; path: string }
type VersionOption = { id: string; updatedAt: string | null; label: string; url: string }
type Retrieval = {
  format: 'plain_text'
  id: string
  serviceId: string
  termType: string
  sourceUrl: string | null
  fetchDate: string | null
  characterCount: number
  content: string
  repository: string
  repositoryUrl: string
}
type RiskFinding = {
  text: string
  riskProbability: number
  predictedLabel: 'risky' | 'not_risky'
}
type Analysis = {
  model: string
  threshold: number
  clauseCount: number
  riskyClauseCount: number
  overallRiskScore: number
  findings: RiskFinding[]
}

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

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

function apiUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

const query = ref('')
const services = ref<Service[]>([])
const selectedService = ref<Declaration | null>(null)
const isCatalogueLoading = ref(true)
const isServiceLoading = ref(false)
const catalogueIsFallback = ref(false)
const retrievingTerm = ref<string | null>(null)
const retrievals = ref<Record<string, Retrieval>>({})
const retrievalErrors = ref<Record<string, string>>({})
const analyses = ref<Record<string, Analysis>>({})
const findingFilters = ref<Record<string, RiskFinding['predictedLabel']>>({})
const analysisErrors = ref<Record<string, string>>({})
const analysingTerm = ref<string | null>(null)
const documentViews = ref<Record<string, string>>({})
const theme = ref<'light' | 'dark'>(
  document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light',
)
const openHistoryTerm = ref<string | null>(null)
const versions = ref<Record<string, VersionOption[]>>({})
const selectedVersions = ref<Record<string, string>>({})
const loadingHistoryTerm = ref<string | null>(null)
const error = ref('')
const isOpen = ref(false)
const activeIndex = ref(-1)
const resultsSection = ref<HTMLElement | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | undefined

const suggestions = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return services.value.slice(0, 10)
  return services.value
    .filter((service) => service.name.toLowerCase().includes(needle))
    .slice(0, 10)
})

const termEntries = computed(
  () => Object.entries(selectedService.value?.terms ?? {}) as Array<[string, Term]>,
)

onMounted(loadCatalogue)

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

function handleInput() {
  isOpen.value = true
  activeIndex.value = -1
  selectedService.value = null
  error.value = ''
  clearTimeout(searchTimer)
  const needle = query.value.trim()
  if (needle.length < 2) return
  searchTimer = setTimeout(() => searchServices(needle), 250)
}

function handleKeydown(event: KeyboardEvent) {
  if (!isOpen.value || !suggestions.value.length) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, suggestions.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (event.key === 'Enter' && activeIndex.value >= 0) {
    event.preventDefault()
    const service = suggestions.value[activeIndex.value]
    if (service) selectService(service)
  } else if (event.key === 'Escape') {
    isOpen.value = false
  }
}

async function searchServices(needle: string) {
  try {
    const response = await fetch(
      apiUrl(`/api/services?search=${encodeURIComponent(needle)}&limit=100`),
    )
    if (!response.ok) return
    const payload = (await response.json()) as { data: Array<{ id: string; name: string }> }
    if (query.value.trim() === needle) {
      services.value = payload.data.map((service) => ({ name: service.name, path: service.id }))
      catalogueIsFallback.value = false
    }
  } catch {
    // Keep the last successful catalogue while upstream search is unavailable.
  }
}

async function submitSearch() {
  const exact = services.value.find(
    (service) => service.name.toLowerCase() === query.value.trim().toLowerCase(),
  )
  const service = exact ?? suggestions.value[0]
  if (service) await selectService(service)
  else error.value = 'No matching service is currently available from ToS;DR.'
}

async function selectService(service: Service) {
  query.value = service.name
  isOpen.value = false
  activeIndex.value = -1
  isServiceLoading.value = true
  selectedService.value = null
  retrievals.value = {}
  retrievalErrors.value = {}
  analyses.value = {}
  documentViews.value = {}
  findingFilters.value = {}
  analysisErrors.value = {}
  openHistoryTerm.value = null
  versions.value = {}
  selectedVersions.value = {}
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
    await nextTick()
    resultsSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch {
    error.value = `We could not retrieve ${service.name} from ToS;DR right now.`
  } finally {
    isServiceLoading.value = false
  }
}

async function retrieveTerm(termType: string, versionUrl?: string) {
  if (!selectedService.value || retrievingTerm.value) return
  retrievingTerm.value = termType
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
    renderDocumentView(termType)
  } catch (cause) {
    retrievalErrors.value[termType] =
      cause instanceof Error ? cause.message : 'The document could not be retrieved.'
  } finally {
    retrievingTerm.value = null
  }
}

async function analyseTerm(termType: string) {
  const retrieval = retrievals.value[termType]
  if (!retrieval || analysingTerm.value) return
  analysingTerm.value = termType
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
    renderDocumentView(termType)
  } catch (cause) {
    analysisErrors.value[termType] =
      cause instanceof Error ? cause.message : 'The document could not be analysed.'
  } finally {
    analysingTerm.value = null
  }
}

function visibleFindings(termType: string) {
  const filter = findingFilters.value[termType] ?? 'risky'
  return (
    analyses.value[termType]?.findings.filter((finding) => finding.predictedLabel === filter) ?? []
  )
}

function labelCount(termType: string, label: RiskFinding['predictedLabel']) {
  return (
    analyses.value[termType]?.findings.filter((finding) => finding.predictedLabel === label)
      .length ?? 0
  )
}

function confidencePercent(finding: RiskFinding) {
  const probability =
    finding.predictedLabel === 'risky' ? finding.riskProbability : 1 - finding.riskProbability
  return Math.round(probability * 100)
}

function flaggedShare(termType: string) {
  const analysis = analyses.value[termType]
  if (!analysis?.clauseCount) return 0
  return Math.round((analysis.riskyClauseCount / analysis.clauseCount) * 100)
}

function severityClass(termType: string) {
  const share = flaggedShare(termType)
  if (share >= 25) return 'bg-danger'
  if (share >= 10) return 'bg-warning'
  return 'bg-success'
}

function avgConfidence(termType: string) {
  return Math.round(analyses.value[termType]?.overallRiskScore ?? 0)
}

function clauseId(termType: string, index: number) {
  return `clause-${termType.replace(/[^a-z0-9]+/gi, '-')}-${index}`
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"]/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character] as string,
  )
}

// wrapping each risky clause in a <mark> so findings can be seen in context 
// and jumped to. Called after retrieval and analysis
// rather than per-render because the source text can be very large.
function renderDocumentView(termType: string) {
  const content = retrievals.value[termType]?.content ?? ''
  if (!content) {
    delete documentViews.value[termType]
    return
  }
  const analysis = analyses.value[termType]
  if (!analysis) {
    documentViews.value[termType] = escapeHtml(content)
    return
  }

  const marks = analysis.findings
    .map((finding, index) => ({
      index,
      start: finding.predictedLabel === 'risky' ? content.indexOf(finding.text) : -1,
      end: 0,
      length: finding.text.length,
    }))
    .filter((mark) => mark.start >= 0)
    .sort((a, b) => a.start - b.start)

  let cursor = 0
  let html = ''
  for (const mark of marks) {
    if (mark.start < cursor) continue // overlapping clause already covered
    const end = mark.start + mark.length
    html += escapeHtml(content.slice(cursor, mark.start))
    html += `<mark id="${clauseId(termType, mark.index)}" class="clause-mark">${escapeHtml(
      content.slice(mark.start, end),
    )}</mark>`
    cursor = end
  }
  html += escapeHtml(content.slice(cursor))
  documentViews.value[termType] = html
}

function scrollToClause(termType: string, finding: RiskFinding) {
  const index = analyses.value[termType]?.findings.indexOf(finding) ?? -1
  if (index < 0) return
  const element = document.getElementById(clauseId(termType, index))
  if (!element) return
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
  element.classList.add('clause-mark-active')
  window.setTimeout(() => element.classList.remove('clause-mark-active'), 1600)
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-bs-theme', theme.value)
  try {
    localStorage.setItem('bya-theme', theme.value)
  } catch {
    // Storage can be unavailable (private mode); the toggle still applies this session.
  }
}

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

async function retrieveSelectedVersion(termType: string) {
  const versionUrl = selectedVersions.value[termType]
  if (!versionUrl) return
  await retrieveTerm(termType, versionUrl)
  openHistoryTerm.value = null
}

function formattedUpdatedAt(value: string | null) {
  if (!value) return 'an unknown date'
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
</script>

<template>
  <header class="border-bottom bg-body">
    <div class="container app-shell py-3 d-flex align-items-center gap-2">
      <i class="bi bi-shield-check fs-4 text-primary"></i>
      <span class="fw-semibold">Before You Agree</span>
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary ms-auto"
        :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
        @click="toggleTheme"
      >
        <i class="bi" :class="theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-stars-fill'"></i>
      </button>
    </div>
  </header>

  <main class="container app-shell my-4 my-md-5">
    <div class="mb-4">
      <h1 class="h3 fw-bold">Read what you're agreeing to</h1>
      <p class="text-body-secondary mb-0">
        Find a digital service and review the terms and policies behind it.
      </p>
    </div>

    <form class="card card-body shadow-sm mb-4" @submit.prevent="submitSearch">
      <label for="service" class="form-label fw-medium">Service</label>
      <div class="row g-2">
        <div class="col position-relative">
          <div class="input-group input-group-lg">
            <span class="input-group-text"><i class="bi bi-search"></i></span>
            <input
              id="service"
              v-model="query"
              class="form-control"
              type="text"
              autocomplete="off"
              placeholder="e.g. Google, Spotify, Discord"
              @input="handleInput"
              @focus="isOpen = true"
              @blur="isOpen = false"
              @keydown="handleKeydown"
            />
          </div>
          <ul
            v-if="isOpen && suggestions.length"
            class="list-group position-absolute w-100 mt-1 shadow"
            style="z-index: 1000; max-height: 260px; overflow-y: auto"
          >
            <li
              v-for="(service, index) in suggestions"
              :key="service.path"
              class="list-group-item list-group-item-action d-flex align-items-center gap-2"
              :class="{ active: index === activeIndex }"
              style="cursor: pointer"
              @mousedown.prevent="selectService(service)"
            >
              <i class="bi bi-file-earmark-text text-body-secondary"></i>
              {{ service.name }}
            </li>
          </ul>
        </div>
        <div class="col-auto">
          <button
            type="submit"
            class="btn btn-primary btn-lg"
            :disabled="isCatalogueLoading || isServiceLoading"
          >
            <span v-if="isServiceLoading" class="spinner-border spinner-border-sm me-1"></span>
            {{ isServiceLoading ? 'Retrieving…' : 'Review terms' }}
          </button>
        </div>
      </div>

      <p class="form-text mb-0 mt-2">
        <span v-if="isCatalogueLoading">
          <span class="spinner-border spinner-border-sm"></span> Loading service list…
        </span>
        <span v-else>
          {{ services.length }} services from ToS;DR
          <span v-if="catalogueIsFallback" class="badge text-bg-secondary ms-1">offline list</span>
        </span>
      </p>
    </form>

    <div v-if="error" class="alert alert-warning" role="alert">{{ error }}</div>

    <section v-if="selectedService" ref="resultsSection" class="card shadow-sm">
      <div class="card-header bg-body d-flex align-items-center justify-content-between">
        <h2 class="h5 mb-0">{{ selectedService.name }}</h2>
        <span class="badge rounded-pill text-bg-light"> {{ termEntries.length }} documents </span>
      </div>

      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th>Document</th>
              <th>Last updated</th>
              <th class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="[termType, term] in termEntries" :key="termType">
              <tr>
                <td class="fw-medium text-capitalize">{{ termType.replace(/_/g, ' ') }}</td>
                <td class="text-body-secondary">
                  <span v-if="term.available">{{ formattedUpdatedAt(term.updatedAt) }}</span>
                  <span v-else class="badge text-bg-light">Not archived</span>
                </td>
                <td class="text-end text-nowrap">
                  <button
                    type="button"
                    class="btn btn-sm btn-primary"
                    :disabled="Boolean(retrievingTerm) || !term.available"
                    @click="retrieveTerm(termType)"
                  >
                    <span
                      v-if="retrievingTerm === termType"
                      class="spinner-border spinner-border-sm"
                    ></span>
                    <template v-else>{{
                      retrievals[termType] ? 'Refresh' : 'Retrieve text'
                    }}</template>
                  </button>

                  <button
                    v-if="term.historyAvailable"
                    type="button"
                    class="btn btn-sm btn-outline-secondary ms-1"
                    @click="toggleHistory(termType)"
                  >
                    <i class="bi bi-clock-history"></i>
                  </button>

                  <a
                    v-if="term.sourceUrl"
                    :href="term.sourceUrl"
                    target="_blank"
                    rel="noreferrer"
                    class="btn btn-sm btn-link"
                  >
                    Source <i class="bi bi-box-arrow-up-right small"></i>
                  </a>
                </td>
              </tr>

              <tr v-if="openHistoryTerm === termType" class="table-active">
                <td colspan="3">
                  <div class="d-flex flex-wrap align-items-end gap-2">
                    <div>
                      <label class="form-label mb-1">Older versions</label>
                      <select
                        v-model="selectedVersions[termType]"
                        class="form-select form-select-sm"
                        style="min-width: 260px"
                        :disabled="loadingHistoryTerm === termType"
                      >
                        <option value="" disabled>
                          {{ loadingHistoryTerm === termType ? 'Loading dates…' : 'Select a date' }}
                        </option>
                        <option
                          v-for="version in versions[termType] || []"
                          :key="version.id"
                          :value="version.url"
                        >
                          {{ version.label }}
                        </option>
                      </select>
                    </div>
                    <button
                      type="button"
                      class="btn btn-sm btn-primary"
                      :disabled="!selectedVersions[termType] || Boolean(retrievingTerm)"
                      @click="retrieveSelectedVersion(termType)"
                    >
                      Retrieve
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="retrievalErrors[termType]">
                <td colspan="3">
                  <div
                    class="alert alert-danger d-flex align-items-center gap-2 mb-0 py-2"
                    role="alert"
                  >
                    <i class="bi bi-exclamation-triangle-fill"></i>
                    {{ retrievalErrors[termType] }}
                  </div>
                </td>
              </tr>

              <tr v-if="retrievals[termType]">
                <td colspan="3">
                  <div class="d-flex justify-content-between text-body-secondary small mb-1">
                    <span
                      >{{ retrievals[termType]?.characterCount.toLocaleString() }} characters</span
                    >
                    <span>{{ retrievals[termType]?.repository }}</span>
                  </div>
                  <div class="d-flex align-items-center gap-2 mb-2">
                    <button
                      type="button"
                      class="btn btn-sm btn-danger"
                      :disabled="Boolean(analysingTerm)"
                      @click="analyseTerm(termType)"
                    >
                      <span
                        v-if="analysingTerm === termType"
                        class="spinner-border spinner-border-sm me-1"
                      ></span>
                      {{
                        analysingTerm === termType
                          ? 'Analysing…'
                          : analyses[termType]
                            ? 'Analyse again'
                            : 'Analyse risks'
                      }}
                    </button>
                  </div>
                  <div v-if="analysisErrors[termType]" class="alert alert-danger py-2">
                    {{ analysisErrors[termType] }}
                  </div>
                  <div v-if="analyses[termType]" class="border rounded p-3 mb-2 bg-body-tertiary">
                    <div
                      class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"
                    >
                      <h3 class="h6 mb-0">Risk analysis</h3>
                      <div class="d-flex align-items-center gap-2">
                        <label
                          :for="`finding-filter-${termType}`"
                          class="small text-body-secondary"
                        >
                          View
                        </label>
                        <select
                          :id="`finding-filter-${termType}`"
                          v-model="findingFilters[termType]"
                          class="form-select form-select-sm"
                          style="width: auto"
                        >
                          <option value="risky">Risky ({{ labelCount(termType, 'risky') }})</option>
                          <option value="not_risky">
                            Not risky ({{ labelCount(termType, 'not_risky') }})
                          </option>
                        </select>
                      </div>
                    </div>

                    <div class="d-flex flex-wrap align-items-center gap-3 mb-3">
                      <div class="text-center lh-1">
                        <div class="display-6 fw-bold">
                          {{ analyses[termType]?.riskyClauseCount }}
                        </div>
                        <div class="small text-body-secondary">
                          risky
                          {{ analyses[termType]?.riskyClauseCount === 1 ? 'clause' : 'clauses' }}
                        </div>
                      </div>
                      <div class="flex-grow-1" style="min-width: 220px">
                        <div class="d-flex flex-wrap justify-content-between small mb-1">
                          <span>
                            {{ flaggedShare(termType) }}% of
                            {{ analyses[termType]?.clauseCount }} clauses flagged
                          </span>
                          <span class="text-body-secondary">
                            avg. confidence {{ avgConfidence(termType) }}%
                          </span>
                        </div>
                        <div
                          class="progress"
                          role="progressbar"
                          :aria-label="`Share of clauses flagged as risky in ${termType.replace(
                            /_/g,
                            ' ',
                          )}`"
                          :aria-valuenow="flaggedShare(termType)"
                          aria-valuemin="0"
                          aria-valuemax="100"
                          style="height: 10px"
                        >
                          <div
                            class="progress-bar"
                            :class="severityClass(termType)"
                            :style="{ width: `${flaggedShare(termType)}%` }"
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div v-if="!visibleFindings(termType).length" class="text-body-secondary small">
                      {{
                        (findingFilters[termType] ?? 'risky') === 'risky'
                          ? 'No clauses were flagged as risky.'
                          : 'Every analysed clause was flagged as risky.'
                      }}
                    </div>
                    <div v-else class="risk-findings">
                      <article
                        v-for="(finding, findingIndex) in visibleFindings(termType)"
                        :key="`${finding.text}-${findingIndex}`"
                        class="border rounded p-2 mb-2"
                      >
                        <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                          <span
                            class="badge"
                            :class="
                              finding.predictedLabel === 'risky'
                                ? 'text-bg-danger'
                                : 'text-bg-success'
                            "
                          >
                            {{ finding.predictedLabel === 'risky' ? 'Risky' : 'Not risky' }} ·
                            {{ confidencePercent(finding) }}% confidence
                          </span>
                          <button
                            v-if="finding.predictedLabel === 'risky'"
                            type="button"
                            class="btn btn-sm btn-link p-0"
                            @click="scrollToClause(termType, finding)"
                          >
                            Show in text
                          </button>
                        </div>
                        <p class="mb-0 small">{{ finding.text }}</p>
                      </article>
                    </div>
                    <p class="text-body-secondary small mb-0 mt-2">
                      Binary automated prediction (risky / not risky); not legal advice.
                    </p>
                  </div>
                  <p
                    v-if="analyses[termType]?.riskyClauseCount"
                    class="text-body-secondary small mb-1"
                  >
                    <mark class="clause-mark">Highlighted</mark> passages are the clauses flagged as
                    risky.
                  </p>
                  <pre
                    class="border rounded bg-body-tertiary p-3 mb-0"
                    tabindex="0"
                    aria-label="Retrieved document text with risky clauses highlighted"
                    style="max-height: 420px; overflow: auto; white-space: pre-wrap"
                    v-html="documentViews[termType] || ''"
                  ></pre>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </section>

    <section class="mt-4">
      <h2 class="h5 fw-bold">How it works</h2>
      <ol class="text-body-secondary ps-3 mb-0">
        <li class="mb-1">Search the public catalogue of tracked digital services.</li>
        <li class="mb-1">Retrieve the current policy text, or pick an archived older version.</li>
        <li>Analyse the retrieved text to flag the clauses the model predicts are risky.</li>
      </ol>
    </section>
  </main>
</template>
