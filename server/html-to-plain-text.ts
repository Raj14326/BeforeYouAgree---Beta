/**
 * HTML → plain-text conversion for retrieved policy documents.
 *
 * Policy pages from ToS;DR arrive as raw HTML fragments full of navigation,
 * scripts, and inline styling. The risk model only wants readable prose, so this
 * module strips the page down to text and then normalises the whitespace so the
 * clause analyser sees consistent paragraph breaks.
 */
import { convert } from 'html-to-text'
import type { DocumentContext } from './clauses.ts'

const HEADING_START = '\uE000'
const HEADING_END = '\uE001'

function decodeAttributeEntities(value: string) {
  const named: Record<string, string> = {
    amp: '&', apos: "'", gt: '>', lt: '<', quot: '"',
  }
  return value.replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|quot);/gi, (entity, code: string) => {
    if (code[0] !== '#') return named[code.toLowerCase()] ?? entity
    const point = code[1]?.toLowerCase() === 'x'
      ? Number.parseInt(code.slice(2), 16)
      : Number.parseInt(code.slice(1), 10)
    return Number.isFinite(point) ? String.fromCodePoint(point) : entity
  })
}

/** Extract HTML held by AEM-style text components in an encoded JSON attribute. */
function embeddedTextComponentHtml(value: string) {
  const fragments: string[] = []
  for (const match of value.matchAll(/\bdatamodel="([^"]*)"/gi)) {
    const decoded = decodeAttributeEntities(match[1]!)
    try {
      const model = JSON.parse(decoded) as { text?: unknown }
      if (typeof model.text === 'string' && model.text.trim()) fragments.push(model.text)
    } catch {
      // Some AEM pages put literal line breaks inside the JSON string, which is
      // invalid JSON. Recover only the text field while preserving its escapes.
      const text = /"text"\s*:\s*"((?:\\.|[^"\\])*)"/s.exec(decoded)?.[1]
      if (!text) continue
      try {
        const normalized = text.replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t')
        const parsed = JSON.parse(`"${normalized}"`) as unknown
        if (typeof parsed === 'string' && parsed.trim()) fragments.push(parsed)
      } catch {
        // Ignore unrelated or malformed component metadata; visible HTML is still processed.
      }
    }
  }
  return fragments.join('\n')
}

function normalizeConvertedText(value: string) {
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function convertHtml(value: string) {
  const embedded = embeddedTextComponentHtml(value)
  const source = embedded
    ? /<\/body>/i.test(value)
      ? value.replace(/<\/body>/i, `${embedded}</body>`)
      : `${value}\n${embedded}`
    : value
  return convert(source, {
    wordwrap: false,
    preserveNewlines: true,
    formatters: {
      byaHeading: (element, walk, builder, options) => {
        builder.openBlock({ leadingLineBreaks: options.leadingLineBreaks || 2 })
        builder.addInline(`${HEADING_START}${options.level}:`)
        walk(element.children, builder)
        builder.addInline(HEADING_END)
        builder.closeBlock({ trailingLineBreaks: options.trailingLineBreaks || 2 })
      },
    },
    selectors: [
      ...['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((selector) => ({
        selector,
        format: 'byaHeading',
        options: { uppercase: false, level: Number(selector[1]) },
      })),
      // Accordion labels are commonly buttons rather than semantic headings.
      // Preserve accessible drawer controls as section context while the
      // generic button rule below continues to discard unrelated UI chrome.
      {
        selector: 'button[aria-expanded]',
        format: 'byaHeading',
        options: { uppercase: false, level: 2 },
      },
      {
        selector: '[role="button"][aria-expanded]',
        format: 'byaHeading',
        options: { uppercase: false, level: 2 },
      },
      {
        selector: 'summary',
        format: 'byaHeading',
        options: { uppercase: false, level: 2 },
      },
      { selector: 'script', format: 'skip' },
      { selector: 'style', format: 'skip' },
      { selector: 'noscript', format: 'skip' },
      { selector: 'template', format: 'skip' },
      { selector: 'iframe', format: 'skip' },
      { selector: 'svg', format: 'skip' },
      // Some CMSs (notably ASP.NET WebForms) wrap the entire page, including
      // the policy article, in one form. Keep its readable descendants and
      // discard only the actual controls so the policy is not erased.
      { selector: 'input', format: 'skip' },
      { selector: 'textarea', format: 'skip' },
      { selector: 'select', format: 'skip' },
      { selector: 'nav', format: 'skip' },
      { selector: 'button', format: 'skip' },
      { selector: 'img', format: 'skip' },
      { selector: 'a', options: { ignoreHref: true } },
    ],
  })
}

/**
 * Convert an HTML fragment to normalised plain text.
 *
 * Non-content elements (scripts, nav, forms, images, SVG, …) are dropped
 * entirely; headings keep their original casing; links are flattened to their
 * text. The result is then cleaned so that downstream clause splitting is stable.
 *
 * @param value Raw HTML string (may be empty).
 * @returns Trimmed plain text with single spaces and at most one blank line
 *          between paragraphs.
 */
export function htmlToPlainText(value: string) {
  return htmlToStructuredText(value).content
}

/** Convert HTML while retaining heading-to-section relationships out of band. */
export function htmlToStructuredText(value: string) {
  const marked = normalizeConvertedText(convertHtml(value))
  const headings: Array<{ start: number; end: number; text: string; level: number }> = []
  let content = ''
  let cursor = 0
  const headingPattern = new RegExp(`${HEADING_START}(\\d):([\\s\\S]*?)${HEADING_END}`, 'gu')
  for (const match of marked.matchAll(headingPattern)) {
    content += marked.slice(cursor, match.index)
    const text = match[2]!.trim()
    const start = content.length
    content += text
    headings.push({ start, end: content.length, text, level: Number(match[1]) })
    cursor = match.index! + match[0].length
  }
  content += marked.slice(cursor)
  let definitionLevel: number | undefined
  const contexts: DocumentContext[] = headings.map((heading, index) => {
    if (definitionLevel && heading.level <= definitionLevel) definitionLevel = undefined
    if (/^(?:definitions?|glossary|key terms)$/i.test(heading.text)) definitionLevel = heading.level
    return {
      start: heading.end,
      end: headings[index + 1]?.start ?? content.length,
      headingStart: heading.start,
      headingEnd: heading.end,
      text: heading.text,
      skipAnalysis: definitionLevel !== undefined,
    }
  })
  return { content, contexts }
}
