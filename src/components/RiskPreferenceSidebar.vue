<script setup lang="ts">
/**
 * RiskPreferenceSidebar.vue: chunk 5, to the left of every other section.
 *
 * Placeholder for an upcoming preference/sorting feature: draggable,
 * toggleable cards per risk category. Reordering and the on/off state are
 * local component state only — nothing here yet feeds clause sorting.
 *
 * Category ids/names mirror the model's own categories, so they line up
 * with what's shown on each clause card:
 *  - the 8 ToS labels in ml/bert-multilabel-base-v1/config.json
 *  - the 11 privacy labels in server/privacy-rules.ts
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import draggable from 'vuedraggable'
import { categoryColor } from '@/lib/category-colors'

type PreferenceCategory = { id: string; name: string; enabled: boolean }

const categories = ref<PreferenceCategory[]>(
  [
    ['limitation_of_liability', 'Limitation of liability'],
    ['unilateral_termination', 'Unilateral termination'],
    ['unilateral_change', 'Unilateral change'],
    ['content_removal', 'Content removal'],
    ['contract_by_using', 'Contract by using'],
    ['choice_of_law', 'Choice of law'],
    ['jurisdiction', 'Jurisdiction'],
    ['arbitration', 'Arbitration'],
    ['privacy_broad_collection', 'Broad data collection'],
    ['privacy_location_tracking', 'Location tracking'],
    ['privacy_cross_service_profiling', 'Cross-service profiling'],
    ['privacy_personalized_ads', 'Personalized advertising'],
    ['privacy_content_analysis', 'Content or audio analysis'],
    ['privacy_third_party_sharing', 'Third-party data sharing'],
    ['privacy_government_disclosure', 'Government or legal disclosure'],
    ['privacy_admin_control', 'Administrator access and control'],
    ['privacy_extended_retention', 'Extended data retention'],
    ['privacy_international_transfer', 'International data transfer'],
    ['privacy_business_transfer', 'Business-transfer disclosure'],
  ].map(([id, name]) => ({ id: id!, name: name!, enabled: true })),
)

// Open by default on desktop, collapsed on narrow viewports (mirrors the
// `.layout-grid` breakpoint). Tracks the media query live, not just at
// mount, so resizing an already-open window across the breakpoint (not only
// a fresh mobile page load) still snaps the sidebar to the right state.
const desktopQuery = window.matchMedia('(min-width: 992px)')
const open = ref(desktopQuery.matches)

function syncOpenToViewport(event: MediaQueryListEvent) {
  open.value = event.matches
}

onMounted(() => desktopQuery.addEventListener('change', syncOpenToViewport))
onBeforeUnmount(() => desktopQuery.removeEventListener('change', syncOpenToViewport))
</script>

<template>
  <aside class="card shadow-sm risk-preference-sidebar">
    <details
      class="risk-preference-details"
      :open="open"
      @toggle="open = ($event.target as HTMLDetailsElement).open"
    >
      <summary class="card-body d-flex align-items-center gap-2 risk-preference-summary">
        <h2 class="h6 mb-0 flex-grow-1">Risk preferences</h2>
        <i class="bi bi-chevron-down risk-preference-chevron" aria-hidden="true"></i>
      </summary>

      <div class="card-body pt-0">
        <p class="small text-body-secondary">
          Drag to reorder priority and toggle categories on or off. Not wired to sorting yet.
        </p>

        <draggable
          v-model="categories"
          item-key="id"
          tag="div"
          class="preference-list"
          handle=".preference-drag-handle"
        >
          <template #item="{ element }: { element: PreferenceCategory }">
            <div class="preference-card">
              <i class="bi bi-grip-vertical preference-drag-handle" aria-hidden="true"></i>
              <span class="preference-dot" :style="{ backgroundColor: categoryColor(element.id) }"></span>
              <span class="preference-name flex-grow-1">{{ element.name }}</span>
              <div class="form-check form-switch mb-0">
                <input
                  :id="`pref-${element.id}`"
                  v-model="element.enabled"
                  class="form-check-input"
                  type="checkbox"
                  role="switch"
                  :aria-label="`Include ${element.name} in risk preferences`"
                />
              </div>
            </div>
          </template>
        </draggable>
      </div>
    </details>
  </aside>
</template>

<style scoped>
.risk-preference-summary {
  cursor: pointer;
  list-style: none;
}

.risk-preference-summary::-webkit-details-marker {
  display: none;
}

.risk-preference-chevron {
  transition: transform 0.15s ease;
}

.risk-preference-details[open] .risk-preference-chevron {
  transform: rotate(180deg);
}

.preference-list {
  max-height: calc(100dvh - 14rem);
  overflow-y: auto;
  padding-right: 0.25rem;
}

.preference-card {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--bs-border-color-translucent);
  border-radius: var(--bs-border-radius-sm);
  background-color: var(--bs-tertiary-bg);
  margin-bottom: 0.45rem;
}

.preference-drag-handle {
  flex: none;
  cursor: grab;
  color: var(--bs-secondary-color);
}

.preference-dot {
  flex: none;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
}

.preference-name {
  font-size: 0.85rem;
}

.sortable-ghost {
  opacity: 0.4;
}
</style>
