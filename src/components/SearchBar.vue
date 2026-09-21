<script setup lang="ts">
/**
 * SearchBar.vue: the always-visible service search (chunk 1).
 *
 * Owns its own autocomplete UI state (query, open dropdown, keyboard nav) and
 * a debounced remote search against `/api/services`. Reports back to the
 * parent only when a service should be loaded, via the `select` emit.
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { apiUrl } from '@/lib/api'
import type { Service } from '@/types'
import BrandAvatar from './BrandAvatar.vue'

const { services, isCatalogueLoading, isServiceLoading, catalogueIsFallback } = defineProps<{
  services: Service[]
  isCatalogueLoading: boolean
  isServiceLoading: boolean
  catalogueIsFallback: boolean
}>()

const emit = defineEmits<{
  select: [service: Service]
}>()

const query = ref('')
const isOpen = ref(false)
const activeIndex = ref(-1)
const error = ref('')
/** Remote results are supplemental: locally loaded services always remain immediately searchable. */
const remoteSearch = ref<{ query: string; services: Service[] } | null>(null)
const searchCache = new Map<string, Service[]>()
let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchController: AbortController | undefined

/**
 * Relevance tier for a service name against the typed needle: exact match,
 * then prefix, then a later word starting with it, then any substring.
 * Lower is more relevant.
 */
function matchRank(name: string, needle: string): number {
  const lower = name.toLowerCase()
  if (lower === needle) return 0
  if (lower.startsWith(needle)) return 1
  if (lower.includes(` ${needle}`)) return 2
  return 3
}

/** Up to 10 services matching the current query (or the first 10 when empty), most relevant first. */
const suggestions = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return services.slice(0, 10)

  const localMatches = services.filter((service) => service.name.toLowerCase().includes(needle))
  const matchingRemote = remoteSearch.value?.query === needle ? remoteSearch.value.services : []
  const seen = new Set<string>()
  const merged = [...localMatches, ...matchingRemote].filter((service) => {
    if (seen.has(service.path)) return false
    seen.add(service.path)
    return true
  })
  return merged
    .map((service, index) => ({ service, index }))
    .sort((a, b) => {
      const rankDiff = matchRank(a.service.name, needle) - matchRank(b.service.name, needle)
      return rankDiff !== 0 ? rankDiff : a.index - b.index
    })
    .map((entry) => entry.service)
    .slice(0, 10)
})

/** On each keystroke: open the dropdown, clear any selection, and debounce a search by 250 ms (min 2 chars). */
function handleInput() {
  isOpen.value = true
  activeIndex.value = -1
  error.value = ''
  clearTimeout(searchTimer)
  searchController?.abort()
  const needle = query.value.trim()
  if (needle.length < 2) {
    remoteSearch.value = null
    return
  }

  const normalizedNeedle = needle.toLowerCase()
  const cached = searchCache.get(normalizedNeedle)
  if (cached) {
    remoteSearch.value = { query: normalizedNeedle, services: cached }
    return
  }

  // Local matches are already visible; fetch the wider upstream catalogue shortly after typing settles.
  searchTimer = setTimeout(() => searchServices(needle), 150)
}

/**
 * Replace the suggestion pool with server-side search results for `needle`.
 * Stale responses (the query moved on) and upstream failures are ignored,
 * keeping the last good results on screen.
 */
async function searchServices(needle: string) {
  const normalizedNeedle = needle.toLowerCase()
  const controller = new AbortController()
  searchController = controller
  try {
    const response = await fetch(
      apiUrl(`/api/services?search=${encodeURIComponent(needle)}&limit=100`),
      { signal: controller.signal },
    )
    if (!response.ok) return
    const payload = (await response.json()) as { data: Array<{ id: string; name: string }> }
    const results = payload.data.map((service) => ({ name: service.name, path: service.id }))
    searchCache.set(normalizedNeedle, results)
    if (query.value.trim().toLowerCase() === normalizedNeedle) {
      remoteSearch.value = { query: normalizedNeedle, services: results }
    }
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') return
    // Keep the last successful results while upstream search is unavailable.
  } finally {
    if (searchController === controller) searchController = undefined
  }
}

/** Keyboard navigation for the suggestions dropdown: Up/Down move, Enter selects, Escape closes. */
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

/** Handle the search form submit: pick an exact name match, else the top suggestion, else show an error. */
function submitSearch() {
  const matchingRemote =
    remoteSearch.value?.query === query.value.trim().toLowerCase()
      ? remoteSearch.value.services
      : []
  const pool = [...services, ...matchingRemote]
  const exact = pool.find((service) => service.name.toLowerCase() === query.value.trim().toLowerCase())
  const service = exact ?? suggestions.value[0]
  if (service) selectService(service)
  else error.value = 'No matching service is currently available from ToS;DR.'
}

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  searchController?.abort()
})

function selectService(service: Service) {
  query.value = service.name
  isOpen.value = false
  activeIndex.value = -1
  error.value = ''
  emit('select', service)
}
</script>

<template>
  <form class="card card-body shadow-sm search-bar" @submit.prevent="submitSearch">
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
        <div
          v-if="isOpen && suggestions.length"
          class="autocomplete-popup mt-1 shadow"
        >
          <ul class="list-group autocomplete-options">
            <li
              v-for="(service, index) in suggestions"
              :key="service.path"
              class="list-group-item list-group-item-action d-flex align-items-center gap-2"
              :class="{ active: index === activeIndex }"
              style="cursor: pointer"
              @mousedown.prevent="selectService(service)"
            >
              <BrandAvatar :service-name="service.name" />
              <span class="flex-grow-1">{{ service.name }}</span>
              <i class="bi bi-chevron-right small text-body-secondary"></i>
            </li>
          </ul>
        </div>
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
    <div v-if="error" class="alert alert-warning mt-2 mb-0 py-2" role="alert">{{ error }}</div>
  </form>
</template>

<style scoped>
.autocomplete-popup {
  position: absolute;
  z-index: 1000;
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--bs-border-color);
  border-radius: 0.8rem;
  background-color: var(--bs-body-bg);
}

.autocomplete-options {
  max-height: 260px;
  margin: 0;
  overflow-y: auto;
  border-radius: 0;
}

.autocomplete-options > .list-group-item {
  border-right: 0;
  border-left: 0;
}

.autocomplete-options > .list-group-item:first-child {
  border-top: 0;
}

.autocomplete-options > .list-group-item:last-child {
  border-bottom: 0;
}
</style>
