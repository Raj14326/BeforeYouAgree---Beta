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

function idFor(sourceRef: CompareSourceRef): string {
  if (sourceRef.kind === 'upload') return `upload:${crypto.randomUUID()}`
  return `${sourceRef.servicePath}:${sourceRef.termType}:${sourceRef.versionUrl ?? 'latest'}`
}

/** Catalogue entries dedupe by service+termType+version; uploads have no stable identity, so every add is distinct. */
function add(entry: Omit<CompareEntry, 'id' | 'addedAt'>) {
  const id = idFor(entry.sourceRef)
  if (entries.value.some((existing) => existing.id === id)) return
  entries.value.push({ ...entry, id, addedAt: new Date().toISOString() })
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
    remove,
    clear,
  }
}
