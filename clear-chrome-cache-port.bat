@echo off
setlocal EnableDelayedExpansion

for /f "tokens=2 delims=:." %%A in ('chcp') do set "OLDCP=%%A"
set "OLDCP=%OLDCP: =%"
chcp 65001 >nul

title Chrome 캐시 삭제 (포트 입력)

echo =============================================
echo   Chrome 캐시 삭제 도구 ^(localhost 포트 지정^)
echo =============================================
echo WARNING: 이 스크립트는 chrome.exe 전체를 종료합니다.
echo 다른 작업 중인 탭이 있다면 저장 후 진행하세요.
echo.

set "PORT=%~1"
if "%PORT%"=="" (
  set /p PORT=캐시를 삭제할 포트번호를 입력하세요 ^(예: 4455^) : 
)

if "%PORT%"=="" (
  echo [ERROR] 포트번호는 필수입니다.
  pause
  exit /b 1
)

echo [1/5] 대상 URL: http://localhost:%PORT%/
echo.

echo [2/5] Chrome 프로세스 종료 중...
taskkill /F /IM chrome.exe >nul 2>&1
timeout /t 1 /nobreak >nul

set "USER_DATA=%LOCALAPPDATA%\Google\Chrome\User Data"
if not exist "%USER_DATA%" (
  echo [ERROR] Chrome 사용자 데이터 경로를 찾을 수 없습니다:
  echo %USER_DATA%
  pause
  exit /b 1
)

echo [3/5] Chrome 전체 프로필 캐시 삭제 중...
for /d %%P in ("%USER_DATA%\*") do (
  if exist "%%P\Cache" rd /s /q "%%P\Cache"
  if exist "%%P\Code Cache" rd /s /q "%%P\Code Cache"
  if exist "%%P\GPUCache" rd /s /q "%%P\GPUCache"
  if exist "%%P\Service Worker\CacheStorage" rd /s /q "%%P\Service Worker\CacheStorage"
)

echo [4/5] DNS 캐시 초기화 중...
ipconfig /flushdns >nul 2>&1

echo [5/5] Chrome 재실행 및 대상 URL 열기...
start "" chrome "http://localhost:%PORT%/?cache_bust=%RANDOM%%RANDOM%"

echo.
echo 완료: Chrome 캐시 삭제 후 localhost:%PORT% 를 열었습니다.
echo 참고: 브라우저에서 Ctrl+F5를 한 번 누르면 강력 새로고침이 됩니다.
echo.
pause
if defined OLDCP chcp %OLDCP% >nul
exit /b 0
