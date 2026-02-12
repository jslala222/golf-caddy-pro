@echo off
chcp 65001
echo.
pushd "%~dp0"
echo ========================================================
echo        캐디 매니저 프로 - 배포 파일 생성 중... 🚀
echo ========================================================
echo.
echo 1. 앱을 만들고 있습니다 (잠시만 기다려주세요)...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ❌ 에러가 발생했습니다! npm run build 실패.
    pause
    exit /b
)

echo.
echo 2. 배포용 폴더(out)를 엽니다...
start explorer out

echo.
echo ========================================================
echo ✅ 완료되었습니다!
echo 열린 'out' 폴더를 Netlify Drop 사이트에 드래그하세요.
echo ========================================================
pause
