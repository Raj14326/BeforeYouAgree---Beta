<script setup lang="ts">
// The core product workflow as a Material 3 click-through mock: search a
// service (or paste/upload your own document) → pick a document → analyze
// → nutrition card + flagged clauses + original document with highlighting.
// No real logic is wired — every score and highlight shown is computed for
// real from the app's lib/ functions, but against static fixture data.
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import MockServiceSearch from '@/prototype/components/MockServiceSearch.vue'
import MockUploadPanel from '@/prototype/components/MockUploadPanel.vue'

const route = useRoute()

type Mode = 'search' | 'upload'
const mode = ref<Mode>(route.query.mode === 'upload' ? 'upload' : 'search')

// Set by Compare's "See details" (?entry=<catalogue-doc-id>) — simulates
// reopening a stored analysis snapshot instead of re-analysing, which is
// the real behaviour the future Phase B feature is meant to have.
const preloadEntryId = computed(() => (typeof route.query.entry === 'string' ? route.query.entry : null))
</script>

<template>
  <div>
    <h1 class="text-h4 font-weight-bold mb-1">Read what you're agreeing to</h1>
    <p class="text-body-2 text-medium-emphasis mb-6">
      Search for a service's terms and privacy documents, or bring your own — either way you get the same
      plain-language risk breakdown.
    </p>

    <v-tabs v-model="mode" color="primary" class="mb-6">
      <v-tab value="search">Search a service</v-tab>
      <v-tab value="upload">Upload or paste your own</v-tab>
    </v-tabs>

    <MockServiceSearch v-if="mode === 'search'" :preload-entry-id="preloadEntryId" />
    <MockUploadPanel v-else />
  </div>
</template>
