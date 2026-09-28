// Shared "what does this mean" hover bubble: a fixed-position popover
// (rendered by HoverTooltipBubble.vue, teleported to <body>) positioned next
// to whatever triggered it. Originally built for RiskPreferenceSidebar's
// half-second hover delay; `delayMs` lets other callers show it instantly.
import { onBeforeUnmount, onMounted, ref } from 'vue'

export type HoverTooltipInfo = {
  key: string
  name: string
  description: string
  top: number
  left: number
  placement: 'left' | 'right'
}

const BUBBLE_WIDTH = 260
const DEFAULT_DELAY_MS = 500

export function useHoverTooltip(getScrollContainer?: () => HTMLElement | null | undefined) {
  const activeInfo = ref<HoverTooltipInfo | null>(null)
  let hoverTimer: ReturnType<typeof setTimeout> | undefined

  /** `rightEdge`/`leftEdge` differ for an element (its two edges); a point passes the same value for both. */
  function place(top: number, rightEdge: number, leftEdge: number, key: string, name: string, description: string) {
    const fitsRight = rightEdge + 12 + BUBBLE_WIDTH <= window.innerWidth
    activeInfo.value = {
      key,
      name,
      description,
      top,
      left: fitsRight ? rightEdge + 12 : leftEdge - 12,
      placement: fitsRight ? 'right' : 'left',
    }
  }

  function showInfo(target: Element, key: string, name: string, description: string) {
    const rect = target.getBoundingClientRect()
    place(rect.top + rect.height / 2, rect.right, rect.left, key, name, description)
  }

  function showInfoAtPoint(x: number, y: number, key: string, name: string, description: string) {
    place(y, x, x, key, name, description)
  }

  function cancelHover() {
    if (hoverTimer !== undefined) clearTimeout(hoverTimer)
    hoverTimer = undefined
  }

  /** Hover intent on a real trigger element (button, row, …): positions off its own edge. */
  function scheduleInfo(
    event: MouseEvent,
    key: string,
    name: string,
    description: string,
    delayMs = DEFAULT_DELAY_MS,
  ) {
    cancelHover()
    const target = event.currentTarget as Element
    if (delayMs <= 0) {
      showInfo(target, key, name, description)
      return
    }
    hoverTimer = window.setTimeout(() => showInfo(target, key, name, description), delayMs)
  }

  /**
   * Hover intent anchored to the pointer instead of the trigger's own edge —
   * for stacked/overlapping shapes (e.g. donut-chart segments) whose
   * bounding rects are identical regardless of which one is hovered.
   */
  function scheduleInfoAtPointer(
    event: MouseEvent,
    key: string,
    name: string,
    description: string,
    delayMs = DEFAULT_DELAY_MS,
  ) {
    cancelHover()
    const { clientX, clientY } = event
    if (delayMs <= 0) {
      showInfoAtPoint(clientX, clientY, key, name, description)
      return
    }
    hoverTimer = window.setTimeout(() => showInfoAtPoint(clientX, clientY, key, name, description), delayMs)
  }

  function toggleInfo(event: MouseEvent, key: string, name: string, description: string) {
    cancelHover()
    if (activeInfo.value?.key === key) {
      activeInfo.value = null
      return
    }
    showInfo(event.currentTarget as Element, key, name, description)
  }

  function closeInfo() {
    cancelHover()
    activeInfo.value = null
  }

  onMounted(() => {
    window.addEventListener('click', closeInfo)
    window.addEventListener('resize', closeInfo)
    getScrollContainer?.()?.addEventListener('scroll', closeInfo, { passive: true })
  })
  onBeforeUnmount(() => {
    cancelHover()
    window.removeEventListener('click', closeInfo)
    window.removeEventListener('resize', closeInfo)
    getScrollContainer?.()?.removeEventListener('scroll', closeInfo)
  })

  return { activeInfo, scheduleInfo, scheduleInfoAtPointer, toggleInfo, closeInfo }
}
