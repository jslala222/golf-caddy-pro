@echo off
chcp 65001
echo ==============================================
echo  골프 캐디 서비스 - 긴급 복구 및 실행 (3000번)
echo ==============================================
echo.
echo 1. 기존 서버를 모두 정리합니다...
taskkill /F /IM node.exe >nul 2>&1
echo.

echo 2. 꼬여버린 임시 파일(.next)을 청소합니다...
if exist ".next" (
    rmdir /S /Q .next
    echo    - 청소 완료!
) else (
    echo    - 이미 깨끗합니다.
)
echo.

echo 3. 3000번 포트로 서버를 시작합니다!
echo    잠시 후 'Ready'가 뜨면 브라우저를 열어주세요.
echo.
echo    접속 주소: http://localhost:3000
echo.
echo ==============================================
npm run dev
pause
