<script setup lang="ts">
/**
 * HoverTooltipBubble.vue: the "what does this mean" popover shown by
 * useHoverTooltip. Teleported to <body> so it's never clipped by a
 * scrolling/overflow ancestor; purely presentational, driven by `info`.
 * `inline` skips the teleport, for triggers inside a modal <dialog> (its top
 * layer sits above anything in <body>); position: fixed still escapes overflow.
 */
import type { HoverTooltipInfo } from '@/composables/useHoverTooltip'

defineProps<{ info: HoverTooltipInfo | null; inline?: boolean }>()
</script>

<template>
  <Teleport to="body" :disabled="inline">
    <Transition name="hover-tooltip">
      <div
        v-if="info"
        class="hover-tooltip-popover"
        :class="`hover-tooltip-popover--${info.placement}`"
        :style="{ top: `${info.top}px`, left: `${info.left}px` }"
        role="tooltip"
        :aria-label="info.name"
      >
        <div class="hover-tooltip-bubble">
          <div class="hover-tooltip-header">
            <span class="hover-tooltip-title">{{ info.name }}</span>
          </div>
          <p class="hover-tooltip-body">{{ info.description }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.hover-tooltip-popover {
  position: fixed;
  z-index: 1080;
  width: 260px;
  max-width: calc(100vw - 2rem);
  transform: translateY(-50%);
}

.hover-tooltip-popover--left {
  transform: translate(-100%, -50%);
}

.hover-tooltip-bubble {
  position: relative;
  background-color: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color-translucent);
  border-radius: 0.75rem;
  box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.2);
  padding: 0.65rem 0.8rem;
}

.hover-tooltip-enter-active,
.hover-tooltip-leave-active {
  transition: opacity 0.18s ease;
}

.hover-tooltip-enter-active .hover-tooltip-bubble,
.hover-tooltip-leave-active .hover-tooltip-bubble {
  transition: transform 0.18s ease;
}

.hover-tooltip-enter-from,
.hover-tooltip-leave-to {
  opacity: 0;
}

.hover-tooltip-enter-from .hover-tooltip-bubble,
.hover-tooltip-leave-to .hover-tooltip-bubble {
  transform: translateY(0.2rem) scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .hover-tooltip-enter-active,
  .hover-tooltip-leave-active,
  .hover-tooltip-enter-active .hover-tooltip-bubble,
  .hover-tooltip-leave-active .hover-tooltip-bubble {
    transition: none;
  }
}

.hover-tooltip-bubble::before {
  content: '';
  position: absolute;
  top: 50%;
  width: 0.65rem;
  height: 0.65rem;
  background-color: var(--bs-body-bg);
}

.hover-tooltip-popover--right .hover-tooltip-bubble::before {
  left: -0.33rem;
  border-bottom: 1px solid var(--bs-border-color-translucent);
  border-left: 1px solid var(--bs-border-color-translucent);
  transform: translateY(-50%) rotate(45deg);
}

.hover-tooltip-popover--left .hover-tooltip-bubble::before {
  right: -0.33rem;
  border-top: 1px solid var(--bs-border-color-translucent);
  border-right: 1px solid var(--bs-border-color-translucent);
  transform: translateY(-50%) rotate(45deg);
}

.hover-tooltip-header {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
}

.hover-tooltip-title {
  flex-grow: 1;
  font-size: 0.85rem;
  font-weight: 600;
}

.hover-tooltip-body {
  margin: 0;
  font-size: 0.8rem;
  color: var(--bs-secondary-color);
  line-height: 1.35;
}
</style>
