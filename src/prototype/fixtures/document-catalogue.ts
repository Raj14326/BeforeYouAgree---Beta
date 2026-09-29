// Static example "search catalogue" for the /prototype workflow mock: 2
// fictional services, each with a Terms of Service + a Privacy Policy, with
// a full documentText (so the original document panel + highlighting are
// real, not hand-faked) and a couple of fake archived versions. Names are
// deliberately generic placeholders, not real companies — this screen shows
// made-up scores. clauseCount/riskyClauseCount are tuned (via the real
// documentRiskScore/personalised-risk-score formulas) to land in the
// high/medium/low tiers named below.
import { withOffsets } from './finding-helpers'
import type { Analysis } from '@/types'

export type DocumentVersion = { id: string; label: string }

export type CatalogueDocument = {
  id: string
  serviceName: string
  documentLabel: string
  termType: 'terms' | 'privacy'
  documentText: string
  versions: DocumentVersion[]
  analysis: Analysis
}

export type CatalogueService = {
  name: string
  documents: CatalogueDocument[]
}

const service1TermsText = `Welcome to Service 1. These Terms of Service govern your access to and use of our platform. By creating an account, you agree to be bound by these terms.

Eligibility and accounts. You must be at least 13 years old to use Service 1. You are responsible for maintaining the security of your account credentials. We may suspend or terminate your account at any time without notice.

Content and conduct. You retain ownership of content you post, but grant us a broad license to use, display, and distribute it. By continuing to use the service you agree we may remove content at our discretion.

Disputes. Any dispute will be resolved exclusively under the laws of our home jurisdiction. We encourage you to contact support before pursuing formal action.

Changes to these terms. We may update these terms from time to time. Continued use of the service after changes take effect constitutes acceptance of the revised terms.`

// Tier: high (documentRiskScore >= 75).
const service1Terms: Analysis = {
  model: 'mock-v1',
  clauseCount: 10,
  riskyClauseCount: 8,
  findings: withOffsets(service1TermsText, [
    {
      text: 'We may suspend or terminate your account at any time without notice.',
      categories: [
        { id: 'arbitration', name: 'Arbitration', score: 1.0 },
        { id: 'unilateral_termination', name: 'Unilateral termination', score: 1.0 },
      ],
    },
    {
      text: 'Any dispute will be resolved exclusively under the laws of our home jurisdiction.',
      categories: [
        { id: 'choice_of_law', name: 'Choice of law', score: 1.0 },
        { id: 'jurisdiction', name: 'Jurisdiction', score: 0.9 },
      ],
    },
    {
      text: 'By continuing to use the service you agree we may remove content at our discretion.',
      categories: [
        { id: 'content_removal', name: 'Content removal', score: 0.9 },
        { id: 'contract_by_using', name: 'Contract by using', score: 0.8 },
      ],
    },
  ]),
}

const service1PrivacyText = `Service 1 Privacy Policy. This policy explains what data we collect and how we use it across our products and services.

Data we collect. We collect device, location, and usage data and may share it with partners who help us operate and improve the service.

How we use your data. Your data may be used to personalise the ads you see across our products. We also use aggregated data to understand feature usage.

Data retention. We retain account data for a period after closure for legal and analytics purposes. You can request earlier deletion by contacting support.

Your choices. You can review, export, or delete much of your data from your account settings at any time.`

// Tier: medium (45-74).
const service1Privacy: Analysis = {
  model: 'mock-v1',
  clauseCount: 12,
  riskyClauseCount: 6,
  findings: withOffsets(service1PrivacyText, [
    {
      text: 'We collect device, location, and usage data and may share it with partners who help us operate and improve the service.',
      categories: [
        { id: 'privacy_broad_collection', name: 'Broad data collection', score: 0.8 },
        { id: 'privacy_third_party_sharing', name: 'Third-party data sharing', score: 0.7 },
      ],
    },
    {
      text: 'Your data may be used to personalise the ads you see across our products.',
      categories: [{ id: 'privacy_personalized_ads', name: 'Personalized advertising', score: 0.6 }],
    },
    {
      text: 'We retain account data for a period after closure for legal and analytics purposes.',
      categories: [{ id: 'privacy_extended_retention', name: 'Extended data retention', score: 0.5 }],
    },
  ]),
}

const service2TermsText = `Service 2 Terms of Service. These terms cover your use of our streaming service and related apps.

Your subscription. Your subscription renews automatically each billing period unless cancelled before the renewal date.

Acceptable use. Please don't share your account credentials outside your household, and don't attempt to circumvent content protections.

Changes to these terms. We may update these terms from time to time; continued use means acceptance. We'll try to notify you of material changes in advance.

Contact us. If you have questions about these terms, reach out to our support team any time.`

// Tier: low (< 45).
const service2Terms: Analysis = {
  model: 'mock-v1',
  clauseCount: 15,
  riskyClauseCount: 2,
  findings: withOffsets(service2TermsText, [
    {
      text: 'We may update these terms from time to time; continued use means acceptance.',
      categories: [{ id: 'unilateral_change', name: 'Unilateral change', score: 0.4 }],
    },
  ]),
}

const service2PrivacyText = `Service 2 Privacy Policy. This policy explains what data we collect and how we use it.

Location. We use location data to show you nearby recommendations. You can disable this in your device settings.

Cross-service activity. Your activity may be linked across our other apps and services to improve recommendations.

Legal requests. We may disclose account information if required by law. We review each request carefully.

Your rights. You can request a copy of your data or ask us to delete it at any time.`

// Tier: medium (45-74).
const service2Privacy: Analysis = {
  model: 'mock-v1',
  clauseCount: 13,
  riskyClauseCount: 5,
  findings: withOffsets(service2PrivacyText, [
    {
      text: 'We use location data to show you nearby recommendations.',
      categories: [{ id: 'privacy_location_tracking', name: 'Location tracking', score: 0.85 }],
    },
    {
      text: 'Your activity may be linked across our other apps and services to improve recommendations.',
      categories: [{ id: 'privacy_cross_service_profiling', name: 'Cross-service profiling', score: 0.65 }],
    },
    {
      text: 'We may disclose account information if required by law.',
      categories: [{ id: 'privacy_government_disclosure', name: 'Government or legal disclosure', score: 0.6 }],
    },
  ]),
}

const ARCHIVED_VERSIONS: DocumentVersion[] = [
  { id: 'current', label: 'Current version' },
  { id: '2024-01', label: 'January 2024 (archived)' },
]

export const DOCUMENT_CATALOGUE: CatalogueService[] = [
  {
    name: 'Service 1',
    documents: [
      {
        id: 'service-1-terms',
        serviceName: 'Service 1',
        documentLabel: 'Terms of Service',
        termType: 'terms',
        documentText: service1TermsText,
        versions: ARCHIVED_VERSIONS,
        analysis: service1Terms,
      },
      {
        id: 'service-1-privacy',
        serviceName: 'Service 1',
        documentLabel: 'Privacy Policy',
        termType: 'privacy',
        documentText: service1PrivacyText,
        versions: ARCHIVED_VERSIONS,
        analysis: service1Privacy,
      },
    ],
  },
  {
    name: 'Service 2',
    documents: [
      {
        id: 'service-2-terms',
        serviceName: 'Service 2',
        documentLabel: 'Terms of Service',
        termType: 'terms',
        documentText: service2TermsText,
        versions: ARCHIVED_VERSIONS,
        analysis: service2Terms,
      },
      {
        id: 'service-2-privacy',
        serviceName: 'Service 2',
        documentLabel: 'Privacy Policy',
        termType: 'privacy',
        documentText: service2PrivacyText,
        versions: ARCHIVED_VERSIONS,
        analysis: service2Privacy,
      },
    ],
  },
]

export const ALL_CATALOGUE_DOCUMENTS: CatalogueDocument[] = DOCUMENT_CATALOGUE.flatMap((service) => service.documents)

export function findCatalogueDocument(id: string): CatalogueDocument | undefined {
  return ALL_CATALOGUE_DOCUMENTS.find((document) => document.id === id)
}
