<script setup lang="ts">
/**
 * CompareView.vue: side-by-side comparison of every document added via an
 * "Add to compare" button elsewhere in the app (ServiceDocumentCard.vue).
 * Each entry renders as a trimmed overview card (score/severity/summary
 * only — see DocumentRiskOverview.vue); the full category breakdown is one
 * shared table below all the cards (CategoryComparisonTable.vue) rather
 * than repeated per card. A placeholder banner above the cards is reserved
 * for a teammate's in-progress LLM risk/safety summary (useCompareSummary.ts).
 *
 * Sits outside the Search → Document → Review flow (its own unconnected node
 * in FlowStepper); "See details" jumps back into Review for that entry.
 */
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BrandAvatar from '@/components/BrandAvatar.vue'
import CategoryComparisonTable from '@/components/CategoryComparisonTable.vue'
import ComparisonSummaryBanner from '@/components/ComparisonSummaryBanner.vue'
import DocumentRiskOverview from '@/components/DocumentRiskOverview.vue'
import FlowBar from '@/components/FlowBar.vue'
import { useCompareList, type CompareEntry } from '@/composables/useCompareList'
import { useCompareSummary } from '@/composables/useCompareSummary'
import { useDocumentSession } from '@/composables/useDocumentSession'
import { useRiskPreferences } from '@/composables/useRiskPreferences'
import { useTheme } from '@/composables/useTheme'
import { reviewRoute, uploadReviewRoute } from '@/lib/flow-routes'

const { entries, remove } = useCompareList()
const { enabledCategoryIds, categoryPriority, riskPreferencesEnabled } = useRiskPreferences()
const { status, summary } = useCompareSummary(entries)
const { startUpload } = useDocumentSession()
const { theme, toggleTheme } = useTheme()
const router = useRouter()

/**
 * Re-enter Review for a compare entry. A catalogue entry is just a route
 * (the session reloads it if needed); an upload's text isn't in the URL, so
 * it's replayed into the session first.
 */
function openEntry(entry: CompareEntry) {
  if (entry.sourceRef.kind === 'upload') {
    startUpload({ name: entry.sourceRef.name, content: entry.sourceRef.content })
    void router.push(uploadReviewRoute)
    return
  }
  const { servicePath, termType, serviceName, versionUrl } = entry.sourceRef
  void router.push(reviewRoute(servicePath, termType, serviceName, versionUrl))
}
</script>

<template>
  <AppHeader :theme="theme" @toggle-theme="toggleTheme" />
  <FlowBar />

  <main class="container app-shell my-4 my-md-5">
    <div class="mb-4">
      <h1 class="h2 fw-bold mb-2">Compare</h1>
      <p class="text-body-secondary fs-5 mb-0">See how documents you've added stack up against each other.</p>
    </div>

    <div v-if="!entries.length" class="alert alert-light border" role="status">
      Nothing added yet. Search for a service above, open a document and click "Add to compare" to bring it
      here.
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
