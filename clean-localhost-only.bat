@echo off
setlocal

title Clean Localhost Only (No tab close)

set "PORT=%~1"
if "%PORT%"=="" set /p PORT=Port to open with clean profile (default 4455): 
if "%PORT%"=="" set "PORT=4455"

set "PROFILE_DIR=%TEMP%\caddy_clean_profile_%PORT%"

echo.
echo [1/3] Removing temporary clean profile...
if exist "%PROFILE_DIR%" rd /s /q "%PROFILE_DIR%"

echo [2/3] Starting Chrome with isolated profile...
start "" chrome --user-data-dir="%PROFILE_DIR%" --new-window "http://localhost:%PORT%/?cache_bust=%RANDOM%%RANDOM%"

echo [3/3] Done.
echo Existing Chrome windows are NOT closed.
echo You are now using a clean, isolated profile only for localhost:%PORT%.
echo.
pause
exit /b 0
