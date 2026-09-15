import type { Analysis } from '@/types'

/** Stable DOM id for a clause's `<mark>`, so a finding can be scrolled to. */
export function clauseId(termType: string, index: number) {
  return `clause-${termType.replace(/[^a-z0-9]+/gi, '-')}-${index}`
}

/** Escape the five HTML-significant characters before text is injected via `v-html`. */
export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"]/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character] as string,
  )
}

/**
 * Build the HTML shown in the document viewer for a term.
 *
 * With no analysis yet, it is just the escaped source text. After analysis,
 * each risky clause is located in the text by substring match and wrapped in a
 * `<mark id=…>` (id from {@link clauseId}) so findings can be seen in context
 * and scrolled to. All non-mark text is HTML-escaped.
 *
 * Overlapping matches are skipped (`mark.start < cursor`), and clauses whose
 * text is not found verbatim are dropped.
 */
export function buildDocumentViewHtml(
  content: string,
  analysis: Analysis | undefined,
  termType: string,
) {
  if (!content) return ''
  if (!analysis) return escapeHtml(content)

  const marks = analysis.findings
    .map((finding, index) => ({
      index,
      start: finding.predictedLabel === 'risky' ? finding.start : -1,
      end: finding.end,
      length: finding.end - finding.start,
    }))
    .filter((mark) => mark.start >= 0)
    .sort((a, b) => a.start - b.start)

  let cursor = 0
  let html = ''
  for (const mark of marks) {
    if (mark.start < cursor) continue // overlapping clause already covered
    const end = mark.start + mark.length
    html += escapeHtml(content.slice(cursor, mark.start))
    html += `<mark id="${clauseId(termType, mark.index)}" class="clause-mark">${escapeHtml(
      content.slice(mark.start, end),
    )}</mark>`
    cursor = end
  }
  html += escapeHtml(content.slice(cursor))
  return html
}
