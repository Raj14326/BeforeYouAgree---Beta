// "What to do after agreeing to a risky clause": per-category next steps and
// Australian recourse, transcribed from the team's guide in
// docs/What To Do After Agreeing to a Risky Clause.pdf. Keyed by the ids in
// risk-categories.ts: the 8 ToS categories plus the combined "privacy" group
// (one guide covers all 11 privacy sub-categories). Shown by ActionGuide.vue.

/** Plain text, or an inline link. */
export type GuideTextPart = string | { label: string; href: string }

export type ActionGuideEntry = {
  summary: string
  steps: string[]
  recourse: GuideTextPart[][]
}

export const GUIDE_LINKS = {
  acccContracts: 'https://www.accc.gov.au/consumers/buying-products-and-services/contracts',
  acccRights: 'https://www.accc.gov.au/consumers/buying-products-and-services/consumer-rights-and-guarantees',
  consumerAffairsVic: 'https://www.consumer.vic.gov.au/',
  vcat: 'https://www.vcat.vic.gov.au/',
  legalAidVic: 'https://www.legalaid.vic.gov.au/',
  oaicComplaint: 'https://www.oaic.gov.au/privacy/privacy-complaints/lodge-a-privacy-complaint-with-us',
} as const

const acccContracts = { label: 'ACCC: Contracts and unfair contract terms', href: GUIDE_LINKS.acccContracts }
const acccRights = { label: 'ACCC: Consumer rights and guarantees', href: GUIDE_LINKS.acccRights }
const consumerAffairsVic = { label: 'Consumer Affairs Victoria', href: GUIDE_LINKS.consumerAffairsVic }
const vcat = { label: 'VCAT', href: GUIDE_LINKS.vcat }
const legalAidVic = { label: 'Victoria Legal Aid', href: GUIDE_LINKS.legalAidVic }

export const ACTION_GUIDES: Record<string, ActionGuideEntry> = {
  limitation_of_liability: {
    summary:
      'The company caps or excludes what it will pay if its service fails, loses your data or causes you a loss. In practice, you carry most of the risk.',
    steps: [
      'Keep your own backups of anything important stored on the service, using its "download your data" or export option on a regular schedule.',
      'Record every failure as it happens: screenshots, dates, receipts and support ticket numbers.',
      'If you paid for the service, ask in writing for a repair, re-supply or refund. ACL consumer guarantees (due care and skill, fit for purpose) apply regardless of what the clause says.',
    ],
    recourse: [
      [acccRights, ' explains that these rights cannot be taken away by a business.'],
      [
        consumerAffairsVic,
        ' for help resolving a dispute, then ',
        vcat,
        ' for a consumer claim (other states: their fair-trading agency and tribunal).',
      ],
    ],
  },
  unilateral_termination: {
    summary:
      'The company can suspend or close your account at any time, sometimes without notice, reasons or a refund. You may lose access to your data, purchases and history overnight.',
    steps: [
      'Export your data now and on a regular schedule, so a sudden closure does not wipe out photos, files or records.',
      'Keep your recovery email, phone number and two-factor authentication current, so you can verify your identity and appeal quickly.',
      'If a paid account is closed, request a pro-rata refund in writing and keep the company’s reply.',
    ],
    recourse: [
      [
        acccContracts,
        ' lists terms that let one party, but not the other, end the contract as a type of term that may be unfair.',
      ],
      [
        { label: 'Report the term to the ACCC', href: GUIDE_LINKS.acccContracts },
        ' or seek help from ',
        consumerAffairsVic,
        '.',
      ],
    ],
  },
  unilateral_change: {
    summary:
      'The company can rewrite the terms, prices or features whenever it likes, and continuing to use the service counts as accepting the new version. What you agreed to today may not be what binds you next month.',
    steps: [
      'Save a dated copy (PDF or screenshot) of the terms you accepted, so you can show what changed.',
      'Keep your account email current and turn on notifications for policy or pricing updates.',
      'When a change you object to arrives, turn off auto-renewal, export your data and cancel before the new terms take effect.',
    ],
    recourse: [
      [acccContracts, ' names terms that let one party, but not the other, change the contract as potentially unfair.'],
      [consumerAffairsVic, ' if a price rise or feature removal breaches what you were promised.'],
    ],
  },
  content_removal: {
    summary:
      'The platform can delete, hide or restrict your posts, files or uploads at its discretion, often with no warning or explanation. These clauses frequently sit beside a broad licence letting the platform use your content.',
    steps: [
      'Keep original copies of anything you post or upload somewhere you control, such as local storage or a separate backup.',
      'If content is removed, use the platform’s in-app appeal immediately and keep the removal notice, date and outcome.',
      'Review visibility and licensing settings, and set content to private where the platform offers it.',
    ],
    recourse: [
      ['The platform’s own appeal or review process is the first and usually fastest route.'],
      [acccContracts, ' if the removal right is one-sided and you paid for the service.'],
    ],
  },
  contract_by_using: {
    summary:
      'Simply visiting the site or opening the app counts as agreeing to all the terms, even if you never clicked "I agree" or saw them. You can be bound without realising it.',
    steps: [
      'If you do not accept the terms, stop using the service, log out and delete the account rather than continuing "just for now".',
      'Reject non-essential cookies in the banner or browser settings, since continued browsing often doubles as consent to tracking.',
      'If using the service quietly started a subscription or trial, cancel it and request a refund in writing straight away.',
    ],
    recourse: [
      [acccContracts, ' covers hidden or hard-to-find terms in standard form contracts; you can report them there.'],
      [consumerAffairsVic, ' for help with unexpected charges or subscriptions.'],
    ],
  },
  choice_of_law: {
    summary:
      'The contract says a foreign law (often a US state such as California) decides any dispute, not Australian law. That can make your rights harder to understand and enforce.',
    steps: [
      'Note which law the clause names and keep evidence that you live in Australia and paid as an Australian customer (receipts in AUD, billing address).',
      'Assert your Australian Consumer Law rights in writing anyway. ACL consumer guarantees can still apply to contracts governed by another country’s law in some circumstances.',
      'Get free advice before dropping a claim because of this clause.',
    ],
    recourse: [
      [acccRights, '.'],
      [legalAidVic, ' or a local community legal centre for free advice on cross-border disputes.'],
    ],
  },
  jurisdiction: {
    summary:
      'Any dispute must be taken to a specific court, often overseas, which makes a claim expensive or impractical. Choice of law decides which rules apply; jurisdiction decides where you must go to argue.',
    steps: [
      'Use the company’s internal complaints process first, in writing, and keep every reply as evidence.',
      'Try free local dispute help before assuming you must sue overseas; a foreign-court clause may itself be challenged as unfair.',
      'Keep a timeline of the problem, your losses and all contact with the company.',
    ],
    recourse: [
      [consumerAffairsVic, ' for dispute assistance, then ', vcat, ' for consumer claims.'],
      [legalAidVic, ' on whether a local claim is possible despite the clause.'],
    ],
  },
  arbitration: {
    summary:
      'You give up your right to go to court and instead must use a private arbitrator, often chosen or paid for by the company. These clauses usually also ban class actions.',
    steps: [
      'Check for an opt-out window (commonly 30 days after you accept) and send the opt-out notice exactly as the clause specifies, keeping proof it was sent.',
      'Check whether small claims are excluded from arbitration; many clauses let you use a small claims tribunal instead.',
      'Keep records of the issue and your complaint so you are ready for whichever forum applies.',
    ],
    recourse: [
      [acccContracts, ' to report a one-sided dispute clause.'],
      [legalAidVic, ' for advice before agreeing to or starting arbitration.'],
    ],
  },
  privacy: {
    summary:
      'The company can collect broad personal data, track you across sites or devices, and share or sell it to third parties. Once shared, that data is hard to pull back.',
    steps: [
      'Open the app’s privacy settings and turn off ad personalisation, location history, contact syncing and any "share with partners" options.',
      'Reject non-essential cookies, and unsubscribe from marketing using the link in each email.',
      'Ask the company, in writing, for a copy of the personal information it holds, correct anything wrong, and request deletion of data it no longer needs.',
    ],
    recourse: [
      [
        'Complain to the company first. If it does not respond within 30 days, or you are unhappy with the answer, ',
        { label: 'lodge a free privacy complaint with the OAIC', href: GUIDE_LINKS.oaicComplaint },
        '.',
      ],
      [
        'Note that the Privacy Act does not cover most small businesses (annual turnover of $3 million or less), so check which organisation you are dealing with.',
      ],
    ],
  },
}
