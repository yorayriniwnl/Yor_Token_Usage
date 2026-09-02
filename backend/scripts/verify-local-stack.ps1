[CmdletBinding()]
param(
  [switch]$KeepRunning,
  [switch]$SkipImageBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$backendRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $backendRoot "compose.yaml"
$databaseUrl = "postgresql://yor_app:yor_local_dev_only@postgres:5432/yor_tokens_test"
$redisUrl = "redis://redis:6379"
$network = "yor-token-usage_default"
$testImage = "yor-token-usage-backend:test"

function Assert-LastExitCode([string]$operation) {
  if ($LASTEXITCODE -ne 0) {
    throw "$operation failed with exit code $LASTEXITCODE"
  }
}

function Invoke-TestContainer([string[]]$command) {
  docker run --rm `
    --network $network `
    -e NODE_ENV=test `
    -e DATABASE_URL=$databaseUrl `
    -e REDIS_URL=$redisUrl `
    $testImage @command
  Assert-LastExitCode "Container command '$($command -join ' ')'"
}

Push-Location $backendRoot
try {
  docker version --format "client={{.Client.Version}} server={{.Server.Version}}"
  Assert-LastExitCode "Docker engine check"
  docker compose -f $composeFile up -d --wait postgres redis
  Assert-LastExitCode "Dependency stack startup"

  docker build --quiet --target test --tag $testImage .
  Assert-LastExitCode "Clean test image build"
  Invoke-TestContainer @("npm", "run", "verify")
  Invoke-TestContainer @("npm", "run", "prisma:migrate")
  Invoke-TestContainer @("npm", "run", "prisma:seed")
  Invoke-TestContainer @("npm", "run", "test:integration")

  if (-not $SkipImageBuild) {
    docker build --quiet --tag yor-token-usage-backend:local .
    Assert-LastExitCode "Runtime image build"
  }
}
finally {
  if (-not $KeepRunning) {
    docker compose -f $composeFile down
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "Dependency stack shutdown failed with exit code $LASTEXITCODE"
    }
  }
  Pop-Location
}
