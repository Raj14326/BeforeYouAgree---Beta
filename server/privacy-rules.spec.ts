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

  it('detects collection, sharing, administration, and retention wording that varies', () => {
    const examples = [
      [
        'We collect IP addresses, crash reports, system activity, and the referrer URL of your request.',
        'privacy_broad_collection',
      ],
      [
        'We collect call and message log information, including phone numbers and message times.',
        'privacy_broad_collection',
      ],
      [
        'We receive information about you from trusted marketing and security partners.',
        'privacy_third_party_sharing',
      ],
      [
        'We share non-identifying information publicly and with our partners.',
        'privacy_third_party_sharing',
      ],
      ['Administrators can access and retain information stored in your account.', 'privacy_admin_control'],
      [
        'Some information we retain for longer periods for legal, security, fraud-prevention, or financial purposes.',
        'privacy_extended_retention',
      ],
    ] as const

    for (const [text, expected] of examples) {
      expect(detectPrivacyRisks(text).map((finding) => finding.id)).toContain(expected)
    }
  })

  it('does not treat identifier definitions and authentication examples as collection', () => {
    const nonCollection = [
      'Unique identifiers are used to recognize a specific device or application.',
      'A unique identifier may be incorporated into a device by its manufacturer.',
      'We use an identifier stored in a cookie to authenticate your account.',
    ]
    for (const text of nonCollection) {
      expect(detectPrivacyRisks(text).map((finding) => finding.id)).not.toContain(
        'privacy_broad_collection',
      )
    }
  })

  it('does not confuse IP addresses or user-directed public sharing with company advertising', () => {
    const accountActivity =
      'This page shows recent account activity, including IP addresses that accessed your mail.'
    expect(detectPrivacyRisks(accountActivity).map((finding) => finding.id)).not.toContain(
      'privacy_personalized_ads',
    )
    expect(
      detectPrivacyRisks('When you share information publicly, search engines may find it.'),
    ).toEqual([])
  })

  it('covers recurring wording from unrelated production privacy policies', () => {
    const examples = [
      [
        'We collect log and event information about the pages, channels, features, and embedded content you interact with.',
        'privacy_broad_collection',
      ],
      [
        'We infer your general geographic location from your IP address.',
        'privacy_location_tracking',
      ],
      [
        'We combine your activity across our services and devices to build a profile of your interests.',
        'privacy_cross_service_profiling',
      ],
      [
        'We use your browsing activity and interests to deliver personalized advertising.',
        'privacy_personalized_ads',
      ],
      [
        'Our automated systems scan messages and uploaded images for safety and content moderation.',
        'privacy_content_analysis',
      ],
      [
        'We share personal information with affiliates, analytics providers, and service providers.',
        'privacy_third_party_sharing',
      ],
      [
        'We disclose account records to law enforcement in response to a subpoena or court order.',
        'privacy_government_disclosure',
      ],
      [
        'Your organization administrator may access, export, delete, or restrict the data in your account.',
        'privacy_admin_control',
      ],
      [
        'We may retain account information after you delete your account for legal, fraud-prevention, and audit purposes.',
        'privacy_extended_retention',
      ],
      [
        'We may store and process your data in the United States and other countries outside your country of residence.',
        'privacy_international_transfer',
      ],
      [
        'If we are involved in a merger, acquisition, or sale of assets, your information may be transferred to a successor.',
        'privacy_business_transfer',
      ],
    ] as const

    for (const [text, expected] of examples) {
      expect(detectPrivacyRisks(text).map(({ id }) => id), text).toContain(expected)
    }
  })

  it('rejects common protective, user-directed, definitional, and address false positives', () => {
    const examples = [
      'We do not sell or share your personal information with advertisers.',
      'When you choose to share a file, we make it available to the people you select.',
      'We retain personal data only for as long as necessary to provide the service.',
      'Our office address is 101 Townsend Street, San Francisco, California.',
      'You can access, download, correct, or delete your personal information in settings.',
      'We do not collect or track your precise location.',
    ]

    for (const text of examples) expect(detectPrivacyRisks(text), text).toEqual([])
  })
})
