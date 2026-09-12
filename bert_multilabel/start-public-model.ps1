$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:BERT_MODEL_DIR = Join-Path $PSScriptRoot 'ml/models/bert-multilabel-base-v1'
$env:BERT_DEVICE = 'cpu'
if (-not (Test-Path -LiteralPath (Join-Path $env:BERT_MODEL_DIR 'risk_config.json'))) {
    throw 'The trained checkpoint is missing. Extract the model bundle into this project first.'
}
& (Join-Path $PSScriptRoot '.venv/Scripts/python.exe') -m uvicorn ml_service.app:app --host 127.0.0.1 --port 8000 --workers 1
exit $LASTEXITCODE
