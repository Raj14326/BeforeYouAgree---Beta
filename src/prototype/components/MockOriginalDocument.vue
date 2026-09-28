<script setup lang="ts">
// Material-3 sibling of OriginalDocumentPanel.vue. Reuses the real
// buildDocumentViewHtml/clauseId helpers (lib/document-view.ts) so
// highlighting is computed from genuine start/end offsets, not faked — and
// reuses the shipped .clause-mark/.clause-mark-active CSS (main.css, loaded
// globally) rather than reinventing highlight styling.
import { computed } from 'vue'
import { buildDocumentViewHtml } from '@/lib/document-view'
import type { Analysis } from '@/types'

const { documentText, analysis, docKey, open } = defineProps<{
  documentText: string
  analysis: Analysis
  docKey: string
  open: boolean
}>()
defineEmits<{ toggle: [] }>()

const html = computed(() => buildDocumentViewHtml(documentText, analysis, docKey))
const hasRiskyFindings = computed(() => analysis.findings.some((finding) => finding.predictedLabel === 'risky'))
</script>

<template>
  <v-card variant="outlined" rounded="lg">
    <v-card-item>
      <v-btn
        variant="text"
        :prepend-icon="open ? 'mdi-chevron-down' : 'mdi-chevron-right'"
        :aria-expanded="open"
        aria-controls="mock-original-document-view"
        @click="$emit('toggle')"
      >
        {{ open ? 'Hide full document text' : 'Show full document text' }}
      </v-btn>
      <div v-if="hasRiskyFindings" class="text-caption text-medium-emphasis mt-1">
        <mark class="clause-mark">Highlighted</mark> passages are the clauses flagged as risky.
      </div>
    </v-card-item>
    <v-card-text v-show="open">
      <pre
        id="mock-original-document-view"
        class="original-doc-text"
        tabindex="0"
        aria-label="Document text with risky clauses highlighted"
        v-html="html"
      ></pre>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.original-doc-text {
  max-height: 420px;
  overflow: auto;
  white-space: pre-wrap;
  font-size: 0.85rem;
  line-height: 1.6;
}
</style>
