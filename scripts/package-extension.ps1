param(
  [string]$Output = "yor-token-usage-chrome.zip"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir
$extensionPaths = @(
  "manifest.json",
  "assets",
  "background",
  "content",
  "dashboard",
  "popup",
  "settings"
)

$mapFiles = Get-ChildItem -Path ($extensionPaths | ForEach-Object { Join-Path $root $_ }) -Recurse -Filter "*.map" -File
if ($mapFiles.Count -gt 0) {
  $relative = $mapFiles | ForEach-Object { Resolve-Path -Relative $_.FullName }
  throw "Refusing to package extension with source maps:`n$($relative -join "`n")"
}

$sourceMapReferences = Get-ChildItem -Path ($extensionPaths | ForEach-Object { Join-Path $root $_ }) -Recurse -Include "*.js" -File |
  Select-String -Pattern "sourceMappingURL"
if ($sourceMapReferences.Count -gt 0) {
  $relative = $sourceMapReferences | ForEach-Object { "$(Resolve-Path -Relative $_.Path):$($_.LineNumber)" }
  throw "Refusing to package extension with source map references:`n$($relative -join "`n")"
}

$outputPath = if ([System.IO.Path]::IsPathRooted($Output)) { $Output } else { Join-Path $root $Output }
if (Test-Path -LiteralPath $outputPath) {
  Remove-Item -LiteralPath $outputPath
}

$paths = $extensionPaths | ForEach-Object { Join-Path $root $_ }
Compress-Archive -Path $paths -DestinationPath $outputPath -CompressionLevel Optimal
