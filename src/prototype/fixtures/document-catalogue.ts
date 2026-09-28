// Static example "search catalogue" for the /prototype workflow mock:
// services with documents, each with a full documentText (so the original
// document panel + highlighting are real, not hand-faked) and a couple of
// fake archived versions. Service names are fictional — this screen shows
// made-up scores, not a real analysis. clauseCount/riskyClauseCount are
// tuned (via the real documentRiskScore/personalised-risk-score formulas)
// to land in the high/medium/low tiers named below.
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

const exampleSocialTermsText = `Welcome to ExampleSocial. These Terms of Service govern your access to and use of our platform. By creating an account, you agree to be bound by these terms.

Eligibility and accounts. You must be at least 13 years old to use ExampleSocial. You are responsible for maintaining the security of your account credentials. We may suspend or terminate your account at any time without notice.

Content and conduct. You retain ownership of content you post, but grant us a broad license to use, display, and distribute it. By continuing to use the service you agree we may remove content at our discretion.

Disputes. Any dispute will be resolved exclusively under the laws of our home jurisdiction. We encourage you to contact support before pursuing formal action.

Changes to these terms. We may update these terms from time to time. Continued use of the service after changes take effect constitutes acceptance of the revised terms.`

// Tier: high (documentRiskScore >= 75).
const exampleSocialTerms: Analysis = {
  model: 'mock-v1',
  clauseCount: 10,
  riskyClauseCount: 8,
  findings: withOffsets(exampleSocialTermsText, [
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

const exampleCloudPrivacyText = `ExampleCloud Privacy Policy. This policy explains what data we collect and how we use it across our products and services.

Data we collect. We collect device, location, and usage data and may share it with partners who help us operate and improve the service.

How we use your data. Your data may be used to personalise the ads you see across our products. We also use aggregated data to understand feature usage.

Data retention. We retain account data for a period after closure for legal and analytics purposes. You can request earlier deletion by contacting support.

Your choices. You can review, export, or delete much of your data from your account settings at any time.`

// Tier: medium (45-74).
const exampleCloudPrivacy: Analysis = {
  model: 'mock-v1',
  clauseCount: 12,
  riskyClauseCount: 6,
  findings: withOffsets(exampleCloudPrivacyText, [
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

const exampleStreamTermsText = `ExampleStream Terms of Service. These terms cover your use of our streaming service and related apps.

Your subscription. Your subscription renews automatically each billing period unless cancelled before the renewal date.

Acceptable use. Please don't share your account credentials outside your household, and don't attempt to circumvent content protections.

Changes to these terms. We may update these terms from time to time; continued use means acceptance. We'll try to notify you of material changes in advance.

Contact us. If you have questions about these terms, reach out to our support team any time.`

// Tier: low (< 45).
const exampleStreamTerms: Analysis = {
  model: 'mock-v1',
  clauseCount: 15,
  riskyClauseCount: 2,
  findings: withOffsets(exampleStreamTermsText, [
    {
      text: 'We may update these terms from time to time; continued use means acceptance.',
      categories: [{ id: 'unilateral_change', name: 'Unilateral change', score: 0.4 }],
    },
  ]),
}

const ARCHIVED_VERSIONS: DocumentVersion[] = [
  { id: 'current', label: 'Current version' },
  { id: '2024-01', label: 'January 2024 (archived)' },
]

export const DOCUMENT_CATALOGUE: CatalogueService[] = [
  {
    name: 'ExampleSocial',
    documents: [
      {
        id: 'example-social-terms',
        serviceName: 'ExampleSocial',
        documentLabel: 'Terms of Service',
        termType: 'terms',
        documentText: exampleSocialTermsText,
        versions: ARCHIVED_VERSIONS,
        analysis: exampleSocialTerms,
      },
    ],
  },
  {
    name: 'ExampleCloud',
    documents: [
      {
        id: 'example-cloud-privacy',
        serviceName: 'ExampleCloud',
        documentLabel: 'Privacy Policy',
        termType: 'privacy',
        documentText: exampleCloudPrivacyText,
        versions: ARCHIVED_VERSIONS,
        analysis: exampleCloudPrivacy,
      },
    ],
  },
  {
    name: 'ExampleStream',
    documents: [
      {
        id: 'example-stream-terms',
        serviceName: 'ExampleStream',
        documentLabel: 'Terms of Service',
        termType: 'terms',
        documentText: exampleStreamTermsText,
        versions: ARCHIVED_VERSIONS,
        analysis: exampleStreamTerms,
      },
    ],
  },
]

export const ALL_CATALOGUE_DOCUMENTS: CatalogueDocument[] = DOCUMENT_CATALOGUE.flatMap((service) => service.documents)

export function findCatalogueDocument(id: string): CatalogueDocument | undefined {
  return ALL_CATALOGUE_DOCUMENTS.find((document) => document.id === id)
}
