<script setup lang="ts">
/**
 * RiskPreferenceSettings.vue: header button that opens the global risk
 * preferences in a modal dialog. The preferences live in the
 * useRiskPreferences singleton, so they apply to every view (Review clause
 * list, Compare scores) whichever page they were changed on.
 *
 * The panel only mounts while the dialog is open: it copies the singleton
 * into local draggable lists on setup, so remounting keeps it in step with
 * changes made from another view's header.
 */
import RiskPreferencePanel from '@/components/RiskPreferencePanel.vue'
import { useModalDialog } from '@/composables/useModalDialog'
import { useRiskPreferences } from '@/composables/useRiskPreferences'

const { enabledCategoryIds, categoryPriority, riskPreferencesEnabled } = useRiskPreferences()
const { dialog, isOpen, open, close, onClose, onPointerdown, onClick } = useModalDialog()
</script>

<template>
  <button
    type="button"
    class="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
    aria-haspopup="dialog"
    aria-controls="risk-preference-settings"
    :aria-expanded="isOpen"
    @click="open"
  >
    <i class="bi bi-sliders" aria-hidden="true"></i>
    <span class="d-none d-sm-inline">Preferences</span>
    <span class="visually-hidden d-sm-none">Risk preferences</span>
    <template v-if="riskPreferencesEnabled">
      <span class="risk-settings-on-dot" title="Risk preferences are on" aria-hidden="true"></span>
      <span class="visually-hidden">(on)</span>
    </template>
  </button>

  <Teleport to="body">
    <dialog
      id="risk-preference-settings"
      ref="dialog"
      class="risk-settings"
      aria-labelledby="risk-preference-settings-title"
      @close="onClose"
      @pointerdown="onPointerdown"
      @click="onClick"
    >
      <div class="d-flex align-items-start justify-content-between gap-3 mb-3">
        <div>
          <p class="settings-eyebrow mb-2">SETTINGS</p>
          <h2 id="risk-preference-settings-title" class="h4 fw-bold mb-1">Risk preferences</h2>
          <p class="small text-body-secondary mb-0">Applies to every document you review or compare.</p>
        </div>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary settings-close"
          aria-label="Close risk preferences"
          autofocus
          @click="close"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>

      <RiskPreferencePanel
        v-if="isOpen"
        v-model:enabled-category-ids="enabledCategoryIds"
        v-model:category-priority="categoryPriority"
        v-model:risk-preferences-enabled="riskPreferencesEnabled"
        class="settings-body"
      />

      <div class="settings-footer">
        <span class="small text-body-secondary">Changes apply immediately.</span>
        <button type="button" class="btn btn-primary" @click="close">Done</button>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.risk-settings-on-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background-color: var(--bs-success);
}

.risk-settings {
  width: min(480px, calc(100% - 2rem));
  max-height: calc(100dvh - 2rem);
  margin: auto;
  padding: clamp(1.25rem, 4vw, 1.75rem);
  border: 1px solid var(--bs-border-color);
  border-radius: 1.25rem;
  background: var(--bs-body-bg);
  color: var(--bs-body-color);
  box-shadow: 0 24px 80px rgb(0 0 0 / 25%);
}

/* Header and footer stay put; only the preference list scrolls. */
.risk-settings[open] {
  display: flex;
  flex-direction: column;
}

.risk-settings::backdrop {
  background: rgb(9 13 25 / 40%);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}

:global(body:has(.risk-settings[open])) {
  overflow: hidden;
}

.settings-body {
  flex: 1 1 auto;
}

.settings-eyebrow {
  color: var(--bs-link-color);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.settings-close {
  flex: none;
  font-size: 1.3rem;
  line-height: 1;
  padding: 0.4rem 0.6rem;
}

.settings-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--bs-border-color);
}
</style>
