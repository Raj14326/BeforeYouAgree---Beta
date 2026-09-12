$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:BERT_SERVICE_URL = 'http://127.0.0.1:8000'
& npm.cmd run dev:full
exit $LASTEXITCODE
