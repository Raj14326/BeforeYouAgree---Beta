# Training method and reproducibility record

## What was trained

A native eight-label English UNFAIR-ToS classifier, using the complete
LEGAL-BERT-Base encoder (12 layers, hidden size 768, 12 attention heads) and a
new eight-dimensional classification head. Both encoder and head were fine-tuned.
Tokenization is WordPiece input preparation, not a keyword-hit risk rule.
Each sentence can have zero, one or several labels. Eight independent sigmoid
scores are thresholded independently; any positive category flags the sentence.

Official label order: limitation of liability, unilateral termination,
unilateral change, content removal, contract by using, choice of law,
jurisdiction, arbitration.

## Data and provenance

Dataset: [coastalcph/lex_glue, unfair_tos](https://huggingface.co/datasets/coastalcph/lex_glue).
Pinned revision: `c23fdff1a6bf74e0e1a71cb86f1e781d37da888c`.
The data card specifies CC-BY-4.0. Original public annotations were used; no new
team labeling, keyword-generated labels, or LLM pseudo-labels were added.

Base model: [nlpaueb/legal-bert-base-uncased](https://huggingface.co/nlpaueb/legal-bert-base-uncased).
Pinned revision: `15b570cbf88259610b082a167dacc190124f60f6`.
The upstream model card specifies CC-BY-SA-4.0. Preserve upstream attribution
and check applicable license terms when distributing derivative weights.

| Split | Original | Cleaned | Any risk | Multiple labels |
|---|---:|---:|---:|---:|
| Train | 5532 | 5378 | 617 | 62 |
| Validation | 2275 | 2253 | 230 | 18 |
| Test | 1607 | 1600 | 168 | 13 |

Exact normalized duplicates were retained only once with fixed precedence
test > validation > train, retaining official split membership. One normalized
text had conflicting annotations (two train occurrences); both were excluded.
There were no additional conflicts hidden by binary mapping. Original eight
labels remain in the CSV `original_labels` column and are restored by the loader.
Raw and CSV SHA-256 values are in `ml/data/lexglue-binary/dataset_manifest.json`.
The folder's historical name does not mean this model trains binary labels.

Important audit limit: the released parquet lacks document/service IDs.
Official split membership and exact text disjointness were checked, but a new
independent group-ID audit and near-duplicate audit were not available/performed.
The task's EU consumer unfairness categories do not establish Australian or other
jurisdiction-specific legal validity. The model is trained on English only.

## Optimization and model selection

- Seed 5120; three epochs; batch 16; maximum length 128; stride 32.
- AdamW; encoder LR 2e-5, new head LR 1e-4; weight decay 0.01; clip norm 1.0.
- First 10% optimizer steps warm-up, then linear LR decay.
- Each epoch samples 5378 rows: 50% risky rows sampled with replacement and
  50% safe rows sampled without replacement. Validation/test retain real prevalence.
- BCEWithLogitsLoss, class weights derived from sampled label prevalence, capped
  at 20: approximately [5.564, 8.074, 9.370, 16.139, 15.453, 20, 20, 20].
- Overflow token windows are max-pooled independently per label, identically
  during training and inference. Input capacity errors are explicit.
- At each epoch, thresholds are searched independently on validation scores.
  Each class must reach validation recall >= 0.70; maximize F1, then precision.
- Checkpoint selection: validation category macro-F1 first, micro-F1 second.
  Epoch 3 was selected. Test was evaluated once after weights/thresholds froze.

An initial trial with uncapped raw-prevalence weights (28-191x) failed: almost
all validation sentences were flagged and macro-F1 was approximately 0.032-0.033.
It was stopped after two validations and not used in the website. Optimization
was revised using validation only. Failure history is under `review_evidence/`.

| Epoch | Train loss | Validation macro-F1 | Validation micro-F1 |
|---|---:|---:|---:|
| 1 | 0.6040 | 0.7129 | 0.6949 |
| 2 | 0.1271 | 0.7276 | 0.7311 |
| 3 (selected) | 0.0458 | 0.7521 | 0.7615 |

Actual run: Windows, Python 3.14.4, torch 2.14.0+cpu, transformers 4.57.6,
8 CPU threads. Recorded epoch train+validation durations total ~113 minutes;
wall-clock overhead, interruption and trial durations are separate.
Hardware/library changes can change floating-point results even with a fixed seed.

## Frozen test results

1600 sentences: category macro-F1 **0.7469**, micro-F1 **0.7479**, exact match **0.9500**.
For the website's any-positive risk decision: precision **0.8047**, recall
**0.8095**, F1 **0.8071**, accuracy **0.9594**, FPR **0.0230**.
Confusion: TP 136, FP 33, FN 32, TN 1399.

| Category | Threshold | Precision | Recall | F1 | Test positives |
|---|---:|---:|---:|---:|---:|
| Liability limitation | .966847 | .7714 | .7297 | .7500 | 37 |
| Unilateral termination | .939959 | .8235 | .7568 | .7887 | 37 |
| Unilateral change | .923475 | .7500 | .6667 | .7059 | 36 |
| Content removal | .249878 | .5000 | .9167 | .6471 | 12 |
| Contract by using | .996423 | 1.0000 | .5217 | .6857 | 23 |
| Choice of law | .451167 | 1.0000 | .9231 | .9600 | 13 |
| Jurisdiction | .697918 | .9375 | .9375 | .9375 | 16 |
| Arbitration | .594291 | .3529 | .8571 | .5000 | 7 |

Do not interpret high exact-match/accuracy as 95% accuracy on risk categories:
most sentences are negatives. Use class F1, precision/recall and support counts.
Arbitration has seven positives and poor precision; contract-by-using misses
nearly half its positives. No confidence intervals or external deployment test
have been claimed. Sigmoid scores are uncalibrated, not legal-harm probabilities.

## Matched binary-risk comparison

All rows below use the same cleaned test hash and any-label risk target.
Binary macro-F1 and eight-label macro-F1 are different metrics, so are not compared.

| Model | Risk precision | Risk recall | Risk F1 | Accuracy |
|---|---:|---:|---:|---:|
| Character n-gram NB | .7168 | .7381 | .7273 | .9419 |
| LEGAL-BERT-Small binary | .8514 | .7500 | .7975 | .9600 |
| LEGAL-BERT-Base eight-label, any-positive | .8047 | .8095 | .8071 | .9594 |

Compared with the earlier binary BERT, recall rises 5.95 percentage points,
precision falls 4.66 points, risk F1 rises 0.97 points; accuracy is essentially
unchanged. This is a trade-off plus category explanations, not universal improvement.

## Reproduction entry points

Use the team runbook for environment setup, weight loading and retraining.
`train-multilabel.ps1` calls `ml_service.train_multilabel`, then
`ml_service.evaluate_multilabel`. It refuses nonempty output directories.
Training data is included; base-model download is pinned by script. Full final
metadata is in `model_metadata/`, and predictions in `ml/reports/`.
The delivered test set is now observed; further optimization should use a fresh
external held-out test rather than repeatedly selecting based on these test scores.
