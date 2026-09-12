param(
  [string]$Output = "yor-token-usage-chrome.zip"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

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

$outputDirectory = Split-Path -Parent $outputPath
if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

# Compress-Archive preserves source timestamps, which makes otherwise identical
# release artifacts hash differently. Build the archive directly so ordering and
# metadata are stable across repeated packages of the same source tree.
$files = foreach ($extensionPath in $extensionPaths) {
  $sourcePath = Join-Path $root $extensionPath
  if (Test-Path -LiteralPath $sourcePath -PathType Container) {
    Get-ChildItem -LiteralPath $sourcePath -Recurse -File
  } else {
    Get-Item -LiteralPath $sourcePath
  }
}
$files = $files | Sort-Object {
  $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace("\", "/")
}

$fixedTimestamp = [System.DateTimeOffset]::new(1980, 1, 1, 0, 0, 0, [System.TimeSpan]::Zero)
$archiveStream = [System.IO.File]::Open(
  $outputPath,
  [System.IO.FileMode]::CreateNew,
  [System.IO.FileAccess]::Write,
  [System.IO.FileShare]::None
)
$archive = [System.IO.Compression.ZipArchive]::new(
  $archiveStream,
  [System.IO.Compression.ZipArchiveMode]::Create,
  $false
)

try {
  foreach ($file in $files) {
    $entryName = $file.FullName.Substring($root.Length).TrimStart('\', '/').Replace("\", "/")
    $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
    $entry.LastWriteTime = $fixedTimestamp
    $entry.ExternalAttributes = 0

    $inputStream = [System.IO.File]::OpenRead($file.FullName)
    try {
      $entryStream = $entry.Open()
      try {
        $inputStream.CopyTo($entryStream)
      } finally {
        $entryStream.Dispose()
      }
    } finally {
      $inputStream.Dispose()
    }
  }
} finally {
  $archive.Dispose()
  $archiveStream.Dispose()
}
