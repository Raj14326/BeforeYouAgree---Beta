# Model-only change scope

This package was rebuilt from the original `BeforeYouAgree---Beta-Prototype.zip`.
The catalogue, policy retrieval, history, styling, branding, quick guide, service
data and build configuration remain byte-for-byte identical to the original.

Model replacement changes:

- Replaced the M006 character n-gram Naive Bayes runtime with a separate Python
  LEGAL-BERT-Base inference service.
- Added native eight-label UNFAIR-ToS training, held-out evaluation and
  independent validation thresholds.
- Added sentence-level splitting with exact source offsets.
- Updated only the risk-result portion of `App.vue` to display matched risk
  categories, scores and review-near-threshold status.
- Added pinned public data, provenance, metrics, tests and reproducible scripts.
- Removed `server/m006-model.ts` and
  `ml/M006_best_model_package/M006_model.json`; the API no longer loads them.

Large trained weights are distributed separately as a GitHub Release asset.
