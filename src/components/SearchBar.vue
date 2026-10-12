<script setup lang="ts">
/**
 * SearchBar.vue: the always-visible service search (chunk 1).
 *
 * Owns its own autocomplete UI state (query, open dropdown, keyboard nav) and
 * a debounced remote search against `/api/services`. Reports back to the
 * parent only when a service should be loaded, via the `select` emit.
 *
 * `compact` is the slimmer variant shown in FlowBar on every view after the
 * landing page: same behaviour (including Spotlight mode), but a visually
 * hidden label, normal-size controls and no catalogue count line.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { apiUrl } from '@/lib/api'
import type { Service } from '@/types'
import BrandAvatar from './BrandAvatar.vue'

const { services, isCatalogueLoading, isServiceLoading, catalogueIsFallback, compact = false } = defineProps<{
  services: Service[]
  isCatalogueLoading: boolean
  isServiceLoading: boolean
  catalogueIsFallback: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  select: [service: Service]
}>()

const BUTTON_SPRING = { type: 'spring', stiffness: 400, damping: 17 } as const
/** Shared with the wrapper's `layout` animation, so the float-up/settle-back glide matches this spring. */
const SPOTLIGHT_SPRING = { type: 'spring', stiffness: 300, damping: 30 } as const

const FEATURED_SERVICES: Service[] = [
  { name: 'TikTok', path: '1448', source: 'tosdr' },
  { name: 'CommBank', path: 'au:commbank', source: 'australian' },
  { name: 'Instagram', path: '219', source: 'tosdr' },
  { name: 'YouTube', path: '274', source: 'tosdr' },
  { name: 'Facebook', path: '182', source: 'tosdr' },
  { name: 'WhatsApp', path: '198', source: 'tosdr' },
  { name: 'Optus', path: 'au:optus', source: 'australian' },
  { name: 'Telstra', path: 'au:telstra', source: 'australian' },
  { name: 'Woolworths', path: 'au:woolworths', source: 'australian' },
  { name: 'Snap Inc. (Snapchat)', path: '311', source: 'tosdr' },
]

/** Distinct per variant, so the label targets the right input if both ever render on one page. */
const inputId = compact ? 'service-compact' : 'service'
const query = ref('')
/** True from focus until blur- doubles as the autocomplete-open flag and the Spotlight-mode flag. */
const isOpen = ref(false)
const activeIndex = ref(-1)
const error = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const featuredServices = ref<Service[]>(FEATURED_SERVICES)
/** Remote results are supplemental: locally loaded services always remain immediately searchable. */
const remoteSearch = ref<{ query: string; services: Service[] } | null>(null)
const searchCache = new Map<string, Service[]>()
const logoCache = new Map<string, string | null>()
let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchController: AbortController | undefined
let logoController: AbortController | undefined

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
  if (!needle) return featuredServices.value

  const localMatches = services.filter((service) => service.name.toLowerCase().includes(needle))
  const matchingRemote = remoteSearch.value?.query === needle ? remoteSearch.value.services : []
  const seen = new Set<string>()
  // Put remote results first so their enriched metadata (such as an Australian
  // catalogue logo URL) wins when the same service is already in the local list.
  const merged = [...matchingRemote, ...localMatches].filter((service) => {
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

/** On each keystroke: show local matches immediately and debounce remote search briefly (min 2 chars). */
function handleInput() {
  isOpen.value = true
  activeIndex.value = -1
  error.value = ''
  clearTimeout(searchTimer)
  searchController?.abort()
  logoController?.abort()
  const needle = query.value.trim()
  if (needle.length < 2) {
    remoteSearch.value = null
    return
  }

  const normalizedNeedle = needle.toLowerCase()
  const cached = searchCache.get(normalizedNeedle)
  if (cached) {
    remoteSearch.value = { query: normalizedNeedle, services: cached }
    hydrateAustralianLogos(normalizedNeedle, cached)
    return
  }

  // Local matches are already visible; fetch the wider upstream catalogue shortly after typing settles.
  searchTimer = setTimeout(() => searchServices(needle), 90)
}

function updateCachedLogo(searchQuery: string, servicePath: string, logoUrl: string | null) {
  if (!searchQuery) {
    featuredServices.value = featuredServices.value.map((service) =>
      service.path === servicePath ? { ...service, logoUrl } : service,
    )
    return
  }
  const cached = searchCache.get(searchQuery)
  if (!cached) return
  const updated = cached.map((service) =>
    service.path === servicePath ? { ...service, logoUrl } : service,
  )
  searchCache.set(searchQuery, updated)
  if (remoteSearch.value?.query === searchQuery)
    remoteSearch.value = { query: searchQuery, services: updated }
}

function handleFocus() {
  isOpen.value = true
  if (!query.value.trim()) hydrateAustralianLogos('', featuredServices.value)
}

/** Load logos after names are visible. Only the ten displayable matches are requested. */
function hydrateAustralianLogos(searchQuery: string, results: Service[]) {
  logoController?.abort()
  const controller = new AbortController()
  logoController = controller
  for (const service of results.filter(({ source }) => source === 'australian').slice(0, 10)) {
    if (service.logoUrl) {
      logoCache.set(service.path, service.logoUrl)
      continue
    }
    if (logoCache.has(service.path)) {
      updateCachedLogo(searchQuery, service.path, logoCache.get(service.path) ?? null)
      continue
    }
    void fetch(apiUrl(`/api/service/${encodeURIComponent(service.path)}`), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null
        const payload = await response.json() as { logoUrl?: string | null }
        return payload.logoUrl || null
      })
      .then((logoUrl) => {
        if (controller.signal.aborted) return
        logoCache.set(service.path, logoUrl)
        updateCachedLogo(searchQuery, service.path, logoUrl)
      })
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError'))
          logoCache.set(service.path, null)
      })
  }
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
    if (!response.ok) return []
    const payload = (await response.json()) as {
      data: Array<{
        id: string
        name: string
        logoUrl?: string | null
        source?: Service['source']
      }>
    }
    const results = payload.data.map((service) => ({
      name: service.name,
      path: service.id,
      logoUrl: service.logoUrl,
      source: service.source,
    }))
    searchCache.set(normalizedNeedle, results)
    if (query.value.trim().toLowerCase() === normalizedNeedle) {
      remoteSearch.value = { query: normalizedNeedle, services: results }
      hydrateAustralianLogos(normalizedNeedle, results)
    }
    return results
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') return []
    // Keep the last successful results while upstream search is unavailable.
    return []
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
    closeSpotlight()
  }
}

/** Exit Spotlight mode by blurring the input; the `@blur` handler closes the dropdown and overlay. */
function closeSpotlight() {
  inputRef.value?.blur()
}

/** Lock page scroll while Spotlight mode is active so the blurred background can't scroll underneath. */
watch(isOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

/** Resolve an exact typed name on submit, without requiring the user to wait for or click a suggestion. */
async function submitSearch() {
  const typedName = query.value.trim()
  const normalizedNeedle = typedName.toLowerCase()
  let matchingRemote = remoteSearch.value?.query === normalizedNeedle
    ? remoteSearch.value.services
    : searchCache.get(normalizedNeedle) ?? []
  let exact = [...featuredServices.value, ...services, ...matchingRemote]
    .find((service) => service.name.toLowerCase() === normalizedNeedle)

  if (!exact && typedName.length >= 2) {
    clearTimeout(searchTimer)
    searchController?.abort()
    matchingRemote = await searchServices(typedName)
    if (query.value.trim().toLowerCase() !== normalizedNeedle) return
    exact = matchingRemote.find((service) => service.name.toLowerCase() === normalizedNeedle)
  }

  const service = exact ?? suggestions.value[0]
  if (service) selectService(service)
  else error.value = 'No matching service is currently available from the connected policy catalogues.'
}

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  searchController?.abort()
  logoController?.abort()
  document.body.style.overflow = ''
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
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="isOpen"
        class="search-spotlight-backdrop"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }"
        :transition="{ duration: 0.2, ease: 'easeOut' }"
        @mousedown="closeSpotlight"
      ></motion.div>
    </AnimatePresence>
  </Teleport>

  <motion.div
    class="search-bar-wrapper"
    :class="{ 'spotlight-active': isOpen }"
    layout
    :transition="SPOTLIGHT_SPRING"
  >
  <form
    class="card card-body shadow-sm search-bar"
    :class="{ 'search-bar-compact': compact }"
    @submit.prevent="submitSearch"
  >
    <label :for="inputId" :class="compact ? 'visually-hidden' : 'form-label fw-medium'">Service</label>
    <div class="row g-2">
      <div class="col position-relative">
        <div class="input-group" :class="{ 'input-group-lg': !compact }">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input
            :id="inputId"
            ref="inputRef"
            v-model="query"
            class="form-control"
            type="text"
            autocomplete="off"
            placeholder="e.g. Google, Spotify, Discord"
            @input="handleInput"
            @focus="handleFocus"
            @blur="isOpen = false"
            @keydown="handleKeydown"
          />
        </div>
        <AnimatePresence>
          <motion.div
            v-if="isOpen && suggestions.length"
            class="autocomplete-popup mt-1 shadow"
            :initial="{ opacity: 0, scale: 0.98, y: -8 }"
            :animate="{ opacity: 1, scale: 1, y: 0 }"
            :exit="{ opacity: 0, scale: 0.98, y: -8 }"
            :transition="{ duration: 0.15, ease: 'easeOut' }"
            style="transform-origin: top"
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
                <BrandAvatar :service-name="service.name" :logo-url="service.logoUrl" />
                <span class="flex-grow-1">{{ service.name }}</span>
                <i class="bi bi-chevron-right small text-body-secondary"></i>
              </li>
            </ul>
          </motion.div>
        </AnimatePresence>
      </div>
      <div class="col-auto">
        <motion.button
          type="submit"
          class="btn btn-primary"
          :class="{ 'btn-lg': !compact }"
          :disabled="isCatalogueLoading || isServiceLoading"
          :while-hover="{ scale: 1.04, y: -2 }"
          :while-press="{ scale: 0.97, y: 0 }"
          :transition="BUTTON_SPRING"
        >
          <span v-if="isServiceLoading" class="spinner-border spinner-border-sm me-1"></span>
          {{ isServiceLoading ? 'Retrieving…' : 'Review terms' }}
        </motion.button>
      </div>
    </div>

    <p v-if="!compact" class="form-text mb-0 mt-2">
      <span v-if="isCatalogueLoading">
        <span class="spinner-border spinner-border-sm"></span> Loading service list…
      </span>
      <span v-else>
        {{ services.length }} services from connected policy catalogues
        <span v-if="catalogueIsFallback" class="badge text-bg-secondary ms-1">offline list</span>
      </span>
    </p>
    <div v-if="error" class="alert alert-warning mt-2 mb-0 py-2" role="alert">{{ error }}</div>
  </form>
  </motion.div>
</template>

<style scoped>
.search-spotlight-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1055;
  background-color: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.search-bar-wrapper.spotlight-active {
  position: fixed;
  top: 12vh;
  left: 0;
  right: 0;
  margin-inline: auto;
  width: min(90vw, 640px);
  z-index: 1060;
}

.search-bar-wrapper.spotlight-active .search-bar {
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35) !important;
}

.search-bar-compact {
  padding: 0.5rem;
}

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
