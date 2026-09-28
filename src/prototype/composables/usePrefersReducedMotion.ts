import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Reactive `prefers-reduced-motion` flag. Unlike AppView.vue's one-shot
 * `matchMedia(...).matches` read (used for a single scroll trigger), the
 * prototype's Vuetify transitions can be toggled live for a whole session,
 * so this listens for the OS setting changing mid-session too.
 */
export function usePrefersReducedMotion() {
  const prefersReducedMotion = ref(false)
  let query: MediaQueryList | null = null
  const update = () => {
    prefersReducedMotion.value = query?.matches ?? false
  }

  onMounted(() => {
    query = window.matchMedia('(prefers-reduced-motion: reduce)')
    update()
    query.addEventListener('change', update)
  })

  onBeforeUnmount(() => {
    query?.removeEventListener('change', update)
  })

  return { prefersReducedMotion }
}
