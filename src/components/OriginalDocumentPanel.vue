<script setup lang="ts">
/**
 * OriginalDocumentPanel.vue: the raw document text for the active document
 * (chunk 4). Collapsed by default; expands on toggle or when a clause's
 * "Show in original text" scrolls to it (handled by the parent, which sets
 * `open` and waits a tick before scrolling).
 */
const { html, open, panelId, hasRiskyFindings } = defineProps<{
  html: string
  open: boolean
  panelId: string
  hasRiskyFindings: boolean
}>()

</script>

<template>
  <section v-if="html && open" class="original-document-panel">
    <div class="d-flex flex-wrap align-items-center gap-2">
      <span v-if="hasRiskyFindings" class="text-body-secondary small">
        <mark class="clause-mark">Highlighted</mark> passages are the clauses flagged as risky.
      </span>
    </div>
    <pre
      :id="panelId"
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
