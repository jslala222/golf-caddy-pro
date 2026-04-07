-- ================================================================
-- Caddy Manager Pro — Web Push 알람 기능 SQL
-- 대상: https://lajjbrrysvkaxzrchanp.supabase.co
-- Supabase 대시보드 > SQL Editor > New Query 에서
-- 전체 복사 붙여넣기 후 RUN 버튼 클릭
--
-- 실행 내용:
--   [1] push_subscriptions  테이블 신규 생성
--   [2] 인덱스 2개 생성
--   [3] RLS 정책 (Service Role Key 전용)
--   [4] updated_at 자동갱신 트리거
--   [5] schedules 테이블에 alarm_at / alarm_sent 컬럼 추가
--   [6] alarm 전용 인덱스 2개 생성
--   [7] 결과 확인 SELECT (실행 후 결과 탭에서 확인)
-- ================================================================


-- ================================================================
-- [1] push_subscriptions 테이블 생성
--
--  한 이용권(license_code)에 여러 기기 구독 가능.
--  endpoint는 브라우저/기기마다 고유값이므로 UNIQUE 제약.
--  기기 교체하면 새 endpoint로 재구독 → upsert(onConflict:endpoint)
-- ================================================================

CREATE TABLE IF NOT EXISTS aone_pro_caddypro_push_subscriptions (

  -- PK
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 어느 이용권 사용자의 구독인지 (SM-XXX-XXX 형식)
  license_code  TEXT        NOT NULL,

  -- Web Push 구독 고유 URL (브라우저가 생성, 기기마다 다름)
  endpoint      TEXT        NOT NULL UNIQUE,

  -- ECDH 공개키 — push 메시지 암호화에 사용 (base64url)
  p256dh        TEXT        NOT NULL,

  -- 인증 비밀값 — push 메시지 인증에 사용 (base64url)
  auth          TEXT        NOT NULL,

  -- 기기 정보 (디버깅용, 선택 저장)
  user_agent    TEXT,

  -- 구독 등록 시각
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 마지막 갱신 시각 (재구독 시 트리거로 자동 업데이트)
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

-- 테이블/컬럼 설명
COMMENT ON TABLE  aone_pro_caddypro_push_subscriptions              IS 'Web Push 브라우저 구독 정보 저장소';
COMMENT ON COLUMN aone_pro_caddypro_push_subscriptions.license_code IS '이용권 코드 (SM-XXX-XXX)';
COMMENT ON COLUMN aone_pro_caddypro_push_subscriptions.endpoint     IS 'Push 서비스 엔드포인트 URL — 브라우저마다 고유';
COMMENT ON COLUMN aone_pro_caddypro_push_subscriptions.p256dh       IS 'ECDH 공개키 (base64url) — 메시지 암호화용';
COMMENT ON COLUMN aone_pro_caddypro_push_subscriptions.auth         IS '인증 비밀값 (base64url) — 메시지 인증용';
COMMENT ON COLUMN aone_pro_caddypro_push_subscriptions.user_agent   IS '구독한 브라우저 User-Agent (디버깅용)';


-- ================================================================
-- [2] 인덱스 생성
--
--  ① license_code 인덱스: Cron이 "이 이용권의 구독 목록"을 빠르게 조회
--  ② endpoint는 UNIQUE 제약으로 자동 인덱스 생성 → 별도 불필요
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_push_subs_license_code
  ON aone_pro_caddypro_push_subscriptions (license_code);


-- ================================================================
-- [3] RLS (Row Level Security) 정책
--
--  서버 API(Service Role Key)에서만 이 테이블에 접근.
--  anon/authenticated 역할은 클라이언트 직접 접근하지 않음.
--  → 정책 USING(true) / WITH CHECK(true) 로 서버 통과 허용.
-- ================================================================

ALTER TABLE aone_pro_caddypro_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subs_service_all" ON aone_pro_caddypro_push_subscriptions;

CREATE POLICY "push_subs_service_all"
  ON  aone_pro_caddypro_push_subscriptions
  FOR ALL
  USING     (true)
  WITH CHECK (true);


-- ================================================================
-- [4] updated_at 자동갱신 트리거
--
--  행이 UPDATE될 때마다 updated_at = NOW() 자동 설정.
--  (재구독 upsert 시 활용)
--
--  set_updated_at() 함수가 이미 있으면 OR REPLACE로 덮어씀.
-- ================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- push_subscriptions 트리거
DROP TRIGGER IF EXISTS trg_push_subs_updated_at
  ON aone_pro_caddypro_push_subscriptions;

CREATE TRIGGER trg_push_subs_updated_at
  BEFORE UPDATE
  ON  aone_pro_caddypro_push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();


-- ================================================================
-- [5] schedules 테이블에 alarm 컬럼 2개 추가
--
--  alarm_at  : 알람을 발송할 시각 (UTC ISO8601)
--              = 약속시간 - 사용자가 설정한 분수
--              ex) 약속 14:00, 1시간 전 설정 → alarm_at = 05:00Z (= 14:00 KST 기준)
--              Vercel Cron이 이 컬럼 값을 보고 push를 발송
--
--  alarm_sent: 발송 완료 여부 (중복 발송 방지용 플래그)
--              기본 FALSE → Cron이 발송 후 TRUE로 UPDATE
--              FALSE 행만 인덱싱해서 발송 완료 후엔 쿼리 대상에서 자동 제외
-- ================================================================

ALTER TABLE aone_pro_caddypro_schedules
  ADD COLUMN IF NOT EXISTS alarm_at   TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS alarm_sent BOOLEAN     NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN aone_pro_caddypro_schedules.alarm_at
  IS 'Push 알람 발송 예정 시각 (약속시간 - 설정분수, UTC ISO8601)';

COMMENT ON COLUMN aone_pro_caddypro_schedules.alarm_sent
  IS 'Push 발송 완료 여부 — Vercel Cron이 발송 후 TRUE로 변경';


-- ================================================================
-- [6] alarm 전용 인덱스
--
--  Vercel Cron 쿼리 패턴:
--    SELECT ... FROM aone_pro_caddypro_schedules
--    WHERE alarm_at BETWEEN (now - interval '5 min') AND now
--      AND alarm_sent = false
--
--  ① 부분 인덱스: alarm_sent=FALSE + alarm_at IS NOT NULL인 행만 인덱싱
--     → 발송 완료(TRUE) 된 대량의 과거 행은 인덱스에서 자동 제외
--     → 시간이 지날수록 인덱스 크기가 커지지 않음 (효율적)
--
--  ② 복합 인덱스: license_code + alarm_at
--     → Cron → 구독 조회 시 license_code 조인에서 활용
-- ================================================================

-- ① 미발송 알람 전용 부분(Partial) 인덱스
CREATE INDEX IF NOT EXISTS idx_schedules_alarm_pending
  ON aone_pro_caddypro_schedules (alarm_at)
  WHERE alarm_sent = FALSE
    AND alarm_at IS NOT NULL;

-- ② 이용권별 알람 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_schedules_alarm_by_license
  ON aone_pro_caddypro_schedules (license_code, alarm_at)
  WHERE alarm_at IS NOT NULL;


-- ================================================================
-- [7] 결과 확인 SELECT
--
--  실행 완료 후 아래 쿼리 결과로 정상 반영 여부를 확인하세요.
--  각 쿼리 결과가 1건 이상이면 정상입니다.
-- ================================================================

-- 7-1. push_subscriptions 테이블 존재 여부 확인
SELECT
  table_name,
  pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) AS size
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name   = 'aone_pro_caddypro_push_subscriptions';

-- 7-2. schedules 테이블에 alarm 컬럼 2개 추가됐는지 확인
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'aone_pro_caddypro_schedules'
  AND column_name  IN ('alarm_at', 'alarm_sent')
ORDER BY column_name;

-- 7-3. 인덱스 생성 확인 (총 3개)
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_push_subs_license_code',
    'idx_schedules_alarm_pending',
    'idx_schedules_alarm_by_license'
  )
ORDER BY indexname;

-- 7-4. RLS 정책 확인
SELECT
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE tablename = 'aone_pro_caddypro_push_subscriptions';

-- 7-5. 트리거 확인
SELECT
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table  = 'aone_pro_caddypro_push_subscriptions';

-- ================================================================
-- 실행 완료!
--
-- SQL 실행 후 Vercel 대시보드에서 환경변수 추가 필요:
--   Settings → Environment Variables → Add
--
--   VAPID_PRIVATE_KEY          = 0UXtd842JGqP_0dM_blKj6MPG7OVoqRA4Z-SXPzHszg
--   VAPID_EMAIL                = mailto:admin@caddypro.kr
--   NEXT_PUBLIC_VAPID_PUBLIC_KEY = BF1vEDu0zwtRRLvXmLBK4_08VwIQ5rwr6dmJpjQgLBGpnOaJSAbsCy4UW3CKEBJplxc_mfmUz0jpUUgMmwrxsvI
--   CRON_SECRET                = caddy_cron_secret_2025
-- ================================================================
