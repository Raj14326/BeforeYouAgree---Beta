/**
 * M006 clause risk classifier: inference only.
 *
 * "M006" is a Multinomial Naive Bayes text classifier trained offline. 
 * It labels a single contract clause as `risky` or
 * `not_risky` from character n-gram wording patterns alone.
 *
 * The trained parameters live in `ml/M006_best_model_package/M006_model.json`
 * and are loaded once, lazily, on first use. This module never trains or writes
 * the model; it only scores text with it.
 *
 * Pipeline: raw document text → {@link segments} splits it into clauses →
 * {@link charNgrams} turns each clause into features → {@link probability}
 * returns P(risky) → compared against the model threshold to get a label.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type Label = 'not_risky' | 'risky'

/**
 * Fields of `M006_model.json` that inference reads. The file also carries
 * descriptive metadata (`algorithm`, `feature_mode`, `labels`, `training` with
 * its validation/test metrics) that this code does not need.
 * All counts are raw training frequencies; the probabilities in
 * {@link probability} are derived from them at inference time.
 */
type Model = {
  /** Identifier echoed back in the API response (currently "M006-UNFAIR-ToS"). */
  model_id: string
  /** Laplace/Lidstone smoothing constant added to every count (trained value: 1). */
  alpha: number
  /**
   * P(risky) at or above this value is labelled `risky`. Tuned to 1.0, so in
   * practice a clause is flagged only when the not-risky score underflows to 0.
   */
  threshold: number
  /** Number of distinct n-gram features seen in training (the vocabulary size). */
  vocab_size: number
  /** Number of training documents per class. */
  class_counts: Record<Label, number>
  /** Sum of all n-gram occurrences across training documents, per class. */
  total_tokens: Record<Label, number>
  /** Per-class occurrence count for each n-gram feature. */
  token_counts: Record<Label, Record<string, number>>
}

/** One clause together with the model's prediction for it. */
export type RiskFinding = {
  text: string
  /** P(risky) for this clause, rounded to 6 decimal places. */
  riskProbability: number
  predictedLabel: Label
}

/**
 * Location of the trained model JSON. Override with `LEO_MODEL_PATH` (useful in
 * tests or when the working directory is not the repo root).
 */
const MODEL_PATH = resolve(
  process.env.LEO_MODEL_PATH || 'ml/M006_best_model_package/M006_model.json',
)

let cachedModel: Model | undefined

/** Load the model JSON once and reuse it for the lifetime of the process. */
function model() {
  cachedModel ||= JSON.parse(readFileSync(MODEL_PATH, 'utf8')) as Model
  return cachedModel
}

/**
 * Feature extractor: lowercase the text, collapse whitespace, then emit every
 * overlapping character 3-, 4- and 5-gram. Character n-grams (rather than words)
 * make the model robust to punctuation, casing and minor wording changes.
 *
 * "we may" → "we ", "e m", " ma", "may", "we m", "e ma", " may", "we ma", "e may"
 *
 * @returns The n-gram list, with repeats kept (multinomial: frequency matters).
 */
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

/**
 * Multinomial Naive Bayes probability that `text` is a risky clause.
 *
 * Worked in log space to avoid floating-point underflow, then converted back:
 *
 *   log P(class) = log prior(class) + Σ log P(ngram | class)
 *
 * with Lidstone smoothing so unseen n-grams never zero out a class:
 *
 *   prior(class)      = (class_docs + α) / (total_docs + 2α)
 *   P(ngram | class)  = (ngram_count_in_class + α) / (total_ngrams_in_class + α · vocab_size)
 *
 * The two class log-scores are shifted by their max before `exp` (a numerically
 * stable softmax) and normalised to give P(risky) ∈ [0, 1].
 */
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

/**
 * Score one clause in isolation. The service name and document type, when
 * provided, are prepended to the clause as extra context (the model was trained
 * the same way), then the whole string is classified.
 *
 * @returns P(risky) rounded to 6 decimal places.
 */
export function scoreClauseWithM006(text: string, serviceName = '', documentType = '') {
  const input = [serviceName, documentType, text].filter(Boolean).join(' ')
  return Number(probability(input).toFixed(6))
}

/**
 * Split a document into candidate clauses.
 *
 * Breaks on blank lines and on sentence-ending punctuation that is followed by
 * whitespace and a capital letter or digit, then keeps only fragments that look
 * like real prose: at least 20 characters and at least 10 letters. This drops
 * headings, list bullets, page furniture and stray tokens.
 */
function segments(content: string) {
  return content
    .split(/(?:\r?\n){2,}|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((text) => text.trim())
    .filter((text) => text.length >= 20 && (text.match(/[a-z]/gi)?.length ?? 0) >= 10)
}

/**
 * Analyse a whole document: split it into clauses, classify each one, and
 * summarise.
 *
 * `overallRiskScore` is the mean P(risky) *of the risky clauses only*, as a
 * percentage (0 when nothing was flagged): a rough "how confident are the
 * flags" number, not a share of the document. Findings are returned sorted by
 * descending risk probability; the clause order within the document is not
 * preserved here (the frontend re-anchors highlights by text match).
 *
 * @param content      Plain-text document (see `html-to-plain-text.ts`).
 * @param serviceName  Optional context prepended to every clause before scoring.
 * @param documentType Optional context prepended to every clause before scoring.
 */
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
