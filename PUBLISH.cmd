@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo   ================================================
echo    DECA Study Hub - publish to GitHub
echo   ================================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo   [XX] git is not installed.
  echo        Install it from  https://git-scm.com/download/win
  echo        then reopen this window.
  echo.
  pause
  exit /b 1
)

rem --- do we have a token? ---
set "HASTOKEN=0"
if exist "github-token.txt" SET "HASTOKEN=1"
if not "%GITHUB_TOKEN%"=="" SET "HASTOKEN=1"
if not "%~1"=="" SET "HASTOKEN=1"

if "%HASTOKEN%"=="0" goto :notoken

echo   Running the deploy...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*
set "CODE=%ERRORLEVEL%"
echo.
if "%CODE%"=="0" (
  echo   Done. Copy the "Live:" link it printed.
) else (
  echo   Something went wrong - scroll up for the reason.
)
echo.
pause
exit /b %CODE%

:notoken
echo   No GitHub token found yet. That is fine, this takes ~1 minute.
echo.
echo   1. Open   https://github.com/settings/tokens/new
echo   2. Note   "deca deploy"      Expiration 90 days
echo   3. Tick the "repo" box      (the only one you need)
echo   4. Generate token, then copy it
echo.
choice /C YN /M "   Open that page for you now?  [Y/N] "
if errorlevel 2 goto :manual
start "" "https://github.com/settings/tokens/new"
echo.
echo   Opened. Finish creating the token, then:
echo.
echo   A) paste it into a new file named   github-token.txt   in this
echo      folder, then double-click PUBLISH.cmd again.  EASIEST
echo.
echo   B) or run this in the PowerShell window instead:
echo.
echo        .\deploy.ps1 -Token "ghp_paste_it_here"
echo.
pause
exit /b 0

:manual
echo.
echo   When you have a token, run either:
echo     .\deploy.ps1 -Token "ghp_paste_it_here"    (PowerShell)
echo     PUBLISH.cmd                                (this file, after
echo                                                  saving github-token.txt)
echo.
echo   No token at all? Run  make-zip.ps1  and drag the zip to
echo   https://github.com/new instead.
echo.
pause
endlocal
