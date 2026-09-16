// Metadata for the risk categories a clause can be tagged with: the model's
// 8 ToS labels plus the 11 rule-based privacy labels (see
// ml/local-models/bya-legalbert-small-unfair-tos/risk_config.json and
// server/privacy-rules.ts). Shared by RiskPreferenceSidebar (toggle cards)
// and anywhere else that needs a human-readable name/description for a
// category id.

export type CategoryDef = { id: string; name: string; description: string }

export const TOS_CATEGORIES: CategoryDef[] = [
  {
    id: 'limitation_of_liability',
    name: 'Limitation of liability',
    description: 'Won’t pay you back for problems it causes.',
  },
  {
    id: 'unilateral_termination',
    name: 'Unilateral termination',
    description: 'Can close your account anytime, no reason given.',
  },
  {
    id: 'unilateral_change',
    name: 'Unilateral change',
    description: 'Can change the rules anytime without asking you.',
  },
  {
    id: 'content_removal',
    name: 'Content removal',
    description: 'Can delete your posts or account without warning.',
  },
  {
    id: 'contract_by_using',
    name: 'Contract by using',
    description: 'Just using it counts as agreeing to the terms.',
  },
  {
    id: 'choice_of_law',
    name: 'Choice of law',
    description: 'Disputes are judged under laws that favour the company.',
  },
  {
    id: 'jurisdiction',
    name: 'Jurisdiction',
    description: 'You must fight legal disputes in their chosen location.',
  },
  {
    id: 'arbitration',
    name: 'Arbitration',
    description: 'You give up the right to sue or join a class action.',
  },
]

export const PRIVACY_GROUP: CategoryDef = {
  id: 'privacy',
  name: 'Privacy',
  description: 'Common ways your data may be tracked, shared, or stored.',
}

export const PRIVACY_CATEGORIES: CategoryDef[] = [
  {
    id: 'privacy_broad_collection',
    name: 'Broad data collection',
    description: 'Collects more personal data than it needs.',
  },
  {
    id: 'privacy_location_tracking',
    name: 'Location tracking',
    description: 'Tracks where you are, even in the background.',
  },
  {
    id: 'privacy_cross_service_profiling',
    name: 'Cross-service profiling',
    description: 'Links your activity across other apps and products.',
  },
  {
    id: 'privacy_personalized_ads',
    name: 'Personalized advertising',
    description: 'Uses your data to target you with ads.',
  },
  {
    id: 'privacy_content_analysis',
    name: 'Content or audio analysis',
    description: 'Scans what you upload or say, often with AI.',
  },
  {
    id: 'privacy_third_party_sharing',
    name: 'Third-party data sharing',
    description: 'Shares your data with outside companies.',
  },
  {
    id: 'privacy_government_disclosure',
    name: 'Government or legal disclosure',
    description: 'Can hand your data to police or government.',
  },
  {
    id: 'privacy_admin_control',
    name: 'Administrator access and control',
    description: 'Staff can view or manage your account and data.',
  },
  {
    id: 'privacy_extended_retention',
    name: 'Extended data retention',
    description: 'Keeps your data long after you delete your account.',
  },
  {
    id: 'privacy_international_transfer',
    name: 'International data transfer',
    description: 'Sends your data to other countries.',
  },
  {
    id: 'privacy_business_transfer',
    name: 'Business-transfer disclosure',
    description: 'Your data moves along if the company is sold.',
  },
]

/** Every leaf category id a clause finding can actually carry (excludes the synthetic "privacy" group id). */
export const ALL_CATEGORY_IDS: string[] = [
  ...TOS_CATEGORIES.map((category) => category.id),
  ...PRIVACY_CATEGORIES.map((category) => category.id),
]
