import { splitClauses } from './clauses.ts'

function failure(message: string, statusCode = 503) {
  return Object.assign(new Error(message), { statusCode })
}

export async function analyzeWithBert(content: string) {
  const clauses = splitClauses(content)
  if (!clauses.length) throw failure('No readable clauses were found.', 400)
  if (clauses.length > 1000) throw failure('Too many clauses; analyze a smaller document.', 413)
  const endpoint = process.env.BERT_SERVICE_URL || 'http://127.0.0.1:8000'
  const timeout = Number(process.env.BERT_TIMEOUT_MS || 120000)
  let response: Response
  try {
    response = await fetch(`${endpoint.replace(/\/$/, '')}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.BERT_API_KEY ? { Authorization: `Bearer ${process.env.BERT_API_KEY}` } : {}),
      },
      body: JSON.stringify({ clauses: clauses.map(({ clauseId, text }) => ({ clauseId, text })) }),
      signal: AbortSignal.timeout(Number.isFinite(timeout) && timeout > 0 ? timeout : 120000),
    })
  } catch {
    throw failure('BERT analysis is unavailable or timed out. Please retry. No risk result was produced.')
  }
  if (!response.ok) {
    if (response.status === 413) throw failure('Document exceeds the model capacity; analyze a smaller document.', 413)
    if (response.status === 429) throw failure('The model is busy. Please retry shortly.', 429)
    throw failure('BERT model is not ready or analysis failed. No risk result was produced.')
  }
  let data: any
  try { data = await response.json() } catch { throw failure('Invalid BERT response.', 502) }
  const score = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
  const hasDecisionConfig = score(data?.threshold) ||
    (data?.thresholds && typeof data.thresholds === 'object' && Object.values(data.thresholds).length === 8 && Object.values(data.thresholds).every(score))
  if (!data || typeof data.model !== 'string' || !hasDecisionConfig ||
      !Array.isArray(data.findings) || data.findings.length !== clauses.length) {
    throw failure('Incomplete BERT response.', 502)
  }
  const info = data.modelInfo
  const httpsUrl = (value: unknown) => typeof value === 'string' && value.startsWith('https://')
  if (!info || typeof info.architecture !== 'string' || typeof info.baseModel !== 'string' ||
      !httpsUrl(info.baseModelUrl) || typeof info.modelRevision !== 'string' ||
      typeof info.trainingDataset !== 'string' || !httpsUrl(info.datasetUrl) ||
      typeof info.datasetRevision !== 'string' || typeof info.datasetLicense !== 'string' ||
      typeof info.language !== 'string' || typeof info.scope !== 'string' ||
      typeof info.scoreMeaning !== 'string') {
    throw failure('Missing BERT model provenance.', 502)
  }
  const byId = new Map<string, any>()
  for (const item of data.findings) {
    const categoriesValid = item?.categories === undefined || (Array.isArray(item.categories) && item.categories.length === 8 &&
      item.categories.every((category: any) => category && typeof category.id === 'string' && typeof category.name === 'string' &&
        score(category.score) && score(category.threshold) && typeof category.predicted === 'boolean'))
    const categoryIdsUnique = item?.categories === undefined || new Set(item.categories.map((category: any) => category.id)).size === 8
    const categoryDecisionConsistent = item?.categories === undefined ||
      item.predictedLabel === (item.categories.some((category: any) => category.predicted) ? 'risky' : 'not_risky')
    if (!item || typeof item.clauseId !== 'string' || byId.has(item.clauseId) ||
        !score(item.riskProbability) || typeof item.needsReview !== 'boolean' ||
        !['risky', 'not_risky'].includes(item.predictedLabel) || !categoriesValid || !categoryIdsUnique || !categoryDecisionConsistent ||
        !Number.isInteger(item.windowCount) || item.windowCount < 1) {
      throw failure('Invalid BERT finding.', 502)
    }
    byId.set(item.clauseId, item)
  }
  const findings = clauses.map(clause => {
    const item = byId.get(clause.clauseId)
    if (!item) throw failure('Missing BERT clause.', 502)
    return {
      ...clause,
      riskProbability: item.riskProbability as number,
      predictedLabel: item.predictedLabel as 'risky' | 'not_risky',
      needsReview: item.needsReview as boolean,
      categories: item.categories,
      windowCount: item.windowCount as number,
    }
  })
  const riskyClauseCount = findings.filter(f => f.predictedLabel === 'risky').length
  return {
    model: data.model, modelInfo: info, threshold: data.threshold, thresholds: data.thresholds, clauseCount: clauses.length,
    riskyClauseCount, reviewClauseCount: findings.filter(f => f.needsReview).length,
    flaggedShare: 100 * riskyClauseCount / clauses.length,
    coverage: 'complete', findings,
  }
}
