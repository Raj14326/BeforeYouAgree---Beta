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
</script>

<template>
  <div class="container my-4">
    <h1>Before You Agree</h1>
    <p>Find a digital service and read the terms and policies you are agreeing to.</p>

    <form class="row g-2 align-items-end my-3" @submit.prevent="submitSearch">
      <div class="col-sm-6 position-relative">
        <label for="service" class="form-label">Service</label>
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
        <ul
          v-if="isOpen && suggestions.length"
          class="list-group position-absolute w-100"
          style="z-index: 1000; max-height: 260px; overflow-y: auto"
        >
          <li
            v-for="(service, index) in suggestions"
            :key="service.path"
            class="list-group-item list-group-item-action"
            :class="{ active: index === activeIndex }"
            style="cursor: pointer"
            @mousedown.prevent="selectService(service)"
          >
            {{ service.name }}
          </li>
        </ul>
      </div>
      <div class="col-sm-auto">
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="isCatalogueLoading || isServiceLoading"
        >
          {{ isServiceLoading ? 'Retrieving...' : 'Review terms' }}
        </button>
      </div>
    </form>

    <p v-if="isCatalogueLoading" class="text-muted">Loading service list...</p>
    <p v-else class="text-muted">
      <small>
        {{ services.length }} services loaded from ToS;DR
        <span v-if="catalogueIsFallback">(offline list)</span>
      </small>
    </p>

    <div v-if="error" class="alert alert-warning">{{ error }}</div>

    <div v-if="selectedService" ref="resultsSection">
      <hr />
      <h2>{{ selectedService.name }}</h2>

      <table class="table">
        <thead>
          <tr>
            <th>Document</th>
            <th>Last updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="[termType, term] in termEntries" :key="termType">
            <tr>
              <td>{{ termType }}</td>
              <td>{{ formattedUpdatedAt(term.updatedAt) }}</td>
              <td>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-primary"
                  :disabled="Boolean(retrievingTerm) || !term.available"
                  @click="retrieveTerm(termType)"
                >
                  {{
                    !term.available
                      ? 'Not archived'
                      : retrievingTerm === termType
                        ? 'Loading...'
                        : retrievals[termType]
                          ? 'Refresh text'
                          : 'Retrieve text'
                  }}
                </button>
                <button
                  v-if="term.historyAvailable"
                  type="button"
                  class="btn btn-sm btn-outline-secondary ms-1"
                  @click="toggleHistory(termType)"
                >
                  History
                </button>
                <a
                  v-if="term.sourceUrl"
                  :href="term.sourceUrl"
                  target="_blank"
                  rel="noreferrer"
                  class="ms-2"
                >
                  Source
                </a>
              </td>
            </tr>

            <tr v-if="openHistoryTerm === termType">
              <td colspan="3">
                <label class="form-label mb-1">Older versions</label>
                <div class="d-flex gap-2">
                  <select
                    v-model="selectedVersions[termType]"
                    class="form-select form-select-sm"
                    style="max-width: 320px"
                    :disabled="loadingHistoryTerm === termType"
                  >
                    <option value="" disabled>
                      {{ loadingHistoryTerm === termType ? 'Loading dates...' : 'Select a date' }}
                    </option>
                    <option
                      v-for="version in versions[termType] || []"
                      :key="version.id"
                      :value="version.url"
                    >
                      {{ version.label }}
                    </option>
                  </select>
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
              <td colspan="3" class="text-danger">{{ retrievalErrors[termType] }}</td>
            </tr>

            <tr v-if="retrievals[termType]">
              <td colspan="3">
                <p class="text-muted mb-1">
                  <small>
                    {{ retrievals[termType]?.characterCount.toLocaleString() }} characters -
                    {{ retrievals[termType]?.repository }}
                  </small>
                </p>
                <pre
                  class="border p-2 bg-light"
                  style="max-height: 400px; overflow: auto; white-space: pre-wrap"
                >{{ retrievals[termType]?.content }}</pre>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <hr />
    <h2>How it works</h2>
    <ol>
      <li>Search the public catalogue of tracked digital services.</li>
      <li>Retrieve the current policy text, or pick an archived older version.</li>
      <li>Automated clause analysis will be added in a later phase.</li>
    </ol>

    <hr />
    
  </div>
</template>
