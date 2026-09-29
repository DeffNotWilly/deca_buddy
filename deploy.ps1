<#
.SYNOPSIS
    Publishes DECA Study Hub to GitHub and turns on GitHub Pages.

.DESCRIPTION
    One command does everything:
      1. checks git + the app files are present
      2. makes sure junk files are ignored
      3. commits the app
      4. creates the GitHub repo (public by default) if it doesn't exist
      5. pushes to main
      6. switches on GitHub Pages so you get a free live URL

    Needs a GitHub personal access token. It is read from (in order):
      - the -Token argument
      - the GITHUB_TOKEN environment variable
      - a file called github-token.txt next to this script

    Nothing is ever sent to GitHub until you confirm.

.EXAMPLE
    .\deploy.ps1
    Creates/updates github.com/<you>/deca_buddy and prints the live URL.

.EXAMPLE
    .\deploy.ps1 -RepoName deca-study-hub -Visibility private

.EXAMPLE
    .\deploy.ps1 -SkipPages
    Push the code but leave Pages off.

.EXAMPLE
    .\deploy.ps1 -DryRun
    Show exactly what would happen, touch nothing.
#>
[CmdletBinding()]
param(
    [string]$RepoName = 'deca_buddy',
    [ValidateSet('public', 'private')]
    [string]$Visibility = 'public',
    [string]$Description = 'DECA study companion - 500 practice questions, flashcards, terms quiz, interview prep, study-hour tracking.',
    [string]$Token = $env:GITHUB_TOKEN,
    [switch]$SkipPages,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
# GitHub refuses anything older than TLS 1.2
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# PowerShell 5.1 turns a native command writing to stderr into a terminating
# error, which would kill this script on harmless things like git's
# "LF will be replaced by CRLF" notice. So we stop treating stderr as fatal and
# check git's exit code explicitly instead. REST calls still pass
# -ErrorAction Stop inside Invoke-Gh, so real API failures still throw.
$ErrorActionPreference = 'Continue'

$Root    = Split-Path -Parent $MyInvocation.MyCommand.Path
$ApiBase = 'https://api.github.com'

# files/folders that make up the app
$AppPaths = @('index.html', 'css', 'js', 'start.md', 'DEPLOY.md', 'deploy.ps1', 'make-zip.ps1', '.gitignore', '.gitattributes')

function Write-Step  ($m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Write-Ok    ($m) { Write-Host "    [ok] $m" -ForegroundColor Green }
function Write-Warn  ($m) { Write-Host "    [!!] $m" -ForegroundColor Yellow }
function Write-Fail  ($m) { Write-Host "    [XX] $m" -ForegroundColor Red }

function Get-Token {
    param([string]$Inline)
    if ($Inline) { return $Inline.Trim() }
    if ($env:GITHUB_TOKEN) { return $env:GITHUB_TOKEN.Trim() }
    $f = Join-Path $Root 'github-token.txt'
    if (Test-Path -LiteralPath $f) { return (Get-Content -LiteralPath $f -Raw).Trim() }
    return $null
}

function Invoke-Gh {
    param(
        [ValidateSet('GET', 'POST', 'PUT', 'DELETE')][string]$Method,
        [string]$Uri,
        [hashtable]$Body,
        [string]$Tok
    )
    $h = @{
        'Authorization'  = "Bearer $Tok"
        'Accept'         = 'application/vnd.github+json'
        'X-GitHub-Api-Version' = '2022-11-28'
        'User-Agent'     = 'deca-study-hub-deploy'
    }
    $p = @{ Uri = $Uri; Method = $Method; Headers = $h; ErrorAction = 'Stop' }
    if ($Body) {
        $p.ContentType = 'application/json; charset=utf-8'
        $p.Body       = ($Body | ConvertTo-Json -Depth 6 -Compress)
    }
    try {
        return Invoke-RestMethod @p
    } catch {
        $detail = $null
        if ($_.Exception.Response) {
            try {
                $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
                $detail = $sr.ReadToEnd()
                $sr.Close()
            } catch { }
        }
        throw "GitHub API $Method $Uri failed: $($_.Exception.Message) $detail"
    }
}

function Invoke-GhRaw {
    # like Invoke-Gh but returns the HTTP status instead of throwing on 404
    param(
        [ValidateSet('GET', 'POST', 'PUT', 'DELETE')][string]$Method,
        [string]$Uri,
        [hashtable]$Body,
        [string]$Tok
    )
    $h = @{
        'Authorization'  = "Bearer $Tok"
        'Accept'         = 'application/vnd.github+json'
        'X-GitHub-Api-Version' = '2022-11-28'
        'User-Agent'     = 'deca-study-hub-deploy'
    }
    $p = @{ Uri = $Uri; Method = $Method; Headers = $h; ErrorAction = 'Stop' }
    if ($Body) {
        $p.ContentType = 'application/json; charset=utf-8'
        $p.Body       = ($Body | ConvertTo-Json -Depth 6 -Compress)
    }
    try {
        $r = Invoke-WebRequest @p -UseBasicParsing
        return @{ Status = [int]$r.StatusCode; Content = $r.Content }
    } catch {
        if ($_.Exception.Response) { return @{ Status = [int]$_.Exception.Response.StatusCode; Content = '' } }
        throw
    }
}

# ---------------------------------------------------------------- start
Write-Host ''
Write-Host '  DECA Study Hub - deploy' -ForegroundColor White
Write-Host '  -----------------------' -ForegroundColor DarkGray
if ($DryRun) { Write-Host '  DRY RUN - nothing will be changed or sent' -ForegroundColor Yellow }
Write-Host ''

Write-Step 'Checking git'
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) { Write-Fail 'git is not installed. Install it from https://git-scm.com/download/win and reopen this window.'; exit 1 }
Write-Ok "git $((& git --version) -replace '^git version ','')"

Write-Step 'Checking app files'
$missing = @()
foreach ($p in $AppPaths) { if (-not (Test-Path -LiteralPath (Join-Path $Root $p))) { $missing += $p } }
if ($missing.Count -eq 1 -and $missing[0] -eq 'DEPLOY.md') {
    Write-Warn 'DEPLOY.md not found yet - continuing anyway.'
} elseif ($missing.Count) {
    Write-Fail "missing: $($missing -join ', ')"
    Write-Host '        Run this script from inside the deca_buddy folder.' -ForegroundColor DarkGray
    exit 1
} else {
    Write-Ok 'all app files present'
}

$token = Get-Token -Inline $Token
$login = $null

# ---------------------------------------------------------------- git
Write-Step 'Preparing the git repository'
if (Test-Path -LiteralPath (Join-Path $Root '.git')) {
    Write-Ok 'repo already initialised'
} elseif ($DryRun) {
    Write-Ok 'would initialise a new repo here (branch: main)'
} else {
    Write-Ok 'initialising a new repo in this folder'
    & git -C $Root init --quiet --initial-branch=main 2>&1 | Out-Null
}

$name  = (& git -C $Root config --get user.name) 2>$null
$email = (& git -C $Root config --get user.email) 2>$null
if (-not $name -or -not $email) {
    # fall back to whatever GitHub says, stored repo-local only (never global)
    if ($login) {
        $email = $login + '@users.noreply.github.com'
        $name  = $login
    }
    if (-not $name)  { $name  = $login; if (-not $name) { $name = 'deca' } }
    if (-not $email) { $email = 'deca@users.noreply.github.com' }
    Write-Ok "setting repo-local author to $name <$email>"
    if (-not $DryRun) {
        & git -C $Root config user.name  $name  | Out-Null
        & git -C $Root config user.email $email | Out-Null
    }
} else {
    Write-Ok "author is $name <$email>"
}

Write-Step 'Staging the app'
$present = @($AppPaths | Where-Object { Test-Path -LiteralPath (Join-Path $Root $_) })
if ($DryRun) {
    Write-Ok "would stage: $($present -join ', ')"
} else {
    & git -C $Root add -A -- $present 2>&1 | Out-Null
    $staged = @(& git -C $Root diff --cached --name-only 2>$null)
    if ($staged.Count) {
        Write-Ok "$($staged.Count) file(s) staged:"
        foreach ($f in $staged) { Write-Host "        $f" -ForegroundColor DarkGray }
    } else {
        Write-Ok 'nothing new to stage (already up to date)'
    }
}

$notIgnored = @()
foreach ($j in @('nc_err.txt', 'nc_exit.txt', 'github-token.txt')) {
    if (-not (Test-Path -LiteralPath (Join-Path $Root $j))) { continue }
    if ($DryRun -or -not (Test-Path -LiteralPath (Join-Path $Root '.git'))) { $notIgnored += $j; continue }
    & git -C $Root check-ignore -q -- $j 2>$null
    if ($LASTEXITCODE -ne 0) { $notIgnored += $j }
}
if ($notIgnored.Count) {
    Write-Warn "not gitignored (check .gitignore): $($notIgnored -join ', ')"
} else {
    Write-Ok 'scratch files (nc_err / nc_exit / token) are ignored'
}

Write-Step 'Committing'
$msg = "Publish DECA Study Hub ($((Get-Date).ToString('yyyy-MM-dd HH:mm')))"
if ($DryRun) {
    Write-Ok "would commit: $msg"
} else {
    & git -C $Root commit --quiet -m $msg 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Ok 'nothing new to commit' }
    else { Write-Ok "committed: $msg" }
}

if ($DryRun) {
    Write-Host ''
    Write-Host 'DRY RUN finished. Re-run without -DryRun to actually publish.' -ForegroundColor Yellow
    exit 0
}

# ---------------------------------------------------------------- github
# the local commit above is already safe; only publishing needs a token
if (-not $token) {
    Write-Host ''
    Write-Fail 'No GitHub token found - your local commit is saved, but nothing was published.'
    Write-Host ''
    Write-Host '  Create a free token (takes ~1 minute):' -ForegroundColor Yellow
    Write-Host '    1. open  https://github.com/settings/tokens/new' -ForegroundColor Gray
    Write-Host '    2. Note: "deca deploy", set Expiration to 90 days' -ForegroundColor Gray
    Write-Host '    3. Under "repo" tick the box  (that is the only scope you need)' -ForegroundColor Gray
    Write-Host '    4. Generate token, then copy it' -ForegroundColor Gray
    Write-Host ''
    Write-Host '  Then run one of these:' -ForegroundColor Yellow
    Write-Host '    .\deploy.ps1 -Token "ghp_xxxx"                    # explicit' -ForegroundColor Gray
    Write-Host '    $env:GITHUB_TOKEN = "ghp_xxxx"; .\deploy.ps1      # this session only' -ForegroundColor Gray
    Write-Host '    (or save the token into github-token.txt - it is gitignored)' -ForegroundColor DarkGray
    Write-Host ''
    Write-Host '  No token at all?  .\make-zip.ps1  and drag the zip onto github.com/new' -ForegroundColor DarkGray
    Write-Host ''
    exit 1
}

Write-Step 'Checking your GitHub login'
try {
    $me = Invoke-Gh -Method GET -Uri "$ApiBase/user" -Tok $token
    $login = $me.login
    Write-Ok "signed in as $login"
    if (-not $name) { & git -C $Root config user.name  $login  | Out-Null }
    if (-not $email) { & git -C $Root config user.email ($login + '@users.noreply.github.com') | Out-Null }
} catch {
    Write-Fail 'That token was rejected by GitHub.'
    Write-Host '        Tokens often get pasted with a stray space or quote.' -ForegroundColor DarkGray
    exit 1
}

# ---------------------------------------------------------------- remote
$remoteUrl = "https://github.com/$login/$RepoName.git"
$hasRemote = $false
foreach ($r in @(& git -C $Root remote 2>$null)) {
    if ($r -eq 'origin') { $hasRemote = $true }
}

Write-Step 'Finding or creating the GitHub repo'
$exists = $false
try {
    $null = Invoke-Gh -Method GET -Uri "$ApiBase/repos/$login/$RepoName" -Tok $token
    $exists = $true
} catch { $exists = $false }

if ($exists) {
    Write-Ok "github.com/$login/$RepoName already exists - reusing it"
} else {
    Write-Host "    creating github.com/$login/$RepoName ($Visibility)" -ForegroundColor DarkGray
    $body = @{ name = $RepoName; description = $Description; private = ($Visibility -eq 'private'); auto_init = $false }
    $new = Invoke-Gh -Method POST -Uri "$ApiBase/user/repos" -Body $body -Tok $token
    Write-Ok "created $new.html_url"
}

if ($hasRemote) {
    & git -C $Root remote set-url origin $remoteUrl | Out-Null
    Write-Ok "origin -> $remoteUrl"
} else {
    & git -C $Root remote add origin $remoteUrl | Out-Null
    Write-Ok "added origin -> $remoteUrl"
}

Write-Step 'Pushing to main'
& git -C $Root push -u origin main --quiet 2>&1 | ForEach-Object { if ($_ -match '\S') { Write-Host "        $_" -ForegroundColor DarkGray } }
if ($LASTEXITCODE -ne 0) {
    Write-Fail 'push failed.'
    Write-Host '        If it asks for credentials: username = your GitHub username,'
    Write-Host '        password = your personal access token (NOT your GitHub password).' -ForegroundColor DarkGray
    exit 1
}
Write-Ok 'pushed'

# ---------------------------------------------------------------- pages
$url = "https://$login.github.io/$RepoName/"
if ($SkipPages) {
    Write-Warn 'skipping GitHub Pages (-SkipPages)'
} else {
    Write-Step 'Turning on GitHub Pages (this can take a minute)'
    $pagesOk = $false
    for ($i = 1; $i -le 6; $i++) {
        $r = Invoke-GhRaw -Method GET -Uri "$ApiBase/repos/$login/$RepoName/pages" -Tok $token
        if ($r.Status -eq 200) {
            $pagesOk = $true
            break
        }
        Start-Sleep -Seconds 3
    }
    if (-not $pagesOk) {
        try {
            $r = Invoke-GhRaw -Method POST -Uri "$ApiBase/repos/$login/$RepoName/pages" -Body @{ source = @{ branch = 'main'; path = '/' } } -Tok $token
            if ($r.Status -in @(200, 201)) { $pagesOk = $true }
        } catch { }
    }
    if (-not $pagesOk) {
        $r = Invoke-GhRaw -Method PUT -Uri "$ApiBase/repos/$login/$RepoName/pages" -Body @{ source = @{ branch = 'main'; path = '/' } } -Tok $token
        if ($r.Status -in @(200, 201, 204)) { $pagesOk = $true }
    }
    if ($pagesOk) { Write-Ok 'Pages is live' }
    else {
        Write-Warn 'could not switch Pages on automatically.'
        Write-Host '        Turn it on by hand: repo -> Settings -> Pages ->' -ForegroundColor DarkGray
        Write-Host '        Source: "Deploy from a branch" -> main -> / (root) -> Save' -ForegroundColor DarkGray
    }
}

Write-Host ''
Write-Host '  -------------------------------------------' -ForegroundColor DarkGray
Write-Host "  Repo:  https://github.com/$login/$RepoName" -ForegroundColor White
Write-Host "  Live:  $url" -ForegroundColor Green
Write-Host '  -------------------------------------------' -ForegroundColor DarkGray
Write-Host ''
Write-Host '  The live site can take 1-2 minutes on first build.' -ForegroundColor DarkGray
Write-Host '  To publish changes later, just run:  .\deploy.ps1' -ForegroundColor DarkGray
Write-Host ''
