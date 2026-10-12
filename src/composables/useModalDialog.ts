/**
 * Open/close + backdrop-dismiss plumbing for a native modal <dialog>, shared
 * by the header pop-ups (QuickGuide, RiskPreferenceSettings) and ActionGuide.
 * Bind `dialog` as the element's ref and wire `onClose`, `onPointerdown` and
 * `onClick` to its close/pointerdown/click events.
 */
import { ref } from 'vue'

export function useModalDialog() {
  const dialog = ref<HTMLDialogElement | null>(null)
  const isOpen = ref(false)
  let pointerStartedOutside = false

  function open() {
    if (!dialog.value) return
    isOpen.value = true
    dialog.value.showModal()
  }

  function close() {
    dialog.value?.close()
  }

  function onClose() {
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

  function onPointerdown(event: PointerEvent) {
    pointerStartedOutside = isOutsidePanel(event)
  }

  function onClick(event: MouseEvent) {
    // A drag (text selection, reordering a card) that begins inside the panel should not dismiss it.
    if (pointerStartedOutside && isOutsidePanel(event)) close()
    pointerStartedOutside = false
  }

  return { dialog, isOpen, open, close, onClose, onPointerdown, onClick }
}
