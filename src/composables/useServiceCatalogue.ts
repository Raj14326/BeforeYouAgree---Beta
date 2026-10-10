/**
 * The service catalogue (`GET /api/services`), loaded once per SPA session
 * and shared by every search bar. When the endpoint is unreachable the list
 * falls back to {@link FALLBACK_SERVICES} so search still works.
 */
import { ref } from 'vue'
import { apiUrl } from '@/lib/api'
import type { Service } from '@/types'

/** Offline service list used when `GET /api/services` fails on load. */
const FALLBACK_SERVICES: Service[] = [
  'Amazon',
  'Apple',
  'Discord',
  'Dropbox',
  'Facebook',
  'GitHub',
  'Google',
  'Instagram',
  'LinkedIn',
  'Microsoft',
  'Netflix',
  'PayPal',
  'Reddit',
  'Spotify',
  'TikTok',
  'Twitch',
  'Uber',
  'WhatsApp',
  'X',
  'YouTube',
].map((name) => ({ name, path: `declarations/${name}.json` }))

const services = ref<Service[]>([])
const isCatalogueLoading = ref(true)
const catalogueIsFallback = ref(false)
let loadPromise: Promise<void> | null = null

async function loadCatalogue() {
  try {
    const response = await fetch(apiUrl('/api/services'))
    if (!response.ok) throw new Error('Catalogue unavailable')
    const payload = (await response.json()) as { data: Array<{ id: string; name: string }> }
    services.value = payload.data.map((service) => ({ ...service, path: service.id }))
    if (!services.value.length) throw new Error('No services found')
  } catch {
    services.value = FALLBACK_SERVICES
    catalogueIsFallback.value = true
  } finally {
    isCatalogueLoading.value = false
  }
}

/** Start loading the catalogue if nothing has yet; safe to call from every view. */
function ensureCatalogueLoaded() {
  loadPromise ??= loadCatalogue()
  return loadPromise
}

export function useServiceCatalogue() {
  return { services, isCatalogueLoading, catalogueIsFallback, ensureCatalogueLoaded }
}
