<script setup lang="ts">
/**
 * OriginalDocumentPanel.vue: the raw document text for the active document
 * (chunk 4). Collapsed by default; expands on toggle or when a clause's
 * "Show in original text" scrolls to it (handled by the parent, which sets
 * `open` and waits a tick before scrolling).
 */
const { html, open, hasRiskyFindings } = defineProps<{
  html: string
  open: boolean
  hasRiskyFindings: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()
</script>

<template>
  <section v-if="html" class="original-document-panel">
    <div class="d-flex flex-wrap align-items-center gap-2">
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        :aria-expanded="open"
        aria-controls="original-document-view"
        @click="emit('toggle')"
      >
        <i class="bi me-1" :class="open ? 'bi-chevron-down' : 'bi-chevron-right'" aria-hidden="true"></i>
        {{ open ? 'Hide full document text' : 'Show full document text' }}
      </button>
      <span v-if="hasRiskyFindings" class="text-body-secondary small">
        <mark class="clause-mark">Highlighted</mark> passages are the clauses flagged as risky.
      </span>
    </div>
    <pre
      v-show="open"
      id="original-document-view"
      class="border rounded bg-body-tertiary p-3 mb-0 mt-2"
      tabindex="0"
      aria-label="Retrieved document text with risky clauses highlighted"
      v-html="html"
    ></pre>
  </section>
</template>

<style scoped>
pre {
  max-height: 480px;
  overflow: auto;
  white-space: pre-wrap;
}
</style>
