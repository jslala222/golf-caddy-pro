-- =============================================
-- Web Push 알람 기능을 위한 Supabase SQL
-- Supabase 대시보드 > SQL Editor에서 실행
-- =============================================

-- 1. push_subscriptions 테이블
CREATE TABLE IF NOT EXISTS aone_pro_caddypro_push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_code TEXT NOT NULL,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_push_subs_license_code
  ON aone_pro_caddypro_push_subscriptions(license_code);

-- 2. schedules 테이블에 alarm 컬럼 추가
ALTER TABLE aone_pro_caddypro_schedules
  ADD COLUMN IF NOT EXISTS alarm_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS alarm_sent BOOLEAN DEFAULT FALSE;

-- 인덱스 (cron job 쿼리 성능)
CREATE INDEX IF NOT EXISTS idx_schedules_alarm_at
  ON aone_pro_caddypro_schedules(alarm_at)
  WHERE alarm_sent = FALSE;
