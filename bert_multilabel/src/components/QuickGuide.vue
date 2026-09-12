<script setup lang="ts">
import { ref } from 'vue'

const dialog = ref<HTMLDialogElement | null>(null)
const isOpen = ref(false)
let pointerStartedOutside = false

function openGuide() {
  if (!dialog.value) return
  dialog.value.showModal()
  isOpen.value = true
}

function closeGuide() {
  dialog.value?.close()
}

function resetGuide() {
  isOpen.value = false
  pointerStartedOutside = false
}

function isOutsidePanel(event: MouseEvent) {
  const bounds = dialog.value?.getBoundingClientRect()
  if (!bounds) return false
  return (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
}

function trackPointerStart(event: PointerEvent) {
  pointerStartedOutside = isOutsidePanel(event)
}

function dismissBackdrop(event: MouseEvent) {
  // A drag that begins inside the panel should not dismiss the guide.
  if (pointerStartedOutside && isOutsidePanel(event)) closeGuide()
  pointerStartedOutside = false
}

function keepFocusInGuide(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  const buttons = dialog.value?.querySelectorAll<HTMLButtonElement>('button')
  const first = buttons?.[0]
  const last = buttons?.item(buttons.length - 1)
  if (!first || !last) return

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <button
    type="button"
    class="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
    aria-haspopup="dialog"
    aria-controls="quick-guide"
    :aria-expanded="isOpen"
    @click="openGuide"
  >
    <i class="bi bi-question-circle" aria-hidden="true"></i>
    <span><span class="d-none d-sm-inline">3-step </span>Guide</span>
  </button>

  <Teleport to="body">
    <dialog
      id="quick-guide"
      ref="dialog"
      class="quick-guide"
      aria-labelledby="quick-guide-title"
      aria-describedby="quick-guide-description"
      @close="resetGuide"
      @pointerdown="trackPointerStart"
      @click="dismissBackdrop"
      @keydown="keepFocusInGuide"
    >
      <div class="d-flex align-items-start justify-content-between gap-3 mb-4">
        <div>
          <p class="guide-eyebrow mb-2">YOUR QUICK START</p>
          <h2 id="quick-guide-title" class="h4 fw-bold mb-2">From search to clarity</h2>
          <p id="quick-guide-description" class="text-body-secondary mb-0">
            Three simple steps to review what you're agreeing to.
          </p>
        </div>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary guide-close"
          aria-label="Close guide"
          autofocus
          @click="closeGuide"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>

      <ol class="guide-steps">
        <li>
          <span class="guide-step-number" aria-hidden="true">1</span>
          <div>
            <h3 class="h6 fw-semibold mb-1">Search for a service</h3>
            <p>
              Enter a name like Spotify or Google, then select it or choose
              <strong>Review terms</strong>.
            </p>
          </div>
        </li>
        <li>
          <span class="guide-step-number" aria-hidden="true">2</span>
          <div>
            <h3 class="h6 fw-semibold mb-1">Retrieve a document</h3>
            <p>
              Find the terms or privacy policy you want to review and choose
              <strong>Retrieve text</strong>.
            </p>
          </div>
        </li>
        <li>
          <span class="guide-step-number" aria-hidden="true">3</span>
          <div>
            <h3 class="h6 fw-semibold mb-1">Analyse the document</h3>
            <p>
              Choose <strong>Analyse risks</strong> to see potentially risky clauses, then read them
              in context.
            </p>
          </div>
        </li>
      </ol>

      <div class="guide-footer">
        <span class="small text-body-secondary">Click outside or press Esc to return.</span>
        <button type="button" class="btn btn-primary" @click="closeGuide">Got it</button>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.quick-guide {
  width: min(540px, calc(100% - 2rem));
  max-height: calc(100dvh - 2rem);
  margin: auto;
  padding: clamp(1.25rem, 4vw, 2rem);
  overflow-y: auto;
  border: 1px solid var(--bs-border-color);
  border-radius: 1.25rem;
  background: var(--bs-body-bg);
  color: var(--bs-body-color);
  box-shadow: 0 24px 80px rgb(0 0 0 / 25%);
}

.quick-guide::backdrop {
  background: rgb(9 13 25 / 40%);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}

:global(body:has(.quick-guide[open])) {
  overflow: hidden;
}

.guide-eyebrow {
  color: var(--bs-link-color);
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

.guide-steps {
  display: grid;
  gap: 1.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.guide-steps li {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.guide-step-number {
  display: grid;
  place-items: center;
  flex: 0 0 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: rgba(var(--bs-primary-rgb), 0.12);
  color: var(--bs-link-color);
  font-weight: 700;
}

.guide-steps p {
  margin: 0;
  color: var(--bs-secondary-color);
  font-size: 0.9rem;
  line-height: 1.6;
}

.guide-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1.75rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--bs-border-color);
}
</style>
