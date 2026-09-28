<script setup lang="ts">
// The full analysed-document view: nutrition card + flagged clauses +
// original document text, wired together the same way AppView.vue wires
// ClausesPanel + OriginalDocumentPanel — a clause's "Show in original text"
// opens the document panel and scrolls/pulses to that exact clause.
import { nextTick, ref } from 'vue'
import { clauseId } from '@/lib/document-view'
import VuetifyNutritionCard from '@/prototype/components/VuetifyNutritionCard.vue'
import MockClauseList from '@/prototype/components/MockClauseList.vue'
import MockOriginalDocument from '@/prototype/components/MockOriginalDocument.vue'
import type { Analysis, RiskFinding } from '@/types'

const { analysis, documentText, docKey } = defineProps<{
  analysis: Analysis
  documentText: string
  docKey: string
}>()

const originalDocOpen = ref(false)

async function scrollToClause(finding: RiskFinding) {
  const index = analysis.findings.indexOf(finding)
  if (index === -1) return

  originalDocOpen.value = true
  await nextTick()

  const element = document.getElementById(clauseId(docKey, index))
  if (!element) return

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
  element.classList.add('clause-mark-active')
  window.setTimeout(() => element.classList.remove('clause-mark-active'), 1600)
}
</script>

<template>
  <v-row>
    <v-col cols="12" md="7">
      <VuetifyNutritionCard :analysis="analysis" class="mb-4" />
      <MockOriginalDocument
        :document-text="documentText"
        :analysis="analysis"
        :doc-key="docKey"
        :open="originalDocOpen"
        @toggle="originalDocOpen = !originalDocOpen"
      />
    </v-col>
    <v-col cols="12" md="5">
      <MockClauseList :analysis="analysis" @show-in-text="scrollToClause" />
    </v-col>
  </v-row>
</template>
