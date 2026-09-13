# Before You Agree — LEGAL-BERT Small 256

This directory contains the eight-label LEGAL-BERT model update for the Before
You Agree project. It identifies potentially unfair clauses in English Terms of
Service and integrates with the existing web frontend and Node API.

## Current model

| Item | Value |
|---|---|
| Model | LEGAL-BERT Small |
| Task | Eight-label multi-label classification |
| Input length | 256 tokens |
| Training epochs | 4 (epoch 4 selected on validation) |
| Model-selection metric | Validation Macro-F1 |
| Historical test Macro-F1 | 72.64% |
| Historical binary-risk accuracy | 95.81% |

The model recognises the following categories: limitation of liability,
unilateral termination, unilateral change, content removal, contract by using,
choice of law, jurisdiction, and arbitration.

See [CURRENT_MODEL.zh-CN.md](CURRENT_MODEL.zh-CN.md) and
[CURRENT_MODEL_CONFIG.json](CURRENT_MODEL_CONFIG.json) for the exact training
configuration, thresholds, checksums, and per-category metrics.

> Model scores are uncalibrated classification scores, not legal-risk
> probabilities, and do not constitute legal advice. The historical test set
> had previously been observed; independent evaluation on newly labelled data
> is still required.

## Directory structure

```text
src/              Vue frontend
server/           Node API and BERT-service integration
ml_service/       Python training, inference, evaluation, and threshold tools
ml/               Evaluation reports and threshold comparisons
model_metadata/   Current model configuration, tokenizer, and training history
docs/             Setup, training, and review documentation
e2e/              End-to-end web tests
```

## Run locally

Install the required Python and Node dependencies first. On Windows, start the
CPU inference service with:

```powershell
.\start-current-small.ps1
```

To use a CUDA GPU:

```powershell
.\start-current-small.ps1 -Device cuda
```

Start the existing web service in a separate terminal:

```powershell
.\start-web.ps1
```

Do not use `start-public-model.ps1`, which points to the older Base model.

## Retraining

Run the following in a Windows CUDA environment:

```powershell
powershell -ExecutionPolicy Bypass -File .\train-small-256-macrof1.ps1
```

The script uses `max_length=256`, `epochs=4`, a BERT learning rate of `2e-5`,
a classification-head learning rate of `1e-4`, and selects the best checkpoint
by validation Macro-F1. Choose a new output directory for each experiment.
