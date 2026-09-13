$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$python = Join-Path $PSScriptRoot '.venv-gpu/Scripts/python.exe'
# Windows CUDA reproduction of the selected 256-token Macro-F1 candidate.
# The output directory must be empty; change the name for a new experiment.
& $python -u -m ml_service.train_multilabel `
  --train ml/data/lexglue-binary/train.csv --validation ml/data/lexglue-binary/validation.csv --test ml/data/lexglue-binary/test.csv `
  --base-model ml/pretrained/legal-bert-small --base-model-source nlpaueb/legal-bert-small-uncased `
  --revision 0e23f7a9a39f59768ea7e09766d8ee308580fb17 --output "ml/models/bert-multilabel-small-256-macrof1-v1" `
  --epochs 4 --batch-size 16 --max-length 256 --stride 32 --learning-rate 2e-5 --head-learning-rate 1e-4 `
  --max-pos-weight 5 --risk-sampling-ratio 0.25 --threshold-beta 1.0 --selection-metric macro_f1 `
  --warmup-ratio 0.1 --min-recall 0.70 --review-margin 0.08 --seed 5120 --threads 8 --device cuda
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
