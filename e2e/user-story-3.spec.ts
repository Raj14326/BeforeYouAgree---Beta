import { expect, test } from '@playwright/test'
import { analyseTerms, openApp, riskyClause } from './acceptance-helpers'

test.describe('User Story 3 - identify and display risky clauses', () => {
  // AC 3.1.1 - ML distinguishes risky and non-risky clauses.
  test('AC 3.1.1 uses ML to distinguish risky clauses', async ({ page }) => {
    await openApp(page)
    await analyseTerms(page)
    await expect(page.getByLabel('View')).toContainText('Risky (1)')
    await page.getByLabel('View').selectOption('not_risky')
    await expect(page.getByText('Not risky · 100% confidence')).toBeVisible()
  })

  // AC 3.2.1 - Concerning clauses receive highlight markup.
  test('AC 3.2.1 highlights concerning clauses', async ({ page }) => {
    await openApp(page)
    await analyseTerms(page)
    await expect(page.locator('pre mark.clause-mark')).toContainText(riskyClause)
  })

  // AC 3.2.2 - Highlighted clauses are visible on the site.
  test('AC 3.2.2 shows highlighted clauses on the site', async ({ page }) => {
    await openApp(page)
    await analyseTerms(page)
    await expect(page.locator('pre mark.clause-mark')).toBeVisible()
  })

  // AC 3.3.1 - Concerning clauses are tagged as risky.
  test('AC 3.3.1 tags concerning clauses as a risk', async ({ page }) => {
    await openApp(page)
    await analyseTerms(page)
    await expect(page.locator('.risk-findings .badge')).toContainText('Risky')
    await expect(page.locator('.risk-findings')).toContainText(riskyClause)
  })
})
