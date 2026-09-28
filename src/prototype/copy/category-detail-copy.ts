// "Detailed" companion to each CategoryDef.description in
// lib/risk-categories.ts, for the prototype's Simple/Detailed toggle. Only
// covers the ids aggregateScorecardRows() can actually produce (the 8 TOS
// categories + the combined "privacy" group row) — ids without an entry here
// fall back to the existing plain-language description.
const DETAILED_CATEGORY_COPY: Record<string, string> = {
  limitation_of_liability:
    'The company disclaims responsibility for most damages, direct or indirect, that result from using the service — even if caused by its own negligence.',
  unilateral_termination:
    'The company can suspend or close your account at its sole discretion, often without prior notice or a stated reason, and typically without a right of appeal.',
  unilateral_change:
    'The company can amend the agreement at any time; continuing to use the service after a change is treated as your acceptance of the new terms.',
  content_removal:
    'The company can remove content you post, or your whole account, without warning — and is typically not liable for anything lost as a result.',
  contract_by_using:
    "Simply using the service, rather than an explicit signature or click, is treated as you agreeing to the full terms.",
  choice_of_law:
    'Any dispute is governed by a jurisdiction the company chose, which may be less favourable to you than your own local laws.',
  jurisdiction:
    'You may be required to bring or defend a legal claim in a specific court location, which can be costly or impractical if it is far from where you live.',
  arbitration:
    'You give up the right to sue in court or join a class action — disputes instead go to individual, binding arbitration, which typically favours the company.',
  privacy: 'One or more of: broad data collection, location tracking, cross-app profiling, ad targeting, content scanning, third-party sharing, government disclosure, admin access, extended retention, international transfer, or data moving with a business sale.',
}

export function detailedCategoryDescription(id: string, fallback: string): string {
  return DETAILED_CATEGORY_COPY[id] ?? fallback
}
