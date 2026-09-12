import { expect, type Page } from '@playwright/test'

export const riskyClause = 'We may terminate your account without notice and without liability.'
export const safeClause = 'You retain ownership of all content that you create and upload.'
export const policyText = `${riskyClause} ${safeClause}`
export const newestVersionUrl = `/api/version/1/10/${'a'.repeat(40)}`
export const olderVersionUrl = `/api/version/1/10/${'b'.repeat(40)}`

export async function mockAcceptanceApi(page: Page, options: { failLatest?: boolean } = {}) {
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    if (path === '/api/services') {
      return route.fulfill({
        json: {
          data: [
            { id: '1', name: 'GitHub' },
            { id: '2', name: 'Google' },
            { id: '3', name: 'Spotify' },
          ],
        },
      })
    }

    if (path === '/api/service/1') {
      return route.fulfill({
        json: {
          name: 'GitHub',
          terms: [
            {
              type: 'Terms of Service',
              sourceUrl: 'https://github.com/terms',
              available: true,
              latestUrl: '/api/version/1/10/latest',
              updatedAt: '2026-08-01T10:00:00Z',
              historyAvailable: true,
              historyUrl: '/api/versions/1/10',
            },
          ],
        },
      })
    }

    if (path === '/api/version/1/10/latest') {
      if (options.failLatest) {
        return route.fulfill({ status: 503, json: { error: 'Terms data cannot be retrieved.' } })
      }
      return route.fulfill({ json: retrieval('latest', 'ToS;DR') })
    }

    if (path === '/api/versions/1/10') {
      return route.fulfill({
        json: {
          data: [
            { id: 'a'.repeat(40), label: '1 Jul 2026, 10:00 am', url: newestVersionUrl },
            { id: 'b'.repeat(40), label: '1 Jan 2025, 11:00 am', url: olderVersionUrl },
          ],
        },
      })
    }

    if (path === newestVersionUrl || path === olderVersionUrl) {
      return route.fulfill({ json: retrieval(path.slice(-40), 'OpenTermsArchive') })
    }

    if (path === '/api/analyze' && request.method() === 'POST') {
      return route.fulfill({
        json: {
          model: 'M006-UNFAIR-ToS',
          threshold: 1,
          clauseCount: 2,
          riskyClauseCount: 1,
          overallRiskScore: 100,
          findings: [
            { text: riskyClause, riskProbability: 1, predictedLabel: 'risky' },
            { text: safeClause, riskProbability: 0, predictedLabel: 'not_risky' },
          ],
        },
      })
    }

    return route.fulfill({ status: 404, json: { error: `Unexpected test request: ${path}` } })
  })
}

export async function openApp(page: Page, options: { failLatest?: boolean } = {}) {
  await mockAcceptanceApi(page, options)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: "Read what you're agreeing to" })).toBeVisible()
}

export async function selectGitHub(page: Page) {
  await page.getByLabel('Service').fill('Git')
  await page.locator('.list-group-item').filter({ hasText: 'GitHub' }).click()
  await expect(page.getByRole('heading', { name: 'GitHub' })).toBeVisible()
}

export async function retrieveTerms(page: Page) {
  await selectGitHub(page)
  await page.getByRole('button', { name: 'Retrieve text' }).click()
  await expect(page.getByLabel('Retrieved document text with risky clauses highlighted')).toContainText(
    riskyClause,
  )
}

export async function analyseTerms(page: Page) {
  await retrieveTerms(page)
  await page.getByRole('button', { name: 'Analyse risks' }).click()
  await expect(page.getByRole('heading', { name: 'Risk analysis' })).toBeVisible()
}

function retrieval(id: string, repository: string) {
  return {
    format: 'plain_text',
    id,
    serviceId: '1',
    termType: 'Terms of Service',
    sourceUrl: 'https://github.com/terms',
    fetchDate: '2026-08-01T10:00:00Z',
    characterCount: policyText.length,
    content: policyText,
    repository,
    repositoryUrl: 'https://example.com/repository',
  }
}
