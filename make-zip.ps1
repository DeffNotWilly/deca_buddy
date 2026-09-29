<#
.SYNOPSIS
    Packs DECA Study Hub into a clean .zip for manual upload to GitHub.

.DESCRIPTION
    Use this when you would rather not deal with a token, or when you just want
    a backup. It builds a zip that contains ONLY the app, laid out the way
    GitHub wants it (index.html at the root of the repo).

    The zip deliberately excludes: .git, node_modules, the deploy tooling,
    scratch files, and any personal token. The result is exactly what belongs
    in the repository.

.EXAMPLE
    .\make-zip.ps1
    Writes dist\deca_buddy.zip and prints the drag-and-drop steps.

.EXAMPLE
    .\make-zip.ps1 -Open
    Same, but opens the folder so you can drag the zip straight out.
#>
[CmdletBinding()]
param(
    [string]$RepoName = 'deca_buddy',
    [switch]$Open
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Dist = Join-Path $Root 'dist'
$Zip  = Join-Path $Dist "$RepoName.zip"

# exactly what should be in the repo
$Include = @('index.html', 'css', 'js', 'start.md', 'DEPLOY.md', '.gitignore', '.gitattributes', 'deploy.ps1', 'make-zip.ps1')

function Write-Step ($m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Write-Ok   ($m) { Write-Host "    [ok] $m" -ForegroundColor Green }
function Write-Fail ($m) { Write-Host "    [XX] $m" -ForegroundColor Red }

Write-Host ''
Write-Host '  DECA Study Hub - make zip' -ForegroundColor White
Write-Host '  --------------------------' -ForegroundColor DarkGray
Write-Host ''

Write-Step 'Checking app files'
$missing = @()
foreach ($p in $Include) {
    if ($p -eq 'DEPLOY.md') { continue }   # docs may not exist yet
    if (-not (Test-Path -LiteralPath (Join-Path $Root $p))) { $missing += $p }
}
if ($missing.Count) { Write-Fail "missing: $($missing -join ', ')"; exit 1 }
Write-Ok 'all app files present'

# build a clean staging copy so nothing unwanted sneaks in
$Stage = Join-Path $env:TEMP ("deca_zip_" + [guid]::NewGuid().ToString('N').Substring(0, 8))
Write-Step 'Staging a clean copy'
if (Test-Path -LiteralPath $Stage) { Remove-Item -LiteralPath $Stage -Recurse -Force }
New-Item -ItemType Directory -Path $Stage -Force | Out-Null

$copied = 0
foreach ($p in $Include) {
    $src = Join-Path $Root $p
    if (-not (Test-Path -LiteralPath $src)) { continue }
    Copy-Item -LiteralPath $src -Destination (Join-Path $Stage $p) -Recurse -Force
    $copied++
}
Write-Ok "$copied item(s) staged (no .git, no token, no scratch files)"

Write-Step 'Creating the zip'
if (-not (Test-Path -LiteralPath $Dist)) { New-Item -ItemType Directory -Path $Dist -Force | Out-Null }
if (Test-Path -LiteralPath $Zip) { Remove-Item -LiteralPath $Zip -Force }
Compress-Archive -Path (Join-Path $Stage '*') -DestinationPath $Zip -CompressionLevel Optimal
Remove-Item -LiteralPath $Stage -Recurse -Force

$size = [math]::Round((Get-Item -LiteralPath $Zip).Length / 1KB, 1)
Write-Ok "$Zip  ($size KB)"

Write-Host ''
Write-Host '  -------------------------------------------' -ForegroundColor DarkGray
Write-Host '  Upload it like this:' -ForegroundColor White
Write-Host ''
Write-Host "    1. go to https://github.com/new" -ForegroundColor Gray
Write-Host "    2. name it $RepoName  -> Create repository" -ForegroundColor Gray
Write-Host "    3. on the new empty repo page click 'uploading an existing file'" -ForegroundColor Gray
Write-Host "    4. drag $RepoName.zip in, then click Commit changes" -ForegroundColor Gray
Write-Host "    5. Settings -> Pages -> Deploy from a branch -> main -> / -> Save" -ForegroundColor Gray
Write-Host ''
Write-Host "    (if GitHub still shows a file browser, the zip unzipped itself - that is fine)" -ForegroundColor DarkGray
Write-Host '  -------------------------------------------' -ForegroundColor DarkGray
Write-Host ''

if ($Open) { Invoke-Item -LiteralPath $Dist }
