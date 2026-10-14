[CmdletBinding()]
param(
  [string]$KoreanGameDir = 'C:\Pearlabyss\BlackDesert',
  [string]$GlobalGameDir = 'C:\Pearlabyss\BlackDesert_NAEU\BlackDesert',
  [string]$OutputRoot = "$env:LOCALAPPDATA\bdo-ship-materials\crafting-notes",
  [string]$NodeExe = 'node.exe',
  [string]$WebOutputDir = ''
)

$ErrorActionPreference = 'Stop'
foreach ($game in @($KoreanGameDir, $GlobalGameDir)) {
  if (-not (Test-Path -LiteralPath (Join-Path $game 'Paz\pad00000.meta'))) {
    throw "Missing game archive index: $game"
  }
}
$runDir = Join-Path $OutputRoot ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$koreanRoot = Join-Path $runDir 'korean'
$globalRoot = Join-Path $runDir 'global'
$normalized = Join-Path $runDir 'catalog'
$nodePath = (Get-Command $NodeExe -ErrorAction Stop).Source

& (Join-Path $PSScriptRoot 'extract-bdo-client.ps1') -GameDir $KoreanGameDir -OutputRoot $koreanRoot -Mode Raw
& (Join-Path $PSScriptRoot 'extract-bdo-client.ps1') -GameDir $GlobalGameDir -OutputRoot $globalRoot -Mode Full
$koreanSnapshot = (Get-ChildItem -LiteralPath $koreanRoot -Directory | Select-Object -First 1).FullName
$globalCatalog = (Get-ChildItem -LiteralPath $globalRoot -Directory | Select-Object -First 1).FullName
$script = Join-Path $PSScriptRoot 'normalize-kr-crafting-notes.mjs'
$outputFile = Join-Path $normalized 'manufacture.ko.json'
# Quote all paths so custom installations with spaces work through Start-Process.
$args = @("`"$script`"", '--snapshot', "`"$koreanSnapshot`"", '--catalog', "`"$globalCatalog`"", '--output', "`"$outputFile`"")
$process = Start-Process -FilePath $nodePath -ArgumentList $args -WorkingDirectory $env:SystemDrive -Wait -PassThru -NoNewWindow
if ($process.ExitCode -ne 0) { throw "Catalog normalization failed: $($process.ExitCode)" }
if ($WebOutputDir) {
  $chunkScript = Join-Path $PSScriptRoot 'build-crafting-chunks.mjs'
  $chunkArgs = @("`"$chunkScript`"", '--catalog', "`"$normalized`"", '--output', "`"$WebOutputDir`"")
  $chunkProcess = Start-Process -FilePath $nodePath -ArgumentList $chunkArgs -WorkingDirectory $env:SystemDrive -Wait -PassThru -NoNewWindow
  if ($chunkProcess.ExitCode -ne 0) { throw 'Web chunk generation failed. Node.js 24 LTS or newer is required.' }
}
Write-Host "Korean crafting catalog: $normalized" -ForegroundColor Green
Write-Host 'See report.json for Korean name coverage and recipe verification counts.'
