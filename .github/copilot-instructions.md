# Caddy Manager Pro — Copilot 작업 규칙

## 필수 규칙

### 실행보고서 항상 업데이트
- 작업을 진행하면서 **항상 `실행보고서.md`를 최신 상태로 유지**한다.
- 새 기능 구현, 버그 수정, 배포 등 주요 작업이 완료될 때마다 아래 항목을 업데이트한다:
  - 완료된 작업 (✅)
  - 수정/생성된 파일 목록
  - 변경된 환경변수나 Supabase 스키마
  - 미완료/다음 작업 목록

### Git 규칙
- 사용자가 명시적으로 커밋/푸시를 요청하기 전에는 커밋하지 않는다.

## 프로젝트 기본 정보

- **프레임워크**: Next.js 14 + TypeScript + Tailwind
- **서버 실행**: `npm run dev` = `next build && next start -p 4455`
- **로컬 URL**: http://localhost:4455
- **Supabase**: `https://lajjbrrysvkaxzrchanp.supabase.co`
- **DB 테이블 접두사**: `aone_pro_caddypro_`
- **이용권 코드 형식**: `SM-XXX-XXX`
- **관리자 비번**: `0827` / **마스터코드**: `0827`
- **R2 버킷**: `aonepro-db`, 경로: `caddy-manager-pro/backups/{코드}/latest.json`
