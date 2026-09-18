$ErrorActionPreference = 'Stop'

$toolDir = Split-Path -Parent $PSScriptRoot
$prepareScript = Join-Path $PSScriptRoot 'prepare.mjs'
$distDir = Join-Path $toolDir 'dist'
$releaseDir = Join-Path $toolDir 'release'
$zipPath = Join-Path $releaseDir 'perler-xhs-minitool-1.0.0-20260918.zip'

if (Test-Path -LiteralPath $zipPath) {
  throw "Artifact already exists and will not be overwritten: $zipPath"
}

node $prepareScript

$indexPath = Join-Path $distDir 'index.html'
if (-not (Test-Path -LiteralPath $indexPath)) {
  throw 'index.html must be at the zip root.'
}

New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
Compress-Archive -Path (Join-Path $distDir '*') -DestinationPath $zipPath -CompressionLevel Optimal

$zipInfo = Get-Item -LiteralPath $zipPath
Write-Output ("Artifact: {0}" -f $zipInfo.FullName)
Write-Output ("Size: {0:N0} bytes" -f $zipInfo.Length)
