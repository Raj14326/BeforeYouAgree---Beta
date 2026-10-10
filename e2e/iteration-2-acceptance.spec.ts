import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const unilateralClause = 'We may change these terms at any time without asking you.'
const arbitrationClause = 'You must resolve every dispute through binding arbitration.'
const unclearClause = 'This clause requires review because its category is unclear.'
const policyText = `${unilateralClause}\n\n${arbitrationClause}\n\n${unclearClause}`

function finding(
  text: string,
  categories: Array<{ id: string; name: string; score: number }>,
  riskLevel: 'low' | 'medium' | 'high',
) {
  const start = policyText.indexOf(text)
  return {
    text,
    start,
    end: start + text.length,
    occurrenceCount: 1,
    occurrenceStarts: [start],
    categories,
    predictedLabel: 'risky' as const,
    riskLevel,
    riskLevelMessage: `${riskLevel} test risk`,
    reviewCategories: [],
  }
}

async function mockIteration2Api(page: Page, counters = { analyze: 0 }) {
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/services') {
      return route.fulfill({ json: { data: [{ id: '1', name: 'GitHub' }, { id: '2', name: 'Google' }] } })
    }
    if (path === '/api/service/1' || path === '/api/service/2') {
      const id = path.endsWith('/2') ? '2' : '1'
      return route.fulfill({
        json: {
          name: id === '1' ? 'GitHub' : 'Google',
          terms: [{
            type: 'Terms of Service', sourceUrl: null, available: true,
            latestUrl: `/api/version/${id}/10/latest`, updatedAt: '2026-09-17T00:00:00Z',
            historyAvailable: false, historyUrl: null,
          }],
        },
      })
    }
    if (/^\/api\/version\/[12]\/10\/latest$/.test(path)) {
      return route.fulfill({
        json: {
          format: 'plain_text', id: 'latest', serviceId: path.split('/')[3],
          termType: 'Terms of Service', sourceUrl: null, fetchDate: '2026-09-17T00:00:00Z',
          characterCount: policyText.length, content: policyText,
          repository: 'ToS;DR', repositoryUrl: 'https://tosdr.org',
        },
      })
    }
    if (path === '/api/analyze' && request.method() === 'POST') {
      counters.analyze += 1
      return route.fulfill({
        json: {
          model: 'BYA-LEGAL-BERT-SMALL-8', clauseCount: 3, riskyClauseCount: 3,
          findings: [
            finding(unilateralClause, [{ id: 'unilateral_change', name: 'Unilateral change', score: 0.6 }], 'medium'),
            finding(arbitrationClause, [{ id: 'arbitration', name: 'Arbitration', score: 0.9 }], 'high'),
            finding(unclearClause, [], 'low'),
          ],
        },
      })
    }
    return route.fulfill({ status: 404, json: { error: `Unexpected test request: ${path}` } })
  })
}

async function openAndAnalyse(page: Page, counters = { analyze: 0 }) {
  await mockIteration2Api(page, counters)
  await page.goto('/')
  await page.getByLabel('Service').fill('Git')
  await page.locator('.list-group-item').filter({ hasText: 'GitHub' }).click()
  await page.locator('.document-card').click()
  await expect(page.getByRole('heading', { name: 'Risk analysis' })).toBeVisible()
  await expect(page.locator('.clause-card')).toHaveCount(3)
  return counters
}

async function closeContext(context: BrowserContext) {
  await context.close()
}

test.describe('Iteration 2 risk preferences and category presentation', () => {
  test('AC 4.1.1 displays labelled risk preference toggles', async ({ page }) => {
    await mockIteration2Api(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Risk preferences' })).toBeVisible()
    await expect(page.getByLabel('Enable risk preferences')).toBeChecked()
    await expect(page.getByLabel('Include Unilateral change in risk preferences')).toBeChecked()
    await expect(page.getByLabel('Include Arbitration in risk preferences')).toBeChecked()
    expect(await page.getByRole('switch').count()).toBeGreaterThanOrEqual(10)
  })

  test('AC 4.1.2 filters clause cards and document highlights by selected category', async ({ page }) => {
    await openAndAnalyse(page)
    await page.getByRole('button', { name: 'Show full document text' }).click()
    const documentMarks = page.locator('#original-document-view mark.clause-mark')
    await expect(documentMarks).toHaveCount(3)

    await page.getByLabel('Include Arbitration in risk preferences').uncheck()
    await expect(page.locator('.clause-card-text')).not.toContainText([arbitrationClause])
    await expect(documentMarks).toHaveCount(2)
    await expect(documentMarks).not.toContainText([arbitrationClause])
  })

  test('AC 4.2.1 reorders findings without reloading or re-analysing', async ({ page }) => {
    const counters = await openAndAnalyse(page)
    await expect(page.locator('.clause-card-text').first()).toHaveText(unilateralClause)

    const arbitration = page.locator('.preference-card').filter({ hasText: 'Arbitration' }).first()
    const unilateral = page.locator('.preference-card').filter({ hasText: 'Unilateral change' }).first()
    await arbitration.locator('.preference-drag-handle').dragTo(unilateral.locator('.preference-drag-handle'))

    await expect(page.locator('.clause-card-text').first()).toHaveText(arbitrationClause)
    expect(counters.analyze).toBe(1)
  })

  test('AC 4.2.2 prioritises selected categories and falls back to severity order', async ({ page }) => {
    await openAndAnalyse(page)
    await expect(page.locator('.clause-card-text').first()).toHaveText(unilateralClause)

    await page.getByLabel('Enable risk preferences').uncheck()
    await expect(page.locator('.clause-card-text').first()).toHaveText(arbitrationClause)
  })

  test('AC 4.3.2 keeps preferences while browsing services in the same session', async ({ page }) => {
    await openAndAnalyse(page)
    await page.getByLabel('Include Arbitration in risk preferences').uncheck()

    await page.getByLabel('Service').fill('Goo')
    await page.locator('.list-group-item').filter({ hasText: 'Google' }).click()
    await expect(page.getByLabel('Service')).toHaveValue('Google')
    await expect(page.locator('.document-card')).toHaveCount(1)
    await expect(page.getByLabel('Include Arbitration in risk preferences')).not.toBeChecked()
  })

  test('AC 4.3.1 resets preferences in a new browser session', async ({ browser }) => {
    const first = await browser.newContext()
    const firstPage = await first.newPage()
    await mockIteration2Api(firstPage)
    await firstPage.goto('/')
    await firstPage.getByLabel('Include Arbitration in risk preferences').uncheck()
    await expect(firstPage.getByLabel('Include Arbitration in risk preferences')).not.toBeChecked()
    await closeContext(first)

    const second = await browser.newContext()
    const secondPage = await second.newPage()
    await mockIteration2Api(secondPage)
    await secondPage.goto('/')
    await expect(secondPage.getByLabel('Include Arbitration in risk preferences')).toBeChecked()
    await closeContext(second)
  })

  test('AC 5.1.1 and AC 5.1.2 show model categories and a fallback category', async ({ page }) => {
    await openAndAnalyse(page)
    await expect(page.locator('.clause-card').filter({ hasText: unilateralClause })).toContainText('Unilateral change')
    await expect(page.locator('.clause-card').filter({ hasText: arbitrationClause })).toContainText('Arbitration')
    await expect(page.locator('.clause-card').filter({ hasText: unclearClause })).toContainText('General risk')
  })

  test('AC 5.2.1 and AC 5.2.2 assign clear and visually different severity levels', async ({ page }) => {
    await openAndAnalyse(page)
    const cards = page.locator('.clause-card')
    await expect(cards.filter({ hasText: unilateralClause })).toContainText('Medium personalised risk')
    await expect(cards.filter({ hasText: arbitrationClause })).toContainText('High personalised risk')
    await expect(cards.filter({ hasText: unclearClause })).toContainText('Low personalised risk')

    const stripColors = await cards.evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node, '::before').backgroundColor),
    )
    expect(new Set(stripColors).size).toBe(3)
  })
})
