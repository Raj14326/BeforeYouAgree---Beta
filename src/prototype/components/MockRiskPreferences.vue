<script setup lang="ts">
// Material-3 sibling of RiskPreferenceSidebar.vue — visual only, per the
// "just show the workflow" brief: real toggles (so it feels alive) but no
// wiring back into the mock analysis, no real drag-to-reorder, and no
// persistence. Reuses the real category taxonomy/colors so the categories
// listed match every other prototype screen.
import { computed, reactive, ref } from 'vue'
import { categoryColor } from '@/lib/category-colors'
import { PRIVACY_CATEGORIES, PRIVACY_GROUP, TOS_CATEGORIES } from '@/lib/risk-categories'

const riskPreferencesEnabled = ref(true)
const tosCategories = reactive(TOS_CATEGORIES.map((category) => ({ ...category, enabled: true })))
const privacyCategories = reactive(PRIVACY_CATEGORIES.map((category) => ({ ...category, enabled: true })))
const privacyExpanded = ref(false)

const privacyAllEnabled = computed(() => privacyCategories.every((category) => category.enabled))
const privacySomeEnabled = computed(() => privacyCategories.some((category) => category.enabled))

function togglePrivacyGroup() {
  const next = !privacyAllEnabled.value
  privacyCategories.forEach((category) => (category.enabled = next))
}
</script>

<template>
  <div>
    <div class="d-flex align-center justify-space-between mb-1">
      <span class="text-body-2 font-weight-medium">Use risk preferences</span>
      <v-switch v-model="riskPreferencesEnabled" color="primary" density="compact" hide-details inset />
    </div>
    <p class="text-caption text-medium-emphasis mb-4">
      Drag to set priority — clauses matching your first preference appear first in the results.
    </p>

    <div :class="{ 'preferences-disabled': !riskPreferencesEnabled }">
      <div v-for="category in tosCategories" :key="category.id" class="preference-row">
        <v-icon icon="mdi-drag-vertical" size="18" class="text-medium-emphasis" />
        <span class="preference-dot" :style="{ backgroundColor: categoryColor(category.id) }" aria-hidden="true" />
        <span class="flex-grow-1 text-body-2">{{ category.name }}</span>
        <v-tooltip :text="category.description" location="top">
          <template #activator="{ props }">
            <v-icon v-bind="props" icon="mdi-information-outline" size="18" class="text-medium-emphasis" />
          </template>
        </v-tooltip>
        <v-switch
          v-model="category.enabled"
          color="primary"
          density="compact"
          hide-details
          inset
          :disabled="!riskPreferencesEnabled"
          :aria-label="`Include ${category.name} in risk preferences`"
        />
      </div>

      <div class="preference-row" :class="{ 'preference-row--group-open': privacyExpanded }">
        <v-icon icon="mdi-drag-vertical" size="18" class="text-medium-emphasis" />
        <span class="preference-dot" :style="{ backgroundColor: categoryColor(PRIVACY_GROUP.id) }" aria-hidden="true" />
        <span class="flex-grow-1 text-body-2">{{ PRIVACY_GROUP.name }}</span>
        <v-tooltip :text="PRIVACY_GROUP.description" location="top">
          <template #activator="{ props }">
            <v-icon v-bind="props" icon="mdi-information-outline" size="18" class="text-medium-emphasis" />
          </template>
        </v-tooltip>
        <v-switch
          :model-value="privacyAllEnabled"
          :indeterminate="privacySomeEnabled && !privacyAllEnabled"
          color="primary"
          density="compact"
          hide-details
          inset
          :disabled="!riskPreferencesEnabled"
          :aria-label="`Include ${PRIVACY_GROUP.name} in risk preferences`"
          @update:model-value="togglePrivacyGroup"
        />
        <v-btn
          icon
          variant="text"
          size="small"
          :disabled="!riskPreferencesEnabled"
          :aria-expanded="privacyExpanded"
          :aria-label="privacyExpanded ? 'Hide individual privacy categories' : 'Show individual privacy categories'"
          @click="privacyExpanded = !privacyExpanded"
        >
          <v-icon :icon="privacyExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down'" />
        </v-btn>
      </div>

      <v-expand-transition>
        <div v-if="privacyExpanded" class="preference-subgroup">
          <div v-for="category in privacyCategories" :key="category.id" class="preference-row preference-row--sub">
            <v-icon icon="mdi-drag-vertical" size="18" class="text-medium-emphasis" />
            <span class="preference-dot" :style="{ backgroundColor: categoryColor(category.id) }" aria-hidden="true" />
            <span class="flex-grow-1 text-body-2">{{ category.name }}</span>
            <v-tooltip :text="category.description" location="top">
              <template #activator="{ props }">
                <v-icon v-bind="props" icon="mdi-information-outline" size="18" class="text-medium-emphasis" />
              </template>
            </v-tooltip>
            <v-switch
              v-model="category.enabled"
              color="primary"
              density="compact"
              hide-details
              inset
              :disabled="!riskPreferencesEnabled"
              :aria-label="`Include ${category.name} in risk preferences`"
            />
          </div>
        </div>
      </v-expand-transition>
    </div>
  </div>
</template>

<style scoped>
.preference-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid rgb(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  background: rgb(var(--v-theme-surface-light));
  margin-bottom: 0.5rem;
}

.preference-row--group-open {
  margin-bottom: 0;
  border-radius: 8px 8px 0 0;
  border-bottom-color: transparent;
}

.preference-row--sub {
  background: rgb(var(--v-theme-surface));
}

.preference-subgroup {
  padding: 0.5rem 0.5rem 0 1.25rem;
  border: 1px solid rgb(var(--v-border-color), var(--v-border-opacity));
  border-top: 0;
  border-radius: 0 0 8px 8px;
  background: rgb(var(--v-theme-surface-light));
  margin-bottom: 0.5rem;
}

.preference-dot {
  flex: none;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
}

.preferences-disabled {
  opacity: 0.6;
}
</style>
