import { expect, test } from '@playwright/test'
import { openApp, retrieveTerms, riskyClause, safeClause } from './acceptance-helpers'

test('BERT results expose unflagged clauses that need review', async ({ page }) => {
  await openApp(page)
  await page.route('**/api/analyze', route => route.fulfill({ json: {
    model: 'BERT-test-fixture', clauseCount: 2, riskyClauseCount: 1, reviewClauseCount: 1,
    modelInfo: {
      architecture: 'LEGAL-BERT-Small', baseModel: 'nlpaueb/legal-bert-small-uncased',
      baseModelUrl: 'https://huggingface.co/nlpaueb/legal-bert-small-uncased', modelRevision: 'abc',
      trainingDataset: 'coastalcph/lex_glue / unfair_tos',
      datasetUrl: 'https://huggingface.co/datasets/coastalcph/lex_glue', datasetRevision: 'def',
      datasetLicense: 'CC-BY-4.0', language: 'English', scope: 'eight ToS categories',
      scoreMeaning: 'uncalibrated',
    },
    findings: [
      { clauseId: '0', text: riskyClause, start: 0, end: riskyClause.length, predictedLabel: 'risky', needsReview: false },
      { clauseId: '1', text: safeClause, start: riskyClause.length + 1, end: riskyClause.length + 1 + safeClause.length, predictedLabel: 'not_risky', needsReview: true },
    ],
  } }))
  await retrieveTerms(page)
  await page.getByRole('button', { name: 'Analyse risks' }).click()
  await page.getByLabel('View').selectOption('needs_review')
  await expect(page.locator('.risk-findings')).toContainText(safeClause)
  await expect(page.locator('.risk-findings')).not.toContainText(riskyClause)
  await expect(page.locator('.risk-findings')).toContainText('Needs review')
  await page.getByText('Model and training data').click()
  await expect(page.getByText('coastalcph/lex_glue / unfair_tos')).toBeVisible()
  await expect(page.getByText('CC-BY-4.0')).toBeVisible()
})

test('model failure is shown as failure rather than no-risk result', async ({ page }) => {
  await openApp(page)
  await page.route('**/api/analyze', route => route.fulfill({ status: 503, json: { error: 'BERT model is not ready.' } }))
  await retrieveTerms(page)
  await page.getByRole('button', { name: 'Analyse risks' }).click()
  await expect(page.getByText('BERT model is not ready.', { exact: true })).toBeVisible()
  await expect(page.getByText('No clauses were flagged as risky.', { exact: true })).toHaveCount(0)
})

test('duplicate text highlights the occurrence identified by its offset', async ({ page }) => {
  await openApp(page)
  const content = `${riskyClause}\n\n${riskyClause}`
  await page.route('**/api/version/1/10/latest', route => route.fulfill({ json: {
    content, format: 'plain_text', repository: 'test', repositoryUrl: 'https://example.com',
    characterCount: content.length, sourceUrl: 'https://example.com', fetchDate: '2026-09-11',
  } }))
  const start = riskyClause.length + 2
  await page.route('**/api/analyze', route => route.fulfill({ json: {
    model: 'BERT-test-fixture', clauseCount: 2, riskyClauseCount: 1,
    findings: [{ clauseId: '1', text: riskyClause, start, end: content.length, predictedLabel: 'risky' }],
  } }))
  await retrieveTerms(page)
  await page.getByRole('button', { name: 'Analyse risks' }).click()
  await expect(page.locator('pre mark.clause-mark')).toHaveCount(1)
  const prefix = await page.locator('pre mark.clause-mark').evaluate(el => el.previousSibling?.textContent)
  expect(prefix).toBe(`${riskyClause}\n\n`)
})
