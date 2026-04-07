-- 일일 수입일지 테이블
-- 날짜 기준 1레코드 (UPSERT 방식)
CREATE TABLE IF NOT EXISTS aone_pro_caddypro_diary (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    license_code    text NOT NULL,
    date            text NOT NULL,          -- YYYY-MM-DD

    -- 캐디피 (스케줄에서 자동)
    caddy_fee_1     integer DEFAULT 0,      -- 1부 캐디피
    caddy_fee_2     integer DEFAULT 0,      -- 2부 캐디피
    caddy_fee_3     integer DEFAULT 0,      -- 3부 캐디피

    -- 팁·오버피 (직접 입력)
    tip_1           integer DEFAULT 0,
    tip_2           integer DEFAULT 0,
    tip_3           integer DEFAULT 0,

    -- 기타수입
    extra_reason    text DEFAULT '',        -- 사유 (직접입력)
    extra_amount    integer DEFAULT 0,

    -- 메모(일지)
    memo            text DEFAULT '',

    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),

    UNIQUE (license_code, date)
);

-- RLS
ALTER TABLE aone_pro_caddypro_diary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diary_all" ON aone_pro_caddypro_diary FOR ALL USING (true) WITH CHECK (true);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_diary_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER diary_updated_at
BEFORE UPDATE ON aone_pro_caddypro_diary
FOR EACH ROW EXECUTE FUNCTION update_diary_updated_at();
