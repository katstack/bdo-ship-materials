[CmdletBinding()]
param(
  [string]$GameDir = 'C:\Pearlabyss\BlackDesert',
  [string]$OutputRoot = "$env:LOCALAPPDATA\bdo-ship-materials\extracted",
  [string]$ExtractorVersion = 'v0.1.9',
  [ValidateSet('Auto', 'Full', 'Raw')]
  [string]$Mode = 'Auto'
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

if (-not (Test-Path -LiteralPath $GameDir -PathType Container)) {
  throw "Black Desert installation directory was not found: $GameDir`nRun extract-bdo-client.ps1 -GameDir 'your installation path'."
}

$toolRoot = Join-Path $env:LOCALAPPDATA 'bdo-ship-materials\tools'
New-Item -ItemType Directory -Force -Path $toolRoot, $OutputRoot | Out-Null

# 시스템 전역 설치를 하지 않는다. 최신 안정 Go를 사용자 로컬 도구 폴더에만 내려받는다.
Write-Step 'Preparing Go toolchain'
$goRelease = Invoke-RestMethod -Uri 'https://go.dev/dl/?mode=json'
$goFile =
  $goRelease[0].files |
  Where-Object { $_.os -eq 'windows' -and $_.arch -eq 'amd64' -and $_.kind -eq 'archive' } |
  Select-Object -First 1
if (-not $goFile) { throw 'Could not find a Windows amd64 Go archive in the official release list.' }

$goHome = Join-Path $toolRoot $goFile.version
$goExe = Join-Path $goHome 'go\bin\go.exe'
$goStdlibProbe = Join-Path $goHome 'go\src\fmt\print.go'
if (-not (Test-Path -LiteralPath $goExe) -or -not (Test-Path -LiteralPath $goStdlibProbe)) {
  # A stopped extraction can leave go.exe behind without its standard library.
  # It is a disposable tool cache, so rebuild this exact version from the verified archive.
  if (Test-Path -LiteralPath $goHome) {
    Remove-Item -LiteralPath $goHome -Recurse -Force
  }
  $goArchive = Join-Path $toolRoot $goFile.filename
  if (-not (Test-Path -LiteralPath $goArchive) -or (Get-Item -LiteralPath $goArchive).Length -eq 0) {
    Invoke-WebRequest -UseBasicParsing -Uri "https://go.dev/dl/$($goFile.filename)" -OutFile $goArchive
  }
  $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $goArchive).Hash.ToLowerInvariant()
  if ($actualHash -ne $goFile.sha256.ToLowerInvariant()) {
    throw "Go download SHA-256 verification failed: $goArchive"
  }
  New-Item -ItemType Directory -Force -Path $goHome | Out-Null
  $tar = Join-Path $env:WINDIR 'System32\tar.exe'
  $extractGo = Start-Process -FilePath $tar -ArgumentList @('-xf', $goArchive, '-C', $goHome) -WorkingDirectory $env:SystemDrive -Wait -PassThru -NoNewWindow
  if ($extractGo.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $goStdlibProbe)) {
    throw "Go archive extraction failed."
  }
}

Write-Step "Preparing bdo-data-extractor $ExtractorVersion"
$env:GOPATH = Join-Path $toolRoot 'gopath'
$env:GOBIN = Join-Path $env:GOPATH 'bin'
New-Item -ItemType Directory -Force -Path $env:GOBIN | Out-Null
$extractorExe = Join-Path $env:GOBIN 'bdo-data-extractor.exe'
$goInstall = Start-Process -FilePath $goExe -ArgumentList @('install', "github.com/idevelopthings/bdo-data-extractor@$ExtractorVersion") -WorkingDirectory $env:SystemDrive -Wait -PassThru -NoNewWindow
if ($goInstall.ExitCode -ne 0) { throw "Extractor installation failed with exit code $($goInstall.ExitCode)." }
if (-not (Test-Path -LiteralPath $extractorExe)) {
  throw "Extractor installation failed: $extractorExe"
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outputDir = Join-Path $OutputRoot $stamp
$fullClientSupported = Test-Path -LiteralPath (Join-Path $GameDir 'ads\languagedata_en.loc')
$effectiveMode = if ($Mode -eq 'Auto') { if ($fullClientSupported) { 'Full' } else { 'Raw' } } else { $Mode }

if ($effectiveMode -eq 'Full' -and -not $fullClientSupported) {
  throw "Full mode requires ads\\languagedata_en.loc, which this client does not provide. Use -Mode Raw, or leave the default -Mode Auto."
}

if ($effectiveMode -eq 'Full') {
  Write-Step "Extracting full client data -> $outputDir"
  # The extractor never writes into GameDir. All generated files stay below OutputRoot.
  $extract = Start-Process -FilePath $extractorExe -ArgumentList @('build', '--game', $GameDir, '--out', $outputDir, '--lang', 'en') -WorkingDirectory $env:SystemDrive -Wait -PassThru -NoNewWindow
  if ($extract.ExitCode -ne 0) { throw "Extractor returned exit code $($extract.ExitCode)." }

  $required = @('items.json', 'recipes.json', 'quests.json', 'npcs.json', 'world.json')
  $missing = $required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $outputDir "data\$_")) }
  if ($missing) { throw "The extraction result is missing required files: $($missing -join ', ')" }
  $resultFiles = $required | ForEach-Object { "data\\$_" }
  $note = 'Full catalog generated from a client layout supported by bdo-data-extractor.'
} else {
  Write-Step "Indexing Korean client raw data -> $outputDir"
  # Korean service clients package localization differently (locales\\ko.pak), while
  # the current upstream extractor expects ads\\languagedata_en.loc. Keep the useful
  # raw tables and the archive index instead of pretending a named full catalog exists.
  $indexDir = Join-Path $outputDir 'paz-index'
  $rawDir = Join-Path $outputDir 'raw'
  New-Item -ItemType Directory -Force -Path $indexDir, $rawDir | Out-Null
  $index = Start-Process -FilePath $extractorExe -ArgumentList @('index', '--game', $GameDir, '--out', $indexDir) -WorkingDirectory $env:SystemDrive -Wait -PassThru -NoNewWindow
  if ($index.ExitCode -ne 0) { throw "PAZ indexing failed with exit code $($index.ExitCode)." }

  $rawTables = @('manufacture.bss', 'itemenchant.dbss')
  foreach ($table in $rawTables) {
    $extractRaw = Start-Process -FilePath $extractorExe -ArgumentList @('extract', '--game', $GameDir, $table, $rawDir) -WorkingDirectory $env:SystemDrive -Wait -PassThru -NoNewWindow
    if ($extractRaw.ExitCode -ne 0) { throw "Raw table extraction failed for $table with exit code $($extractRaw.ExitCode)." }
  }

  # Decode the client-side portion of manufacture.bss to JSON. The probe is
  # compiled inside an upstream source checkout because Go's internal packages
  # intentionally cannot be imported by a program outside that module.
  $sourceDir = Join-Path $toolRoot "bdo-data-extractor-$($ExtractorVersion.TrimStart('v'))"
  if (-not (Test-Path -LiteralPath (Join-Path $sourceDir 'go.mod'))) {
    $clone = Start-Process -FilePath 'git.exe' -ArgumentList @('clone', '--depth', '1', '--branch', $ExtractorVersion, 'https://github.com/idevelopthings/bdo-data-extractor.git', $sourceDir) -WorkingDirectory $env:SystemDrive -Wait -PassThru -NoNewWindow
    if ($clone.ExitCode -ne 0) { throw "Extractor source checkout failed with exit code $($clone.ExitCode)." }
  }
  $probeDir = Join-Path $sourceDir 'cmd\\kr-manufacture-probe'
  New-Item -ItemType Directory -Force -Path $probeDir | Out-Null
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'kr-manufacture-probe.go') -Destination (Join-Path $probeDir 'main.go') -Force
  $decodedManufacture = Join-Path $outputDir 'data\\manufacture.raw.json'
  New-Item -ItemType Directory -Force -Path (Split-Path $decodedManufacture) | Out-Null
  $decode = Start-Process -FilePath $goExe -ArgumentList @('run', '.\\cmd\\kr-manufacture-probe', $GameDir, $decodedManufacture) -WorkingDirectory $sourceDir -Wait -PassThru -NoNewWindow
  if ($decode.ExitCode -ne 0) { throw "Manufacture table decoding failed with exit code $($decode.ExitCode)." }

  $resultFiles = @('paz-index\\paz_files.json', 'paz-index\\paz_dirs.json', 'raw\\gamecommondata\\binary\\manufacture.bss', 'raw\\gamecommondata\\binary\\itemenchant.dbss', 'data\\manufacture.raw.json')
  $missing = $resultFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $outputDir $_)) }
  if ($missing) { throw "The raw extraction result is missing files: $($missing -join ', ')" }
  $note = 'Raw Korean-client snapshot. manufacture.raw.json contains client-side input item IDs, counts, processing type, and success rate. Its result group is server-resolved, so item names and output-item links require a separately versioned catalog. The installation has no ads\\languagedata_en.loc; locales\\ko.pak is launcher UI data and is not compatible with the game localization decoder.'
}

$manifest = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  extractorVersion = $ExtractorVersion
  mode = $effectiveMode
  gameDir = $GameDir
  outputDir = $outputDir
  files = $resultFiles
  note = $note
}
$manifest | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $outputDir 'manifest.json')

Write-Host "`nDone: $outputDir" -ForegroundColor Green
Write-Host 'Use this directory as input for the crafting-note normalization script.'
