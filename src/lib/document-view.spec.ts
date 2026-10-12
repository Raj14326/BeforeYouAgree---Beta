import { describe, expect, it } from 'vitest'
import type { Analysis } from '@/types'
import { buildDocumentViewHtml } from './document-view'

describe('document viewer HTML', () => {
  it('renders known headings, paragraphs, and lists as semantic HTML', () => {
    const content = 'Privacy policy\n\nWe collect information.\n\n* Email address\n* Device ID'
    const html = buildDocumentViewHtml(content, undefined, 'privacy', [{
      start: 'Privacy policy'.length,
      end: content.length,
      text: 'Privacy policy',
      headingStart: 0,
      headingEnd: 'Privacy policy'.length,
    }])

    expect(html).toContain('<h3>Privacy policy</h3>')
    expect(html).toContain('<p>We collect information.</p>')
    expect(html).toContain('<ul><li>Email address</li><li>Device ID</li></ul>')
  })

  it('escapes source text and preserves exact risky-clause highlighting', () => {
    const content = 'Terms\n\nWe limit <our> liability.\n\n1. Safe item'
    const start = content.indexOf('We limit')
    const end = content.indexOf('.', start) + 1
    const analysis = {
      model: 'test',
      clauseCount: 1,
      riskyClauseCount: 1,
      findings: [{
        text: content.slice(start, end),
        start,
        end,
        occurrenceCount: 1,
        occurrenceStarts: [start],
        categories: [],
        predictedLabel: 'risky',
        riskLevel: 'high',
        riskLevelMessage: 'High risk',
        reviewCategories: [],
      }],
    } satisfies Analysis

    const html = buildDocumentViewHtml(content, analysis, 'terms')
    expect(html).toContain('<mark id="clause-terms-0" class="clause-mark">We limit &lt;our&gt; liability.</mark>')
    expect(html).toContain('<ol><li>Safe item</li></ol>')
    expect(html).not.toContain('<our>')
  })

  it('renders attack-shaped policy text without creating executable markup', () => {
    const content = '<img src=x onerror="alert(1)">\n<script>alert(2)</script>\n\'; DROP TABLE users; --'
    const html = buildDocumentViewHtml(content, undefined, 'privacy')

    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
    expect(html).toContain('&lt;script&gt;alert(2)&lt;/script&gt;')
    expect(html).toContain("'; DROP TABLE users; --")
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script>')
  })
})
