/**
 * BERT clause category classifier: inference only.
 *
 * Fine-tuned LEGAL-BERT Small (LexGLUE UNFAIR-ToS, 8 unfairness
 * categories, multi-label). This module never trains; it loads the exported ONNX
 * checkpoint once, lazily, and scores clause text against it.
 *
 * Pipeline: raw document text → {@link segments} splits it into clauses →
 * transformers.js tokenizes and runs each clause through the ONNX model →
 * {@link scoreClauseWithBert} turns the raw logits into per-category scores and
 * compares each against its own tuned threshold from `risk_config.json`.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  AutoModelForSequenceClassification,
  AutoTokenizer,
  env,
  type PreTrainedModel,
  type PreTrainedTokenizer,
} from '@huggingface/transformers'
import { splitClauses, type Clause } from './clauses.ts'
import { detectPrivacyRisks } from './privacy-rules.ts'

/**
 * The ONNX weights are installed locally so inference does not wait for
 * a Hugging Face download. Override the directory with `BERT_MODEL_DIR`.
 */
const MODEL_PATH = resolve(
  process.env.BERT_MODEL_DIR || 'ml/local-models/bya-legalbert-small-unfair-tos',
)
env.allowRemoteModels = false

const RISK_CONFIG_PATH = resolve(
  process.env.BERT_RISK_CONFIG || resolve(MODEL_PATH, 'risk_config.json'),
)

type CategoryLabel = { id: string; name: string }
type RiskConfig = {
  model_id: string
  labels: CategoryLabel[]
  thresholds: Record<string, number>
}

/** One risk category the model flagged for a clause, above its own threshold. */
export type CategoryFinding = {
  id: string
  name: string
  /** Sigmoid score for this category, rounded to 6 decimal places. */
  score: number
}

/** One clause together with the model's category predictions for it. */
export type RiskFinding = {
  text: string
  start: number
  end: number
  occurrenceCount: number
  occurrenceStarts: number[]
  categories: CategoryFinding[]
  predictedLabel: 'not_risky' | 'risky'
}

let cachedConfig: RiskConfig | undefined
function riskConfig() {
  cachedConfig ||= JSON.parse(readFileSync(RISK_CONFIG_PATH, 'utf8')) as RiskConfig
  return cachedConfig
}

let cachedModel: { tokenizer: PreTrainedTokenizer; model: PreTrainedModel } | undefined

/** Load the tokenizer and ONNX model once and reuse them for the process lifetime. */
async function model() {
  if (!cachedModel) {
    const [tokenizer, loaded] = await Promise.all([
      AutoTokenizer.from_pretrained(MODEL_PATH, { local_files_only: true }),
      AutoModelForSequenceClassification.from_pretrained(MODEL_PATH, {
        dtype: 'fp32',
        local_files_only: true,
      }),
    ])
    cachedModel = { tokenizer, model: loaded }
  }
  return cachedModel
}

function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x))
}

/**
 * Score one clause against all 8 categories.
 *
 * @returns Categories whose score reached their own tuned threshold, sorted by
 * descending score. Empty when no category fired (i.e. the clause isn't risky).
 */
export async function scoreClauseWithBert(text: string): Promise<CategoryFinding[]> {
  return (await scoreClausesWithBert([text]))[0]!
}

function categoriesFromLogits(logits: number[], config: RiskConfig) {
  const categories: CategoryFinding[] = []
  config.labels.forEach((label, index) => {
    const score = sigmoid(logits[index])
    if (score >= config.thresholds[label.id]) {
      categories.push({ id: label.id, name: label.name, score: Number(score.toFixed(6)) })
    }
  })
  return categories.sort((a, b) => b.score - a.score)
}

/** Score clauses in configurable batches; small CPU batches often avoid padding waste. */
async function scoreClausesWithBert(texts: string[]) {
  const config = riskConfig()
  const { tokenizer, model: loaded } = await model()
  const results: CategoryFinding[][] = []
  const configuredBatchSize = Number(process.env.BERT_BATCH_SIZE || 1)
  const batchSize = Number.isInteger(configuredBatchSize)
    ? Math.min(32, Math.max(1, configuredBatchSize))
    : 1
  for (let start = 0; start < texts.length; start += batchSize) {
    const batch = texts.slice(start, start + batchSize)
    const inputs = await tokenizer(batch, { truncation: true, padding: true, max_length: 128 })
    const output = await loaded(inputs)
    const values = Array.from(output.logits.data as Float32Array)
    for (let index = 0; index < batch.length; index++) {
      const offset = index * config.labels.length
      results.push(categoriesFromLogits(values.slice(offset, offset + config.labels.length), config))
    }
  }
  return results
}

function normalizedClause(text: string) {
  return text.toLocaleLowerCase('en').replace(/\s+/g, ' ').trim()
}

type ClauseGroup = { clause: Clause; occurrenceStarts: number[] }

/** Merge source repetitions before inference while retaining their exact offsets. */
function uniqueClauses(content: string) {
  const sourceClauses = splitClauses(content).filter(
    ({ text }) => text.length >= 20 && (text.match(/[a-z]/gi)?.length ?? 0) >= 10,
  )
  const groups = new Map<string, ClauseGroup>()
  for (const clause of sourceClauses) {
    const key = normalizedClause(clause.text)
    const existing = groups.get(key)
    if (existing) existing.occurrenceStarts.push(clause.start)
    else groups.set(key, { clause, occurrenceStarts: [clause.start] })
  }
  return { sourceClauseCount: sourceClauses.length, groups: [...groups.values()] }
}

/**
 * Analyse a whole document: split it into clauses and classify each one against
 * all 8 unfairness categories. A clause is `risky` when at least one category
 * fired.
 */
export async function analyzeWithBert(content: string) {
  const config = riskConfig()
  const { sourceClauseCount, groups } = uniqueClauses(content)
  const modelCategories = await scoreClausesWithBert(groups.map(({ clause }) => clause.text))
  const findings = groups.map(({ clause, occurrenceStarts }, index): RiskFinding => {
    const byId = new Map<string, CategoryFinding>()
    for (const category of [...modelCategories[index]!, ...detectPrivacyRisks(clause.text)]) {
      byId.set(category.id, category)
    }
    const categories = [...byId.values()]
    return {
      text: clause.text,
      start: clause.start,
      end: clause.end,
      occurrenceCount: occurrenceStarts.length,
      occurrenceStarts,
      categories,
      predictedLabel: categories.length ? 'risky' : 'not_risky',
    }
  })
  const riskyFindings = findings.filter((finding) => finding.predictedLabel === 'risky')
  return {
    model: config.model_id,
    clauseCount: findings.length,
    sourceClauseCount,
    riskyClauseCount: riskyFindings.length,
    coverage: 'complete' as const,
    findings,
  }
}
