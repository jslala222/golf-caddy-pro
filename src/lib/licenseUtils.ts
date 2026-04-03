
/**
 * 라이선스 유틸리티 (이용권 코드 방식)
 * 기기 무관 — 코드만 맞으면 어디서든 활성화됩니다.
 * 코드 형식: xx-AAA-BBB (prefix 2자리 + 시드 3자리 + 체크섬 3자리, 총 10자)
 */
import { supabase } from './supabaseClient';

// ── 요금제 정의 ────────────────────────────────────────────────
export const PLANS = {
    month:    { label: '1개월',  days: 30,  price: 9_900 },
    '6month': { label: '6개월', days: 180, price: 55_000 },
    year:     { label: '1년',    days: 365, price: 99_000 },
} as const;

export type PlanType = keyof typeof PLANS;

// ── 채널(판매 경로) 정의 ────────────────────────────────────────
export const CHANNELS = {
    smartstore: '네이버 스마트스토어',
    kmong:      '크몽',
    event:      '이벤트',
    dealer:     '현장 딜러',
    direct:     '직접 발급',
} as const;

export type ChannelType = keyof typeof CHANNELS;

// ── 내부 상수 ──────────────────────────────────────────────────
// 헷갈리는 문자(0, O, I, 1, L) 제외
const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// 비밀 솔트 (절대 노출 주의)
const SECRET_SALT = "CADDY-PRO-SAFETY-2026";

// ── 채널 → 코드 prefix 매핑 ────────────────────────────────────
// 형식: [prefix]-XXX-XXX  (예: sm-AB3-MN7, 총 10자)
// 딜러 추적은 DB issued_by 컬럼에서 처리 (코드에 딜러 ID 불포함)
export const CHANNEL_PREFIX: Record<ChannelType, string> = {
    smartstore: 'sm',
    kmong:      'cm',
    event:      'ev',
    direct:     'dc',
    dealer:     'dl',
};

// 시드 → 체크섬 3자리 계산
function computeChecksum(seed: string): string {
    const combined = seed + SECRET_SALT;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    let result = "";
    let h = Math.abs(hash);
    for (let i = 0; i < 3; i++) {
        result += CHARS[h % CHARS.length];
        h = Math.floor(h / CHARS.length);
    }
    return result;
}

/**
 * prefix를 포함한 이용권 코드 생성
 * 형식: xx-XXX-XXX (2자리 소문자 prefix + 시드 3자 + 체크섬 3자 = 총 10자)
 */
function generateCodeWithPrefix(prefix: string): string {
    let seed = "";
    for (let i = 0; i < 3; i++) {
        seed += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }
    const checksum = computeChecksum(seed);
    return `${prefix}-${seed}-${checksum}`;
}

/**
 * 새 이용권 코드 생성 (채널 없이 직접 발급 — 레거시 호환용)
 * 형식: dc-XXXX-XXXX (직접 발급 prefix)
 */
export const generateVoucherCode = (): string => {
    return generateCodeWithPrefix('dc');
};

/**
 * 이용권 코드 형식 검증 (로컬 체크섬 — 오프라인 검증용)
 * 지원 형식:
 *   xx-XXX-XXX  (신형: 2자리 소문자 prefix, 총 10자)
 *   XXXX-XXXX   (레거시 — prefix 없음)
 */
export const verifyLicense = (inputKey: string): boolean => {
    const trimmed = inputKey.trim().toUpperCase();

    // 마스터 키 (비상용)
    if (trimmed === '0827') return true;

    const parts = trimmed.split('-');

    if (parts.length === 2) {
        // 레거시: XXXX-XXXX
        if (parts[0].length !== 4 || parts[1].length !== 4) return false;
        return parts[1] === computeChecksum(parts[0]);
    }
    if (parts.length === 3) {
        // 신형: sm-XXX-XXX (prefix 2자리 소문자, 총 10자)
        const [prefix, seed, checksum] = parts;
        if (prefix.length !== 2) return false;
        if (seed.length !== 3 || checksum.length !== 3) return false;
        return checksum === computeChecksum(seed);
    }
    return false;
};

// ── Supabase 연동 함수 ──────────────────────────────────────────

/**
 * 이용권 코드 Supabase에 발급 (관리자 / 딜러 공통)
 *
 * 코드 형식:
 *   - 일반 채널: P-XXXX-XXXX  (예: S-AB3K-MN7P)
 *   - 딜러 채널: XY-XXXX-XXXX (딜러 토큰 앞 2자리, 예: Q7-AB3K-MN7P)
 */
export const issueVoucher = async ({
    channel,
    plan,
    days,
    memo,
    userName,
    userPhone,
    issuedBy = 'admin',
}: {
    channel: ChannelType;
    plan: PlanType;
    days: number;
    memo?: string;
    userName?: string;
    userPhone?: string;
    issuedBy?: string;
}): Promise<{ success: boolean; code?: string; error?: string }> => {
    // 채널별 prefix 결정 (딜러 포함 모두 CHANNEL_PREFIX 사용)
    // 딜러 추적은 issued_by 컬럼('dealer_TOKEN')으로 처리
    const prefix = CHANNEL_PREFIX[channel] || 'dc';

    const code = generateCodeWithPrefix(prefix);

    const { error } = await supabase.from('aone_pro_caddypro_licenses').insert({
        code,
        channel,
        plan,
        days,
        is_active: false,
        memo: memo || null,
        user_name: userName || null,
        user_phone: userPhone || null,
        issued_by: issuedBy,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, code };
};

/**
 * Supabase에서 코드 검증 + 첫 사용 시 만료일 자동 설정
 */
export const verifyLicenseAsync = async (inputKey: string): Promise<{
    valid: boolean;
    reason?: string;
    expiresAt?: string;
    daysLeft?: number;
}> => {
    const trimmed = inputKey.trim().toUpperCase();

    // 마스터 키 (Supabase 조회 없이 통과)
    if (trimmed === '0827') return { valid: true };

    const { data, error } = await supabase
        .from('aone_pro_caddypro_licenses')
        .select('code, plan, days, expires_at, first_used_at, is_active')
        .eq('code', trimmed)
        .maybeSingle();

    if (error || !data) return { valid: false, reason: 'not_found' };

    // 이미 만료일이 있는 경우 → 만료 여부만 체크
    if (data.expires_at) {
        const now = new Date();
        const expires = new Date(data.expires_at);
        if (now > expires) return { valid: false, reason: 'expired' };
        const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / 86_400_000);
        return { valid: true, expiresAt: data.expires_at, daysLeft };
    }

    // 첫 사용 → 만료일 자동 계산 후 DB 업데이트
    if (!data.first_used_at) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + data.days * 86_400_000);
        await supabase
            .from('aone_pro_caddypro_licenses')
            .update({
                is_active: true,
                first_used_at: now.toISOString(),
                expires_at: expiresAt.toISOString(),
            })
            .eq('code', trimmed);
        return { valid: true, expiresAt: expiresAt.toISOString(), daysLeft: data.days };
    }

    return { valid: true };
};
