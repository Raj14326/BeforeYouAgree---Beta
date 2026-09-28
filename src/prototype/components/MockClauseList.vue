<script setup lang="ts">
// Material-3 sibling of ClausesPanel.vue's clause list (no filter select or
// stagger animation — this is a small fixed fixture list, not a live one).
import MockClauseCard from '@/prototype/components/MockClauseCard.vue'
import type { Analysis, RiskFinding } from '@/types'

const { analysis } = defineProps<{ analysis: Analysis }>()
const emit = defineEmits<{ 'show-in-text': [finding: RiskFinding] }>()
</script>

<template>
  <div>
    <div class="text-subtitle-1 font-weight-medium mb-3">Flagged clauses</div>
    <div v-if="!analysis.findings.length" class="text-body-2 text-medium-emphasis">
      No clauses were flagged as risky.
    </div>
    <MockClauseCard
      v-for="(finding, index) in analysis.findings"
      :key="`${finding.start}-${index}`"
      :finding="finding"
      @show-in-text="emit('show-in-text', finding)"
    />
    <p class="text-caption text-medium-emphasis mb-0">
      Automated prediction, labelled by category where applicable; not legal advice.
    </p>
  </div>
</template>
