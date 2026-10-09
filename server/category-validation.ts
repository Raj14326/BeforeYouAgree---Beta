import type { CategoryFinding } from './bert-model.ts'

const LIMITS_LIABILITY = /\b(?:not|isn’t|isn't) liable\b|\bliable only\b|\b(?:total )?liability.{0,30}limited\b|\blimit(?:s|ed|ing)?\b.{0,20}\bliability\b|\b(?:won’t|won't) be responsible\b/i
const PRESERVES_LIABILITY = /\b(?:do not|don’t|don't|does not|doesn’t|doesn't) limit liability\b/i
const USER_TERMINATION = /\b(?:suspend|terminate|close|delete|disable).{0,70}\b(?:your|user).{0,30}\b(?:account|access|services?)\b|\b(?:account|access).{0,50}\b(?:suspend|terminat|clos|delet|disabl)/i
const GOVERNING_LAW = /\b(?:terms|disputes?).{0,50}\b(?:governed by|govern|laws? (?:will )?apply)\b|\b(?:governed by|govern).{0,50}\b(?:terms|disputes?)\b/i
const COLLECTS_DATA = /\b(?:we|google|administrator)\s+(?:(?:also|may|will|can)\s+)?(?:collects?|receive|gather|store|save|access|retain)\b|\binformation (?:we )?collect.{0,50}\binclude/i
const COLLECTION_META_OR_DEFINITION = /\b(?:questions?|further information).{0,80}\b(?:collect|legal basis)\b|\b(?:sources|purposes|criteria).{0,80}\b(?:collect|store).{0,80}\b(?:described|determine|policy|section)\b|\bif we store.{0,80}\bnon-personal.{0,80}\bconsider.{0,40}\bpersonal information\b/i

/** Remove predictions that mention a category without expressing its required meaning. */
export function validCategories(categories: CategoryFinding[], text: string) {
  const filtered = categories.filter(({ id }) => {
    if (id === 'limitation_of_liability') return LIMITS_LIABILITY.test(text) && !PRESERVES_LIABILITY.test(text)
    if (id === 'unilateral_termination')
      return USER_TERMINATION.test(text) && !/\b(?:employees?|personnel|anyone with (?:this )?access).{0,60}\b(?:disciplined|terminated)\b/i.test(text)
    if (id === 'choice_of_law') return GOVERNING_LAW.test(text) && !/\b(?:organized|incorporated) under the laws\b/i.test(text)
    if (id === 'privacy_broad_collection') {
      return COLLECTS_DATA.test(text) &&
        !COLLECTION_META_OR_DEFINITION.test(text) &&
        !/\b(?:you (?:can|may).{0,40}delete|we use (?:the )?information we collect)\b/i.test(text)
    }
    return true
  })
  return filtered.some(({ id }) => id === 'privacy_admin_control')
    ? filtered.filter(({ id }) => id !== 'privacy_broad_collection')
    : filtered
}

/** High-precision patterns for important clauses the model commonly misses. */
export function supplementalCategories(text: string): CategoryFinding[] {
  const findings: CategoryFinding[] = []
  const add = (id: string, name: string) => findings.push({ id, name, score: 1 })
  if (/\bto (?:access|use).{0,60}\b(?:must accept|agree to).{0,30}\bterms\b/i.test(text))
    add('contract_by_using', 'Contract by using')
  if (/\b(?:add or remove (?:features|functionalities)|increase or decrease.{0,20}limits|stop offering (?:old )?(?:services?|features?))/i.test(text))
    add('unilateral_change', 'Unilateral change')
  if (LIMITS_LIABILITY.test(text) && !PRESERVES_LIABILITY.test(text))
    add('limitation_of_liability', 'Limitation of liability')
  if (/\binformation we collect may include\b[^:]*:\s*(?:[-*•]|\d+[.)])\s+/i.test(text))
    add('privacy_broad_collection', 'Broad data collection')
  if (/\badministrator.{0,80}\b(?:access|disable|suspend|terminate).{0,30}\b(?:account|access)\b/i.test(text))
    add('privacy_admin_control', 'Administrator access and control')
  return findings
}
