import type { Analysis, DocumentContext } from '@/types'

/** Stable DOM id for a clause's `<mark>`, so a finding can be scrolled to. */
export function clauseId(termType: string, index: number) {
  return `clause-${termType.replace(/[^a-z0-9]+/gi, '-')}-${index}`
}

/** Escape source text before injecting it through `v-html`. */
export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"]/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character] as string,
  )
}

/** Render safe, structured policy HTML while retaining exact finding offsets. */
export function buildDocumentViewHtml(
  content: string,
  analysis: Analysis | undefined,
  termType: string,
  contexts: DocumentContext[] = [],
) {
  if (!content) return ''
  const marks = (analysis?.findings ?? [])
    .map((finding, index) => ({
      index,
      start: finding.predictedLabel === 'risky' ? finding.start : -1,
      end: finding.end,
    }))
    .filter((mark) => mark.start >= 0 && mark.end > mark.start && mark.end <= content.length)
    .sort((a, b) => a.start - b.start)

  const nonOverlappingMarks = marks.reduce<typeof marks>((accepted, mark) => {
    if (!accepted.length || mark.start >= accepted[accepted.length - 1]!.end) accepted.push(mark)
    return accepted
  }, [])

  function inlineHtml(start: number, end: number) {
    let cursor = start
    let html = ''
    for (const mark of nonOverlappingMarks) {
      if (mark.end <= start) continue
      if (mark.start >= end) break
      const markStart = Math.max(mark.start, start)
      const markEnd = Math.min(mark.end, end)
      html += escapeHtml(content.slice(cursor, markStart))
      const id = mark.start >= start ? ` id="${clauseId(termType, mark.index)}"` : ''
      html += `<mark${id} class="clause-mark">${escapeHtml(content.slice(markStart, markEnd))}</mark>`
      cursor = markEnd
    }
    return html + escapeHtml(content.slice(cursor, end))
  }

  const headingRanges = new Set(
    contexts
      .filter(({ headingStart, headingEnd }) => headingStart !== undefined && headingEnd !== undefined)
      .map(({ headingStart, headingEnd }) => `${headingStart}:${headingEnd}`),
  )
  const lines = [...content.matchAll(/[^\r\n]*(?:\r?\n|$)/g)]
    .filter((match) => match[0] !== '')
    .map((match) => {
      const raw = match[0].replace(/\r?\n$/u, '')
      const start = match.index! + raw.search(/\S|$/u)
      const text = raw.trim()
      return { text, start, end: start + text.length }
    })

  let html = ''
  let listType: 'ul' | 'ol' | undefined
  const closeList = () => {
    if (listType) html += `</${listType}>`
    listType = undefined
  }
  for (const line of lines) {
    if (!line.text) {
      closeList()
      continue
    }
    const range = `${line.start}:${line.end}`
    if (headingRanges.has(range)) {
      closeList()
      html += `<h3>${inlineHtml(line.start, line.end)}</h3>`
      continue
    }
    const bullet = /^(?:[-*•])\s+/u.exec(line.text)
    const numbered = /^\d+[.)]\s+/u.exec(line.text)
    const prefix = bullet ?? numbered
    if (prefix) {
      const nextType = bullet ? 'ul' : 'ol'
      if (listType !== nextType) {
        closeList()
        listType = nextType
        html += `<${listType}>`
      }
      const itemStart = line.start + prefix[0].length
      html += `<li>${inlineHtml(itemStart, line.end)}</li>`
      continue
    }
    closeList()
    html += `<p>${inlineHtml(line.start, line.end)}</p>`
  }
  closeList()
  return html
}
