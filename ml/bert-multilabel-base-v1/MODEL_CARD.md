# BYA LEGAL-BERT-Base Eight-Label Classifier

This checkpoint is a fully fine-tuned `nlpaueb/legal-bert-base-uncased` model for
the eight-label LexGLUE UNFAIR-ToS task. It performs English sentence-level,
multi-label classification. It is not a keyword matcher.

Base model revision: `15b570cbf88259610b082a167dacc190124f60f6`  
Dataset revision: `c23fdff1a6bf74e0e1a71cb86f1e781d37da888c`  
Selected checkpoint: epoch 3, by validation macro-F1  
Held-out test macro-F1: 0.7469  
Held-out test micro-F1: 0.7479  
Derived risky/not-risky F1: 0.8071

The eight validation-selected thresholds and complete provenance are in
`risk_config.json`. Do not replace them with a global 0.5 threshold. The full
training curve is in `training_history.json`; held-out metrics and predictions
are in `ml/reports/bert-multilabel-base-v1` in the source package.

Training data: [LexGLUE UNFAIR-ToS](https://huggingface.co/datasets/coastalcph/lex_glue),
dataset card license CC-BY-4.0. Base model:
[LEGAL-BERT-Base](https://huggingface.co/nlpaueb/legal-bert-base-uncased), model
card license CC-BY-SA-4.0. Users must review and comply with the upstream terms.

The scores are uncalibrated classifier scores, not probabilities of legal harm.
The model covers only the eight dataset categories and is not legal advice.
