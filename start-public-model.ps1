$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:BERT_MODEL_DIR = Join-Path $PSScriptRoot 'ml/local-models/bya-legalbert-small-unfair-tos'
$env:BERT_ONNX_PATH = Join-Path $env:BERT_MODEL_DIR 'onnx/model.onnx'
$env:BERT_INFERENCE_BACKEND = 'onnx'
$env:BERT_DEVICE = 'cpu'
if (-not (Test-Path -LiteralPath (Join-Path $env:BERT_MODEL_DIR 'risk_config.json'))) {
    throw 'The trained checkpoint is missing. Extract the model bundle into this project first.'
}
$python = Join-Path $PSScriptRoot 'ml/.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $python)) {
    $python = Join-Path $PSScriptRoot '.venv/Scripts/python.exe'
}
& $python -m uvicorn ml_service.app:app --host 127.0.0.1 --port 8000 --workers 1
exit $LASTEXITCODE
