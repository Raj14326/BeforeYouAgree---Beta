/**
 * In-memory snapshot store for the side-by-side comparison view
 * (CompareView.vue). A module-scope singleton ref, not a per-component
 * ref, so the list survives route changes within the SPA session; it is
 * never persisted, so a page refresh clears it.
 */
import { computed, ref } from 'vue'
import type { Analysis, DocumentContext } from '@/types'

export type CompareSourceRef =
  | {
      kind: 'catalogue'
      servicePath: string
      serviceName: string
      termType: string
      /** Absent means "latest" rather than a specific archived version. */
      versionUrl?: string
    }
  | {
      /** A user's own upload/paste. `content` is already in hand, so reopening never needs a fetch. */
      kind: 'upload'
      name: string
      content: string
    }

export type CompareEntry = {
  id: string
  displayName: string
  serviceName: string
  documentType: string
  /** Copied at add-time — the document session's analyses map is wiped/overwritten in place, so this must not alias into it. */
  analysis: Analysis
  content: string
  contexts?: DocumentContext[]
  addedAt: string
  sourceRef: CompareSourceRef
}

const entries = ref<CompareEntry[]>([])

/** Stable entry id for a catalogue document: service + termType + version. */
export function catalogueCompareId(sourceRef: Extract<CompareSourceRef, { kind: 'catalogue' }>): string {
  return `${sourceRef.servicePath}:${sourceRef.termType}:${sourceRef.versionUrl ?? 'latest'}`
}

function idFor(sourceRef: CompareSourceRef): string {
  if (sourceRef.kind === 'upload') return `upload:${crypto.randomUUID()}`
  return catalogueCompareId(sourceRef)
}

/**
 * Catalogue entries dedupe by service+termType+version; uploads have no
 * stable identity, so every add is distinct. Returns the entry's id (the
 * existing one when deduped) so callers can find or remove it later.
 */
function add(entry: Omit<CompareEntry, 'id' | 'addedAt'>): string {
  const id = idFor(entry.sourceRef)
  if (!has(id)) entries.value.push({ ...entry, id, addedAt: new Date().toISOString() })
  return id
}

function has(id: string) {
  return entries.value.some((entry) => entry.id === id)
}

function remove(id: string) {
  entries.value = entries.value.filter((entry) => entry.id !== id)
}

function clear() {
  entries.value = []
}

export function useCompareList() {
  return {
    entries: computed(() => entries.value),
    add,
    has,
    remove,
    clear,
  }
}
