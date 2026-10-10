<script setup lang="ts">
/**
 * FlowStepper.vue: clickable step indicator for Search → Document → Review,
 * plus a separate (unconnected) Compare node, since comparing isn't a step
 * in the linear flow — documents can be added to it from any review.
 *
 * The current step comes from the route; each other step links back to
 * wherever the user last was in it (the current service's document list,
 * the document last reviewed), read from the shared document session. A
 * step with nowhere to go yet is shown but not clickable. For an upload the
 * Document step is skipped, since the upload goes straight to Review.
 */
import { computed } from 'vue'
import { RouterLink, useRoute, type RouteLocationRaw } from 'vue-router'
import { useCompareList } from '@/composables/useCompareList'
import { useDocumentSession } from '@/composables/useDocumentSession'
import { reviewRoute, serviceRoute, uploadReviewRoute } from '@/lib/flow-routes'

type Step = {
  key: string
  label: string
  detail: string
  to: RouteLocationRaw | null
  skipped?: boolean
}

const route = useRoute()
const { entries } = useCompareList()
const { selectedService, currentServicePath, isUpload, activeTerm, loadedVersionUrl, documentLabel } =
  useDocumentSession()

const STEP_INDEX: Record<string, number> = { landing: 0, service: 1, review: 2, 'review-upload': 2 }

/** Index of the current flow step, or -1 when outside the flow (Compare). */
const currentIndex = computed(() => STEP_INDEX[String(route.name)] ?? -1)

const steps = computed<Step[]>(() => {
  const serviceName = selectedService.value?.name ?? ''
  const servicePath = currentServicePath.value

  let documentTo: RouteLocationRaw | null = null
  if (servicePath) documentTo = serviceRoute(servicePath, serviceName || undefined)

  let reviewTo: RouteLocationRaw | null = null
  if (isUpload.value) reviewTo = uploadReviewRoute
  else if (servicePath && activeTerm.value) {
    reviewTo = reviewRoute(servicePath, activeTerm.value, serviceName || undefined, loadedVersionUrl.value[activeTerm.value])
  }

  return [
    { key: 'search', label: 'Search', detail: 'Find a service', to: { name: 'landing' } },
    {
      key: 'document',
      label: 'Document',
      detail: isUpload.value ? 'Skipped for uploads' : serviceName || 'Choose a document',
      to: documentTo,
      skipped: isUpload.value,
    },
    {
      key: 'review',
      label: 'Review',
      detail: activeTerm.value ? documentLabel(activeTerm.value) : 'Read the risks',
      to: reviewTo,
    },
  ]
})

function status(index: number) {
  if (index === currentIndex.value) return 'current'
  if (steps.value[index]?.skipped) return 'skipped'
  if (currentIndex.value === -1 ? steps.value[index]?.to : index < currentIndex.value) return 'complete'
  return 'upcoming'
}

const isCompareCurrent = computed(() => route.name === 'compare')
</script>

<template>
  <nav class="flow-stepper" aria-label="Progress">
    <ol class="flow-steps">
      <li
        v-for="(step, index) in steps"
        :key="step.key"
        class="flow-step"
        :class="`flow-step-${status(index)}`"
      >
        <component
          :is="step.to && status(index) !== 'current' ? RouterLink : 'span'"
          :to="step.to && status(index) !== 'current' ? step.to : undefined"
          class="flow-step-target"
          :aria-current="status(index) === 'current' ? 'step' : undefined"
          :aria-disabled="!step.to && status(index) !== 'current' ? 'true' : undefined"
        >
          <span class="flow-step-marker" aria-hidden="true">
            <i v-if="status(index) === 'complete'" class="bi bi-check-lg"></i>
            <i v-else-if="status(index) === 'skipped'" class="bi bi-dash-lg"></i>
            <template v-else>{{ index + 1 }}</template>
          </span>
          <span class="flow-step-text">
            <span class="flow-step-label">{{ step.label }}</span>
            <span class="flow-step-detail">{{ step.detail }}</span>
          </span>
          <span v-if="status(index) === 'skipped'" class="visually-hidden">(skipped)</span>
          <span v-else-if="status(index) === 'complete'" class="visually-hidden">(completed)</span>
        </component>
      </li>
    </ol>

    <span class="flow-divider" aria-hidden="true"></span>

    <RouterLink
      to="/compare"
      class="flow-step-target flow-compare"
      :class="{ 'flow-compare-current': isCompareCurrent }"
      :aria-current="isCompareCurrent ? 'page' : undefined"
    >
      <span class="flow-step-marker" aria-hidden="true">
        <i class="bi bi-ui-checks-grid"></i>
      </span>
      <span class="flow-step-text">
        <span class="flow-step-label">Compare</span>
        <span class="flow-step-detail">
          {{ entries.length ? `${entries.length} added` : 'Nothing added yet' }}
        </span>
      </span>
      <span v-if="entries.length" class="badge rounded-pill text-bg-primary flow-compare-badge" aria-hidden="true">
        {{ entries.length }}
      </span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.flow-stepper {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}

.flow-steps {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.flow-step {
  display: flex;
  align-items: center;
  flex: 1 1 0;
  min-width: 0;
}

/* Connector line between consecutive steps. */
.flow-step:not(:last-child)::after {
  content: '';
  flex: 1 1 auto;
  height: 2px;
  min-width: 1rem;
  margin: 0 0.75rem;
  border-radius: 1px;
  background-color: var(--bs-border-color);
}

.flow-step-complete:not(:last-child)::after {
  background-color: var(--bs-primary);
}

.flow-step-target {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  padding: 0.35rem 0.5rem 0.35rem 0.35rem;
  border-radius: 999px;
  color: inherit;
  text-decoration: none;
  transition: background-color 0.15s ease;
}

a.flow-step-target:hover,
a.flow-step-target:focus-visible {
  background-color: rgba(var(--bs-primary-rgb), 0.08);
}

.flow-step-marker {
  display: grid;
  flex: none;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--bs-border-color);
  border-radius: 50%;
  background-color: var(--bs-body-bg);
  color: var(--bs-secondary-color);
  font-size: 0.85rem;
  font-weight: 700;
}

.flow-step-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.2;
}

.flow-step-label {
  font-size: 0.9rem;
  font-weight: 600;
}

.flow-step-detail {
  overflow: hidden;
  font-size: 0.75rem;
  color: var(--bs-secondary-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-step-current .flow-step-marker {
  border-color: var(--bs-primary);
  background-color: var(--bs-primary);
  color: #fff;
}

.flow-step-current .flow-step-label {
  color: var(--bs-link-color);
}

.flow-step-complete .flow-step-marker {
  border-color: var(--bs-primary);
  color: var(--bs-link-color);
}

.flow-step-upcoming span.flow-step-target,
.flow-step-skipped span.flow-step-target {
  opacity: 0.6;
}

.flow-step-skipped .flow-step-marker {
  border-style: dashed;
}

.flow-divider {
  flex: none;
  width: 1px;
  height: 2rem;
  background-color: var(--bs-border-color);
}

.flow-compare {
  position: relative;
  flex: none;
}

.flow-compare .flow-step-marker {
  border-radius: 0.6rem;
}

.flow-compare-current .flow-step-marker {
  border-color: var(--bs-primary);
  background-color: var(--bs-primary);
  color: #fff;
}

.flow-compare-current .flow-step-label {
  color: var(--bs-link-color);
}

.flow-compare-badge {
  position: absolute;
  top: 0;
  left: 1.5rem;
  font-size: 0.65rem;
}

/* Narrow screens: markers + labels only; the detail line would truncate to nothing. */
@media (max-width: 767.98px) {
  .flow-step-detail {
    display: none;
  }

  .flow-step:not(:last-child)::after {
    margin: 0 0.35rem;
  }

  .flow-stepper {
    gap: 0.5rem;
  }
}

@media (max-width: 479.98px) {
  .flow-step-text {
    display: none;
  }

  .flow-compare .flow-step-text {
    display: flex;
  }
}
</style>
