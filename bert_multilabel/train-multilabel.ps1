$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$python = Join-Path $PSScriptRoot '.venv/Scripts/python.exe'
$data = Join-Path $PSScriptRoot 'ml/data/lexglue-binary'

& $python -m ml_service.train_multilabel `
  --train (Join-Path $data 'train.csv') `
  --validation (Join-Path $data 'validation.csv') `
  --test (Join-Path $data 'test.csv') `
  --base-model (Join-Path $PSScriptRoot 'ml/pretrained/legal-bert-base') `
  --base-model-source 'nlpaueb/legal-bert-base-uncased' `
  --revision '15b570cbf88259610b082a167dacc190124f60f6' `
  --output (Join-Path $PSScriptRoot 'ml/models/bert-multilabel-base-v1') `
  --epochs 3 --batch-size 16 --max-length 128 --stride 32 `
  --learning-rate 2e-5 --head-learning-rate 1e-4 --max-pos-weight 20 `
  --warmup-ratio 0.1 --min-recall 0.70 --review-margin 0.08 `
  --threads 8 --device cpu

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $python -m ml_service.evaluate_multilabel `
  --model (Join-Path $PSScriptRoot 'ml/models/bert-multilabel-base-v1') `
  --test (Join-Path $data 'test.csv') `
  --output (Join-Path $PSScriptRoot 'ml/reports/bert-multilabel-base-v1') `
  --threads 8 --device cpu
exit $LASTEXITCODE
