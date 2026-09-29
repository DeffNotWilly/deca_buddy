@echo off
setlocal
cd /d "%~dp0"

echo.
echo   ==========================================
echo    DECA Study Hub
echo   ==========================================
echo.
echo   Opening the app in your browser...
echo.
start "" "%~dp0index.html"

echo   Also opening the folder so you can see the files.
start "" "%~dp0"
echo.
echo   To publish it to GitHub, double-click PUBLISH.cmd instead.
echo.
echo   Press any key to close this window.
pause >nul
endlocal
