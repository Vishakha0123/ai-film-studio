# Builds cineai-api.zip — the file you upload to Elastic Beanstalk.
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File deploy\aws\make-backend-zip.ps1
# Uses Windows' built-in tar so the zip has the folder layout Linux expects (Compress-Archive can get it wrong).
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$out = Join-Path $root 'cineai-api.zip'
if (Test-Path $out) { Remove-Item $out }
Push-Location (Join-Path $root 'backend')
try {
  tar -a -c -f $out --exclude=__pycache__ --exclude=*.pyc `
    Dockerfile .dockerignore requirements.txt alembic.ini alembic app portraits .platform .ebextensions
  if ($LASTEXITCODE -ne 0) { throw "tar failed" }
} finally { Pop-Location }
Write-Host "Created $out ($([math]::Round((Get-Item $out).Length / 1MB, 1)) MB)"
