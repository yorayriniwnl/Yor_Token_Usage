param(
  [string]$Output = "yor-token-usage-chrome.zip"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir

Push-Location $root
try {
  Write-Host "Running typecheck..."
  npm run typecheck
  if ($LASTEXITCODE -ne 0) { throw "TypeScript typecheck failed" }

  Write-Host "Building fresh bundles..."
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Extension build failed" }
} finally {
  Pop-Location
}

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

node (Join-Path $scriptDir "verify-extension-regressions.mjs")
if ($LASTEXITCODE -ne 0) {
  throw "Extension regression suite failed"
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
