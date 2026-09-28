<script setup lang="ts">
// The core "search a service, pick a document" workflow, restyled in
// Material 3 — mirrors AppView.vue's real shape (search → service's document
// cards → active document's clauses + original text) as a click-through
// mock: no real API calls, fixed delays instead of real analysis, but every
// score/highlight shown is computed for real from lib/ functions.
import { computed, onMounted, reactive, ref, watch } from 'vue'
import MockDocumentResult from '@/prototype/components/MockDocumentResult.vue'
import { DOCUMENT_CATALOGUE, findCatalogueDocument, type CatalogueDocument } from '@/prototype/fixtures/document-catalogue'
import { useMockCompareList } from '@/prototype/composables/useMockCompareList'

const { preloadEntryId } = defineProps<{ preloadEntryId?: string | null }>()

const { add: addToCompare, remove: removeFromCompare, isAdded } = useMockCompareList()

const query = ref('')
const selectedServiceName = ref<string | null>(null)
const activeDocId = ref<string | null>(null)

const filteredServices = computed(() => {
  const term = query.value.trim().toLowerCase()
  if (!term) return DOCUMENT_CATALOGUE
  return DOCUMENT_CATALOGUE.filter((service) => service.name.toLowerCase().includes(term))
})

const selectedService = computed(() => DOCUMENT_CATALOGUE.find((service) => service.name === selectedServiceName.value) ?? null)

type DocStatus = 'idle' | 'analyzing' | 'analyzed'
const docStates = reactive<Record<string, { status: DocStatus; versionId: string; historyOpen: boolean }>>({})

function stateFor(doc: CatalogueDocument) {
  if (!docStates[doc.id]) {
    docStates[doc.id] = { status: 'idle', versionId: doc.versions[0]!.id, historyOpen: false }
  }
  return docStates[doc.id]!
}

function selectService(name: string) {
  selectedServiceName.value = name
  query.value = ''
}

function analyze(doc: CatalogueDocument) {
  const state = stateFor(doc)
  if (state.status === 'analyzing') return
  state.status = 'analyzing'
  window.setTimeout(() => {
    state.status = 'analyzed'
    activeDocId.value = doc.id
  }, 1100)
}

function toggleHistory(doc: CatalogueDocument) {
  stateFor(doc).historyOpen = !stateFor(doc).historyOpen
}

function toggleCompare(doc: CatalogueDocument) {
  if (isAdded(doc.id)) {
    removeFromCompare(doc.id)
    return
  }
  addToCompare({
    id: doc.id,
    serviceName: doc.serviceName,
    documentLabel: doc.documentLabel,
    documentText: doc.documentText,
    analysis: doc.analysis,
  })
}

const activeDoc = computed(() => (activeDocId.value ? findCatalogueDocument(activeDocId.value) : undefined))

function preload(id: string | null | undefined) {
  if (!id) return
  const doc = findCatalogueDocument(id)
  if (!doc) return
  selectedServiceName.value = doc.serviceName
  stateFor(doc).status = 'analyzed'
  activeDocId.value = doc.id
}

onMounted(() => preload(preloadEntryId))
watch(() => preloadEntryId, preload)
</script>

<template>
  <div>
    <v-text-field
      v-model="query"
      label="Search for a service"
      placeholder="Try “ExampleSocial”, “ExampleCloud”, “ExampleStream”…"
      variant="outlined"
      prepend-inner-icon="mdi-magnify"
      clearable
      class="mb-2"
    />

    <div class="d-flex flex-wrap ga-2 mb-6">
      <span class="text-caption text-medium-emphasis mr-1 align-self-center">Quick pick:</span>
      <v-chip
        v-for="service in DOCUMENT_CATALOGUE"
        :key="service.name"
        size="small"
        :variant="selectedServiceName === service.name ? 'flat' : 'tonal'"
        :color="selectedServiceName === service.name ? 'primary' : undefined"
        @click="selectService(service.name)"
      >
        {{ service.name }}
      </v-chip>
    </div>

    <v-list v-if="query && filteredServices.length" density="compact" class="mb-6 search-results" rounded="lg">
      <v-list-item
        v-for="service in filteredServices"
        :key="service.name"
        :title="service.name"
        @click="selectService(service.name)"
      />
    </v-list>

    <template v-if="selectedService">
      <div class="text-subtitle-1 font-weight-medium mb-3">{{ selectedService.name }}</div>
      <v-row class="mb-6">
        <v-col v-for="doc in selectedService.documents" :key="doc.id" cols="12" sm="6">
          <v-card variant="outlined" rounded="lg" :class="{ 'border-primary': activeDocId === doc.id }">
            <v-card-item>
              <template #title>{{ doc.documentLabel }}</template>
              <template #subtitle>
                {{
                  stateFor(doc).status === 'analyzed'
                    ? 'Analyzed'
                    : stateFor(doc).status === 'analyzing'
                      ? 'Analyzing…'
                      : 'Not analyzed yet'
                }}
              </template>
            </v-card-item>
            <v-card-text>
              <div class="d-flex flex-wrap ga-2 mb-2">
                <v-btn
                  size="small"
                  color="primary"
                  variant="tonal"
                  :loading="stateFor(doc).status === 'analyzing'"
                  @click="analyze(doc)"
                >
                  {{ stateFor(doc).status === 'analyzed' ? 'Re-analyze' : 'Analyze' }}
                </v-btn>
                <v-btn
                  v-if="stateFor(doc).status === 'analyzed'"
                  size="small"
                  variant="text"
                  :disabled="activeDocId === doc.id"
                  @click="activeDocId = doc.id"
                >
                  View analysis
                </v-btn>
                <v-btn size="small" variant="text" append-icon="mdi-chevron-down" @click="toggleHistory(doc)">
                  History
                </v-btn>
                <v-btn
                  size="small"
                  variant="text"
                  :icon="isAdded(doc.id) ? 'mdi-bookmark-check' : 'mdi-bookmark-plus-outline'"
                  :color="isAdded(doc.id) ? 'primary' : undefined"
                  :disabled="stateFor(doc).status !== 'analyzed'"
                  class="ml-auto"
                  :aria-label="isAdded(doc.id) ? 'Remove from compare' : 'Add to compare'"
                  @click="toggleCompare(doc)"
                />
              </div>

              <div v-if="stateFor(doc).historyOpen" class="d-flex ga-2 align-center mt-2">
                <v-select
                  v-model="stateFor(doc).versionId"
                  :items="doc.versions"
                  item-title="label"
                  item-value="id"
                  label="Version"
                  density="compact"
                  variant="outlined"
                  hide-details
                  style="max-width: 220px"
                />
                <v-btn size="small" variant="tonal" @click="analyze(doc)">Retrieve</v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <v-empty-state
      v-else
      icon="mdi-magnify"
      title="Search for a service"
      text="Try the search bar or a quick pick above to see its documents."
    />

    <MockDocumentResult
      v-if="activeDoc && stateFor(activeDoc).status === 'analyzed'"
      :key="activeDoc.id"
      :analysis="activeDoc.analysis"
      :document-text="activeDoc.documentText"
      :doc-key="activeDoc.id"
    />
  </div>
</template>

<style scoped>
.search-results {
  border: 1px solid rgb(var(--v-theme-surface-variant));
}

.border-primary {
  border-color: rgb(var(--v-theme-primary)) !important;
}
</style>
