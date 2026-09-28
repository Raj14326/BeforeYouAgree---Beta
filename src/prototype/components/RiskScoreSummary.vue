<script setup lang="ts">
// Score tile + severity chip + flagged-clause bar + summary alert — the
// part of a nutrition card every /prototype screen agrees on. Shared by
// VuetifyNutritionCard.vue (full card, home page) and CompareScoreCard.vue
// (Compare grid, no category list) so the two never drift visually.
import { computeMockRisk } from '@/prototype/lib/mock-risk'
import SeverityChip from '@/prototype/components/SeverityChip.vue'
import type { Analysis } from '@/types'

const { analysis, summary } = defineProps<{ analysis: Analysis; summary: string }>()

const risk = computeMockRisk(analysis)
const alertType = risk.level === 'high' ? 'error' : risk.level === 'medium' ? 'warning' : 'success'
</script>

<template>
  <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-4">
    <div>
      <div class="text-h4 font-weight-bold">
        {{ risk.score }} <span class="text-body-2 text-medium-emphasis">/ 100</span>
      </div>
      <div class="text-caption text-medium-emphasis">document risk score</div>
    </div>
    <SeverityChip :level="risk.level" />
  </div>

  <v-alert :type="alertType" variant="tonal" density="comfortable" class="mb-4" role="status">
    {{ summary }}
  </v-alert>

  <div>
    <div class="d-flex justify-space-between ga-2 text-body-2 mb-1">
      <span>{{ analysis.riskyClauseCount }} / {{ analysis.clauseCount }} clauses flagged</span>
      <span>{{ risk.flaggedShare }}%</span>
    </div>
    <v-progress-linear
      :model-value="risk.flaggedShare"
      :color="alertType"
      rounded
      height="8"
      :aria-label="`${risk.flaggedShare}% of clauses flagged as risky`"
    />
  </div>
</template>
