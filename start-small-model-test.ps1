$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:BERT_MODEL_DIR = Join-Path $PSScriptRoot 'ml/local-models/bya-legalbert-small-unfair-tos'
npm run dev:full
exit $LASTEXITCODE
