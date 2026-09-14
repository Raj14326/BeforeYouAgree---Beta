import type { CategoryFinding } from './bert-model.ts'

type PrivacyRule = {
  id: string
  name: string
  patterns: RegExp[]
}

const RULES: PrivacyRule[] = [
  {
    id: 'privacy_broad_collection',
    name: 'Broad data collection',
    patterns: [
      /we collect (?:information|data).*(?:apps?|browsers?|devices?|activity|content)/i,
      /information we collect.*(?:search|watch|voice|audio|purchase|communicat|third-party|browsing)/i,
      /collect (?:call|message) log information/i,
      /unique identifiers.*(?:browser|application|device)/i,
    ],
  },
  {
    id: 'privacy_location_tracking',
    name: 'Location tracking',
    patterns: [
      /^(?:we|Google) (?:collect|use|save|process).{0,50}location information/i,
      /(?:GPS|IP address).*(?:Wi-?Fi|cell towers?|Bluetooth|sensor)/i,
      /(?:Wi-?Fi|cell towers?|Bluetooth).*(?:location|device)/i,
    ],
  },
  {
    id: 'privacy_cross_service_profiling',
    name: 'Cross-service profiling',
    patterns: [
      /across (?:our )?services and across your devices/i,
      /activity (?:on|from) (?:other|third-party) sites and apps.*(?:associated|link|personal information)/i,
      /link information about your activity.*activity from other sites or apps/i,
    ],
  },
  {
    id: 'privacy_personalized_ads',
    name: 'Personalized advertising',
    patterns: [
      /personalized ads.*(?:interests|activity|information)/i,
      /(?:interests|activity|information).*(?:personalized|customized) ads/i,
      /partners?.*collect information.*(?:advertising|measurement).*(?:cookies|technologies)/i,
    ],
  },
  {
    id: 'privacy_content_analysis',
    name: 'Content or audio analysis',
    patterns: [
      /automated systems.*analy[sz]e your content/i,
      /analy[sz]e and listen to samples of saved user audio/i,
    ],
  },
  {
    id: 'privacy_third_party_sharing',
    name: 'Third-party data sharing',
    patterns: [
      /provide personal information to (?:our )?affiliates and other trusted/i,
      /partners?.*collect information from your browser or device/i,
    ],
  },
  {
    id: 'privacy_government_disclosure',
    name: 'Government or legal disclosure',
    patterns: [
      /(?:share|receive|disclos).*(?:legal process|governmental request|law enforcement)/i,
      /respond to.*(?:law|regulation|legal process|governmental request)/i,
    ],
  },
  {
    id: 'privacy_admin_control',
    name: 'Administrator access and control',
    patterns: [
      /domain administrator.*(?:access|Google Account)/i,
      /(?:administrator|reseller).*(?:change your account password|suspend|terminate|restrict)/i,
      /restrict your ability to delete or edit.*privacy settings/i,
    ],
  },
  {
    id: 'privacy_extended_retention',
    name: 'Extended data retention',
    patterns: [
      /keep (?:this |some )?data until you delete/i,
      /retain (?:the )?(?:data|information).*(?:longer|business|legal|security|fraud|financial)/i,
      /delays? between when you delete.*(?:active|backup|servers|copies)/i,
    ],
  },
  {
    id: 'privacy_international_transfer',
    name: 'International data transfer',
    patterns: [
      /servers around the world.*outside of the country where you live/i,
      /information may be processed.*outside of the country/i,
    ],
  },
  {
    id: 'privacy_business_transfer',
    name: 'Business-transfer disclosure',
    patterns: [
      /merger, acquisition, or sale of assets.*personal information/i,
      /personal information.*(?:merger|acquisition|sale of assets)/i,
    ],
  },
]

/** Conservative, auditable privacy-policy signals that complement UNFAIR-ToS. */
export function detectPrivacyRisks(text: string): CategoryFinding[] {
  return RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(text))).map((rule) => ({
    id: rule.id,
    name: rule.name,
    score: 1,
  }))
}
