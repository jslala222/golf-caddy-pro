@echo off
chcp 65001 >nul
echo ⛳️ 캐디 매니저 프로를 시작합니다...
echo.
echo 창을 닫지 마세요! (이 창이 꺼지면 앱도 꺼집니다)
echo.
echo 웹 브라우저가 자동으로 열리지 않으면 아래 링크를 클릭하세요:
echo http://localhost:3000
echo.

cd /d "%~dp0"
if not exist node_modules (
    echo npm 패키지를 설치하는 중입니다... 잠시만 기다려주세요.
    call npm install >nul 2>&1
)

call npm run dev
pause
