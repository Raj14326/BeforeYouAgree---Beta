export type Clause = {
  clauseId: string
  text: string
  start: number
  end: number
  /** Nearest short heading or list introduction inherited by a bullet. */
  context?: string
  skipAnalysis?: boolean
}

export type DocumentContext = {
  start: number
  end: number
  text: string
  headingStart?: number
  headingEnd?: number
  skipAnalysis?: boolean
}

function isBullet(text: string) {
  return /^(?:[-*•]|\d+[.)])\s+/u.test(text)
}

function inferredContext(text: string) {
  const isShortIntroduction = text.length <= 160 && !isBullet(text) &&
    (/:\s*$/u.test(text) || !/[.!?]\s*$/u.test(text))
  return isShortIntroduction ? text.replace(/:\s*$/u, '').trim() : undefined
}

/** Sentence-level inference with exact JavaScript UTF-16 offsets. */
export function splitClauses(
  content: string,
  documentContexts: DocumentContext[] = [],
): Clause[] {
  const clauses: Clause[] = []
  const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
  function add(raw: string, base: number) {
    const text = raw.trim()
    if (!text || !/\p{L}/u.test(text)) return
    const start = base + raw.indexOf(text)
    clauses.push({ clauseId: `clause-${clauses.length}`, text, start, end: start + text.length })
  }
  for (const part of segmenter.segment(content)) {
    const listBoundary = /(?:\r?\n(?=[\t ]*(?:[-*•]|\d+[.)])\s)|[ \t]*\|[ \t]*)/g
    let cursor = 0
    for (const match of part.segment.matchAll(listBoundary)) {
      add(part.segment.slice(cursor, match.index), part.index + cursor)
      cursor = match.index + match[0].length
    }
    add(part.segment.slice(cursor), part.index + cursor)
  }

  let listContext: string | undefined
  for (const [index, clause] of clauses.entries()) {
    const section = documentContexts.find(({ start, end }) => clause.start >= start && clause.start < end)
    const heading = documentContexts.find(
      ({ headingStart, headingEnd }) => headingStart === clause.start && headingEnd === clause.end,
    )
    if (heading || section?.skipAnalysis) clause.skipAnalysis = true

    if (isBullet(clause.text)) {
      clause.context = [...new Set([section?.text, listContext].filter(Boolean))].join(' — ') || undefined
      continue
    }
    listContext = inferredContext(clause.text)
    if (listContext && isBullet(clauses[index + 1]?.text || '')) clause.skipAnalysis = true
    else listContext = undefined
  }
  return clauses
}
