<script setup lang="ts">
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
    <article
      :id="panelId"
      class="document-content border rounded bg-body-tertiary p-3 mb-0 mt-2"
      tabindex="0"
      aria-label="Retrieved document text with risky clauses highlighted"
      v-html="html"
    ></article>
  </section>
</template>

<style scoped>
.document-content {
  max-height: 480px;
  overflow: auto;
  line-height: 1.65;
}

.document-content :deep(h3) {
  margin: 1.25rem 0 0.5rem;
  font-size: 1.05rem;
}

.document-content :deep(:is(h3, p):first-child) {
  margin-top: 0;
}

.document-content :deep(p) {
  margin: 0 0 0.85rem;
}

.document-content :deep(:is(ul, ol)) {
  margin: 0 0 1rem;
  padding-left: 1.5rem;
}
</style>
