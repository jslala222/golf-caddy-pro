-- 카카오 액세스 토큰 저장 테이블
-- Supabase SQL 에디터에서 실행하세요

CREATE TABLE IF NOT EXISTS aone_pro_caddypro_kakao_tokens (
    id              BIGSERIAL PRIMARY KEY,
    license_code    TEXT NOT NULL UNIQUE,
    access_token    TEXT NOT NULL,
    refresh_token   TEXT,
    expires_at      TIMESTAMPTZ,
    notification_hour INT NOT NULL DEFAULT 6,  -- 알림 받을 시각 (KST 기준, 5~9)
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_kakao_tokens_license_code
    ON aone_pro_caddypro_kakao_tokens(license_code);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_kakao_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kakao_tokens_updated_at ON aone_pro_caddypro_kakao_tokens;
CREATE TRIGGER trg_kakao_tokens_updated_at
    BEFORE UPDATE ON aone_pro_caddypro_kakao_tokens
    FOR EACH ROW EXECUTE FUNCTION update_kakao_tokens_updated_at();
