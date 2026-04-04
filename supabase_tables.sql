-- =====================================================
-- Caddy Manager Pro — 정규화 테이블 생성 SQL
-- Supabase SQL Editor에서 실행
-- prefix: aone_pro_caddypro_
-- =====================================================

-- 1. 일정 테이블
CREATE TABLE IF NOT EXISTS aone_pro_caddypro_schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_code TEXT NOT NULL REFERENCES aone_pro_caddypro_licenses(code) ON DELETE CASCADE,
  date        DATE NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('work', 'holiday', 'personal')),
  shift       TEXT CHECK (shift IN ('1', '2', '3')),
  holes       INTEGER DEFAULT 18,
  caddy_fee   INTEGER DEFAULT 0,
  over_fee    INTEGER DEFAULT 0,
  is_rain     BOOLEAN DEFAULT false,
  title       TEXT,
  memo        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 수입/지출 거래 테이블
CREATE TABLE IF NOT EXISTS aone_pro_caddypro_transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_code TEXT NOT NULL REFERENCES aone_pro_caddypro_licenses(code) ON DELETE CASCADE,
  schedule_id  UUID REFERENCES aone_pro_caddypro_schedules(id) ON DELETE SET NULL,
  date         DATE NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount       INTEGER NOT NULL DEFAULT 0,
  category     TEXT,   -- income: caddy_fee/tip/over_fee / expense: food/transport/gear/other
  memo         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 고객 테이블
CREATE TABLE IF NOT EXISTS aone_pro_caddypro_clients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_code TEXT NOT NULL REFERENCES aone_pro_caddypro_licenses(code) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT,
  car_info     TEXT,
  birth_date   TEXT,
  grade        TEXT DEFAULT 'normal' CHECK (grade IN ('vip', 'gn', 'normal')),
  visit_count  INTEGER DEFAULT 0,
  last_visit   DATE,
  memo         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 캐디피 설정 테이블
CREATE TABLE IF NOT EXISTS aone_pro_caddypro_fee_settings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_code TEXT NOT NULL UNIQUE REFERENCES aone_pro_caddypro_licenses(code) ON DELETE CASCADE,
  shift1       INTEGER DEFAULT 150000,
  shift2       INTEGER DEFAULT 150000,
  shift3       INTEGER DEFAULT 150000,
  use_shift3   BOOLEAN DEFAULT false,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 영수증/지출 사진 테이블 (Phase 3용, 미리 생성)
CREATE TABLE IF NOT EXISTS aone_pro_caddypro_expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_code  TEXT NOT NULL REFERENCES aone_pro_caddypro_licenses(code) ON DELETE CASCADE,
  date          DATE NOT NULL,
  amount        INTEGER NOT NULL DEFAULT 0,
  merchant_name TEXT,
  category      TEXT DEFAULT 'other',  -- gear/food/transport/other
  receipt_url   TEXT,  -- R2 경로
  ocr_raw       TEXT,  -- OCR 원본 텍스트
  memo          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 인덱스
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_schedules_license_date   ON aone_pro_caddypro_schedules(license_code, date);
CREATE INDEX IF NOT EXISTS idx_transactions_license_date ON aone_pro_caddypro_transactions(license_code, date);
CREATE INDEX IF NOT EXISTS idx_clients_license          ON aone_pro_caddypro_clients(license_code);
CREATE INDEX IF NOT EXISTS idx_expenses_license_date    ON aone_pro_caddypro_expenses(license_code, date);

-- =====================================================
-- RLS (Row Level Security) 활성화
-- 현재는 Service Role Key(서버 API)로만 접근하므로
-- RLS 정책은 나중에 추가 (지금은 비활성화)
-- =====================================================
-- ALTER TABLE aone_pro_caddypro_schedules    ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE aone_pro_caddypro_transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE aone_pro_caddypro_clients      ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE aone_pro_caddypro_fee_settings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE aone_pro_caddypro_expenses     ENABLE ROW LEVEL SECURITY;
