param([ValidateSet('cpu','cuda')][string]$Device='cpu')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:BERT_MODEL_DIR = Join-Path $PSScriptRoot 'ml/models/bert-multilabel-small-256-macrof1-v1'
$env:BERT_DEVICE = $Device
$env:BERT_CPU_THREADS = '8'
$python = Join-Path $PSScriptRoot '.venv-gpu/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $python)) { $python = Join-Path $PSScriptRoot '.venv/Scripts/python.exe' }
if (-not (Test-Path -LiteralPath (Join-Path $env:BERT_MODEL_DIR 'model.safetensors'))) { throw 'Extract the current Small-256 weights into ml/models first.' }
& $python -m uvicorn ml_service.app:app --host 127.0.0.1 --port 8000 --workers 1
exit $LASTEXITCODE
