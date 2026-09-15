/** API origin from `VITE_API_URL`; empty in dev, where Vite proxies `/api`. */
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

/** Join {@link API_BASE_URL} with an API path (which may or may not be absolute). */
export function apiUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
