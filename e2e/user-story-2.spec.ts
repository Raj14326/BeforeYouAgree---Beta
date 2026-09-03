import { expect, test } from '@playwright/test'
import {
  newestVersionUrl,
  olderVersionUrl,
  openApp,
  policyText,
  retrieveTerms,
  selectGitHub,
} from './acceptance-helpers'

test.describe('User Story 2 - retrieve and prepare policies', () => {
  // AC 2.1.1 - Terms are retrieved successfully.
  test('AC 2.1.1 retrieves terms and conditions successfully', async ({ page }) => {
    await openApp(page)
    await retrieveTerms(page)
    await expect(page.getByLabel('Retrieved document text with risky clauses highlighted')).toContainText(
      policyText,
    )
  })

  // AC 2.1.2 - Latest terms come from the ToS;DR endpoint.
  test('AC 2.1.2 retrieves the latest terms from ToS;DR', async ({ page }) => {
    await openApp(page)
    const latestRequest = page.waitForRequest((request) =>
      request.url().includes('/api/version/1/10/latest'),
    )
    await retrieveTerms(page)
    await latestRequest
    await expect(page.getByText('ToS;DR', { exact: true }).last()).toBeVisible()
  })

  // AC 2.2.1 - Latest OpenTermsArchive version can be retrieved.
  test('AC 2.2.1 retrieves the latest archived terms from OpenTermsArchive', async ({ page }) => {
    await openApp(page)
    await selectGitHub(page)
    await page.locator('table button.btn-outline-secondary').click()
    const archiveRequest = page.waitForRequest((request) => request.url().includes(newestVersionUrl))
    await page.getByRole('button', { name: 'Retrieve', exact: true }).click()
    await archiveRequest
    await expect(page.getByText('OpenTermsArchive', { exact: true })).toBeVisible()
  })

  // AC 2.2.2 - User can choose a historical version.
  test('AC 2.2.2 selects terms from a historical dataset', async ({ page }) => {
    await openApp(page)
    await selectGitHub(page)
    await page.locator('table button.btn-outline-secondary').click()
    await page.locator('select.form-select').selectOption(olderVersionUrl)
    const archiveRequest = page.waitForRequest((request) => request.url().includes(olderVersionUrl))
    await page.getByRole('button', { name: 'Retrieve', exact: true }).click()
    await archiveRequest
    await expect(page.getByText('OpenTermsArchive', { exact: true })).toBeVisible()
  })

  // AC 2.3.1 - Retrieval failure is explained to the user.
  test('AC 2.3.1 informs the user when terms cannot be retrieved', async ({ page }) => {
    await openApp(page, { failLatest: true })
    await selectGitHub(page)
    await page.getByRole('button', { name: 'Retrieve text' }).click()
    await expect(page.getByRole('alert')).toContainText('Terms data cannot be retrieved')
  })

  // AC 2.4.1 - Retrieved policy is broken into clauses for analysis.
  test('AC 2.4.1 refines a policy into clauses for analysis', async ({ page }) => {
    await openApp(page)
    await retrieveTerms(page)
    await page.getByRole('button', { name: 'Analyse risks' }).click()
    await expect(page.getByText('50% of 2 clauses flagged')).toBeVisible()
  })

  // AC 2.4.2 - Original policy order is preserved.
  test('AC 2.4.2 preserves the original policy order while refining', async ({ page }) => {
    await openApp(page)
    await retrieveTerms(page)
    const text = await page.getByLabel('Retrieved document text with risky clauses highlighted').textContent()
    expect(text?.indexOf('terminate your account')).toBeLessThan(text?.indexOf('retain ownership') ?? -1)
  })
})
