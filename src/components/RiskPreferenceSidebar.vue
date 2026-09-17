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
type ActiveInfo = { key: string; name: string; description: string; top: number; left: number; placement: 'left' | 'right' }
const activeInfo = ref<ActiveInfo | null>(null)
const preferenceListEl = ref<HTMLElement | null>(null)
let infoHoverTimer: ReturnType<typeof setTimeout> | undefined

function showInfo(target: HTMLElement, key: string, name: string, description: string) {
  const rect = target.getBoundingClientRect()
  const bubbleWidth = 260
  const fitsRight = rect.right + 12 + bubbleWidth <= window.innerWidth
  activeInfo.value = {
    key,
    name,
    description,
    top: rect.top + rect.height / 2,
    left: fitsRight ? rect.right + 12 : rect.left - 12,
    placement: fitsRight ? 'right' : 'left',
  }
}

function toggleInfo(event: MouseEvent, key: string, name: string, description: string) {
  cancelInfoHover()
  if (activeInfo.value?.key === key) {
    activeInfo.value = null
    return
  }
  showInfo(event.currentTarget as HTMLElement, key, name, description)
}

function scheduleInfo(event: MouseEvent, key: string, name: string, description: string) {
  cancelInfoHover()
  const target = event.currentTarget as HTMLElement
  infoHoverTimer = window.setTimeout(() => showInfo(target, key, name, description), 500)
}

function cancelInfoHover() {
  if (infoHoverTimer !== undefined) clearTimeout(infoHoverTimer)
  infoHoverTimer = undefined
}

function closeInfo() {
  cancelInfoHover()
  activeInfo.value = null
}

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

onMounted(() => {
  desktopQuery.addEventListener('change', syncOpenToViewport)
  window.addEventListener('click', closeInfo)
  window.addEventListener('resize', closeInfo)
  preferenceListEl.value?.addEventListener('scroll', closeInfo, { passive: true })
})
onBeforeUnmount(() => {
  cancelInfoHover()
  desktopQuery.removeEventListener('change', syncOpenToViewport)
  window.removeEventListener('click', closeInfo)
  window.removeEventListener('resize', closeInfo)
  preferenceListEl.value?.removeEventListener('scroll', closeInfo)
})
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

        <fieldset
          class="preference-fieldset"
          :class="{ 'preference-fieldset--disabled': !riskPreferencesEnabled }"
          :disabled="!riskPreferencesEnabled"
        >
        <div ref="preferenceListEl" class="preference-list">
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
    </details>
  </aside>

  <Teleport to="body">
    <Transition name="preference-tooltip">
      <div
        v-if="activeInfo"
        class="preference-popover"
        :class="`preference-popover--${activeInfo.placement}`"
        :style="{ top: `${activeInfo.top}px`, left: `${activeInfo.left}px` }"
        role="tooltip"
        :aria-label="activeInfo.name"
      >
        <div class="preference-popover-bubble">
          <div class="preference-popover-header">
            <span class="preference-popover-title">{{ activeInfo.name }}</span>
          </div>
          <p class="preference-popover-body">{{ activeInfo.description }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
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

.preference-popover {
  position: fixed;
  z-index: 1080;
  width: 260px;
  max-width: calc(100vw - 2rem);
  transform: translateY(-50%);
}

.preference-popover--left {
  transform: translate(-100%, -50%);
}

.preference-popover-bubble {
  position: relative;
  background-color: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color-translucent);
  border-radius: 0.75rem;
  box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.2);
  padding: 0.65rem 0.8rem;
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

.preference-tooltip-enter-active,
.preference-tooltip-leave-active {
  transition: opacity 0.18s ease;
}

.preference-tooltip-enter-active .preference-popover-bubble,
.preference-tooltip-leave-active .preference-popover-bubble {
  transition: transform 0.18s ease;
}

.preference-tooltip-enter-from,
.preference-tooltip-leave-to {
  opacity: 0;
}

.preference-tooltip-enter-from .preference-popover-bubble,
.preference-tooltip-leave-to .preference-popover-bubble {
  transform: translateY(0.2rem) scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .preference-tooltip-enter-active,
  .preference-tooltip-leave-active,
  .preference-tooltip-enter-active .preference-popover-bubble,
  .preference-tooltip-leave-active .preference-popover-bubble {
    transition: none;
  }
}

.preference-popover-bubble::before {
  content: '';
  position: absolute;
  top: 50%;
  width: 0.65rem;
  height: 0.65rem;
  background-color: var(--bs-body-bg);
}

.preference-popover--right .preference-popover-bubble::before {
  left: -0.33rem;
  border-bottom: 1px solid var(--bs-border-color-translucent);
  border-left: 1px solid var(--bs-border-color-translucent);
  transform: translateY(-50%) rotate(45deg);
}

.preference-popover--left .preference-popover-bubble::before {
  right: -0.33rem;
  border-top: 1px solid var(--bs-border-color-translucent);
  border-right: 1px solid var(--bs-border-color-translucent);
  transform: translateY(-50%) rotate(45deg);
}

.preference-popover-header {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
}

.preference-popover-title {
  flex-grow: 1;
  font-size: 0.85rem;
  font-weight: 600;
}

.preference-popover-body {
  margin: 0;
  font-size: 0.8rem;
  color: var(--bs-secondary-color);
  line-height: 1.35;
}
</style>
