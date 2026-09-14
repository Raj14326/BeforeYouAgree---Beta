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
    for (const clause of clauses) {
      expect(content.slice(clause.start, clause.end)).toBe(clause.text)
    }
  })
})
