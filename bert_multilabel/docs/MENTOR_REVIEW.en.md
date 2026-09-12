# Mentor review guide

This delivery is for the **Leo** branch of
[Raj14326/BeforeYouAgree---Beta](https://github.com/Raj14326/BeforeYouAgree---Beta/tree/Leo).
The inspected baseline commit is `5e893d673803a2402a12a3b3db2702f02ab3105c`.
It adds a separate `bert_multilabel/` directory; existing Leo NB artifacts are
preserved. It has not been pushed, merged, or published by this preparation step.

## Suggested review order

1. Read `TRAINING_METHOD.en.md` for provenance, selection, metrics and limitations.
2. Inspect `../model_metadata/risk_config.json`: eight labels, per-class thresholds,
   input pooling, selected epoch and complete split hashes.
3. Check `../model_metadata/training_history.json` and `../review_evidence/`
   for all three final epochs and the unsuccessful first optimization trial.
4. Inspect `../ml/reports/bert-multilabel-base-v1/metrics.json` and `predictions.csv`.
5. Review implementation: `train_multilabel.py`, `multilabel_data.py`, `model.py`,
   `evaluate_multilabel.py`, Node adapter and sentence splitter.
6. For website change scope, inspect `../MODEL_ONLY_AUDIT.json` and
   `../MODEL_ONLY_CHANGES.md`. The integration example was rebuilt from the original
   website ZIP: 30/36 original files unchanged; four model-related files changed,
   two obsolete model files removed. This is separate from adding the folder to Leo.

## Questions worth reviewing

- Does eight-category UNFAIR-ToS screening match the product's intended risk scope?
- Is the higher recall/lower precision trade-off appropriate for consumer screening?
- Are arbitration false positives and contract-by-using false negatives acceptable?
- Is an external cross-service test required before deploying to main?
- Should review-near-threshold status use calibrated scores or a different policy?
- Are upstream licensing and attribution appropriate for released derivative weights?

## Verified behavior and boundaries

Build, six Node unit tests, 13 Python tests and three browser acceptance tests
passed on the clean source package. Real Node -> Python -> trained BERT inference
covered exact offsets, platform termination, user account closure and arbitration.
These plumbing checks are separate from the held-out accuracy measurement.

The UI uses full sentence embeddings and independent category decisions. It
does not declare every unflagged clause legally safe, does not use keyword-hit
rules, and does not fall back silently to NB when BERT fails. Sentence-only
inference can miss exceptions/cross-references in adjacent sentences; no
document-level semantic consistency or legal correctness guarantee is claimed.

## Handoff decision

The work is ready for branch review and reproducible demonstration. Integration
into the team's main deployment should be a separately reviewed PR, because Leo
currently contains baseline-only source and is diverged from main. A Release asset
can target the Leo commit without merging into main. No messages have been sent
to mentor or teammates; the user can share the GitHub review URLs after upload.
