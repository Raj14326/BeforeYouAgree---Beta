import { expect, test } from '@playwright/test'
import { analyseTerms, openApp, policyText, selectGitHub } from './acceptance-helpers'

test.describe('User Story 1 - search and view services', () => {
  // AC 1.1.1 - User can search for a service.
  test('AC 1.1.1 allows the user to search for a service', async ({ page }) => {
    await openApp(page)
    await page.getByLabel('Service').fill('GitHub')
    await page.getByRole('button', { name: 'Review terms' }).click()
    await expect(page.getByRole('heading', { name: 'GitHub' })).toBeVisible()
  })

  // AC 1.1.2 - Search suggests matching services.
  test('AC 1.1.2 suggests and autocompletes service names', async ({ page }) => {
    await openApp(page)
    await page.getByLabel('Service').fill('Git')
    await expect(page.locator('.list-group-item').filter({ hasText: 'GitHub' })).toBeVisible()
  })

  // AC 1.1.3 - Terms are retrieved for the selected service.
  test('AC 1.1.3 retrieves terms for the selected service', async ({ page }) => {
    await openApp(page)
    await selectGitHub(page)
    await page.getByRole('button', { name: 'Retrieve text' }).click()
    await expect(page.getByLabel('Retrieved document text with risky clauses highlighted')).toContainText(
      policyText,
    )
  })

  // AC 1.1.4 - Unknown services show a clear message.
  test('AC 1.1.4 shows a service not found message', async ({ page }) => {
    await openApp(page)
    await page.getByLabel('Service').fill('Unknown Service 123')
    await page.getByRole('button', { name: 'Review terms' }).click()
    await expect(page.getByRole('alert')).toContainText('No matching service')
  })

  // AC 1.4.1 - User can move to a flagged clause.
  test('AC 1.4.1 lets the user move to and view a flagged clause', async ({ page }) => {
    await openApp(page)
    await analyseTerms(page)
    await page.getByRole('button', { name: 'Show in text' }).click()
    await expect(page.locator('pre mark.clause-mark-active')).toBeVisible()
  })

  // AC 1.4.2 - Controls are visible and labelled.
  test('AC 1.4.2 displays clearly visible and labelled controls', async ({ page }) => {
    await openApp(page)
    await selectGitHub(page)
    await expect(page.getByLabel('Service')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Review terms' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retrieve text' })).toBeVisible()
    await expect(page.locator('table button.btn-outline-secondary')).toHaveAccessibleName(/.+/)
  })
})
