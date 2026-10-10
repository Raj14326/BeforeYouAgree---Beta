<script setup lang="ts">
/**
 * RiskPreferencePanel.vue: the body of the global "Risk preferences" dialog
 * (RiskPreferenceSettings, in the header).
 *
 * Toggle cards for the risk categories a clause can be tagged with: the 8 ToS
 * labels predicted by the model plus 11 rule-based privacy labels, collapsed
 * into a single "Privacy" card with an
 * "Advanced" expander for the individual sub-categories. Toggling a card
 * feeds `enabledCategoryIds` back up, which ClausesPanel and CompareView use
 * to filter and score clauses.
 */
import { computed, ref, watch, watchEffect } from 'vue'
import draggable from 'vuedraggable'
import HoverTooltipBubble from '@/components/HoverTooltipBubble.vue'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { categoryColor } from '@/lib/category-colors'
import { PRIVACY_CATEGORIES, PRIVACY_GROUP, TOS_CATEGORIES } from '@/lib/risk-categories'

type PreferenceCategory = { id: string; name: string; description: string; enabled: boolean }

const enabledCategoryIds = defineModel<Set<string>>('enabledCategoryIds', { required: true })
const categoryPriority = defineModel<string[]>('categoryPriority', { required: true })
const riskPreferencesEnabled = defineModel<boolean>('riskPreferencesEnabled', { required: true })

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

// "What does this mean" bubble, opened after a half-second pointer hover or
// immediately by click/keyboard activation. `key` identifies its trigger.
const preferenceListEl = ref<HTMLElement | null>(null)
const { activeInfo, scheduleInfo, toggleInfo, closeInfo } = useHoverTooltip(() => preferenceListEl.value)

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
</script>

<template>
  <div class="risk-preference-panel">
    <div class="preference-master d-flex align-items-center justify-content-between gap-3 mb-2">
      <label class="small fw-medium" for="risk-preferences-enabled">Use risk preferences</label>
      <div class="form-check form-switch mb-0">
        <input
          id="risk-preferences-enabled"
          v-model="riskPreferencesEnabled"
          class="form-check-input"
          type="checkbox"
          role="switch"
          aria-label="Enable risk preferences"
        />
      </div>
    </div>
    <p class="small text-body-secondary">
      Drag preferences to set their priority. Clauses matching the first preference appear first.
    </p>

    <!-- Scroll on a plain div: Chrome neither clips a fieldset's overflow nor
         lets it size a flex child, so either would spill out of the dialog. -->
    <div ref="preferenceListEl" class="preference-scroll">
    <fieldset
      class="preference-fieldset"
      :class="{ 'preference-fieldset--disabled': !riskPreferencesEnabled }"
      :disabled="!riskPreferencesEnabled"
    >
    <div class="preference-list">
      <draggable
        v-model="topLevelPreferences"
        :disabled="!riskPreferencesEnabled"
        item-key="id"
        handle=".preference-drag-handle"
        ghost-class="preference-card-ghost"
        chosen-class="preference-card-chosen"
      >
        <template #item="{ element: item }">
          <div>
            <div
              class="preference-card"
              :class="{ 'preference-card--group-open': item.kind === 'privacy' && advancedOpen }"
            >
              <button class="preference-drag-handle" type="button" aria-label="Drag to change priority">
                <i class="bi bi-grip-vertical" aria-hidden="true"></i>
              </button>
              <template v-if="item.kind === 'category'">
                <span class="preference-dot" :style="{ backgroundColor: categoryColor(item.category.id) }"></span>
                <div class="preference-text flex-grow-1">
                  <div class="preference-name">{{ item.category.name }}</div>
                </div>
                <button
                  type="button"
                  class="preference-info-btn"
                  :class="{ 'preference-info-btn--active': activeInfo?.key === item.category.id }"
                  :aria-label="`About ${item.category.name}`"
                  @mouseenter="scheduleInfo($event, item.category.id, item.category.name, item.category.description)"
                  @mouseleave="closeInfo"
                  @click.stop="toggleInfo($event, item.category.id, item.category.name, item.category.description)"
                >
                  <i class="bi bi-info-circle" aria-hidden="true"></i>
                </button>
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
                </div>
                <button
                  type="button"
                  class="preference-info-btn"
                  :class="{ 'preference-info-btn--active': activeInfo?.key === 'privacy-group' }"
                  :aria-label="`About ${PRIVACY_GROUP.name}`"
                  @mouseenter="scheduleInfo($event, 'privacy-group', PRIVACY_GROUP.name, PRIVACY_GROUP.description)"
                  @mouseleave="closeInfo"
                  @click.stop="toggleInfo($event, 'privacy-group', PRIVACY_GROUP.name, PRIVACY_GROUP.description)"
                >
                  <i class="bi bi-info-circle" aria-hidden="true"></i>
                </button>
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
                <button
                  type="button"
                  class="preference-expand-btn"
                  :aria-expanded="advancedOpen"
                  :aria-label="advancedOpen ? 'Hide individual privacy categories' : 'Show individual privacy categories'"
                  @click="advancedOpen = !advancedOpen"
                >
                  <i class="bi" :class="advancedOpen ? 'bi-chevron-up' : 'bi-chevron-down'" aria-hidden="true"></i>
                </button>
              </template>
            </div>

            <template v-if="item.kind === 'privacy' && advancedOpen">
              <div class="preference-subgroup">
                <draggable
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
                      </div>
                      <button
                        type="button"
                        class="preference-info-btn"
                        :class="{ 'preference-info-btn--active': activeInfo?.key === category.id }"
                        :aria-label="`About ${category.name}`"
                        @mouseenter="scheduleInfo($event, category.id, category.name, category.description)"
                        @mouseleave="closeInfo"
                        @click.stop="toggleInfo($event, category.id, category.name, category.description)"
                      >
                        <i class="bi bi-info-circle" aria-hidden="true"></i>
                      </button>
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
              </div>
            </template>
          </div>
        </template>
      </draggable>
    </div>
    </fieldset>
    </div>

    <!-- Rendered in place, not teleported to <body>: the panel lives in a modal
         <dialog>, whose top layer would otherwise hide the bubble. -->
    <HoverTooltipBubble :info="activeInfo" inline />
  </div>
</template>

<style scoped>
.risk-preference-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.preference-scroll {
  flex: 1 1 auto;
  min-height: 0;
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

.preference-card--group-open {
  margin-bottom: 0;
  border-radius: var(--bs-border-radius-sm) var(--bs-border-radius-sm) 0 0;
  border-bottom-color: transparent;
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

.preference-subgroup {
  padding: 0.4rem 0.4rem 0.4rem 1.4rem;
  border: 1px solid var(--bs-border-color-translucent);
  border-top: 0;
  border-radius: 0 0 var(--bs-border-radius-sm) var(--bs-border-radius-sm);
  background-color: var(--bs-tertiary-bg);
  margin-bottom: 0.45rem;
}

.preference-subcard {
  background-color: var(--bs-body-bg);
  margin-bottom: 0.35rem;
}

.preference-subcard:last-child {
  margin-bottom: 0;
}

.preference-dot {
  flex: none;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  align-self: center;
}

.preference-text {
  min-width: 0;
}

.preference-name {
  font-size: 0.85rem;
}

.preference-info-btn {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: var(--bs-secondary-color);
  background: transparent;
  cursor: pointer;
  font-size: 0.85rem;
}

.preference-info-btn:hover,
.preference-info-btn--active {
  color: var(--bs-body-color);
  background-color: var(--bs-border-color-translucent);
}

.preference-expand-btn {
  flex: none;
  display: flex;
  align-items: center;
  padding: 0.15rem 0.2rem;
  margin: -0.25rem -0.35rem -0.25rem 0;
  border: 0;
  border-radius: var(--bs-border-radius-sm);
  color: var(--bs-secondary-color);
  background: transparent;
}

.preference-expand-btn:hover {
  color: var(--bs-body-color);
}

.preference-sublist {
  margin-bottom: 0;
}

.preference-fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  transition: opacity 0.15s ease;
}

.preference-fieldset--disabled {
  opacity: 0.5;
}
</style>
