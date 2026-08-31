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
  <header class="border-bottom bg-white">
    <div class="container app-shell py-3 d-flex align-items-center gap-2">
      <i class="bi bi-shield-check fs-4 text-primary"></i>
      <span class="fw-semibold">Before You Agree</span>
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
      <div class="card-header bg-white d-flex align-items-center justify-content-between">
        <h2 class="h5 mb-0">{{ selectedService.name }}</h2>
        <span class="badge rounded-pill text-bg-light"> {{ termEntries.length }} documents </span>
      </div>

      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
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
                  <pre
                    class="border rounded bg-body-tertiary p-3 mb-0"
                    style="max-height: 420px; overflow: auto; white-space: pre-wrap"
                    >{{ retrievals[termType]?.content }}</pre>
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
        <li>Automated clause analysis will be added in a later phase.</li>
      </ol>
    </section>
  </main>
</template>
