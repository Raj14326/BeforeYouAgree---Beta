import type { CategoryFinding } from './bert-model.ts'

type PrivacyRule = {
  id: string
  name: string
  patterns: RegExp[]
  exclusions?: RegExp[]
}

const DATA = String.raw`(?:personal (?:data|information)|information|data|content|messages?|files?|documents?|photos?|videos?|audio|contacts?|activity|usage|identifiers?|device information|account information)`
const THIRD_PARTY = String.raw`(?:third part(?:y|ies)|partners?|affiliates?|vendors?|service providers?|processors?|advertising networks?|analytics providers?|resellers?|contractors?|other companies|outside (?:companies|organisations|organizations))`
const CONSENT_OR_USER_DIRECTION = /(?:at your direction|when you (?:ask|direct|choose|decide|consent)|with your (?:express )?(?:consent|permission)|you (?:share|make|post|provide|upload)|as you direct|publicly available|available to (?:the )?people you choose)/i
const RETENTION_MINIMISATION = /(?:only|no longer than|for no longer than|shortest).{0,35}(?:as long as|for so long as|period).{0,35}(?:necessary|needed)|delete.{0,30}(?:when|once).{0,20}no longer (?:necessary|needed)/i

const RULES: PrivacyRule[] = [
  {
    id: 'privacy_broad_collection',
    name: 'Broad data collection',
    patterns: [
      new RegExp(String.raw`\b(?:we|the (?:service|company))\s+(?:also\s+|may\s+|automatically\s+)?(?:collect|gather|receive|store|record|access|obtain|process)\b.{0,60}${DATA}`, 'i'),
      /\b(?:information|data) we collect (?:includes?|may include|consists? of)\b/i,
      /\bcollect(?:ed|ion)? automatically\b.{0,100}\b(?:IP address|device|browser|operating system|log|usage|activity|pages?|features?|interactions?|identifiers?)\b/i,
      /\b(?:collect|store|process|scan)\b.{0,100}\b(?:emails?|messages?|voice|audio|photos?|videos?|documents?|files?|contacts?|call logs?|search(?:es| history)?|browsing history|purchase history)\b/i,
      /\b(?:collect|store|receive)\b.{0,100}\b(?:IP addresses?|crash reports?|system activity|referrer URLs?|unique identifiers?)\b/i,
      /\b(?:log|event|telemetry|diagnostic|crash report|system activity|referrer URL|device identifier|advertising identifier)\b.{0,100}\b(?:collect|gather|record|receive|store|information|data)\b/i,
      /\b(?:collect|receive|obtain)\b.{0,100}\b(?:from|through)\b.{0,40}\b(?:partners?|third parties|other sources|social media|public sources)\b/i,
      /\bwe collect (?:it|this|them) automatically\b/i,
    ],
    exclusions: [
      /\b(?:does not|don't|do not|never|no longer)\s+(?:collect|store|record|retain|process)\b/i,
      /\b(?:definition|means|refers to|examples? of).{0,50}(?:personal data|personal information)\b/i,
      /\bwe (?:strive|try|aim) to collect only\b/i,
      /\byou (?:can|may) (?:access|correct|delete|download|export)\b/i,
    ],
  },
  {
    id: 'privacy_location_tracking',
    name: 'Location tracking',
    patterns: [
      /\b(?:we|the (?:service|app)|Google)\s+(?:may\s+|also\s+)?(?:collect|use|receive|store|track|process|access|determine|infer)\b.{0,80}\b(?:precise|approximate|coarse|real-time|background|geographic|physical)?\s*(?:geo)?location\b/i,
      /\b(?:GPS|cell towers?|Wi-?Fi|Bluetooth|beacons?)\b.{0,80}\b(?:location|where you are|movements?)\b/i,
      /\b(?:location|where you are|movements?)\b.{0,80}\b(?:GPS|cell towers?|Wi-?Fi|Bluetooth|beacons?)\b/i,
      /\b(?:derive|infer|estimate|determine)\b.{0,45}\b(?:location|country|city|region)\b.{0,45}\b(?:IP address|device|network)\b/i,
      /\b(?:IP address|device|network)\b.{0,45}\b(?:derive|infer|estimate|determine)\b.{0,45}\b(?:location|country|city|region)\b/i,
    ],
    exclusions: [
      /\b(?:learn|read|find out) more\b.{0,60}\blocation\b/i,
      /\byou (?:can|may|choose to)\b.{0,60}\b(?:enable|disable|control|manage|turn (?:on|off))\b.{0,40}\blocation\b/i,
      /\b(?:office|mailing|billing|postal|street|business) address\b/i,
      /\b(?:does not|don't|do not|never)\s+(?:collect|track|store|use)\b.{0,50}\blocation\b/i,
    ],
  },
  {
    id: 'privacy_cross_service_profiling',
    name: 'Cross-service profiling',
    patterns: [
      /\b(?:combine|link|associate|connect)\b.{0,90}\b(?:information|data|activity)\b.{0,90}\b(?:across|from)\b.{0,30}\b(?:services?|devices?|sites?|apps?|platforms?)\b/i,
      /\b(?:activity|information|data)\b.{0,70}\b(?:on|from)\b.{0,20}\b(?:other|third-party)\s+(?:sites?|apps?|services?|platforms?)\b.{0,90}\b(?:profile|personalize|associate|link|combine|infer)\b/i,
      /\bacross (?:our )?(?:services?|products?|apps?) and (?:across )?(?:your )?devices?\b/i,
      /\b(?:build|create|develop)\b.{0,25}\b(?:a )?(?:profile|inferences?)\b.{0,80}\b(?:interests?|preferences?|behaviou?r|activity)\b/i,
    ],
  },
  {
    id: 'privacy_personalized_ads',
    name: 'Personalized advertising',
    patterns: [
      /\b(?:personalized|personalised|targeted|interest-based|behaviou?ral|relevant)\s+(?:ads?|advertisements?|advertising|sponsored content|marketing)\b/i,
      /\b(?:ads?|advertisements?|advertising|sponsored content|marketing)\b.{0,90}\b(?:based on|using)\b.{0,60}\b(?:activity|interests?|profile|browsing|personal information|data)\b/i,
      /\b(?:use|process|collect|share)\b.{0,80}\b(?:activity|interests?|profile|personal information|data)\b.{0,80}\b(?:serve|show|deliver|measure|personalize|target)\b.{0,30}\b(?:ads?|advertising|marketing|sponsored content)\b/i,
      /\b(?:advertising|marketing)\s+(?:partners?|networks?|providers?)\b.{0,100}\b(?:cookies?|pixels?|beacons?|identifiers?|collect|receive|track)\b/i,
    ],
    exclusions: [
      /\b(?:do not|don't|never)\s+(?:use|share|sell).{0,60}\b(?:personalized|targeted|interest-based)?\s*(?:ads?|advertising)\b/i,
      /\b(?:do not|don't|never)\s+(?:show|serve|display)\b.{0,70}\b(?:personalized|targeted|interest-based)?\s*(?:ads?|advertising)\b/i,
      /\bnot based on\b.{0,60}\b(?:selling|sharing|using)\b.{0,40}\b(?:personal information|personal data)\b/i,
      /\b(?:opt[- ]out|turn off|disable)\b.{0,45}\b(?:ads?|advertising|marketing)\b/i,
    ],
  },
  {
    id: 'privacy_content_analysis',
    name: 'Content or audio analysis',
    patterns: [
      /\b(?:automated systems?|machine learning|artificial intelligence|algorithms?)\b.{0,100}\b(?:analy[sz]e|scan|review|process|moderate)\b.{0,80}\b(?:content|messages?|communications?|images?|photos?|videos?|audio|voice|files?)\b/i,
      /\b(?:analy[sz]e|scan|review|listen to|transcribe|moderate)\b.{0,80}\b(?:your )?(?:content|messages?|communications?|images?|photos?|videos?|audio|voice|files?|uploads?)\b/i,
      /\b(?:content|messages?|communications?|images?|photos?|videos?|audio|voice|files?|uploads?)\b.{0,80}\b(?:analy[sz]ed|scanned|reviewed|transcribed|moderated)\b/i,
    ],
    exclusions: [
      /\b(?:you|users?|administrators?)\s+(?:(?:can|may|will)\s+|will have (?:an )?opportunity to )(?:review|scan|analy[sz]e)\b/i,
      /\bwe (?:do not|don't|never)\s+(?:store|analy[sz]e|scan|listen|review)\b/i,
    ],
  },
  {
    id: 'privacy_third_party_sharing',
    name: 'Third-party data sharing',
    patterns: [
      new RegExp(String.raw`\b(?:we|[A-Z][\w.-]+)\s+(?:may\s+|also\s+)?(?:share|disclose|provide|transfer|sell|make available)\b.{0,100}${DATA}.{0,100}\b(?:with|to)\b.{0,30}${THIRD_PARTY}\b`, 'i'),
      new RegExp(String.raw`\b(?:share|disclose|provide|transfer|sell|make available)\b.{0,100}${DATA}.{0,100}\b(?:with|to)\b.{0,30}${THIRD_PARTY}\b`, 'i'),
      new RegExp(String.raw`\b${THIRD_PARTY}\b.{0,100}\b(?:receive|access|collect|process|use)\b.{0,80}${DATA}`, 'i'),
      /\b(?:collect|receive|obtain)\b.{0,80}\b(?:information|data)\b.{0,60}\bfrom\b.{0,70}\b(?:partners?|third parties|other companies|other sources)\b/i,
      /\b(?:share|disclose|provide)\b.{0,100}\b(?:information|data)\b.{0,100}\b(?:publicly|with)\b.{0,50}\b(?:partners?|third parties)\b/i,
      /\b(?:share|disclose|provide|transfer)\b.{0,100}\b(?:personal data|personal information|your information|your data)\b.{0,100}\b(?:business purposes?|advertising|analytics|payment processing|hosting|support|fraud prevention)\b/i,
    ],
    exclusions: [CONSENT_OR_USER_DIRECTION, /\b(?:do not|don't|never)\s+(?:sell|share|disclose|provide)\b/i],
  },
  {
    id: 'privacy_government_disclosure',
    name: 'Government or legal disclosure',
    patterns: [
      /\b(?:share|disclose|provide|release|hand over|preserve)\b.{0,100}\b(?:information|data|content|records?)\b.{0,100}\b(?:law enforcement|government|public authorit(?:y|ies)|regulators?|courts?|legal process|subpoena|court order|warrant)\b/i,
      /\b(?:law enforcement|government|public authorit(?:y|ies)|regulators?|courts?)\b.{0,100}\b(?:request|require|demand|access|receive|obtain)\b.{0,100}\b(?:information|data|content|records?)\b/i,
      /\b(?:respond|comply)\b.{0,60}\b(?:subpoenas?|court orders?|warrants?|legal process|government(?:al)? requests?|law enforcement requests?)\b/i,
      /\b(?:required|compelled|permitted) by law\b.{0,80}\b(?:share|disclose|provide|retain|preserve|release)\b.{0,60}\b(?:information|data|content|records?)\b/i,
      /\b(?:share|disclose|provide|retain|preserve|release)\b.{0,60}\b(?:information|data|content|records?)\b.{0,80}\b(?:required|compelled|permitted) by law\b/i,
      /\b(?:share|disclose|provide|retain|preserve|release)\b.{0,60}\b(?:information|data|content|records?)\b.{0,80}\blaw requires\b/i,
    ],
    exclusions: [/\bgovernment[- ]issued (?:identification|ID)\b/i],
  },
  {
    id: 'privacy_admin_control',
    name: 'Administrator access and control',
    patterns: [
      /\b(?:administrators?|admins?|organization owners?|team owners?|employers?|schools?)\b.{0,100}\b(?:access|view|disclose|export|retain|modify|delete|remove|restrict|control|suspend|terminate)\b.{0,80}\b(?:account|content|files?|messages?|information|data|access|settings?)\b/i,
      /\b(?:account|content|files?|messages?|information|data|access|settings?)\b.{0,80}\b(?:accessed|viewed|disclosed|exported|retained|modified|deleted|removed|restricted|controlled)\b.{0,80}\b(?:administrator|admin|organization|employer|school)\b/i,
    ],
  },
  {
    id: 'privacy_extended_retention',
    name: 'Extended data retention',
    patterns: [
      /\b(?:retain|keep|store|preserve)\b.{0,100}\b(?:information|data|content|records?|account information)\b.{0,100}\b(?:after|following|even if|even after)\b.{0,60}\b(?:delete|deletion|close|closure|terminate|termination|cancel|cancellation)\b/i,
      /\b(?:after|following|even if|even after)\b.{0,60}\b(?:delete|deletion|close|closure|terminate|termination|cancel|cancellation)\b.{0,100}\b(?:retain|keep|store|preserve|backup|copies)\b/i,
      /\b(?:retain|keep|store|preserve)\b.{0,100}\b(?:information|data|content|records?)\b.{0,100}\b(?:legal|regulatory|audit|tax|fraud|security|dispute|enforcement|financial|business)\b/i,
      /\b(?:information|data|content|records?)\b.{0,50}\b(?:we )?(?:retain|keep|store|preserve)\b.{0,100}\b(?:longer|legal|regulatory|audit|tax|fraud|security|dispute|enforcement|financial|business)\b/i,
      /\b(?:backup|archival)\s+(?:copies|systems?|storage)\b.{0,100}\b(?:remain|retain|keep|store|delete|deletion)\b/i,
      /\b(?:retain|keep|store)\b.{0,100}\b(?:for as long as|while)\b.{0,60}\b(?:account exists|account is active|provide (?:the )?services?|business relationship)\b/i,
      /\b(?:retain|keep|store)\b.{0,100}\b(?:indefinitely|for an unspecified period|as long as permitted)\b/i,
      /\b(?:retain|keep|store)\b.{0,80}\b(?:information|data|content)\b.{0,50}\buntil you (?:delete|remove|close|cancel)\b/i,
    ],
    exclusions: [RETENTION_MINIMISATION],
  },
  {
    id: 'privacy_international_transfer',
    name: 'International data transfer',
    patterns: [
      /\b(?:transfer|transmit|store|process|access|host)\b.{0,100}\b(?:information|data|content)\b.{0,100}\b(?:outside|around|across|in)\b.{0,45}\b(?:your country|country where you (?:live|reside)|world|globally|other countries|United States|EEA|European Economic Area)\b/i,
      /\b(?:information|data|content)\b.{0,100}\b(?:transferred|transmitted|stored|processed|accessed|hosted)\b.{0,100}\b(?:outside|around|across|in)\b.{0,45}\b(?:your country|country where you (?:live|reside)|world|globally|other countries|United States|EEA|European Economic Area)\b/i,
      /\b(?:cross-border|international)\s+(?:data )?transfers?\b/i,
      /\bservers? around the world\b.{0,100}\boutside (?:of )?the country where you (?:live|reside)\b/i,
      /\b(?:countries?|jurisdictions?)\b.{0,80}\b(?:different|lower|without (?:an )?adequate)\b.{0,50}\bdata protection\b/i,
    ],
  },
  {
    id: 'privacy_business_transfer',
    name: 'Business-transfer disclosure',
    patterns: [
      /\b(?:merger|acquisition|sale of (?:assets|the business)|bankruptcy|reorganization|restructuring|change (?:in|of) control)\b.{0,130}\b(?:information|data|records?|assets?|transfer|disclose|share|successor)\b/i,
      /\b(?:information|data|records?)\b.{0,130}\b(?:transferred|disclosed|shared|sold)\b.{0,80}\b(?:merger|acquisition|sale|bankruptcy|reorganization|restructuring|successor|change (?:in|of) control)\b/i,
    ],
  },
]

/** High-precision, auditable privacy-policy signals used alongside the ToS model. */
export function detectPrivacyRisks(text: string): CategoryFinding[] {
  return RULES.filter(
    (rule) =>
      !rule.exclusions?.some((pattern) => pattern.test(text)) &&
      rule.patterns.some((pattern) => pattern.test(text)),
  ).map((rule) => ({ id: rule.id, name: rule.name, score: 1 }))
}
