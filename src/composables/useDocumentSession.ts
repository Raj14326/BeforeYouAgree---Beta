/**
 * The service + documents the user is currently working with, shared by
 * DocumentSelectView (pick a document) and ReviewView (read its analysis).
 *
 * A module-scope singleton, so moving between the flow's steps — or out to
 * Compare and back — keeps every retrieval and analysis already fetched.
 * Selecting a different service (or uploading a document) starts a fresh
 * session. Nothing is persisted, so a page refresh re-fetches from the
 * route params.
 *
 * Per-document maps are keyed by term type ("terms", "privacy", …) so
 * several documents of one service can be retrieved and analysed
 * independently.
 */
import { computed, ref } from 'vue'
import { useCompareList } from '@/composables/useCompareList'
import { apiUrl } from '@/lib/api'
import { fetchAnalysis, fetchRetrieval } from '@/lib/document-fetch'
import type { Analysis, Declaration, Retrieval, RiskFinding, Service, Term, VersionOption } from '@/types'

/** Single term key used for an uploaded/pasted document (it has no other term types). */
export const UPLOAD_TERM_TYPE = 'document'

const compareList = useCompareList()

const selectedService = ref<Declaration | null>(null)
/** `Service.path` for the current catalogue service; `null` for an upload. Needed to rebuild routes and CompareSourceRefs. */
const currentServicePath = ref<string | null>(null)
const isServiceLoading = ref(false)
const serviceError = ref('')
const retrievingTerm = ref<Record<string, boolean>>({})
const analysingTerm = ref<Record<string, boolean>>({})
const retrievals = ref<Record<string, Retrieval>>({})
const retrievalErrors = ref<Record<string, string>>({})
const analyses = ref<Record<string, Analysis>>({})
const findingFilters = ref<Record<string, RiskFinding['predictedLabel']>>({})
const analysisErrors = ref<Record<string, string>>({})
/** The document most recently opened in the Review step (drives the stepper's Review link). */
const activeTerm = ref<string | null>(null)
const openHistoryTerm = ref<string | null>(null)
const versions = ref<Record<string, VersionOption[]>>({})
const selectedVersions = ref<Record<string, string>>({})
/** `null` = latest; a URL = which archived version is loaded (or loading) for that term. */
const loadedVersionUrl = ref<Record<string, string | null>>({})
/**
 * Which "Add to compare" buttons have already been clicked for their
 * current content, for button feedback. This is separate from
 * compareList's own dedup (which only has a stable identity for catalogue
 * documents) so an upload — which the store always lets through as a new
 * entry — still gets "Added to compare" feedback instead of silently doing
 * nothing on repeat clicks.
 */
const addedTermTypes = ref<Set<string>>(new Set())
/** Same idea as {@link addedTermTypes}, keyed by `${termType}:${versionUrl}` for the History popover's own button. */
const addedVersionKeys = ref<Set<string>>(new Set())
const loadingHistoryTerm = ref<string | null>(null)

/**
 * Bumped on every reset; async work captures it and drops its result if the
 * user has moved to another service in the meantime, so a slow analysis
 * can't land in the next service's maps.
 */
let generation = 0
let pendingServiceLoad: { path: string; promise: Promise<void> } | null = null

const isUpload = computed(() => selectedService.value !== null && currentServicePath.value === null)

/** `[termType, Term]` pairs for the selected service, in API order. */
const termEntries = computed(
  () => Object.entries(selectedService.value?.terms ?? {}) as Array<[string, Term]>,
)

function resetSession() {
  generation += 1
  selectedService.value = null
  currentServicePath.value = null
  serviceError.value = ''
  retrievals.value = {}
  retrievalErrors.value = {}
  analyses.value = {}
  findingFilters.value = {}
  analysisErrors.value = {}
  retrievingTerm.value = {}
  analysingTerm.value = {}
  openHistoryTerm.value = null
  versions.value = {}
  selectedVersions.value = {}
  loadedVersionUrl.value = {}
  addedTermTypes.value = new Set()
  addedVersionKeys.value = new Set()
  activeTerm.value = null
}

// ---------------------------------------------------------------------------
// Service / upload
// ---------------------------------------------------------------------------

/**
 * Make `service` the current session. A no-op if it already is (or is
 * already loading), so navigating between steps never refetches; any other
 * service resets every per-document map first. Nothing is retrieved or
 * analysed here — that happens per document, in {@link openDocument}.
 */
function loadService(service: Service): Promise<void> {
  if (currentServicePath.value === service.path && selectedService.value) return Promise.resolve()
  if (pendingServiceLoad?.path === service.path) return pendingServiceLoad.promise
  const promise = fetchService(service).finally(() => {
    if (pendingServiceLoad?.promise === promise) pendingServiceLoad = null
  })
  pendingServiceLoad = { path: service.path, promise }
  return promise
}

async function fetchService(service: Service) {
  resetSession()
  const token = generation
  currentServicePath.value = service.path
  isServiceLoading.value = true
  try {
    const response = await fetch(apiUrl(`/api/service/${encodeURIComponent(service.path)}`))
    if (!response.ok) throw new Error('Declaration unavailable')
    const payload = (await response.json()) as {
      name: string
      terms: Array<{ type: string } & Term>
    }
    if (token !== generation) return
    selectedService.value = {
      name: payload.name,
      terms: Object.fromEntries(payload.terms.map(({ type, ...term }) => [type, term])),
    }
  } catch {
    if (token !== generation) return
    serviceError.value = `We could not retrieve ${service.name} from ToS;DR right now.`
  } finally {
    if (token === generation) isServiceLoading.value = false
  }
}

/**
 * Start a session for a user-supplied document (pasted or extracted from an
 * uploaded file, see DocumentUploadPanel). Builds a synthetic single-term
 * declaration whose content is already in hand — skipping `retrieveTerm` —
 * then runs it through the same `analyseTerm` as a catalogue document.
 */
function startUpload({ name, content }: { name: string; content: string }) {
  pendingServiceLoad = null
  resetSession()
  isServiceLoading.value = false
  selectedService.value = {
    name,
    terms: {
      [UPLOAD_TERM_TYPE]: {
        sourceUrl: null,
        available: true,
        latestUrl: null,
        updatedAt: null,
        historyAvailable: false,
        historyUrl: null,
      },
    },
  }
  retrievals.value[UPLOAD_TERM_TYPE] = {
    format: 'plain_text',
    id: 'uploaded',
    serviceId: 'uploaded',
    termType: UPLOAD_TERM_TYPE,
    sourceUrl: null,
    fetchDate: new Date().toISOString(),
    characterCount: content.length,
    content,
    repository: '',
    repositoryUrl: '',
  }
  activeTerm.value = UPLOAD_TERM_TYPE
  void analyseTerm(UPLOAD_TERM_TYPE)
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/**
 * Fetch a document's plain text. Pass `versionUrl` to load a specific
 * archived version; otherwise the term's `latestUrl` is used. Clears any
 * prior analysis for this term so the viewer starts from raw text.
 */
async function retrieveTerm(termType: string, versionUrl?: string) {
  if (!selectedService.value) return
  const token = generation
  retrievingTerm.value[termType] = true
  retrievalErrors.value[termType] = ''
  try {
    const term = selectedService.value.terms[termType]
    if (!term?.latestUrl) throw new Error('No archived version is available for this document.')
    const retrieval = await fetchRetrieval(versionUrl || term.latestUrl)
    if (token !== generation) return
    retrievals.value[termType] = retrieval
    delete analyses.value[termType]
    delete findingFilters.value[termType]
    analysisErrors.value[termType] = ''
  } catch (cause) {
    if (token !== generation) return
    retrievalErrors.value[termType] =
      cause instanceof Error ? cause.message : 'The document could not be retrieved.'
  } finally {
    if (token === generation) retrievingTerm.value[termType] = false
  }
}

/**
 * Send the retrieved text to `POST /api/analyze`, store the findings, and
 * default the findings filter to "risky".
 */
async function analyseTerm(termType: string) {
  const retrieval = retrievals.value[termType]
  if (!retrieval || analysingTerm.value[termType]) return
  const token = generation
  analysingTerm.value[termType] = true
  analysisErrors.value[termType] = ''
  try {
    const analysis = await fetchAnalysis(
      retrieval.content,
      retrieval.contexts,
      selectedService.value?.name,
      termType,
    )
    if (token !== generation) return
    analyses.value[termType] = analysis
    findingFilters.value[termType] = 'risky'
  } catch (cause) {
    if (token !== generation) return
    analysisErrors.value[termType] =
      cause instanceof Error ? cause.message : 'The document could not be analysed.'
  } finally {
    if (token === generation) analysingTerm.value[termType] = false
  }
}

/** Retrieve a document (optionally a specific archived version) then immediately analyse it. */
async function autoLoadAndAnalyse(termType: string, versionUrl?: string) {
  loadedVersionUrl.value[termType] = versionUrl ?? null
  addedTermTypes.value.delete(termType)
  await retrieveTerm(termType, versionUrl)
  if (retrievals.value[termType]) await analyseTerm(termType)
}

/**
 * Make a document the one under review and, unless that exact version is
 * already loaded (or loading), retrieve and analyse it. Returns false when
 * the current service has no such archived document.
 */
function openDocument(termType: string, versionUrl: string | null = null) {
  const term = selectedService.value?.terms[termType]
  if (!term?.available) return false
  activeTerm.value = termType
  const sameVersion = termType in loadedVersionUrl.value && loadedVersionUrl.value[termType] === versionUrl
  const inHand = Boolean(retrievals.value[termType] || retrievingTerm.value[termType])
  if (!(sameVersion && inHand)) void autoLoadAndAnalyse(termType, versionUrl ?? undefined)
  return true
}

/** True only for a document's very first automatic retrieve+analyse pass. */
function isInitialLoading(termType: string) {
  return (
    !retrievals.value[termType] &&
    Boolean(retrievingTerm.value[termType] || analysingTerm.value[termType])
  )
}

/**
 * Toggle the version-history popover for a term. On first open, fetch the
 * list of archived versions and preselect the newest; results are cached in
 * `versions` so reopening does not refetch.
 */
async function toggleHistory(termType: string) {
  if (openHistoryTerm.value === termType) {
    openHistoryTerm.value = null
    return
  }
  openHistoryTerm.value = termType
  const term = selectedService.value?.terms[termType]
  if (!term?.historyUrl || versions.value[termType]) return
  const token = generation
  loadingHistoryTerm.value = termType
  retrievalErrors.value[termType] = ''
  try {
    const response = await fetch(apiUrl(term.historyUrl))
    const payload = (await response.json()) as { data?: VersionOption[]; error?: string }
    if (!response.ok) throw new Error(payload.error || 'Version history could not be retrieved.')
    if (token !== generation) return
    versions.value[termType] = payload.data || []
    selectedVersions.value[termType] = versions.value[termType]?.[0]?.url || ''
  } catch (cause) {
    if (token !== generation) return
    retrievalErrors.value[termType] =
      cause instanceof Error ? cause.message : 'Version history could not be retrieved.'
  } finally {
    if (token === generation) loadingHistoryTerm.value = null
  }
}

/** Human label for a term type, e.g. "terms_of_service" → "Terms of service"; an upload uses its own name. */
function documentLabel(termType: string) {
  if (termType === UPLOAD_TERM_TYPE && isUpload.value) return selectedService.value?.name ?? 'Your document'
  const label = termType.replace(/_/g, ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

function compareDisplayName(termType: string, versionLabel?: string | null) {
  const typeLabel = termType === UPLOAD_TERM_TYPE ? 'Uploaded document' : termType.replace(/_/g, ' ')
  const capitalised = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)
  return versionLabel ? `${capitalised} (${versionLabel})` : capitalised
}

function catalogueSourceRef(termType: string, versionUrl?: string) {
  if (!currentServicePath.value || !selectedService.value) return null
  return {
    kind: 'catalogue' as const,
    servicePath: currentServicePath.value,
    serviceName: selectedService.value.name,
    termType,
    versionUrl,
  }
}

/** Add whatever's currently loaded for this document — the active version for a catalogue document, or the upload's own text. */
function addCurrentToCompare(termType: string) {
  const analysis = analyses.value[termType]
  const service = selectedService.value
  if (!analysis || !service) return

  if (isUpload.value) {
    const content = retrievals.value[termType]?.content
    if (content == null) return
    compareList.add({
      displayName: compareDisplayName(termType),
      serviceName: service.name,
      documentType: termType,
      analysis,
      sourceRef: { kind: 'upload', name: service.name, content },
    })
    addedTermTypes.value.add(termType)
    return
  }

  const versionUrl = loadedVersionUrl.value[termType] ?? undefined
  const sourceRef = catalogueSourceRef(termType, versionUrl)
  if (!sourceRef) return
  const versionLabel = versionUrl
    ? versions.value[termType]?.find((version) => version.url === versionUrl)?.label ?? null
    : null
  compareList.add({
    displayName: compareDisplayName(termType, versionLabel),
    serviceName: service.name,
    documentType: termType,
    analysis,
    sourceRef,
  })
  addedTermTypes.value.add(termType)
}

/** Add the archived version currently selected in the History popover, without disturbing the active document. */
async function addVersionToCompare(termType: string) {
  const versionUrl = selectedVersions.value[termType]
  const service = selectedService.value
  if (!versionUrl || !service) return
  const sourceRef = catalogueSourceRef(termType, versionUrl)
  if (!sourceRef) return
  try {
    const retrieval = await fetchRetrieval(versionUrl)
    const analysis = await fetchAnalysis(retrieval.content, retrieval.contexts, service.name, termType)
    const versionLabel = versions.value[termType]?.find((version) => version.url === versionUrl)?.label ?? null
    compareList.add({
      displayName: compareDisplayName(termType, versionLabel),
      serviceName: service.name,
      documentType: termType,
      analysis,
      sourceRef,
    })
    addedVersionKeys.value.add(`${termType}:${versionUrl}`)
  } catch (cause) {
    retrievalErrors.value[termType] =
      cause instanceof Error ? cause.message : 'That version could not be added to compare.'
  }
}

/** Whether the "Add to compare" button for this document's current content has already been clicked. */
function isCurrentCompared(termType: string) {
  return addedTermTypes.value.has(termType)
}

/** Whether the History popover's "Add this version" button for the selected version has already been clicked. */
function isSelectedVersionCompared(termType: string) {
  const versionUrl = selectedVersions.value[termType]
  if (!versionUrl) return false
  return addedVersionKeys.value.has(`${termType}:${versionUrl}`)
}

export function useDocumentSession() {
  return {
    selectedService,
    currentServicePath,
    isUpload,
    isServiceLoading,
    serviceError,
    termEntries,
    retrievingTerm,
    analysingTerm,
    retrievals,
    retrievalErrors,
    analyses,
    findingFilters,
    analysisErrors,
    activeTerm,
    openHistoryTerm,
    versions,
    selectedVersions,
    loadedVersionUrl,
    loadingHistoryTerm,
    loadService,
    startUpload,
    openDocument,
    isInitialLoading,
    toggleHistory,
    documentLabel,
    addCurrentToCompare,
    addVersionToCompare,
    isCurrentCompared,
    isSelectedVersionCompared,
  }
}
