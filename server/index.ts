/**
 * Before You Agree HTTP API.
 *
 * A single dependency-free Node HTTP server. It is the only component that talks
 * to the outside internet; the Vue frontend calls nothing but this API.
 *
 * Responsibilities:
 *  - Serve the service catalogue and policy documents by proxying **ToS;DR**
 *    (`api.tosdr.org`).
 *  - Serve dated historical versions of those documents from the **Open Terms
 *    Archive** `contrib-versions` repo on GitHub.
 *  - Run clause risk analysis locally via the M006 model (`m006-model.ts`).
 *  - Be a good upstream citizen: in-memory response caching, a per-IP rate
 *    limit, request-size limits, and an allow-listed CORS policy.
 *
 * Routing is a hand-written match on the split URL path in the request handler
 * below; every route table entry maps to one `handle*` function. All handlers
 * reply through {@link sendJson} and throw {@link clientError}/{@link serverError}
 * for anything that should not be a 200, the top-level catch turns those into
 * JSON error responses.
 *
 * Configuration (environment variables):
 *  - `PORT` (default 8787), `HOST` (default 0.0.0.0)
 *  - `ALLOWED_ORIGINS`: comma-separated origins allowed for CORS (localhost is
 *    always allowed)
 *  - `GITHUB_TOKEN`: optional; raises the GitHub API rate limit for history
 *  - `LEO_MODEL_PATH`: optional; overrides the model file location
 */
import http from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { URL } from 'node:url'
import { htmlToPlainText } from './html-to-plain-text.ts'
import { analyzeWithM006 } from './m006-model.ts'

type ApiError = Error & { statusCode: number }
type ServiceSummary = { id: number; name: string; slug?: string; rating?: string }
type DocumentReference = { id: number; name: string; url: string; updated_at?: string }
type Service = ServiceSummary & { documents?: DocumentReference[] }
type Document = DocumentReference & { text: string; service_id: number }
type RequestBucket = { count: number; resetAt: number }
type GitHubTree = { tree: Array<{ path: string; type: string }>; truncated: boolean }
type GitHubCommit = {
  sha: string
  commit: { message: string; author?: { date?: string }; committer?: { date?: string } }
  files?: Array<{ filename: string }>
}
type ArchivedDocument = { serviceName: string; termsType: string; path: string }

const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '0.0.0.0'

// Upstream data sources.
const TOSDR_API = 'https://api.tosdr.org'
const GITHUB_API = 'https://api.github.com'
const GITHUB_RAW = 'https://raw.githubusercontent.com'
const ARCHIVE_OWNER = 'OpenTermsArchive'
const ARCHIVE_REPO = 'contrib-versions'

// Cache lifetimes: metadata (service lists, indexes) is refreshed more often
// than document bodies, which rarely change and are the expensive fetches.
const CACHE_TTL_MS = 10 * 60 * 1000
const CONTENT_CACHE_TTL_MS = 60 * 60 * 1000

// Per-IP rate limit: RATE_LIMIT requests per RATE_WINDOW_MS.
const RATE_LIMIT = 60
const RATE_WINDOW_MS = 60 * 1000
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
)

/** Process-wide upstream response cache, keyed by a `source:path` string. */
const responseCache = new Map<string, { expiresAt: number; value: unknown }>()
/** Per-IP rate-limit counters, keyed by remote address. */
const requestBuckets = new Map<string, RequestBucket>()

/**
 * Main request handler and route table.
 *
 * Order matters: CORS headers first, then the preflight short-circuit, then the
 * two "special" routes (`/api/health` needs no rate limit; `/api/analyze` is the
 * only POST), then GET-only path matching by segment count and prefix. Anything
 * unmatched is a 404. Errors thrown anywhere below are normalised to a JSON
 * response by the surrounding catch.
 */
const server = http.createServer(async (request, response) => {
  setCorsHeaders(request, response)
  if (request.method === 'OPTIONS') return endEmpty(response, 204)

  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(response, 200, {
        status: 'ok',
        source: 'tosdr',
        upstream: TOSDR_API,
        model: "Leo's M006 Naive Bayes classifier",
      })
    }
    if (request.method === 'POST' && url.pathname === '/api/analyze') {
      enforceRateLimit(request)
      return await analyzeDocument(request, response)
    }
    if (request.method !== 'GET') {
      return sendJson(response, 405, { error: 'Only GET requests are supported.' })
    }

    enforceRateLimit(request)
    const segments = url.pathname.split('/').filter(Boolean).map(decodePathSegment)
    if (segments.length === 2 && segments[0] === 'api' && segments[1] === 'services') {
      return await listServices(url, response)
    }
    if (segments.length === 3 && segments[0] === 'api' && segments[1] === 'service') {
      return await getService(segments[2], response)
    }
    if (segments.length === 4 && segments[0] === 'api' && segments[1] === 'versions') {
      return await listVersions(segments[2], segments[3], url, response)
    }
    if (
      segments.length === 5 &&
      segments[0] === 'api' &&
      segments[1] === 'version' &&
      segments[4] === 'latest'
    ) {
      return await getDocument(segments[2], segments[3], response)
    }
    if (segments.length === 5 && segments[0] === 'api' && segments[1] === 'version') {
      return await getArchivedVersion(segments[2], segments[3], segments[4], response)
    }
    return sendJson(response, 404, { error: 'Endpoint not found.' })
  } catch (error: unknown) {
    const apiError = normalizeError(error)
    if (apiError.statusCode >= 500) console.error(apiError)
    return sendJson(response, apiError.statusCode, {
      error: apiError.message,
    })
  }
})

/**
 * `POST /api/analyze`: classify a document's clauses with the local M006 model.
 *
 * Body: `{ content: string, serviceName?: string, documentType?: string }`.
 * Rejects empty content (400) and content over 500 kB (413). No upstream calls.
 */
async function analyzeDocument(request: IncomingMessage, response: ServerResponse) {
  const body = await readJsonBody(request)
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) return sendJson(response, 400, { error: 'Document content is required.' })
  if (content.length > 500_000)
    return sendJson(response, 413, { error: 'Document is too large to analyze.' })
  return sendJson(
    response,
    200,
    analyzeWithM006(
      content,
      typeof body.serviceName === 'string' ? body.serviceName : '',
      typeof body.documentType === 'string' ? body.documentType : '',
    ),
  )
}

/**
 * Read and JSON-parse a request body, aborting with 413 if it exceeds ~510 kB
 * and rejecting with 400 on invalid JSON. An empty body parses as `{}`.
 */
function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolveBody, reject) => {
    let raw = ''
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => {
      raw += chunk
      if (raw.length > 510_000) request.destroy(clientError(413, 'Request body is too large.'))
    })
    request.on('end', () => {
      try {
        resolveBody(JSON.parse(raw || '{}') as Record<string, unknown>)
      } catch {
        reject(clientError(400, 'Request body must be valid JSON.'))
      }
    })
    request.on('error', reject)
  })
}

server.listen(PORT, HOST, () => {
  console.log(`Before You Agree ToS;DR API listening on http://${HOST}:${PORT}`)
})

/**
 * `GET /api/services`: the service catalogue, sorted by name.
 *
 * With `?search=` it hits the ToS;DR search endpoint; without, it returns the
 * first page of the full service list. `?limit=` (1–500, default 100) caps the
 * result. Response: `{ data, count, total }` where each item is
 * `{ id, name, slug?, rating? }` with `id` stringified.
 */
async function listServices(url: URL, response: ServerResponse) {
  const query = (url.searchParams.get('search') || '').trim()
  const limit = parseInteger(url.searchParams.get('limit'), 100, 1, 500)
  let services: ServiceSummary[]
  let total: number

  if (query) {
    const payload = await tosdrJson<{ services?: ServiceSummary[] }>(
      `/search/v5?query=${encodeURIComponent(query)}`,
      CACHE_TTL_MS,
    )
    services = payload.services || []
    total = services.length
  } else {
    const payload = await tosdrJson<{
      services?: ServiceSummary[]
      page?: { total?: number }
    }>('/service/v3?page=1', CACHE_TTL_MS)
    services = payload.services || []
    total = payload.page?.total || services.length
  }

  const data = services
    .filter((service) => Number.isInteger(service.id) && service.name)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ id, name, slug, rating }) => ({ id: String(id), name, slug, rating }))
  return sendJson(response, 200, { data, count: data.length, total })
}

/**
 * `GET /api/service/:serviceId`: one service plus its policy documents.
 *
 * Each ToS;DR document is cross-referenced against the Open Terms Archive index
 * (see {@link getArchiveIndex} / {@link findArchivedDocument}); when a match is
 * found, `historyAvailable` is set and `historyUrl` points at the versions
 * route. A missing/failed archive index degrades gracefully to "no history".
 * Response: `{ id, name, rating, terms: [...] }`.
 */
async function getService(serviceId: string, response: ServerResponse) {
  const id = parseId(serviceId, 'service')
  const service = await tosdrJson<Service>(`/service/v3?id=${id}`, CACHE_TTL_MS)
  if (!service?.id || !service.name) throw clientError(404, 'Service not found.')

  const archive = await getArchiveIndex().catch((error) => {
    console.warn('Historical archive index unavailable:', error)
    return []
  })
  const terms = (service.documents || []).map((document) => {
    const archivedDocument = findArchivedDocument(archive, service.name, document.name)
    return {
      id: String(document.id),
      type: document.name,
      sourceUrl: document.url || null,
      available: true,
      latestUrl: `/api/version/${id}/${document.id}/latest`,
      updatedAt: document.updated_at || null,
      historyAvailable: Boolean(archivedDocument),
      historyUrl: archivedDocument ? `/api/versions/${id}/${document.id}` : null,
    }
  })
  return sendJson(response, 200, {
    id: String(service.id),
    name: service.name,
    rating: service.rating || 'N/A',
    terms,
  })
}

/**
 * `GET /api/versions/:serviceId/:documentId`: dated history for one document.
 *
 * Lists the Git commits that touched this document's file in the Open Terms
 * Archive repo, newest first (`?limit=` 1–100, default 100). Each entry carries
 * a `url` to {@link getArchivedVersion} for that commit SHA.
 */
async function listVersions(
  serviceId: string,
  documentId: string,
  url: URL,
  response: ServerResponse,
) {
  const { archivedDocument } = await resolveArchivedDocument(serviceId, documentId)
  const limit = parseInteger(url.searchParams.get('limit'), 100, 1, 100)
  const archivePath = encodeURIComponent(archivedDocument.path)
  const commits = await githubJson<GitHubCommit[]>(
    `/repos/${ARCHIVE_OWNER}/${ARCHIVE_REPO}/commits?path=${archivePath}&per_page=${limit}`,
    5 * 60 * 1000,
  )
  const data = commits.map((commit) => ({
    id: commit.sha,
    updatedAt: commit.commit.committer?.date || commit.commit.author?.date || null,
    label: formatVersionDate(commit.commit.committer?.date || commit.commit.author?.date),
    message: commit.commit.message,
    url: `/api/version/${serviceId}/${documentId}/${commit.sha}`,
  }))
  return sendJson(response, 200, { data, count: data.length })
}

/**
 * `GET /api/version/:serviceId/:documentId/:commitSha`: one archived version.
 *
 * `commitSha` must be a full 40-hex Git SHA. The commit is verified to actually
 * touch this document's file (else 404) before the raw Markdown at that revision
 * is fetched. Response mirrors {@link getDocument} but with
 * `repository: "OpenTermsArchive/contrib-versions"` and a GitHub blob URL.
 */
async function getArchivedVersion(
  serviceId: string,
  documentId: string,
  revision: string,
  response: ServerResponse,
) {
  if (!/^[a-f0-9]{40}$/i.test(revision)) throw clientError(400, 'Invalid version ID.')
  const { service, document, archivedDocument } = await resolveArchivedDocument(
    serviceId,
    documentId,
  )
  const commit = await githubJson<GitHubCommit>(
    `/repos/${ARCHIVE_OWNER}/${ARCHIVE_REPO}/commits/${revision}`,
    5 * 60 * 1000,
  )
  if (!commit.files?.some((file) => file.filename === archivedDocument.path)) {
    throw clientError(404, 'That version does not belong to this document.')
  }
  const content = await archiveText(revision, archivedDocument.path)
  const fetchDate = commit.commit.committer?.date || commit.commit.author?.date || null
  const repositoryPath = encodePath(archivedDocument.path)
  return sendJson(response, 200, {
    format: 'plain_text',
    id: revision,
    serviceId: String(service.id),
    termsType: document.name,
    fetchDate,
    content,
    characterCount: content.length,
    sourceUrl: document.url || null,
    repository: `${ARCHIVE_OWNER}/${ARCHIVE_REPO}`,
    repositoryUrl: `https://github.com/${ARCHIVE_OWNER}/${ARCHIVE_REPO}/blob/${revision}/${repositoryPath}`,
  })
}

/**
 * Shared lookup for the two history routes: resolve `serviceId`/`documentId` to
 * the ToS;DR service and document, then to the matching Open Terms Archive file.
 * Throws 404 at whichever step fails.
 */
async function resolveArchivedDocument(serviceId: string, documentId: string) {
  const serviceNumber = parseId(serviceId, 'service')
  const documentNumber = parseId(documentId, 'document')
  const service = await tosdrJson<Service>(`/service/v3?id=${serviceNumber}`, CACHE_TTL_MS)
  const document = service.documents?.find((item) => item.id === documentNumber)
  if (!document) throw clientError(404, 'Terms document not found for this service.')
  const archivedDocument = findArchivedDocument(
    await getArchiveIndex(),
    service.name,
    document.name,
  )
  if (!archivedDocument)
    throw clientError(404, 'No historical versions are available for this document.')
  return { service, document, archivedDocument }
}

/**
 * `GET /api/version/:serviceId/:documentId/latest`: current document text.
 *
 * Fetches the ToS;DR document, checks it belongs to the given service (else
 * 404), and converts its stored HTML to plain text via {@link htmlToPlainText}.
 * Response: `{ format, id, serviceId, termsType, fetchDate, content,
 * characterCount, sourceUrl, repository: "ToS;DR", repositoryUrl }`.
 */
async function getDocument(serviceId: string, documentId: string, response: ServerResponse) {
  const service = parseId(serviceId, 'service')
  const document = parseId(documentId, 'document')
  const payload = await tosdrJson<{ parameters?: Document }>(
    `/document/v1?id=${document}`,
    CONTENT_CACHE_TTL_MS,
  )
  const terms = payload.parameters
  if (!terms?.id || terms.service_id !== service) {
    throw clientError(404, 'Terms document not found for this service.')
  }

  const content = htmlToPlainText(terms.text || '')

  return sendJson(response, 200, {
    format: 'plain_text',
    id: String(terms.id),
    serviceId: String(service),
    termsType: terms.name,
    fetchDate: terms.updated_at || null,
    content,
    characterCount: content.length,
    sourceUrl: terms.url || null,
    repository: 'ToS;DR',
    repositoryUrl: `https://tosdr.org/en/service/${service}`,
  })
}

/** Cached GET against the ToS;DR API. 20 s timeout; upstream errors mapped by {@link tosdrError}. */
async function tosdrJson<T>(path: string, ttl: number): Promise<T> {
  return cachedJson<T>(`tosdr:${path}`, ttl, async () => {
    const response = await fetch(`${TOSDR_API}${path}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'BeforeYouAgree' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) throw tosdrError(response)
    return (await response.json()) as T
  })
}

/**
 * Build (and cache) the index of every archived document.
 *
 * Reads the archive repo's full Git tree and keeps each blob whose path looks
 * like `<Service Name>/<Document Type>.md`, capturing the service, type and
 * repo path. A truncated tree is treated as an error rather than a partial
 * index.
 */
async function getArchiveIndex(): Promise<ArchivedDocument[]> {
  return cachedJson<ArchivedDocument[]>('archive:index', CACHE_TTL_MS, async () => {
    const tree = await githubJson<GitHubTree>(
      `/repos/${ARCHIVE_OWNER}/${ARCHIVE_REPO}/git/trees/main?recursive=1`,
      CACHE_TTL_MS,
    )
    if (tree.truncated) throw serverError('The historical archive index was truncated.')
    return tree.tree.flatMap((item) => {
      const match = item.type === 'blob' ? item.path.match(/^([^/]+)\/(.+)\.md$/) : null
      return match ? [{ serviceName: match[1], termsType: match[2], path: item.path }] : []
    })
  })
}

/**
 * Match a ToS;DR service/document name pair to an entry in the archive index.
 *
 * ToS;DR and the Open Terms Archive name things differently ("Privacy Policy"
 * vs "Privacy", "Google Inc." vs "Google"), so both sides are run through
 * {@link comparableName} and compared on the normalised form.
 */
function findArchivedDocument(
  archive: ArchivedDocument[],
  serviceName: string,
  documentName: string,
) {
  const serviceKey = comparableName(serviceName, true)
  const documentKey = comparableName(documentName, false)
  return archive.find(
    (item) =>
      comparableName(item.serviceName, true) === serviceKey &&
      comparableName(item.termsType, false) === documentKey,
  )
}

/**
 * Normalise a name for fuzzy comparison: lowercase, strip everything that is not
 * a letter or digit, drop a trailing "service"/"services" for service names,
 * and fold the common wordings of the two document types onto "terms" and
 * "privacy".
 *
 * @param service `true` for a service name, `false` for a document-type name.
 */
function comparableName(value: string, service: boolean) {
  let normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '')
  if (service) normalized = normalized.replace(/services?$/, '')
  return normalized
    .replace(/termsandconditions|termsofuse|termsofservice/g, 'terms')
    .replace(/privacystatement|privacynotice|privacypolicy/g, 'privacy')
}

/** Cached GET against the GitHub REST API (adds auth if `GITHUB_TOKEN` is set). 20 s timeout. */
async function githubJson<T>(path: string, ttl: number): Promise<T> {
  return cachedJson<T>(`github:${path}`, ttl, async () => {
    const response = await fetch(`${GITHUB_API}${path}`, {
      headers: githubHeaders(),
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) throw githubError(response)
    return (await response.json()) as T
  })
}

/** Cached fetch of a file's raw contents at a specific commit from `raw.githubusercontent.com`. */
async function archiveText(revision: string, path: string) {
  return cachedJson<string>(`archive:${revision}:${path}`, CONTENT_CACHE_TTL_MS, async () => {
    const response = await fetch(
      `${GITHUB_RAW}/${ARCHIVE_OWNER}/${ARCHIVE_REPO}/${revision}/${encodePath(path)}`,
      { headers: { 'User-Agent': 'BeforeYouAgree' }, signal: AbortSignal.timeout(20_000) },
    )
    if (!response.ok) throw githubError(response)
    return response.text()
  })
}

/** Standard GitHub API headers, with a bearer token when `GITHUB_TOKEN` is present. */
function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'BeforeYouAgree',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  return headers
}

/** Map a failed GitHub response to a client-facing error (404 → not found, 403/429 → 503). */
function githubError(response: Response): ApiError {
  if (response.status === 404)
    return clientError(404, 'The requested historical version was not found.')
  if (response.status === 403 || response.status === 429) {
    return clientError(503, 'Historical archive rate limit reached. Try again later.')
  }
  return serverError(`Historical archive request failed with ${response.status}.`)
}

/** Percent-encode each path segment while leaving the "/" separators intact. */
function encodePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}

/** Human-readable UTC date+time label for a version, or "Unknown date". */
function formatVersionDate(value?: string) {
  if (!value) return 'Unknown date'
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
}

/**
 * Read `key` from {@link responseCache} if it is still fresh, otherwise run
 * `loader`, store the result for `ttl` ms, and return it. Failed loads are not
 * cached. The cache is unbounded but entries are effectively self-limiting given
 * the small, fixed set of upstream paths.
 */
async function cachedJson<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
  const cached = responseCache.get(key)
  if (cached?.expiresAt && cached.expiresAt > Date.now()) return cached.value as T
  const value = await loader()
  responseCache.set(key, { expiresAt: Date.now() + ttl, value })
  return value
}

/** Map a failed ToS;DR response to a client-facing error (404/422 → 4xx, 429 → 503). */
function tosdrError(response: Response): ApiError {
  if (response.status === 404) return clientError(404, 'The requested ToS;DR data was not found.')
  if (response.status === 422) return clientError(400, 'The ToS;DR request was invalid.')
  if (response.status === 429)
    return clientError(503, 'ToS;DR rate limit reached. Try again later.')
  return serverError(`ToS;DR request failed with ${response.status}.`)
}

/** Parse a positive integer path parameter, throwing 400 with `label` on anything else. */
function parseId(value: string, label: string) {
  if (!/^\d+$/.test(value)) throw clientError(400, `Invalid ${label} ID.`)
  return Number(value)
}

/**
 * Fixed-window per-IP rate limiter. Each remote address gets {@link RATE_LIMIT}
 * requests per {@link RATE_WINDOW_MS}; the window resets lazily on the first
 * request after it expires. Over the limit throws 429.
 */
function enforceRateLimit(request: IncomingMessage) {
  const key = request.socket.remoteAddress || 'local'
  const now = Date.now()
  const bucket = requestBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    requestBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return
  }
  bucket.count += 1
  if (bucket.count > RATE_LIMIT) throw clientError(429, 'Too many requests. Try again shortly.')
}

/**
 * Set CORS and hardening headers on every response. The `Access-Control-Allow-
 * Origin` header is echoed back only for `localhost`/`127.0.0.1` or an origin
 * listed in `ALLOWED_ORIGINS`; other origins get no ACAO header (request blocked
 * by the browser).
 */
function setCorsHeaders(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin
  const isLocalOrigin = origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  if (origin && (isLocalOrigin || ALLOWED_ORIGINS.has(origin.replace(/\/$/, '')))) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
  }
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
}

/** Parse an optional integer query param, returning `fallback` when absent and throwing 400 when out of `[minimum, maximum]`. */
function parseInteger(value: string | null, fallback: number, minimum: number, maximum: number) {
  if (value === null) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw clientError(400, `Value must be an integer between ${minimum} and ${maximum}.`)
  }
  return parsed
}

/** `decodeURIComponent` that turns a malformed escape into a 400 instead of a throw. */
function decodePathSegment(segment: string) {
  try {
    return decodeURIComponent(segment)
  } catch {
    throw clientError(400, 'URL path contains invalid encoding.')
  }
}

/** Write a JSON response with the right headers; no-op if the response is already sent. */
function sendJson(response: ServerResponse, status: number, payload: unknown) {
  if (response.writableEnded) return
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  })
  response.end(body)
}

/** End a response with a status code and no body (used for the CORS preflight). */
function endEmpty(response: ServerResponse, status: number) {
  response.writeHead(status)
  response.end()
}

/** Build an error whose `message` is safe to show the client, tagged with an HTTP `statusCode`. */
function clientError(statusCode: number, message: string): ApiError {
  return Object.assign(new Error(message), { statusCode })
}

/** Build a 502 error for upstream failures we cannot attribute to the caller. */
function serverError(message: string): ApiError {
  return Object.assign(new Error(message), { statusCode: 502 })
}

/** Coerce any thrown value into an {@link ApiError}, defaulting to 500. */
function normalizeError(error: unknown): ApiError {
  if (error instanceof Error) {
    const statusCode = 'statusCode' in error ? Number(error.statusCode) || 500 : 500
    return Object.assign(error, { statusCode })
  }
  return Object.assign(new Error('Unknown server error.'), { statusCode: 500 })
}

/** Stop accepting connections and exit once in-flight requests drain. */
function shutdown() {
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
