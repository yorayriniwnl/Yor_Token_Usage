param(
  [string]$Output = "yor-token-usage-chrome.zip"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir
$rootFullPath = [System.IO.Path]::GetFullPath($root).TrimEnd('\', '/')
$rootPrefix = $rootFullPath + [System.IO.Path]::DirectorySeparatorChar
$extensionPaths = @(
  "manifest.json",
  "assets",
  "background",
  "content",
  "dashboard",
  "popup",
  "settings"
)

$manifestPath = Join-Path $rootFullPath "manifest.json"
try {
  $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
} catch {
  throw "Refusing to package: manifest.json is missing or invalid. $($_.Exception.Message)"
}

$manifestReferences = @()
if ($manifest.background.service_worker) { $manifestReferences += $manifest.background.service_worker }
if ($manifest.action.default_popup) { $manifestReferences += $manifest.action.default_popup }
if ($manifest.options_page) { $manifestReferences += $manifest.options_page }
if ($manifest.options_ui.page) { $manifestReferences += $manifest.options_ui.page }

foreach ($icons in @($manifest.icons, $manifest.action.default_icon)) {
  if ($icons -is [string]) {
    $manifestReferences += $icons
  } elseif ($icons) {
    foreach ($icon in $icons.PSObject.Properties) {
      if ($icon.Value -is [string]) { $manifestReferences += $icon.Value }
    }
  }
}

foreach ($contentScript in @($manifest.content_scripts)) {
  $manifestReferences += @($contentScript.js)
  $manifestReferences += @($contentScript.css)
}
foreach ($resourceGroup in @($manifest.web_accessible_resources)) {
  $manifestReferences += @($resourceGroup.resources)
}

$manifestFiles = @()
foreach ($reference in @($manifestReferences | Where-Object { $_ -is [string] -and -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique)) {
  $relativePath = $reference.Replace('/', '\')
  if ([System.IO.Path]::IsPathRooted($relativePath) -or $relativePath -match '(^|\\)\.\.(\\|$)') {
    throw "Refusing to package a manifest path outside the extension root: $reference"
  }

  $wildcardIndex = $relativePath.IndexOfAny([char[]]@('*', '?'))
  if ($wildcardIndex -ge 0) {
    $pathPattern = Join-Path $rootFullPath $relativePath
    $prefixBeforeWildcard = $relativePath.Substring(0, $wildcardIndex)
    $lastSeparator = $prefixBeforeWildcard.LastIndexOf('\')
    $literalDirectory = if ($lastSeparator -ge 0) { $prefixBeforeWildcard.Substring(0, $lastSeparator) } else { "" }
    $literalDirectoryPath = if ($literalDirectory) {
      [System.IO.Path]::GetFullPath((Join-Path $rootFullPath $literalDirectory))
    } else {
      $rootFullPath
    }
    if ($literalDirectoryPath -ne $rootFullPath -and -not $literalDirectoryPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to package a web-accessible-resource pattern outside the extension root: $reference"
    }

    $matches = @(Get-ChildItem -Path $pathPattern -File -ErrorAction SilentlyContinue)
    if ($matches.Count -eq 0) {
      throw "Refusing to package: web-accessible-resource pattern has no matching files: $reference"
    }
    $manifestFiles += @($matches | ForEach-Object { [System.IO.Path]::GetFullPath($_.FullName) })
    continue
  }

  $fullPath = [System.IO.Path]::GetFullPath((Join-Path $rootFullPath $relativePath))
  if (-not $fullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to package a manifest path outside the extension root: $reference"
  }
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
    throw "Refusing to package an incomplete extension. Build first if these generated files are missing:`n$reference"
  }
  $manifestFiles += $fullPath
}
$manifestFiles = @($manifestFiles | Sort-Object -Unique)

$mapFiles = Get-ChildItem -Path ($extensionPaths | ForEach-Object { Join-Path $rootFullPath $_ }) -Recurse -Filter "*.map" -File
if ($mapFiles.Count -gt 0) {
  $relative = $mapFiles | ForEach-Object { Resolve-Path -Relative $_.FullName }
  throw "Refusing to package extension with source maps:`n$($relative -join "`n")"
}

$sourceMapReferences = Get-ChildItem -Path ($extensionPaths | ForEach-Object { Join-Path $rootFullPath $_ }) -Recurse -Include "*.js" -File |
  Select-String -Pattern '(?m)^[ \t]*(?://[#@][ \t]*sourceMappingURL[ \t]*=[ \t]*\S+|/\*[#@][ \t]*sourceMappingURL[ \t]*=[^*]+\*/)[ \t]*$'
if ($sourceMapReferences.Count -gt 0) {
  $relative = $sourceMapReferences | ForEach-Object { "$(Resolve-Path -Relative $_.Path):$($_.LineNumber)" }
  throw "Refusing to package extension with source map references:`n$($relative -join "`n")"
}

$files = foreach ($extensionPath in $extensionPaths) {
  $sourcePath = Join-Path $rootFullPath $extensionPath
  if (Test-Path -LiteralPath $sourcePath -PathType Container) {
    Get-ChildItem -LiteralPath $sourcePath -Recurse -File
  } else {
    Get-Item -LiteralPath $sourcePath
  }
}
$files = @($files | Sort-Object {
  $_.FullName.Substring($rootFullPath.Length).TrimStart('\', '/').Replace('\', '/')
})
$packageFilePaths = @($files | ForEach-Object { [System.IO.Path]::GetFullPath($_.FullName) })
$missingFromPackage = @($manifestFiles | Where-Object { $packageFilePaths -notcontains $_ })
if ($missingFromPackage.Count -gt 0) {
  throw "Refusing to package: these manifest resources are outside the package file set:`n$($missingFromPackage -join "`n")"
}

$outputPath = if ([System.IO.Path]::IsPathRooted($Output)) { $Output } else { Join-Path $rootFullPath $Output }
$outputPath = [System.IO.Path]::GetFullPath($outputPath)
if ($packageFilePaths -contains $outputPath) {
  throw "Refusing to overwrite a file required by the extension package: $outputPath"
}
foreach ($extensionPath in $extensionPaths | Where-Object { $_ -ne "manifest.json" }) {
  $protectedDirectory = [System.IO.Path]::GetFullPath((Join-Path $rootFullPath $extensionPath)).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
  if ($outputPath.StartsWith($protectedDirectory, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Choose an output path outside packaged directories: $outputPath"
  }
}

$outputDirectory = Split-Path -Parent $outputPath
if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}
$temporaryOutputPath = Join-Path $outputDirectory ("." + [System.IO.Path]::GetFileName($outputPath) + "." + [guid]::NewGuid().ToString("N") + ".tmp")

# Compress-Archive preserves source timestamps, which makes otherwise identical
# release artifacts hash differently. Build a stable archive, validate it, then
# replace the requested output only after every manifest resource is present.
$fixedTimestamp = [System.DateTimeOffset]::new(1980, 1, 1, 0, 0, 0, [System.TimeSpan]::Zero)
try {
  $archiveStream = [System.IO.File]::Open(
    $temporaryOutputPath,
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
      $entryName = $file.FullName.Substring($rootFullPath.Length).TrimStart('\', '/').Replace('\', '/')
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

  $archiveReadStream = [System.IO.File]::OpenRead($temporaryOutputPath)
  $readArchive = [System.IO.Compression.ZipArchive]::new(
    $archiveReadStream,
    [System.IO.Compression.ZipArchiveMode]::Read,
    $false
  )
  try {
    $entryNames = @($readArchive.Entries | ForEach-Object { $_.FullName })
    $missingEntries = @($manifestFiles | Where-Object {
      $entryName = $_.Substring($rootFullPath.Length).TrimStart('\', '/').Replace('\', '/')
      $entryNames -notcontains $entryName
    })
    if ($missingEntries.Count -gt 0) {
      throw "Refusing to publish an incomplete archive. Missing manifest entries:`n$($missingEntries -join "`n")"
    }
  } finally {
    $readArchive.Dispose()
    $archiveReadStream.Dispose()
  }

  Move-Item -LiteralPath $temporaryOutputPath -Destination $outputPath -Force
} catch {
  if (Test-Path -LiteralPath $temporaryOutputPath) {
    Remove-Item -LiteralPath $temporaryOutputPath
  }
  throw
}
