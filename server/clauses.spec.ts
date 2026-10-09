// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { splitClauses } from './clauses.ts'

describe('policy clause splitting', () => {
  it('splits bullets and table cells while preserving exact source offsets', () => {
    const content =
      'Information includes:\n* Device identifiers and browser activity\n* Precise location data | Legal grounds depend on your settings.'
    const clauses = splitClauses(content)
    expect(clauses.map(({ text }) => text)).toEqual([
      'Information includes:',
      '* Device identifiers and browser activity',
      '* Precise location data',
      'Legal grounds depend on your settings.',
    ])
    expect(clauses.map(({ context }) => context)).toEqual([
      undefined,
      'Information includes',
      'Information includes',
      undefined,
    ])
    for (const clause of clauses) {
      expect(content.slice(clause.start, clause.end)).toBe(clause.text)
    }
  })

  it('does not attach ordinary prose as bullet context', () => {
    const clauses = splitClauses('We explain our practices here.\n* Device identifiers')
    expect(clauses[1]?.context).toBeUndefined()
  })

  it('uses a structured section heading when a bullet has no list introduction', () => {
    const content = 'Information we collect\n\n* Content you create'
    const bulletStart = content.indexOf('*')
    const clauses = splitClauses(content, [
      { start: 'Information we collect'.length, end: content.length, text: 'Information we collect' },
    ])
    expect(clauses.find((clause) => clause.start === bulletStart)?.context)
      .toBe('Information we collect')
  })

  it('keeps headings and list introductions as context but skips their own analysis', () => {
    const content = 'Information we collect\n\nActivity may include:\n* Terms you search for'
    const headingEnd = 'Information we collect'.length
    const clauses = splitClauses(content, [{
      start: headingEnd,
      end: content.length,
      text: 'Information we collect',
      headingStart: 0,
      headingEnd,
    }])
    expect(clauses[0]?.skipAnalysis).toBe(true)
    expect(clauses[1]?.skipAnalysis).toBe(true)
    expect(clauses[2]?.context).toBe('Information we collect — Activity may include')
  })

  it('skips internal Markdown navigation links but retains substantive clauses', () => {
    const content = "Limitation of liability](#15)[16.\n\nWe limit our liability to the amount you paid us."
    const clauses = splitClauses(content)

    expect(clauses[0]).toMatchObject({
      text: 'Limitation of liability](#15)[16.',
      skipAnalysis: true,
    })
    expect(clauses[1]).toMatchObject({
      text: 'We limit our liability to the amount you paid us.',
    })
    expect(clauses[1]?.skipAnalysis).toBeUndefined()
  })
})
