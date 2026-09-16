<script setup lang="ts">
/**
 * RiskPreferenceSidebar.vue: chunk 5, to the left of every other section.
 *
 * Toggle cards for the risk categories a clause can be tagged with: the 8
 * ToS labels the model predicts, plus the 11 rule-based privacy labels
 * (server/privacy-rules.ts) collapsed into a single "Privacy" card with an
 * "Advanced" expander for the individual sub-categories. Toggling a card
 * feeds `enabledCategoryIds` back up to App.vue, which uses it to filter
 * the clause list in ClausesPanel.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import draggable from 'vuedraggable'
import { categoryColor } from '@/lib/category-colors'
import { PRIVACY_CATEGORIES, PRIVACY_GROUP, TOS_CATEGORIES } from '@/lib/risk-categories'

type PreferenceCategory = { id: string; name: string; description: string; enabled: boolean }

const enabledCategoryIds = defineModel<Set<string>>('enabledCategoryIds', { required: true })
const categoryPriority = defineModel<string[]>('categoryPriority', { required: true })

type TopLevelPreference =
  | { kind: 'category'; id: string; category: PreferenceCategory }
  | { kind: 'privacy'; id: 'privacy' }

const initialRank = new Map(categoryPriority.value.map((id, index) => [id, index]))
const topLevelPreferences = ref<TopLevelPreference[]>([
  ...TOS_CATEGORIES.map(
    (category): TopLevelPreference => ({
      kind: 'category',
      id: category.id,
      category: { ...category, enabled: enabledCategoryIds.value.has(category.id) },
    }),
  ),
  { kind: 'privacy', id: 'privacy' } as TopLevelPreference,
].sort((a, b) => {
  const rank = (item: TopLevelPreference) =>
    item.kind === 'privacy'
      ? Math.min(...PRIVACY_CATEGORIES.map((category) => initialRank.get(category.id) ?? Number.MAX_SAFE_INTEGER))
      : initialRank.get(item.id) ?? Number.MAX_SAFE_INTEGER
  return rank(a) - rank(b)
}))
const privacyCategories = ref<PreferenceCategory[]>(
  PRIVACY_CATEGORIES.map((category) => ({ ...category, enabled: enabledCategoryIds.value.has(category.id) })).sort(
    (a, b) =>
      (initialRank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (initialRank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  ),
)
const advancedOpen = ref(false)

const privacyAllEnabled = computed(() => privacyCategories.value.every((category) => category.enabled))
const privacySomeEnabled = computed(() => privacyCategories.value.some((category) => category.enabled))
const privacyMasterInput = ref<HTMLInputElement | null>(null)

watchEffect(() => {
  if (privacyMasterInput.value) {
    privacyMasterInput.value.indeterminate = privacySomeEnabled.value && !privacyAllEnabled.value
  }
})

function togglePrivacyGroup() {
  const nextValue = !privacyAllEnabled.value
  privacyCategories.value.forEach((category) => (category.enabled = nextValue))
}

// Recompute the emitted set whenever any individual card flips.
watch(
  [topLevelPreferences, privacyCategories],
  () => {
    const next = new Set<string>()
    for (const item of topLevelPreferences.value) {
      if (item.kind === 'category' && item.category.enabled) next.add(item.category.id)
    }
    for (const category of privacyCategories.value) if (category.enabled) next.add(category.id)
    enabledCategoryIds.value = next

    categoryPriority.value = topLevelPreferences.value.flatMap((item) =>
      item.kind === 'privacy' ? privacyCategories.value.map((category) => category.id) : [item.category.id],
    )
  },
  { deep: true },
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
          Drag preferences to set their priority. Clauses matching the first preference appear first.
        </p>

        <div class="preference-list">
          <draggable
            v-model="topLevelPreferences"
            item-key="id"
            handle=".preference-drag-handle"
            ghost-class="preference-card-ghost"
            chosen-class="preference-card-chosen"
          >
            <template #item="{ element: item }">
              <div>
                <div class="preference-card">
                  <button class="preference-drag-handle" type="button" aria-label="Drag to change priority">
                    <i class="bi bi-grip-vertical" aria-hidden="true"></i>
                  </button>
                  <template v-if="item.kind === 'category'">
                    <span class="preference-dot" :style="{ backgroundColor: categoryColor(item.category.id) }"></span>
                    <div class="preference-text flex-grow-1">
                      <div class="preference-name">{{ item.category.name }}</div>
                      <div class="preference-description">{{ item.category.description }}</div>
                    </div>
                    <div class="form-check form-switch mb-0">
                      <input
                        :id="`pref-${item.category.id}`"
                        v-model="item.category.enabled"
                        class="form-check-input"
                        type="checkbox"
                        role="switch"
                        :aria-label="`Include ${item.category.name} in risk preferences`"
                      />
                    </div>
                  </template>
                  <template v-else>
                    <span class="preference-dot" :style="{ backgroundColor: categoryColor(PRIVACY_GROUP.id) }"></span>
                    <div class="preference-text flex-grow-1">
                      <div class="preference-name">{{ PRIVACY_GROUP.name }}</div>
                      <div class="preference-description">{{ PRIVACY_GROUP.description }}</div>
                    </div>
                    <div class="form-check form-switch mb-0">
                      <input
                        id="pref-privacy-group"
                        ref="privacyMasterInput"
                        class="form-check-input"
                        type="checkbox"
                        role="switch"
                        :checked="privacyAllEnabled"
                        :aria-label="`Include ${PRIVACY_GROUP.name} in risk preferences`"
                        @change="togglePrivacyGroup"
                      />
                    </div>
                  </template>
                </div>

                <template v-if="item.kind === 'privacy'">
                  <button
                    type="button"
                    class="btn btn-sm btn-link p-0 mb-2 preference-advanced-toggle"
                    :aria-expanded="advancedOpen"
                    @click="advancedOpen = !advancedOpen"
                  >
                    <i class="bi" :class="advancedOpen ? 'bi-chevron-down' : 'bi-chevron-right'" aria-hidden="true"></i>
                    Advanced: individual privacy categories
                  </button>
                  <draggable
                    v-if="advancedOpen"
                    v-model="privacyCategories"
                    class="preference-sublist"
                    item-key="id"
                    handle=".preference-drag-handle"
                    ghost-class="preference-card-ghost"
                  >
                    <template #item="{ element: category }">
                      <div class="preference-card preference-subcard">
                        <button class="preference-drag-handle" type="button" aria-label="Drag to change privacy priority">
                          <i class="bi bi-grip-vertical" aria-hidden="true"></i>
                        </button>
                        <span class="preference-dot" :style="{ backgroundColor: categoryColor(category.id) }"></span>
                        <div class="preference-text flex-grow-1">
                          <div class="preference-name">{{ category.name }}</div>
                          <div class="preference-description">{{ category.description }}</div>
                        </div>
                        <div class="form-check form-switch mb-0">
                          <input
                            :id="`pref-${category.id}`"
                            v-model="category.enabled"
                            class="form-check-input"
                            type="checkbox"
                            role="switch"
                            :aria-label="`Include ${category.name} in risk preferences`"
                          />
                        </div>
                      </div>
                    </template>
                  </draggable>
                </template>
              </div>
            </template>
          </draggable>
        </div>
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
  margin: -0.25rem 0 -0.25rem -0.35rem;
  padding: 0.25rem 0.1rem;
  border: 0;
  color: var(--bs-secondary-color);
  background: transparent;
  cursor: grab;
  touch-action: none;
}

.preference-drag-handle:active {
  cursor: grabbing;
}

.preference-card-ghost {
  opacity: 0.35;
}

.preference-card-chosen .preference-card {
  box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.12);
}

.preference-subcard {
  margin-left: 1rem;
  background-color: var(--bs-body-bg);
}

.preference-dot {
  flex: none;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  margin-top: 0.3rem;
  align-self: flex-start;
}

.preference-text {
  min-width: 0;
}

.preference-name {
  font-size: 0.85rem;
}

.preference-description {
  font-size: 0.75rem;
  color: var(--bs-secondary-color);
  line-height: 1.3;
}

.preference-advanced-toggle {
  font-size: 0.8rem;
  text-decoration: none;
}

.preference-sublist {
  margin-bottom: 0.45rem;
}
</style>
