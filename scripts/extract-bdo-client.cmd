@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0extract-bdo-client.ps1" %*
set "exitCode=%ERRORLEVEL%"
if not "%exitCode%"=="0" (
  echo.
  echo Extraction failed with exit code %exitCode%.
  pause
)
exit /b %exitCode%
