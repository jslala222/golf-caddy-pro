param(
    [string]$msg = "deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "========================================================"
Write-Host "       캐디 매니저 프로 - Vercel 배포 시작"
Write-Host "========================================================"
Write-Host ""

# 1. 빌드
Write-Host "[1/3] 빌드 중..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "빌드 실패 - 배포를 중단합니다."
    exit 1
}

Write-Host ""
Write-Host "[2/3] Git 커밋 중..."
Write-Host "  메시지: $msg"
git add .
git commit -m $msg
if ($LASTEXITCODE -ne 0) {
    Write-Host "커밋할 변경사항이 없거나 커밋 실패."
    exit 1
}

Write-Host ""
Write-Host "[3/3] new_origin 으로 푸시 중..."
git push new_origin master
if ($LASTEXITCODE -ne 0) {
    Write-Host "푸시 실패."
    exit 1
}

Write-Host ""
Write-Host "========================================================"
Write-Host "  배포 완료: https://caddy-pink.vercel.app/"
Write-Host "========================================================"
Write-Host ""
