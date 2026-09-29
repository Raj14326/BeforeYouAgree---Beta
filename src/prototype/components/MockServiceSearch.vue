<script setup lang="ts">
// The core "search a service, pick a document" workflow, restyled in
// Material 3 — mirrors AppView.vue's real shape (search → service's document
// cards → active document's clauses + original text) as a click-through
// mock: no real API calls, fixed delays instead of real analysis, but every
// score/highlight shown is computed for real from lib/ functions.
import { computed, onMounted, reactive, ref, watch } from 'vue'
import MockDocumentResult from '@/prototype/components/MockDocumentResult.vue'
import MockBrandAvatar from '@/prototype/components/MockBrandAvatar.vue'
import AddToCompareButton from '@/prototype/components/AddToCompareButton.vue'
import { DOCUMENT_CATALOGUE, findCatalogueDocument, type CatalogueDocument } from '@/prototype/fixtures/document-catalogue'

const { preloadEntryId } = defineProps<{ preloadEntryId?: string | null }>()

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

function toCompareEntry(doc: CatalogueDocument) {
  return {
    id: doc.id,
    serviceName: doc.serviceName,
    documentLabel: doc.documentLabel,
    documentText: doc.documentText,
    analysis: doc.analysis,
  }
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
      placeholder="Try “Service 1” or “Service 2”…"
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
      >
        <template #prepend>
          <MockBrandAvatar :service-name="service.name" :size="28" />
        </template>
      </v-list-item>
    </v-list>

    <template v-if="selectedService">
      <div class="d-flex align-center ga-2 mb-3">
        <MockBrandAvatar :service-name="selectedService.name" :size="28" />
        <span class="text-subtitle-1 font-weight-medium">{{ selectedService.name }}</span>
      </div>

      <v-card
        v-for="doc in selectedService.documents"
        :key="doc.id"
        variant="outlined"
        rounded="lg"
        class="mb-3"
        :class="{ 'border-primary': activeDocId === doc.id }"
      >
        <v-card-text class="d-flex flex-wrap align-center ga-3 py-3">
          <MockBrandAvatar :service-name="doc.serviceName" :size="40" />

          <div class="flex-grow-1" style="min-width: 160px">
            <div class="text-subtitle-1 font-weight-medium">{{ doc.documentLabel }}</div>
            <div class="text-caption text-medium-emphasis">
              {{
                stateFor(doc).status === 'analyzed'
                  ? 'Analyzed'
                  : stateFor(doc).status === 'analyzing'
                    ? 'Analyzing…'
                    : 'Not analyzed yet'
              }}
            </div>
          </div>

          <div class="d-flex flex-wrap align-center ga-2 ml-auto">
            <v-btn size="small" variant="text" append-icon="mdi-chevron-down" @click="toggleHistory(doc)">
              History
            </v-btn>
            <v-btn
              v-if="stateFor(doc).status === 'idle'"
              size="small"
              color="primary"
              variant="tonal"
              :loading="stateFor(doc).status === 'analyzing'"
              @click="analyze(doc)"
            >
              Analyze
            </v-btn>
            <v-btn
              v-else-if="stateFor(doc).status === 'analyzed' && activeDocId !== doc.id"
              size="small"
              variant="text"
              @click="activeDocId = doc.id"
            >
              View analysis
            </v-btn>
            <AddToCompareButton :entry="toCompareEntry(doc)" :disabled="stateFor(doc).status !== 'analyzed'" />
          </div>
        </v-card-text>

        <v-expand-transition>
          <div v-if="stateFor(doc).historyOpen" class="d-flex ga-2 align-center px-4 pb-4">
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
        </v-expand-transition>
      </v-card>
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
