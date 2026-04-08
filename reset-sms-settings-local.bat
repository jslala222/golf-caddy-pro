@echo off
setlocal

title Reset SMS Settings (Supabase value)

set "PORT=%~1"
if "%PORT%"=="" set /p PORT=Local server port (default 4455): 
if "%PORT%"=="" set "PORT=4455"

set "LICENSE_CODE="
set /p LICENSE_CODE=License code to reset (example: DC-Q73-9FZ): 
if "%LICENSE_CODE%"=="" (
  echo [ERROR] License code is required.
  pause
  exit /b 1
)

echo.
echo [1/2] Resetting phone/null + notification hour 6...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$u='http://localhost:%PORT%/api/notify/settings';" ^
  "$b=@{ licenseCode='%LICENSE_CODE%'; phone=$null; notificationHour=6 } | ConvertTo-Json;" ^
  "try { $r=Invoke-RestMethod -Uri $u -Method Put -ContentType 'application/json' -Body $b; $r | ConvertTo-Json -Depth 5; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"
if errorlevel 1 (
  echo [ERROR] Failed to reset SMS settings. Check if local server is running.
  pause
  exit /b 1
)

echo [2/2] Opening settings page...
start "" "http://localhost:%PORT%/settings"

echo Done. SMS settings reset request sent.
echo.
pause
exit /b 0
