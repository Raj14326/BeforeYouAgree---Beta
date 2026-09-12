/**
 * BERT clause category classifier: inference only.
 *
 * Fine-tuned `nlpaueb/legal-bert-base-uncased` (LexGLUE UNFAIR-ToS, 8 unfairness
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

/**
 * The ~438MB ONNX weights live on the Hugging Face Hub, not in this repo (well
 * past GitHub's 100MB file limit). transformers.js downloads them from there on
 * first use and caches them under `ml/.cache/` for every run after.
 */
const MODEL_REPO = 'SH4LAN/bya-legalbert-multilabel-v1-onnx'
env.cacheDir = resolve('ml/.cache')

const RISK_CONFIG_PATH = resolve('ml/bert-multilabel-base-v1/risk_config.json')

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
      AutoTokenizer.from_pretrained(MODEL_REPO),
      AutoModelForSequenceClassification.from_pretrained(MODEL_REPO, { dtype: 'fp32' }),
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
  const config = riskConfig()
  const { tokenizer, model: loaded } = await model()
  const inputs = await tokenizer(text, { truncation: true, max_length: 128 })
  const output = await loaded(inputs)
  const logits = Array.from(output.logits.data as Float32Array)

  const categories: CategoryFinding[] = []
  config.labels.forEach((label, index) => {
    const score = sigmoid(logits[index])
    if (score >= config.thresholds[label.id]) {
      categories.push({ id: label.id, name: label.name, score: Number(score.toFixed(6)) })
    }
  })
  return categories.sort((a, b) => b.score - a.score)
}

/**
 * Split a document into candidate clauses. Identical to the M006 segmenter:
 * breaks on blank lines and on sentence-ending punctuation, then keeps only
 * fragments that look like real prose.
 */
function segments(content: string) {
  return content
    .split(/(?:\r?\n){2,}|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((text) => text.trim())
    .filter((text) => text.length >= 20 && (text.match(/[a-z]/gi)?.length ?? 0) >= 10)
}

/**
 * Analyse a whole document: split it into clauses and classify each one against
 * all 8 unfairness categories. A clause is `risky` when at least one category
 * fired.
 */
export async function analyzeWithBert(content: string) {
  const config = riskConfig()
  const clauses = segments(content)
  const findings: RiskFinding[] = []
  for (const text of clauses) {
    const categories = await scoreClauseWithBert(text)
    findings.push({ text, categories, predictedLabel: categories.length ? 'risky' : 'not_risky' })
  }
  const riskyFindings = findings.filter((finding) => finding.predictedLabel === 'risky')
  return {
    model: config.model_id,
    clauseCount: clauses.length,
    riskyClauseCount: riskyFindings.length,
    findings,
  }
}
