export type Clause = { clauseId: string; text: string; start: number; end: number }

/** Sentence-level inference with exact JavaScript UTF-16 offsets. */
export function splitClauses(content: string): Clause[] {
  const clauses: Clause[] = []
  const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
  function add(raw: string, base: number) {
    const text = raw.trim()
    if (!text || !/\p{L}/u.test(text)) return
    const start = base + raw.indexOf(text)
    clauses.push({ clauseId: `clause-${clauses.length}`, text, start, end: start + text.length })
  }
  for (const part of segmenter.segment(content)) {
    const listBoundary = /\r?\n(?=[\t ]*(?:[-*•]|\d+[.)])\s)/g
    let cursor = 0
    for (const match of part.segment.matchAll(listBoundary)) {
      add(part.segment.slice(cursor, match.index), part.index + cursor)
      cursor = match.index + match[0].length
    }
    add(part.segment.slice(cursor), part.index + cursor)
  }
  return clauses
}
