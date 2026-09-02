import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type Label = 'not_risky' | 'risky'
type Model = {
  model_id: string
  alpha: number
  threshold: number
  vocab_size: number
  class_counts: Record<Label, number>
  total_tokens: Record<Label, number>
  token_counts: Record<Label, Record<string, number>>
}

export type RiskFinding = {
  text: string
  riskProbability: number
  predictedLabel: Label
}

const MODEL_PATH = resolve(
  process.env.LEO_MODEL_PATH || 'ml/M006_best_model_package/M006_model.json',
)

let cachedModel: Model | undefined

function model() {
  cachedModel ||= JSON.parse(readFileSync(MODEL_PATH, 'utf8')) as Model
  return cachedModel
}

function charNgrams(text: string) {
  const cleaned = text.toLowerCase().replace(/\s+/g, ' ')
  const tokens: string[] = []
  for (let size = 3; size <= 5; size += 1) {
    for (let index = 0; index <= cleaned.length - size; index += 1) {
      tokens.push(cleaned.slice(index, index + size))
    }
  }
  return tokens
}

function probability(text: string) {
  const current = model()
  const tokens = charNgrams(text)
  const totalDocuments = current.class_counts.risky + current.class_counts.not_risky
  const scores = {} as Record<Label, number>

  for (const label of ['not_risky', 'risky'] as const) {
    const prior =
      (current.class_counts[label] + current.alpha) / (totalDocuments + current.alpha * 2)
    const denominator = current.total_tokens[label] + current.alpha * current.vocab_size
    scores[label] = Math.log(prior)
    for (const token of tokens) {
      const count = current.token_counts[label][token] || 0
      scores[label] += Math.log((count + current.alpha) / denominator)
    }
  }

  const maximum = Math.max(scores.risky, scores.not_risky)
  const risky = Math.exp(scores.risky - maximum)
  const safe = Math.exp(scores.not_risky - maximum)
  return risky / (risky + safe)
}

export function scoreClauseWithM006(text: string, serviceName = '', documentType = '') {
  const input = [serviceName, documentType, text].filter(Boolean).join(' ')
  return Number(probability(input).toFixed(6))
}

function segments(content: string) {
  return content
    .split(/(?:\r?\n){2,}|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((text) => text.trim())
    .filter((text) => text.length >= 20 && (text.match(/[a-z]/gi)?.length ?? 0) >= 10)
}

export function analyzeWithM006(content: string, serviceName = '', documentType = '') {
  const current = model()
  const clauses = segments(content)
  const findings = clauses.map((text): RiskFinding => {
    const input = [serviceName, documentType, text].filter(Boolean).join(' ')
    const riskProbability = probability(input)
    return {
      text,
      riskProbability: Number(riskProbability.toFixed(6)),
      predictedLabel: riskProbability >= current.threshold ? 'risky' : 'not_risky',
    }
  })
  const riskyFindings = findings.filter((finding) => finding.predictedLabel === 'risky')
  const probabilityTotal = riskyFindings.reduce(
    (total, finding) => total + finding.riskProbability,
    0,
  )
  const overallRiskScore = riskyFindings.length
    ? Number(((probabilityTotal / riskyFindings.length) * 100).toFixed(2))
    : 0
  return {
    model: current.model_id,
    threshold: current.threshold,
    clauseCount: clauses.length,
    riskyClauseCount: riskyFindings.length,
    overallRiskScore,
    findings: findings.sort((a, b) => b.riskProbability - a.riskProbability),
  }
}
