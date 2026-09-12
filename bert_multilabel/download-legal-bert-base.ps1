$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$python = Join-Path $PSScriptRoot '.venv/Scripts/python.exe'
$destination = Join-Path $PSScriptRoot 'ml/pretrained/legal-bert-base'
$code = @'
from huggingface_hub import snapshot_download
snapshot_download(
    "nlpaueb/legal-bert-base-uncased",
    revision="15b570cbf88259610b082a167dacc190124f60f6",
    local_dir="ml/pretrained/legal-bert-base",
    allow_patterns=["*.json", "*.txt", "*.model", "*.safetensors", "pytorch_model.bin", "README.md"],
)
'@
if (-not (Test-Path -LiteralPath (Join-Path $destination 'config.json'))) {
    & $python -c $code
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
Write-Output "Pinned LEGAL-BERT-Base is ready at $destination"
