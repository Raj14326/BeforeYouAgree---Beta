<script setup lang="ts">
/**
 * ActionGuide.vue: "Take action" button in ServiceDocumentCard's toolbar,
 * shown once a document is analysed and has flagged clauses. Opens a modal
 * with the team's "what to do after agreeing" guidance (lib/action-guides.ts),
 * one tab per risk category the document's flagged clauses fall into: the 8
 * ToS categories plus one combined Privacy tab.
 */
import { computed, nextTick, ref } from 'vue'
import { useModalDialog } from '@/composables/useModalDialog'
import { ACTION_GUIDES, GUIDE_LINKS } from '@/lib/action-guides'
import { categoryColor } from '@/lib/category-colors'
import { PRIVACY_CATEGORIES, PRIVACY_GROUP, TOS_CATEGORIES } from '@/lib/risk-categories'
import type { Analysis, RiskFinding } from '@/types'

const { analysis, serviceName } = defineProps<{ analysis: Analysis; serviceName: string }>()

const { dialog, isOpen, open, close, onClose, onPointerdown, onClick } = useModalDialog()

const PRIVACY_IDS = new Set(PRIVACY_CATEGORIES.map((category) => category.id))
const TAB_DEFS = [
  ...TOS_CATEGORIES.map((category) => ({ ...category, matches: (id: string) => id === category.id })),
  { ...PRIVACY_GROUP, matches: (id: string) => PRIVACY_IDS.has(id) },
]

/** Same "Risky / needs review" test as ClausesPanel's default filter. */
function isFlagged(finding: RiskFinding) {
  return finding.predictedLabel === 'risky' || finding.reviewCategories.length > 0
}

/** One tab per category with at least one flagged clause, most-flagged first. */
const tabs = computed(() => {
  const flagged = analysis.findings.filter(isFlagged)
  return TAB_DEFS.map((def) => ({
    id: def.id,
    name: def.name,
    guide: ACTION_GUIDES[def.id]!,
    clauseCount: flagged.filter((finding) => finding.categories.some((category) => def.matches(category.id))).length,
  }))
    .filter((tab) => tab.clauseCount > 0)
    .sort((a, b) => b.clauseCount - a.clauseCount)
})

const activeId = ref('')
const activeTab = computed(() => tabs.value.find((tab) => tab.id === activeId.value) ?? tabs.value[0])

function openGuide() {
  activeId.value = tabs.value[0]?.id ?? ''
  open()
}

/** Arrow/Home/End keys move between tabs (WAI-ARIA tabs pattern, automatic activation). */
async function onTabKeydown(event: KeyboardEvent, index: number) {
  const last = tabs.value.length - 1
  const next =
    event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
    : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
    : event.key === 'Home' ? 0
    : event.key === 'End' ? last
    : null
  if (next === null) return
  event.preventDefault()
  await selectTab(tabs.value[next]!.id)
  document.getElementById(`action-guide-tab-${activeId.value}`)?.focus()
}

/** Activate a tab and bring it into view in the phone-width scrolling tab row. */
async function selectTab(id: string) {
  activeId.value = id
  await nextTick()
  document.getElementById(`action-guide-tab-${id}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
</script>

<template>
  <button
    v-if="tabs.length"
    type="button"
    class="btn btn-sm action-guide-trigger"
    aria-haspopup="dialog"
    aria-controls="action-guide"
    :aria-expanded="isOpen"
    @click="openGuide"
  >
    <i class="bi bi-signpost-split-fill" aria-hidden="true"></i>
    Take action
    <span class="action-guide-count" :aria-label="`${tabs.length} risk categories`">{{ tabs.length }}</span>
  </button>

  <Teleport to="body">
    <dialog
      id="action-guide"
      ref="dialog"
      class="action-guide"
      aria-labelledby="action-guide-title"
      @close="onClose"
      @pointerdown="onPointerdown"
      @click="onClick"
    >
      <div class="d-flex align-items-start justify-content-between gap-3 mb-3">
        <div>
          <p class="guide-eyebrow mb-2">WHAT YOU CAN DO</p>
          <h2 id="action-guide-title" class="h4 fw-bold mb-1">Already agreed? You still have options</h2>
          <p class="small text-body-secondary mb-0">
            {{ serviceName }}’s flagged clauses fall into {{ tabs.length }}
            {{ tabs.length === 1 ? 'category' : 'categories' }}. Australian consumers keep rights a contract can’t
            sign away.
          </p>
        </div>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary guide-close"
          aria-label="Close action guide"
          @click="close"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>

      <div class="guide-tabs" role="tablist" aria-label="Risk categories found">
        <button
          v-for="(tab, index) in tabs"
          :id="`action-guide-tab-${tab.id}`"
          :key="tab.id"
          type="button"
          role="tab"
          class="guide-tab"
          :class="{ 'guide-tab--active': tab.id === activeTab?.id }"
          :aria-selected="tab.id === activeTab?.id"
          aria-controls="action-guide-panel"
          :tabindex="tab.id === activeTab?.id ? 0 : -1"
          @click="selectTab(tab.id)"
          @keydown="onTabKeydown($event, index)"
        >
          <span class="guide-tab-dot" :style="{ backgroundColor: categoryColor(tab.id) }" aria-hidden="true"></span>
          {{ tab.name }}
          <span class="guide-tab-count" :aria-label="`${tab.clauseCount} flagged clauses`">{{ tab.clauseCount }}</span>
        </button>
      </div>

      <section
        v-if="activeTab"
        id="action-guide-panel"
        class="guide-panel"
        role="tabpanel"
        :aria-labelledby="`action-guide-tab-${activeTab.id}`"
        tabindex="0"
      >
        <p class="guide-summary">
          <strong>In plain English:</strong> {{ activeTab.guide.summary }}
        </p>

        <h3 class="guide-section-title"><i class="bi bi-list-check" aria-hidden="true"></i> Next steps</h3>
        <ol class="guide-steps">
          <li v-for="step in activeTab.guide.steps" :key="step">{{ step }}</li>
        </ol>

        <h3 class="guide-section-title"><i class="bi bi-building" aria-hidden="true"></i> Where to get help</h3>
        <ul class="guide-recourse">
          <li v-for="(item, itemIndex) in activeTab.guide.recourse" :key="itemIndex">
            <template v-for="(part, partIndex) in item" :key="partIndex">
              <a v-if="typeof part !== 'string'" :href="part.href" target="_blank" rel="noreferrer">
                {{ part.label }}<i class="bi bi-box-arrow-up-right ms-1 small" aria-hidden="true"></i>
              </a>
              <template v-else>{{ part }}</template>
            </template>
          </li>
        </ul>

        <p class="guide-note">
          <i class="bi bi-info-circle me-1" aria-hidden="true"></i>
          Start with the company’s own complaints process, then escalate. You can report a possibly unfair term to the
          <a :href="GUIDE_LINKS.acccContracts" target="_blank" rel="noreferrer">ACCC</a> at any time. Outside Victoria,
          use your state’s fair-trading agency and tribunal (e.g. NSW Fair Trading and NCAT).
        </p>
      </section>

      <div class="guide-footer">
        <p class="small text-body-secondary mb-0">General information for Australian users, not legal advice.</p>
        <button type="button" class="btn btn-primary" @click="close">Done</button>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
/* Warm, filled treatment so it reads as the next thing to do, not another neutral tool button. */
.action-guide-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid rgba(var(--bs-warning-rgb), 0.6);
  background: linear-gradient(135deg, rgba(var(--bs-warning-rgb), 0.22), rgba(var(--bs-warning-rgb), 0.08));
  color: var(--bs-warning-text-emphasis);
  font-weight: 600;
  animation: action-guide-attention 1.6s ease-out 2;
}

.action-guide-trigger:hover,
.action-guide-trigger:focus-visible {
  border-color: var(--bs-warning);
  background: rgba(var(--bs-warning-rgb), 0.3);
  color: var(--bs-warning-text-emphasis);
}

.action-guide-count {
  min-width: 1.25rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background-color: var(--bs-warning);
  color: #212529;
  font-size: 0.72rem;
  line-height: 1.25rem;
  text-align: center;
}

@keyframes action-guide-attention {
  0% {
    box-shadow: 0 0 0 0 rgba(var(--bs-warning-rgb), 0.55);
  }
  100% {
    box-shadow: 0 0 0 0.6rem rgba(var(--bs-warning-rgb), 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .action-guide-trigger {
    animation: none;
  }
}

.action-guide {
  width: min(640px, calc(100% - 2rem));
  max-height: calc(100dvh - 2rem);
  margin: auto;
  padding: clamp(1.25rem, 4vw, 1.75rem);
  border: 1px solid var(--bs-border-color);
  border-radius: 1.25rem;
  background: var(--bs-body-bg);
  color: var(--bs-body-color);
  box-shadow: 0 24px 80px rgb(0 0 0 / 25%);
}

/* Header, tabs and footer stay put; only the tab panel scrolls. */
.action-guide[open] {
  display: flex;
  flex-direction: column;
}

.action-guide::backdrop {
  background: rgb(9 13 25 / 40%);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}

:global(body:has(.action-guide[open])) {
  overflow: hidden;
}

.guide-eyebrow {
  color: var(--bs-warning-text-emphasis);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.guide-close {
  flex: none;
  font-size: 1.3rem;
  line-height: 1;
  padding: 0.4rem 0.6rem;
}

.guide-tabs {
  display: flex;
  flex: none;
  gap: 0.4rem;
  overflow-x: auto;
  padding-bottom: 0.6rem;
  margin-bottom: 0.9rem;
  border-bottom: 1px solid var(--bs-border-color);
  scrollbar-width: thin;
}

.guide-tab {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--bs-border-color-translucent);
  border-radius: 999px;
  background-color: var(--bs-tertiary-bg);
  color: var(--bs-secondary-color);
  font-size: 0.82rem;
  white-space: nowrap;
}

.guide-tab:hover {
  color: var(--bs-body-color);
}

.guide-tab--active {
  border-color: var(--bs-body-color);
  background-color: var(--bs-body-bg);
  color: var(--bs-body-color);
  font-weight: 600;
}

.guide-tab-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
}

.guide-tab-count {
  min-width: 1.1rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  background-color: var(--bs-secondary-bg);
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.1rem;
  text-align: center;
}

.guide-panel {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.guide-summary {
  padding: 0.75rem 0.9rem;
  border-left: 3px solid var(--bs-warning);
  border-radius: var(--bs-border-radius-sm);
  background-color: rgba(var(--bs-warning-rgb), 0.1);
  font-size: 0.9rem;
  line-height: 1.55;
}

.guide-section-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 1.1rem 0 0.5rem;
  font-size: 0.9rem;
  font-weight: 700;
}

.guide-steps,
.guide-recourse {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding-left: 1.3rem;
  font-size: 0.88rem;
  line-height: 1.55;
}

.guide-note {
  margin: 1.1rem 0 0;
  padding: 0.65rem 0.8rem;
  border-radius: var(--bs-border-radius-sm);
  background-color: var(--bs-tertiary-bg);
  color: var(--bs-secondary-color);
  font-size: 0.8rem;
  line-height: 1.5;
}

.guide-steps li::marker {
  color: var(--bs-warning-text-emphasis);
  font-weight: 700;
}

.guide-footer {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--bs-border-color);
}

.guide-footer .btn {
  flex: none;
}

/* Up to 9 tabs: wrap where there's room, scroll sideways on phones to save height. */
@media (min-width: 576px) {
  .guide-tabs {
    flex-wrap: wrap;
    overflow-x: visible;
  }
}
</style>
