import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { htmlToStructuredText } from './html-to-plain-text.ts'

const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024
const MAX_TEXT_LENGTH = 500_000
const MAX_REDIRECTS = 5

export type PolicyFetchErrorCode = 'URL_INVALID' | 'SSRF_BLOCKED' | 'HTTP_TIMEOUT' | 'ACCESS_DENIED'

export class PolicyFetchError extends Error {
  constructor(
    public readonly code: PolicyFetchErrorCode,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message)
    this.name = 'PolicyFetchError'
  }
}

function policyError(code: PolicyFetchErrorCode, message: string, statusCode = 422) {
  return new PolicyFetchError(code, message, statusCode)
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^::ffff:/, '')
  if (isIP(normalized) === 4) {
    const [a = 0, b = 0] = normalized.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  }
  if (isIP(normalized) === 6)
    return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') ||
      normalized.startsWith('fd') || /^fe[89ab]/.test(normalized)
  return true
}

async function validatePublicUrl(value: string | URL) {
  let url: URL
  try { url = value instanceof URL ? value : new URL(value) }
  catch { throw policyError('URL_INVALID', 'Enter a complete URL, such as https://example.com/privacy.') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname)
    throw policyError('URL_INVALID', 'Policy URL must be a public HTTP or HTTPS address.')
  if (url.port && !['80', '443'].includes(url.port))
    throw policyError('URL_INVALID', 'Policy URL uses an unsupported port.')
  let addresses
  try { addresses = await lookup(url.hostname, { all: true, verbatim: true }) }
  catch { throw policyError('URL_INVALID', 'The policy website could not be found.') }
  if (!addresses.length) throw policyError('URL_INVALID', 'The policy website could not be found.')
  if (addresses.some(({ address }) => isPrivateAddress(address)))
    throw policyError('SSRF_BLOCKED', 'For security, private and internal network addresses cannot be fetched.', 403)
  return url
}

async function readLimitedText(response: Response) {
  if (Number(response.headers.get('content-length') || 0) > MAX_DOWNLOAD_BYTES)
    throw policyError('ACCESS_DENIED', 'The policy page exceeds the 2 MB download limit.', 413)
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > MAX_DOWNLOAD_BYTES) {
      await reader.cancel()
      throw policyError('ACCESS_DENIED', 'The policy page exceeds the 2 MB download limit.', 413)
    }
    chunks.push(value)
  }
  const body = new Uint8Array(bytes)
  let offset = 0
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(body)
}

function pageName(html: string, url: URL) {
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]
    ?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return (title || `${url.hostname} policy`).slice(0, 100)
}

/** Fetch and extract a public policy page, with bounds and SSRF protection. */
export async function fetchPolicyUrl(input: string) {
  let url = await validatePublicUrl(input.trim())
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    let response: Response
    try {
      response = await fetch(url, {
        redirect: 'manual',
        headers: { Accept: 'text/html, text/plain;q=0.9', 'User-Agent': 'BeforeYouAgree/1.0' },
        signal: AbortSignal.timeout(20_000),
      })
    } catch (cause) {
      if (cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError'))
        throw policyError('HTTP_TIMEOUT', 'The policy website took too long to respond.', 504)
      throw policyError('ACCESS_DENIED', 'The policy website could not be reached.', 502)
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      if (!location) throw policyError('URL_INVALID', 'The policy page returned an invalid redirect.')
      if (redirects === MAX_REDIRECTS)
        throw policyError('ACCESS_DENIED', 'The policy page redirected too many times.')
      url = await validatePublicUrl(new URL(location, url))
      continue
    }
    if (response.status === 401 || response.status === 403)
      throw policyError('ACCESS_DENIED', 'The policy website denied access to this page.', 403)
    if (response.status === 404)
      throw policyError('URL_INVALID', 'No policy page was found at this URL.', 404)
    if (!response.ok)
      throw policyError('ACCESS_DENIED', `The policy website returned HTTP ${response.status}.`, 502)
    const contentType = response.headers.get('content-type')?.toLowerCase() || ''
    if (!/^(?:text\/html|application\/xhtml\+xml|text\/plain)(?:\s*;|$)/.test(contentType))
      throw policyError('URL_INVALID', 'The URL does not point to an HTML or plain-text policy page.')
    const raw = await readLimitedText(response)
    const structured = contentType.startsWith('text/plain')
      ? { content: raw.replace(/\r\n?/g, '\n').trim(), contexts: [] }
      : htmlToStructuredText(raw)
    if (structured.content.length > MAX_TEXT_LENGTH)
      throw policyError('ACCESS_DENIED', 'The extracted policy text is too large to analyze.', 413)
    if (structured.content.length < 120)
      throw policyError('URL_INVALID', 'We could not find enough readable policy text at this URL.')
    return { ...structured, sourceUrl: url.href, name: pageName(raw, url) }
  }
  throw policyError('ACCESS_DENIED', 'The policy page could not be fetched.')
}
