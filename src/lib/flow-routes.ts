/**
 * Route builders for the Search → Document → Review flow, so every view,
 * the stepper and the compare page link to the same URL shapes.
 */
import type { RouteLocationRaw } from 'vue-router'

/** Document-selecting view for one catalogue service. `name` is only a display hint for a cold load. */
export function serviceRoute(servicePath: string, serviceName?: string): RouteLocationRaw {
  return { name: 'service', params: { servicePath }, query: serviceName ? { name: serviceName } : {} }
}

/** Review view for one catalogue document; `versionUrl` pins an archived version instead of the latest. */
export function reviewRoute(
  servicePath: string,
  termType: string,
  serviceName?: string,
  versionUrl?: string | null,
): RouteLocationRaw {
  const query: Record<string, string> = {}
  if (serviceName) query.name = serviceName
  if (versionUrl) query.version = versionUrl
  return { name: 'review', params: { servicePath, termType }, query }
}

/** Review view for the user's own uploaded/pasted document (its text lives in the session, not the URL). */
export const uploadReviewRoute: RouteLocationRaw = { name: 'review-upload' }

/** Landing page with the search/upload card scrolled into view, optionally on the upload tab. */
export function startRoute(mode?: 'upload'): RouteLocationRaw {
  return { name: 'landing', query: mode ? { mode } : {}, hash: '#start' }
}
