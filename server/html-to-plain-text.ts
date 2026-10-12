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

function normalizeConvertedText(value: string) {
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function convertHtml(value: string) {
  return convert(value, {
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
      { selector: 'script', format: 'skip' },
      { selector: 'style', format: 'skip' },
      { selector: 'noscript', format: 'skip' },
      { selector: 'template', format: 'skip' },
      { selector: 'iframe', format: 'skip' },
      { selector: 'svg', format: 'skip' },
      { selector: 'form', format: 'skip' },
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
