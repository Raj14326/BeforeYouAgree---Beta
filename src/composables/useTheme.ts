/**
 * Light/dark theme shared by every view's header. A module-scope ref so the
 * toggle state survives route changes; applied via `data-bs-theme` on
 * `<html>` and persisted to localStorage.
 */
import { ref } from 'vue'

const theme = ref<'light' | 'dark'>(
  document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light',
)

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-bs-theme', theme.value)
  try {
    localStorage.setItem('bya-theme', theme.value)
  } catch {
    // Storage can be unavailable (private mode); the toggle still applies this session.
  }
}

export function useTheme() {
  return { theme, toggleTheme }
}
