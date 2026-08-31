<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  FileSearch,
  FileText,
  LoaderCircle,
  Search,
  ShieldCheck,
  Sparkles,
} from '@lucide/vue'

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
const collapsedTerms = ref<Record<string, boolean>>({})
const failedBrandIcons = ref<Record<string, boolean>>({})
const openHistoryTerm = ref<string | null>(null)
const versions = ref<Record<string, VersionOption[]>>({})
const selectedVersions = ref<Record<string, string>>({})
const loadingHistoryTerm = ref<string | null>(null)
const error = ref('')
const isOpen = ref(false)
const activeIndex = ref(-1)
const searchInput = ref<HTMLInputElement | null>(null)
const resultsSection = ref<HTMLElement | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | undefined

const suggestions = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return services.value.slice(0, 7)
  return services.value
    .filter((service) => service.name.toLowerCase().includes(needle))
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(needle) ? 0 : 1
      const bStarts = b.name.toLowerCase().startsWith(needle) ? 0 : 1
      return aStarts - bStarts || a.name.localeCompare(b.name)
    })
    .slice(0, 7)
})

const initials = computed(() =>
  selectedService.value?.name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
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

async function searchServices(needle: string) {
  try {
    const response = await fetch(apiUrl(`/api/services?search=${encodeURIComponent(needle)}&limit=100`))
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

function handleKeydown(event: KeyboardEvent) {
  if (!isOpen.value && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) isOpen.value = true
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, suggestions.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const service = suggestions.value[activeIndex.value] ?? suggestions.value[0]
    if (service) selectService(service)
  } else if (event.key === 'Escape') {
    isOpen.value = false
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
  isServiceLoading.value = true
  selectedService.value = null
  retrievals.value = {}
  retrievalErrors.value = {}
  collapsedTerms.value = {}
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
    collapsedTerms.value[termType] = false
  } catch (cause) {
    retrievalErrors.value[termType] =
      cause instanceof Error ? cause.message : 'The document could not be retrieved.'
  } finally {
    retrievingTerm.value = null
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

function sourceUrl(term: Term) {
  return term.sourceUrl ?? ''
}

function brandIconUrl(serviceName: string) {
  const aliases: Record<string, string> = {
    'Twitter': 'x',
    'Twitter (X)': 'x',
    'Google Play': 'googleplay',
    'Microsoft Teams': 'microsoftteams',
    'YouTube': 'youtube',
  }
  const slug = aliases[serviceName] ?? serviceName.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `https://cdn.simpleicons.org/${encodeURIComponent(slug)}`
}

function markBrandIconFailed(serviceName: string) {
  failedBrandIcons.value[serviceName] = true
}
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <a class="brand" href="#" aria-label="Before You Agree home">
        <span class="brand-mark"><Check :size="17" :stroke-width="3" /></span>
        <span>Before You Agree</span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="#how-it-works">How it works</a>
        <a href="#data-source">Data source</a>
      </nav>
      <span class="prototype-label">Prototype</span>
    </header>

    <main>
      <section class="hero" aria-labelledby="page-title">
        <div class="hero-grid" aria-hidden="true"></div>
        <div class="hero-content">
          <div class="eyebrow"><Sparkles :size="15" /> Terms, made readable</div>
          <h1 id="page-title">Know what you’re agreeing to.</h1>
          <p class="hero-copy">
            Find a digital service and inspect the policies that shape your rights, data, and choices.
          </p>

          <form class="search-form" role="search" @submit.prevent="submitSearch">
            <div class="combobox-wrap">
              <Search class="search-icon" :size="22" aria-hidden="true" />
              <input
                ref="searchInput"
                v-model="query"
                type="search"
                role="combobox"
                aria-label="Search for a service"
                aria-controls="service-suggestions"
                :aria-expanded="isOpen"
                :aria-activedescendant="activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined"
                autocomplete="off"
                placeholder="Search Google, Spotify, Discord…"
                @input="handleInput"
                @focus="isOpen = true"
                @keydown="handleKeydown"
              />
              <LoaderCircle v-if="isCatalogueLoading" class="input-loader" :size="20" />

              <ul
                v-if="isOpen && !isCatalogueLoading && (query || suggestions.length)"
                id="service-suggestions"
                class="suggestions"
                role="listbox"
              >
                <li v-if="query" class="suggestions-heading">Services</li>
                <li
                  v-for="(service, index) in suggestions"
                  :id="`suggestion-${index}`"
                  :key="service.path"
                  role="option"
                  :aria-selected="index === activeIndex"
                  :class="{ active: index === activeIndex }"
                  @mousedown.prevent="selectService(service)"
                >
                  <span class="service-avatar">
                    <img
                      v-if="!failedBrandIcons[service.name]"
                      :src="brandIconUrl(service.name)"
                      alt=""
                      loading="lazy"
                      @error="markBrandIconFailed(service.name)"
                    />
                    <span v-else>{{ service.name.slice(0, 1).toUpperCase() }}</span>
                  </span>
                  <span>{{ service.name }}</span>
                  <ChevronRight :size="18" />
                </li>
                <li v-if="!suggestions.length" class="empty-suggestion">No tracked services found</li>
              </ul>
            </div>
            <button type="submit" :disabled="isCatalogueLoading || isServiceLoading">
              <span>{{ isServiceLoading ? 'Retrieving' : 'Review terms' }}</span>
              <LoaderCircle v-if="isServiceLoading" class="spin" :size="19" />
              <ArrowRight v-else :size="19" />
            </button>
          </form>
          <p class="search-meta">
            <ShieldCheck :size="15" />
            {{ services.length.toLocaleString() }} services loaded from ToS;DR
            <span v-if="catalogueIsFallback">· limited offline catalogue</span>
          </p>
          <p v-if="error" class="error-message" role="alert">{{ error }}</p>
        </div>
      </section>

      <section v-if="selectedService" ref="resultsSection" class="results-section">
        <div class="results-inner">
          <div class="service-heading">
            <span class="selected-avatar">
              <img
                v-if="!failedBrandIcons[selectedService.name]"
                :src="brandIconUrl(selectedService.name)"
                alt=""
                @error="markBrandIconFailed(selectedService.name)"
              />
              <span v-else>{{ initials }}</span>
            </span>
            <div>
              <span class="section-kicker">Available documents</span>
              <h2>{{ selectedService.name }}</h2>
            </div>
            <span class="tracked-badge"><span></span> Tracked</span>
          </div>

          <div class="document-list">
            <article
              v-for="(term, termType) in selectedService.terms"
              :key="termType"
              :class="{ expanded: retrievals[termType as string] }"
            >
              <span class="document-icon"><FileText :size="21" /></span>
              <div class="document-info">
                <h3>{{ termType }}</h3>
                <p>Current version updated {{ formattedUpdatedAt(term.updatedAt) }}.</p>
              </div>
              <div class="document-actions">
                <button
                  type="button"
                  :disabled="Boolean(retrievingTerm) || !term.available"
                  @click="retrieveTerm(termType as string)"
                >
                  <LoaderCircle
                    v-if="retrievingTerm === termType"
                    class="spin"
                    :size="15"
                  />
                  <FileSearch v-else :size="15" />
                  {{
                    !term.available
                      ? 'Not archived'
                      : retrievals[termType as string]
                        ? 'Refresh text'
                        : 'Retrieve text'
                  }}
                </button>
                <div v-if="term.historyAvailable" class="history-control">
                  <button
                    type="button"
                    class="history-toggle"
                    :aria-expanded="openHistoryTerm === termType"
                    :aria-label="`Choose a historical version of ${termType}`"
                    title="Choose a historical version"
                    @click="toggleHistory(termType as string)"
                  >
                    <LoaderCircle
                      v-if="loadingHistoryTerm === termType"
                      class="spin"
                      :size="15"
                    />
                    <CalendarDays v-else :size="16" />
                  </button>
                  <div v-if="openHistoryTerm === termType" class="history-menu">
                    <span>Available update dates</span>
                    <div class="history-fields">
                      <select
                        v-model="selectedVersions[termType as string]"
                        :aria-label="`Version date for ${termType}`"
                        :disabled="loadingHistoryTerm === termType"
                      >
                        <option value="" disabled>
                          {{ loadingHistoryTerm === termType ? 'Loading dates…' : 'Select a date' }}
                        </option>
                        <option
                          v-for="version in versions[termType as string] || []"
                          :key="version.id"
                          :value="version.url"
                        >
                          {{ version.label }}
                        </option>
                      </select>
                    </div>
                    <button
                      type="button"
                      class="history-submit"
                      :disabled="!selectedVersions[termType as string] || Boolean(retrievingTerm)"
                      @click="retrieveSelectedVersion(termType as string)"
                    >
                      Retrieve selected version
                    </button>
                  </div>
                </div>
                <a v-if="sourceUrl(term)" :href="sourceUrl(term)" target="_blank" rel="noreferrer">
                  Source <ExternalLink :size="15" />
                </a>
              </div>
              <p v-if="retrievalErrors[termType as string]" class="retrieval-error" role="alert">
                {{ retrievalErrors[termType as string] }}
              </p>
              <div
                v-if="retrievals[termType as string]"
                class="terms-preview"
                :class="{ collapsed: collapsedTerms[termType as string] }"
              >
                <div class="terms-preview-header">
                  <span>Plain text</span>
                  <div>
                    <span>
                      {{ retrievals[termType as string]!.characterCount.toLocaleString() }} characters
                      · {{ retrievals[termType as string]!.repository }}
                    </span>
                    <button
                      type="button"
                      :aria-label="collapsedTerms[termType as string] ? 'Expand terms' : 'Collapse terms'"
                      :title="collapsedTerms[termType as string] ? 'Expand terms' : 'Collapse terms'"
                      @click="collapsedTerms[termType as string] = !collapsedTerms[termType as string]"
                    >
                      <ChevronDown v-if="collapsedTerms[termType as string]" :size="17" />
                      <ChevronUp v-else :size="17" />
                    </button>
                  </div>
                </div>
                <pre v-show="!collapsedTerms[termType as string]">{{ retrievals[termType as string]!.content }}</pre>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="how-it-works" class="process-section">
        <div class="process-intro">
          <span class="section-kicker">How it works</span>
          <h2>A clearer path through the fine print.</h2>
        </div>
        <div class="steps">
          <div><span>01</span><h3>Find a service</h3><p>Search the public catalogue of tracked digital services.</p></div>
          <div><span>02</span><h3>Retrieve its terms</h3><p>Open current policies and independently archived versions.</p></div>
          <div><span>03</span><h3>Understand the risk</h3><p>Automated clause analysis will be added in the next phase.</p></div>
        </div>
      </section>
    </main>

    <footer id="data-source">
      <div class="brand footer-brand">
        <span class="brand-mark"><Check :size="15" :stroke-width="3" /></span>
        <span>Before You Agree</span>
      </div>
      <p>
        Terms data provided by
        <a href="https://tosdr.org" target="_blank" rel="noreferrer">ToS;DR</a>.
      </p>
      <p>Informational only, not legal advice.</p>
    </footer>
  </div>
</template>
