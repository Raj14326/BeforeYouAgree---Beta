import http from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { URL } from 'node:url'

type ApiError = Error & { statusCode: number }
type GitHubTreeItem = { path: string; type: 'blob' | 'tree'; size?: number; sha: string }
type GitHubTree = { tree: GitHubTreeItem[]; truncated: boolean }
type GitHubCommit = {
  sha: string
  commit: {
    message: string
    author?: { date?: string }
    committer?: { date?: string }
  }
  files?: Array<{ filename: string }>
}
type DeclarationTerm = { fetch?: string | { url?: string } }
type ServiceDeclaration = { name?: string; terms?: Record<string, DeclarationTerm> }
type IndexedDocument = {
  serviceName: string
  termsType: string
  path: string
  size?: number
  sha: string
}
type IndexedService = {
  id: string
  name: string
  termsTypes: string[]
  declarationPath: string
}
type IndexCache = {
  expiresAt: number
  services: IndexedService[]
  documents: Map<string, IndexedDocument>
}
type RequestBucket = { count: number; resetAt: number }

const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '0.0.0.0'
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
)
const GITHUB_API = 'https://api.github.com'
const GITHUB_RAW = 'https://raw.githubusercontent.com'
const OWNER = 'OpenTermsArchive'
const DECLARATIONS_REPO = 'contrib-declarations'
const VERSIONS_REPO = 'contrib-versions'
const BRANCH = 'main'
const CACHE_TTL_MS = 10 * 60 * 1000
const CONTENT_CACHE_TTL_MS = 60 * 60 * 1000
const RATE_LIMIT = 60
const RATE_WINDOW_MS = 60 * 1000

let indexCache: IndexCache = { expiresAt: 0, services: [], documents: new Map() }
const responseCache = new Map<string, { expiresAt: number; value: unknown }>()
const requestBuckets = new Map<string, RequestBucket>()

const server = http.createServer(async (request, response) => {
  setCorsHeaders(request, response)
  if (request.method === 'OPTIONS') return endEmpty(response, 204)

  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(response, 200, {
        status: 'ok',
        source: 'github',
        repository: `${OWNER}/${VERSIONS_REPO}`,
      })
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
      return await getVersion(segments[2], segments[3], null, response)
    }

    if (
      segments.length === 5 &&
      segments[0] === 'api' &&
      segments[1] === 'version' &&
      segments[4] === 'at'
    ) {
      return await getVersionAtMonth(segments[2], segments[3], url, response)
    }

    if (segments.length === 5 && segments[0] === 'api' && segments[1] === 'version') {
      return await getVersion(segments[2], segments[3], segments[4], response)
    }

    return sendJson(response, 404, { error: 'Endpoint not found.' })
  } catch (error: unknown) {
    const apiError = normalizeError(error)
    const status = apiError.statusCode
    if (status >= 500) console.error(apiError)
    return sendJson(response, status, {
      error: status >= 500 ? 'GitHub data could not be retrieved right now.' : apiError.message,
    })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Before You Agree GitHub API listening on http://${HOST}:${PORT}`)
})

async function listServices(url: URL, response: ServerResponse) {
  const index = await getIndex()
  const query = (url.searchParams.get('search') || '').trim().toLowerCase()
  const limit = parseInteger(url.searchParams.get('limit'), 1000, 1, 1000)
  const data = index.services
    .filter((service) => !query || service.name.toLowerCase().includes(query))
    .slice(0, limit)
    .map(({ id, name, termsTypes }) => ({ id, name, termsTypes }))

  return sendJson(response, 200, { data, count: data.length, total: index.services.length })
}

async function getService(serviceName: string, response: ServerResponse) {
  const index = await getIndex()
  const service = index.services.find((item) => item.name === serviceName)
  if (!service) throw clientError(404, 'Service not found.')

  const declaration = await getDeclaration(service)
  const terms = Object.entries(declaration.terms || {}).map(([type, term]) => {
    const document = index.documents.get(documentKey(serviceName, type))
    return {
      type,
      sourceUrl: typeof term.fetch === 'string' ? term.fetch : term.fetch?.url || null,
      available: Boolean(document),
      latestUrl: document
        ? `/api/version/${encodeURIComponent(serviceName)}/${encodeURIComponent(type)}/latest`
        : null,
    }
  })

  return sendJson(response, 200, { id: serviceName, name: declaration.name || serviceName, terms })
}

async function listVersions(
  serviceName: string,
  termsType: string,
  url: URL,
  response: ServerResponse,
) {
  const document = await requireDocument(serviceName, termsType)
  const limit = parseInteger(url.searchParams.get('limit'), 20, 1, 100)
  const page = parseInteger(url.searchParams.get('page'), 1, 1, 1000)
  const commits = await githubJson<GitHubCommit[]>(
    `/repos/${OWNER}/${VERSIONS_REPO}/commits?path=${encodeURIComponent(document.path)}&per_page=${limit}&page=${page}`,
    2 * 60 * 1000,
  )

  const data = commits.map((commit) => ({
    id: commit.sha,
    serviceId: serviceName,
    termsType,
    fetchDate: commit.commit.committer?.date || commit.commit.author?.date || null,
    message: commit.commit.message,
    url: `/api/version/${encodeURIComponent(serviceName)}/${encodeURIComponent(termsType)}/${commit.sha}`,
  }))

  return sendJson(response, 200, {
    data,
    count: data.length,
    limit,
    page,
    hasMore: data.length === limit,
  })
}

async function getVersion(
  serviceName: string,
  termsType: string,
  revision: string | null,
  response: ServerResponse,
) {
  const document = await requireDocument(serviceName, termsType)
  if (revision && !/^[a-f0-9]{40}$/i.test(revision)) throw clientError(400, 'Invalid version ID.')

  const commit = revision
    ? await githubJson<GitHubCommit>(`/repos/${OWNER}/${VERSIONS_REPO}/commits/${revision}`, 5 * 60 * 1000)
    : (
        await githubJson<GitHubCommit[]>(
          `/repos/${OWNER}/${VERSIONS_REPO}/commits?path=${encodeURIComponent(document.path)}&per_page=1`,
          5 * 60 * 1000,
        )
      )[0]

  if (!commit) throw clientError(404, 'No version was found for this document.')
  if (revision && !commit.files?.some((file) => file.filename === document.path)) {
    throw clientError(404, 'That version does not belong to this document.')
  }

  const content = await rawText(VERSIONS_REPO, commit.sha, document.path)
  const service = (await getIndex()).services.find((item) => item.name === serviceName)
  const declaration = service ? await getDeclaration(service) : null
  const term = declaration?.terms?.[termsType]

  return sendJson(response, 200, {
    id: commit.sha,
    serviceId: serviceName,
    termsType,
    fetchDate: commit.commit.committer?.date || commit.commit.author?.date || null,
    content,
    characterCount: content.length,
    sourceUrl: typeof term?.fetch === 'string' ? term.fetch : term?.fetch?.url || null,
    repository: `${OWNER}/${VERSIONS_REPO}`,
    repositoryUrl: `https://github.com/${OWNER}/${VERSIONS_REPO}/blob/${commit.sha}/${encodePath(document.path)}`,
  })
}

async function getVersionAtMonth(
  serviceName: string,
  termsType: string,
  url: URL,
  response: ServerResponse,
) {
  const monthValue = url.searchParams.get('month')
  if (!monthValue) throw clientError(400, 'The month query parameter is required.')
  if (!/^\d{4}-\d{2}$/.test(monthValue)) {
    throw clientError(400, 'The requested month must use YYYY-MM format.')
  }

  const [year, month] = monthValue.split('-').map(Number)
  if (month < 1 || month > 12) throw clientError(400, 'The requested month is invalid.')
  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 1) - 1)
  if (monthStart > new Date()) throw clientError(416, 'The requested month is in the future.')

  const document = await requireDocument(serviceName, termsType)
  const commits = await githubJson<GitHubCommit[]>(
    `/repos/${OWNER}/${VERSIONS_REPO}/commits?path=${encodeURIComponent(document.path)}&since=${encodeURIComponent(monthStart.toISOString())}&until=${encodeURIComponent(monthEnd.toISOString())}&per_page=1`,
    5 * 60 * 1000,
  )
  if (!commits.length) {
    throw clientError(404, 'No version was archived in the selected month.')
  }

  return getVersion(serviceName, termsType, commits[0].sha, response)
}

async function getIndex() {
  if (indexCache.expiresAt > Date.now()) return indexCache

  const [declarationsTree, versionsTree] = await Promise.all([
    githubJson<GitHubTree>(`/repos/${OWNER}/${DECLARATIONS_REPO}/git/trees/${BRANCH}?recursive=1`, CACHE_TTL_MS),
    githubJson<GitHubTree>(`/repos/${OWNER}/${VERSIONS_REPO}/git/trees/${BRANCH}?recursive=1`, CACHE_TTL_MS),
  ])

  if (declarationsTree.truncated || versionsTree.truncated) {
    throw serverError('A GitHub repository tree was truncated.')
  }

  const documents = new Map<string, IndexedDocument>()
  for (const item of versionsTree.tree) {
    const match = item.type === 'blob' ? item.path.match(/^([^/]+)\/(.+)\.md$/) : null
    if (!match) continue
    documents.set(documentKey(match[1], match[2]), {
      serviceName: match[1],
      termsType: match[2],
      path: item.path,
      size: item.size,
      sha: item.sha,
    })
  }

  const services = declarationsTree.tree
    .filter((item) => item.type === 'blob' && /^declarations\/[^/]+\.json$/.test(item.path))
    .map((item) => {
      const name = item.path.split('/').at(-1)!.replace(/\.json$/, '')
      const termsTypes = [...documents.values()]
        .filter((document) => document.serviceName === name)
        .map((document) => document.termsType)
        .sort()
      return { id: name, name, termsTypes, declarationPath: item.path }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  indexCache = { expiresAt: Date.now() + CACHE_TTL_MS, services, documents }
  return indexCache
}

async function getDeclaration(service: IndexedService): Promise<ServiceDeclaration> {
  return cachedJson<ServiceDeclaration>(
    `declaration:${service.name}`,
    CACHE_TTL_MS,
    async () => JSON.parse(await rawText(DECLARATIONS_REPO, BRANCH, service.declarationPath)),
  )
}

async function requireDocument(serviceName: string, termsType: string): Promise<IndexedDocument> {
  const index = await getIndex()
  const service = index.services.find((item) => item.name === serviceName)
  if (!service) throw clientError(404, 'Service not found.')
  const document = index.documents.get(documentKey(serviceName, termsType))
  if (!document) throw clientError(404, 'Terms document not found.')
  return document
}

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

async function rawText(repo: string, revision: string, path: string): Promise<string> {
  return cachedJson<string>(`raw:${repo}:${revision}:${path}`, CONTENT_CACHE_TTL_MS, async () => {
    const response = await fetch(`${GITHUB_RAW}/${OWNER}/${repo}/${revision}/${encodePath(path)}`, {
      headers: { 'User-Agent': 'BeforeYouAgree' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) throw githubError(response)
    return response.text()
  })
}

async function cachedJson<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
  const cached = responseCache.get(key)
  if (cached?.expiresAt && cached.expiresAt > Date.now()) return cached.value as T
  const value = await loader()
  responseCache.set(key, { expiresAt: Date.now() + ttl, value })
  return value
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'BeforeYouAgree',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  return headers
}

function githubError(response: Response): ApiError {
  if (response.status === 404) return clientError(404, 'The requested GitHub data was not found.')
  if (response.status === 403 || response.status === 429) {
    return clientError(503, 'GitHub rate limit reached. Configure GITHUB_TOKEN or try again later.')
  }
  return serverError(`GitHub request failed with ${response.status}.`)
}

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

function setCorsHeaders(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin
  const isLocalOrigin = origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  if (origin && (isLocalOrigin || ALLOWED_ORIGINS.has(origin.replace(/\/$/, '')))) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
  }
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
}

function parseInteger(value: string | null, fallback: number, minimum: number, maximum: number) {
  if (value === null) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw clientError(400, `Value must be an integer between ${minimum} and ${maximum}.`)
  }
  return parsed
}

function decodePathSegment(segment: string) {
  try {
    return decodeURIComponent(segment)
  } catch {
    throw clientError(400, 'URL path contains invalid encoding.')
  }
}

function documentKey(serviceName: string, termsType: string) {
  return `${serviceName}\u0000${termsType}`
}

function encodePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  if (response.writableEnded) return
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  })
  response.end(body)
}

function endEmpty(response: ServerResponse, status: number) {
  response.writeHead(status)
  response.end()
}

function clientError(statusCode: number, message: string): ApiError {
  return Object.assign(new Error(message), { statusCode })
}

function serverError(message: string): ApiError {
  return Object.assign(new Error(message), { statusCode: 502 })
}

function shutdown() {
  server.close(() => process.exit(0))
}

function normalizeError(error: unknown): ApiError {
  if (error instanceof Error) {
    const statusCode = 'statusCode' in error ? Number(error.statusCode) || 500 : 500
    return Object.assign(error, { statusCode })
  }
  return Object.assign(new Error('Unknown server error.'), { statusCode: 500 })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
