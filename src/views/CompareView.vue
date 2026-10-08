<script setup lang="ts">
/**
 * CompareView.vue: side-by-side comparison of every document added via an
 * "Add to compare" button elsewhere in the app (ServiceDocumentCard.vue).
 * Each entry renders as a trimmed overview card (score/severity/summary
 * only — see DocumentRiskOverview.vue); the full category breakdown is one
 * shared table below all the cards (CategoryComparisonTable.vue) rather
 * than repeated per card. A placeholder banner above the cards is reserved
 * for a teammate's in-progress LLM risk/safety summary (useCompareSummary.ts).
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BrandAvatar from '@/components/BrandAvatar.vue'
import CategoryComparisonTable from '@/components/CategoryComparisonTable.vue'
import ComparisonSummaryBanner from '@/components/ComparisonSummaryBanner.vue'
import DocumentRiskOverview from '@/components/DocumentRiskOverview.vue'
import { pendingReopen, useCompareList, type CompareEntry } from '@/composables/useCompareList'
import { useCompareSummary } from '@/composables/useCompareSummary'
import { useRiskPreferences } from '@/composables/useRiskPreferences'

const { entries, remove } = useCompareList()
const { enabledCategoryIds, categoryPriority, riskPreferencesEnabled } = useRiskPreferences()
const { status, summary } = useCompareSummary(entries)
const router = useRouter()

const theme = ref<'light' | 'dark'>(
  document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light',
)

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-bs-theme', theme.value)
  try {
    localStorage.setItem('bya-theme', theme.value)
  } catch {
    // Storage can be unavailable (private mode); the toggle still applies this session.
  }
}

const compareCount = computed(() => entries.value.length)

function openEntry(entry: CompareEntry) {
  if (entry.sourceRef.kind === 'upload') {
    pendingReopen.value = entry.sourceRef
    router.push('/app')
    return
  }
  router.push({
    path: '/app',
    query: {
      servicePath: entry.sourceRef.servicePath,
      serviceName: entry.sourceRef.serviceName,
      termType: entry.sourceRef.termType,
      versionUrl: entry.sourceRef.versionUrl ?? '',
    },
  })
}
</script>

<template>
  <AppHeader :theme="theme" :compare-count="compareCount" @toggle-theme="toggleTheme" />

  <main class="container app-shell my-4 my-md-5">
    <div class="mb-4">
      <h1 class="h2 fw-bold mb-2">Compare</h1>
      <p class="text-body-secondary fs-5 mb-0">See how documents you've added stack up against each other.</p>
    </div>

    <div v-if="!entries.length" class="alert alert-light border" role="status">
      Nothing added yet. Open a document and click "Add to compare" to bring it here.
    </div>

    <template v-else>
      <ComparisonSummaryBanner :status="status" :summary="summary" />

      <div class="row row-cols-1 row-cols-md-2 g-3 mb-4">
        <div v-for="entry in entries" :key="entry.id" class="col">
          <div class="card shadow-sm h-100">
            <div class="card-body d-flex flex-column">
              <div class="d-flex align-items-start gap-2 mb-3">
                <BrandAvatar :service-name="entry.serviceName" size="lg" />
                <div class="flex-grow-1">
                  <div class="fw-semibold">{{ entry.serviceName }}</div>
                  <div class="small text-body-secondary">{{ entry.displayName }}</div>
                </div>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary"
                  :aria-label="`Remove ${entry.serviceName} — ${entry.displayName} from compare`"
                  @click="remove(entry.id)"
                >
                  <i class="bi bi-x-lg" aria-hidden="true"></i>
                </button>
              </div>

              <DocumentRiskOverview
                :analysis="entry.analysis"
                :category-priority="categoryPriority"
                :enabled-category-ids="enabledCategoryIds"
                :risk-preferences-enabled="riskPreferencesEnabled"
                class="mb-3"
              />

              <button type="button" class="btn btn-sm btn-outline-primary mt-auto" @click="openEntry(entry)">
                See details
              </button>
            </div>
          </div>
        </div>
      </div>

      <CategoryComparisonTable :entries="entries" />
    </template>
  </main>
</template>
