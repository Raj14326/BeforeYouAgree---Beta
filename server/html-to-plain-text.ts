/**
 * HTML → plain-text conversion for retrieved policy documents.
 *
 * Policy pages from ToS;DR arrive as raw HTML fragments full of navigation,
 * scripts, and inline styling. The risk model only wants readable prose, so this
 * module strips the page down to text and then normalises the whitespace so the
 * clause splitter in `m006-model.ts` sees consistent paragraph breaks.
 */
import { convert } from 'html-to-text'

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
  return (
    convert(value, {
      wordwrap: false,
      preserveNewlines: true,
      selectors: [
        { selector: 'h1', options: { uppercase: false } },
        { selector: 'h2', options: { uppercase: false } },
        { selector: 'h3', options: { uppercase: false } },
        { selector: 'h4', options: { uppercase: false } },
        { selector: 'h5', options: { uppercase: false } },
        { selector: 'h6', options: { uppercase: false } },
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
      // Drop control characters (NUL, backspace, vertical tab, DEL, …) that survive conversion.
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Collapse runs of horizontal whitespace (spaces, tabs) to a single space.
      .replace(/[^\S\n]+/g, ' ')
      // Strip spaces that sit directly against a newline.
      .replace(/ *\n */g, '\n')
      // Cap consecutive blank lines at one, so paragraphs are separated by exactly "\n\n".
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}
