param(
  [string]$Output = "yor-token-usage-chrome.zip"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir
$extensionDirs = @("background", "content", "dashboard", "popup", "settings")

foreach ($dir in $extensionDirs) {
  Get-ChildItem -LiteralPath (Join-Path $root $dir) -Recurse -Filter "*.js" -File | ForEach-Object {
    node --check $_.FullName
    if ($LASTEXITCODE -ne 0) {
      throw "JavaScript syntax check failed: $($_.FullName)"
    }
  }
}

$manifest = Get-Content -Raw (Join-Path $root "manifest.json") | ConvertFrom-Json
if ($manifest.manifest_version -ne 3) {
  throw "Expected a Manifest V3 extension"
}

foreach ($check in @("verify-quota-evidence.mjs", "verify-overlay-window.mjs", "verify-reset-predictor.mjs")) {
  node (Join-Path $scriptDir $check)
  if ($LASTEXITCODE -ne 0) { throw "Regression check failed: $check" }
}

node (Join-Path $scriptDir "verify-extension-runtime.mjs")
if ($LASTEXITCODE -ne 0) {
  throw "Extension runtime normalization check failed"
}

& (Join-Path $scriptDir "package-extension.ps1") -Output $Output
if ($LASTEXITCODE -ne 0) {
  throw "Extension packaging failed"
}

$outputPath = if ([System.IO.Path]::IsPathRooted($Output)) { $Output } else { Join-Path $root $Output }
$firstPackageHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $outputPath).Hash

& (Join-Path $scriptDir "package-extension.ps1") -Output $Output
if ($LASTEXITCODE -ne 0) {
  throw "Extension reproducibility package failed"
}

$secondPackageHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $outputPath).Hash
if ($firstPackageHash -ne $secondPackageHash) {
  throw "Extension package is not reproducible: $firstPackageHash vs $secondPackageHash"
}

Write-Output "extension-package-sha256=$secondPackageHash"
