@echo off
chcp 65001
echo ==============================================
echo  골프 캐디 서비스 - 데이터 이사용 (3001번)
echo ==============================================
echo.
echo 1. 기존 서버를 정리합니다...
taskkill /F /IM node.exe >nul 2>&1
echo.

echo 2. 3001번 포트로 임시 서버를 엽니다.
echo    이 창은 데이터를 백업한 뒤 닫아주세요.
echo.
echo    접속 주소: http://localhost:3001
echo.
echo ==============================================
npx next dev -p 3001
pause
