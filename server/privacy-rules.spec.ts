// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { detectPrivacyRisks } from './privacy-rules.ts'

describe('privacy policy signals', () => {
  it('detects the material privacy clauses found in the Google policy', () => {
    const examples = [
      ['We collect location information when you use our services.', 'privacy_location_tracking'],
      [
        'We may use the information we collect across our services and across your devices.',
        'privacy_cross_service_profiling',
      ],
      [
        'We use automated systems that analyze your content to provide personalized ads.',
        'privacy_content_analysis',
      ],
      [
        'We provide personal information to our affiliates and other trusted businesses or persons to process it for us.',
        'privacy_third_party_sharing',
      ],
      [
        'We keep some data until you delete your Google Account.',
        'privacy_extended_retention',
      ],
      [
        'We maintain servers around the world and your information may be processed on servers located outside of the country where you live.',
        'privacy_international_transfer',
      ],
    ] as const
    for (const [text, expected] of examples) {
      expect(detectPrivacyRisks(text).map((finding) => finding.id)).toContain(expected)
    }
  })

  it('does not flag navigation text or consent-based sharing by itself', () => {
    expect(detectPrivacyRisks('Learn more about how we use location information.')).toEqual([])
    expect(
      detectPrivacyRisks('We’ll share personal information outside of Google when we have your consent.'),
    ).toEqual([])
  })
})
