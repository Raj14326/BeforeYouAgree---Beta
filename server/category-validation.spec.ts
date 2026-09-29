// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { supplementalCategories, validCategories } from './category-validation.ts'

const category = (id: string) => ({ id, name: id, score: 0.9 })

describe('category validation', () => {
  it('removes wrong-subject and protective false positives', () => {
    expect(validCategories([category('limitation_of_liability')], "We're liable for defects.")).toEqual([])
    expect(validCategories([category('unilateral_termination')], 'Employees may be disciplined or terminated.')).toEqual([])
    expect(validCategories([category('unilateral_termination')], 'Anyone with this access may be disciplined or terminated.')).toEqual([])
    expect(validCategories([category('choice_of_law')], 'Organized under the laws of Delaware.')).toEqual([])
    expect(validCategories([category('privacy_broad_collection')], 'You can delete the content you create.')).toEqual([])
    expect(validCategories([category('privacy_broad_collection')], 'Examples of services include: * Gmail, for sending and receiving emails.')).toEqual([])
    expect(validCategories([category('privacy_broad_collection')], 'Some services require a Google Account to send and receive email.')).toEqual([])
    expect(validCategories([category('limitation_of_liability')], "These terms don't limit liability for fraud.")).toEqual([])
  })

  it('retains genuine restrictions and adds high-precision misses', () => {
    expect(validCategories([category('limitation_of_liability')], "Google isn't liable for indirect losses.")).toHaveLength(1)
    expect(supplementalCategories('To use our services, you must accept these terms.').map(({ id }) => id))
      .toContain('contract_by_using')
    expect(supplementalCategories('We sometimes add or remove features and stop offering old services.').map(({ id }) => id))
      .toContain('unilateral_change')
    expect(supplementalCategories('Your activity — The activity information we collect may include: * Terms you search for.').map(({ id }) => id))
      .toContain('privacy_broad_collection')
  })
})
