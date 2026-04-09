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

### 내부서버 반영 규칙
- 라우트/페이지/컴포넌트 구조, 설정 흐름, 주요 UI 배치가 바뀌는 수정 후에는 **반드시 내부서버를 재시작**한다.
- 재시작 후 `http://localhost:4455/home/`, `http://localhost:4455/settings/` 응답(200)을 확인하고 사용자에게 반영 완료를 알린다.
- 반영 누락이 의심되면 강제 새로고침(`Ctrl+F5`) 경로까지 함께 안내한다.

### 배포 규칙
- **배포는 항상 `https://caddy-pink.vercel.app/` 에만 한다** (특별히 지정하지 않는 한)
- 배포 레포: `new_origin` = `caddy_pro_enterprise.git` → `git push new_origin master`
- `golf-caddy-pro.git` (origin)은 기존 테스터용 구버전 — **절대 건드리지 않는다**
- **`git push` 시 반드시 `new_origin master` 만 사용한다. `origin` 또는 다른 remote에 push하는 것은 금지**
- 배포 = `npm run build` 성공 확인 → `git add .` → `git commit` → `git push new_origin master` 순서 고정
- **`deploy.ps1` 스크립트**: `.\deploy.ps1 "커밋 메시지"` 한 줄로 빌드→커밋→배포 가능

## 프로젝트 기본 정보

- **프레임워크**: Next.js 14 + TypeScript + Tailwind
- **서버 실행**: `npm run dev` = `next build && next start -p 4455`
- **로컬 URL**: http://localhost:4455
- **Supabase**: `https://lajjbrrysvkaxzrchanp.supabase.co`
- **DB 테이블 접두사**: `aone_pro_caddypro_`
- **이용권 코드 형식**: `SM-XXX-XXX`
- **관리자 비번**: `0827` / **마스터코드**: `0827`
- **R2 버킷**: `aonepro-db`, 경로: `caddy-manager-pro/backups/{코드}/latest.json`

## UI/UX 규칙

### 전화번호 입력
- **모든** 전화번호 input은 자동 하이픈 포맷팅 적용 (`010-0000-0000`)
- `formatPhoneNumber()` 함수 재사용: `value.replace(/[^0-9]/g,'')` → 3-4-4 하이픈 삽입
- `type="tel"` + `placeholder="010-0000-0000"` 필수
- 스마트폰 기준 설계 (99% 이상 스마트폰 사용자)
