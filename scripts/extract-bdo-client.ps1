[CmdletBinding()]
param(
  [string]$GameDir = 'C:\Pearlabyss\BlackDesert',
  [string]$OutputRoot = "$env:LOCALAPPDATA\bdo-ship-materials\extracted",
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

Write-Step 'Preparing pinned bdo-data-extractor submodule'
$env:GOPATH = Join-Path $toolRoot 'gopath'
$env:GOBIN = Join-Path $env:GOPATH 'bin'
New-Item -ItemType Directory -Force -Path $env:GOBIN | Out-Null
$extractorExe = Join-Path $env:GOBIN 'bdo-data-extractor.exe'
$submoduleDir = Join-Path $PSScriptRoot '..\tools\bdo-data-extractor'
if (-not (Test-Path -LiteralPath (Join-Path $submoduleDir 'go.mod'))) {
  throw 'Initialize the extractor with: git submodule update --init --recursive'
}
# Build from a Windows-native disposable source copy. Keep the submodule clean
# and avoid Go internal-package restrictions when adding our probe commands.
$sourceDir = Join-Path $toolRoot ('source-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $sourceDir | Out-Null
Get-ChildItem -LiteralPath $submoduleDir -Force | Where-Object { $_.Name -ne '.git' } | Copy-Item -Destination $sourceDir -Recurse -Force
$goBuild = Start-Process -FilePath $goExe -ArgumentList @('build', '-o', "`"$extractorExe`"", '.') -WorkingDirectory $sourceDir -Wait -PassThru -NoNewWindow
if ($goBuild.ExitCode -ne 0) { throw "Extractor build failed with exit code $($goBuild.ExitCode)." }
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
  $extract = Start-Process -FilePath $extractorExe -ArgumentList @('build', '--game', "`"$GameDir`"", '--out', "`"$outputDir`"", '--lang', 'en') -WorkingDirectory $env:SystemDrive -Wait -PassThru -NoNewWindow
  if ($extract.ExitCode -ne 0) { throw "Extractor returned exit code $($extract.ExitCode)." }

  $required = @('items.json', 'recipes.json', 'quests.json', 'npcs.json', 'world.json')
  $missing = $required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $outputDir $_)) }
  if ($missing) { throw "The extraction result is missing required files: $($missing -join ', ')" }
  $resultFiles = $required
  $textProbeDir = Join-Path $sourceDir 'cmd\global-korean-text-probe'
  New-Item -ItemType Directory -Force -Path $textProbeDir | Out-Null
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'global-korean-text-probe.go') -Destination (Join-Path $textProbeDir 'main.go') -Force
  $textOutput = Join-Path $outputDir 'item-texts.ko.json'
  $textProcess = Start-Process -FilePath $goExe -ArgumentList @('run', '.\cmd\global-korean-text-probe', "`"$GameDir`"", "`"$textOutput`"") -WorkingDirectory $sourceDir -Wait -PassThru -NoNewWindow
  if ($textProcess.ExitCode -ne 0) { throw 'Korean source XML text extraction failed.' }
  $resultFiles += 'item-texts.ko.json'
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
  $probeDir = Join-Path $sourceDir 'cmd\\kr-manufacture-probe'
  New-Item -ItemType Directory -Force -Path $probeDir | Out-Null
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'kr-manufacture-probe.go') -Destination (Join-Path $probeDir 'main.go') -Force
  $decodedManufacture = Join-Path $outputDir 'data\\manufacture.raw.json'
  New-Item -ItemType Directory -Force -Path (Split-Path $decodedManufacture) | Out-Null
  $decode = Start-Process -FilePath $goExe -ArgumentList @('run', '.\\cmd\\kr-manufacture-probe', $GameDir, $decodedManufacture) -WorkingDirectory $sourceDir -Wait -PassThru -NoNewWindow
  if ($decode.ExitCode -ne 0) { throw "Manufacture table decoding failed with exit code $($decode.ExitCode)." }

  # Korean display names are embedded as UTF-16 strings in itemenchant.dbss,
  # even though this client has no languagedata_ko.loc. Keep the ID -> Korean
  # name map as a small, reusable localization layer for a full foreign catalog.
  $probeNamesDir = Join-Path $sourceDir 'cmd\\kr-item-name-probe'
  New-Item -ItemType Directory -Force -Path $probeNamesDir | Out-Null
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'kr-item-name-probe.go') -Destination (Join-Path $probeNamesDir 'main.go') -Force
  $koreanItemNames = Join-Path $outputDir 'data\\item-names.ko.json'
  $decodeNames = Start-Process -FilePath $goExe -ArgumentList @('run', '.\\cmd\\kr-item-name-probe', $GameDir, $koreanItemNames) -WorkingDirectory $sourceDir -Wait -PassThru -NoNewWindow
  if ($decodeNames.ExitCode -ne 0) { throw "Korean item-name decoding failed with exit code $($decodeNames.ExitCode)." }
  $detailProbeDir = Join-Path $sourceDir 'cmd\kr-item-details-probe'
  New-Item -ItemType Directory -Force -Path $detailProbeDir | Out-Null
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'kr-item-details-probe.go') -Destination (Join-Path $detailProbeDir 'main.go') -Force
  $detailOutput = Join-Path $outputDir 'data\item-details.ko.json'
  $detailProcess = Start-Process -FilePath $goExe -ArgumentList @('run', '.\cmd\kr-item-details-probe', "`"$GameDir`"", "`"$detailOutput`"") -WorkingDirectory $sourceDir -Wait -PassThru -NoNewWindow
  if ($detailProcess.ExitCode -ne 0) { throw 'Korean item detail extraction failed.' }

  $resultFiles = @('paz-index\\paz_files.json', 'paz-index\\paz_dirs.json', 'raw\\gamecommondata\\binary\\manufacture.bss', 'raw\\gamecommondata\\binary\\itemenchant.dbss', 'data\\manufacture.raw.json', 'data\\item-names.ko.json')
  $resultFiles += 'data\item-details.ko.json'
  $missing = $resultFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $outputDir $_)) }
  if ($missing) { throw "The raw extraction result is missing files: $($missing -join ', ')" }
  $note = 'Raw Korean-client snapshot. manufacture.raw.json contains client-side input item IDs, counts, processing type, and success rate. item-names.ko.json supplies Korean display names decoded from itemenchant.dbss. Manufacture result groups remain server-resolved, so output-item links require a separately versioned full recipe catalog. The installation has no ads\\languagedata_en.loc; locales\\ko.pak is launcher UI data and is not compatible with the game localization decoder.'
}

$manifest = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  extractorSource = 'tools/bdo-data-extractor (Git submodule pinned by parent repository)'
  mode = $effectiveMode
  gameDir = $GameDir
  outputDir = $outputDir
  files = $resultFiles
  note = $note
}
$manifest | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $outputDir 'manifest.json')

Write-Host "`nDone: $outputDir" -ForegroundColor Green
Write-Host 'Use this directory as input for the crafting-note normalization script.'
