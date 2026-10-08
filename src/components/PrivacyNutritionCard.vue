<script setup lang="ts">
/**
 * PrivacyNutritionCard.vue: plain-language, dashboard-style summary of a
 * document's risk — a "nutrition label" for its terms/privacy document.
 * Purely presentational (no emits): the score/scorecard are derived straight
 * from `analysis` and the current risk preferences, so this same component
 * can be reused unchanged for a future side-by-side comparison view.
 */
import { computed } from 'vue'
import DocumentRiskOverview from '@/components/DocumentRiskOverview.vue'
import HoverTooltipBubble from '@/components/HoverTooltipBubble.vue'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { aggregateScorecardRows } from '@/lib/category-aggregation'
import { categoryColor } from '@/lib/category-colors'
import { buildCategoryPieSlices, PIE_RADIUS } from '@/lib/category-pie'
import type { Analysis } from '@/types'

const { analysis, categoryPriority, enabledCategoryIds, riskPreferencesEnabled } = defineProps<{
  analysis: Analysis
  categoryPriority: string[]
  enabledCategoryIds: Set<string>
  riskPreferencesEnabled: boolean
}>()

const scorecardRows = computed(() => aggregateScorecardRows(analysis))
const detectedCount = computed(() => scorecardRows.value.filter((row) => row.detected).length)

const pieSlices = computed(() => buildCategoryPieSlices(scorecardRows.value))
const pieViewBoxSize = PIE_RADIUS * 2 + 16 // stroke width (16) needs half its width as margin on each side
const pieCenter = pieViewBoxSize / 2

/** Share of total tagged occurrences each detected category accounts for — same figures as the pie slices. */
const percentageByCategoryId = computed(() => new Map(pieSlices.value.map((slice) => [slice.id, slice.percentage])))

// Same "what does this mean" bubble as RiskPreferenceSidebar, but instant
// (delayMs 0) rather than its half-second hover delay.
const { activeInfo, scheduleInfo, scheduleInfoAtPointer, closeInfo } = useHoverTooltip()
</script>

<template>
  <div class="privacy-nutrition-card" v-bind="$attrs">
    <DocumentRiskOverview
      :analysis="analysis"
      :category-priority="categoryPriority"
      :enabled-category-ids="enabledCategoryIds"
      :risk-preferences-enabled="riskPreferencesEnabled"
      class="mb-2"
    />

    <div class="row g-3">
      <div class="col-md-7">
        <table class="table table-sm scorecard-table mb-0">
          <thead>
            <tr>
              <th scope="col">Risk category</th>
              <th scope="col" class="text-end">Detected</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="category in scorecardRows"
              :key="category.id"
              @mouseenter="scheduleInfo($event, category.id, category.name, category.description, 0)"
              @mouseleave="closeInfo"
            >
              <td>
                <span class="category-dot" :style="{ backgroundColor: categoryColor(category.id) }"></span>
                {{ category.name }}
              </td>
              <td class="text-end">
                <span v-if="category.detected" class="d-inline-flex align-items-center gap-2">
                  <span class="small text-body-secondary">
                    {{ category.occurrences }} ({{ percentageByCategoryId.get(category.id) }}%)
                  </span>
                  <span class="badge rounded-pill text-bg-danger">
                    <i class="bi bi-check-lg" aria-hidden="true"></i>
                    <span class="visually-hidden">Detected</span>
                  </span>
                </span>
                <span v-else class="text-body-tertiary" aria-label="Not detected">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="col-md-5 d-flex flex-column align-items-center justify-content-center">
        <svg
          v-if="pieSlices.length"
          :viewBox="`0 0 ${pieViewBoxSize} ${pieViewBoxSize}`"
          class="category-pie"
          role="img"
          :aria-label="`${detectedCount} of ${scorecardRows.length} risk categories detected, by share of tagged clauses`"
        >
          <circle
            :cx="pieCenter"
            :cy="pieCenter"
            :r="PIE_RADIUS"
            fill="none"
            stroke="var(--bs-tertiary-bg)"
            stroke-width="16"
          />
          <circle
            v-for="slice in pieSlices"
            :key="slice.id"
            :cx="pieCenter"
            :cy="pieCenter"
            :r="PIE_RADIUS"
            fill="none"
            :stroke="categoryColor(slice.id)"
            stroke-width="16"
            :stroke-dasharray="slice.dasharray"
            :stroke-dashoffset="slice.dashoffset"
            :transform="`rotate(-90 ${pieCenter} ${pieCenter})`"
            class="category-pie-slice"
            @mouseenter="
              scheduleInfoAtPointer($event, slice.id, slice.name, `${slice.count} occurrences (${slice.percentage}%)`, 0)
            "
            @mouseleave="closeInfo"
          />
          <text :x="pieCenter" :y="pieCenter - 4" text-anchor="middle" class="pie-center-value">
            {{ detectedCount }}/{{ scorecardRows.length }}
          </text>
          <text :x="pieCenter" :y="pieCenter + 14" text-anchor="middle" class="pie-center-label">detected</text>
        </svg>
        <p v-else class="small text-body-secondary text-center mb-0">No risk categories were detected.</p>
      </div>
    </div>
  </div>

  <HoverTooltipBubble :info="activeInfo" />
</template>

<style scoped>
.scorecard-table {
  --bs-table-bg: transparent;
}

.scorecard-table th {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--bs-secondary-color);
  font-weight: 600;
  border-bottom-width: 1px;
}

.category-dot {
  display: inline-block;
  flex: none;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  margin-right: 0.5rem;
}

.category-pie {
  width: 100%;
  max-width: 170px;
}

.category-pie-slice {
  transition: opacity 0.15s ease;
}

.category-pie-slice:hover {
  opacity: 0.8;
}

.pie-center-value {
  font-size: 0.95rem;
  font-weight: 700;
  fill: var(--bs-body-color);
}

.pie-center-label {
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  fill: var(--bs-secondary-color);
}
</style>
