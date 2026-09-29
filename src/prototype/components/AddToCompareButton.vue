<script setup lang="ts">
// Shared, labelled "Add to compare" control — used from both the search
// flow's document cards and the upload/paste result, so adding a document
// to compare works the same way (and looks the same) everywhere.
//
// Deliberately toggles `variant` (outlined <-> flat) rather than keeping
// `variant="tonal"` and only swapping `color`/an active state: Vuetify's
// tonal state-layer can render fully solid with invisible same-colour text
// once a component is marked "active" (hit this on CompareScoreCard's old
// "See details" button and the quick-pick chips) — flat/outlined don't have
// that failure mode.
import { useMockCompareList, type MockCompareEntry } from '@/prototype/composables/useMockCompareList'

const { entry, disabled = false } = defineProps<{ entry: MockCompareEntry; disabled?: boolean }>()

const { add, remove, isAdded } = useMockCompareList()

function toggle() {
  if (isAdded(entry.id)) remove(entry.id)
  else add(entry)
}
</script>

<template>
  <v-btn
    size="small"
    :variant="isAdded(entry.id) ? 'flat' : 'outlined'"
    color="primary"
    :disabled="disabled"
    :prepend-icon="isAdded(entry.id) ? 'mdi-bookmark-check' : 'mdi-bookmark-plus-outline'"
    @click="toggle"
  >
    {{ isAdded(entry.id) ? 'Added to compare' : 'Add to compare' }}
  </v-btn>
</template>
