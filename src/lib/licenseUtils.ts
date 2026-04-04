
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

// ── 티어 정의 ────────────────────────────────────────────────
export const TIER_PRICES: Record<'standard' | 'premium', Record<PlanType, number>> = {
    standard: { month: 9_900,  '6month': 55_000, year: 99_000 },
    premium:  { month: 12_900, '6month': 69_000, year: 129_000 },
};

export type TierType = 'standard' | 'premium';

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
    golfCourse,
    payMethod = 'cash',
    userName,
    userPhone,
    issuedBy = 'admin',
    tier = 'standard',
}: {
    channel: ChannelType;
    plan: PlanType;
    days: number;
    memo?: string;
    golfCourse?: string;
    payMethod?: string;
    userName?: string;
    userPhone?: string;
    issuedBy?: string;
    tier?: TierType;
}): Promise<{ success: boolean; code?: string; error?: string }> => {
    // 채널별 prefix 결정 (딜러 포함 모두 CHANNEL_PREFIX 사용)
    // 딜러 추적은 issued_by 컬럼('dealer_TOKEN')으로 처리
    const prefix = CHANNEL_PREFIX[channel] || 'dc';

    const code = generateCodeWithPrefix(prefix);

    // 발급 즉시 expires_at 계산 (오늘 기준 days 후)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + days * 86_400_000);

    const { error } = await supabase.from('aone_pro_caddypro_licenses').insert({
        code,
        channel,
        plan,
        days,
        tier,
        is_active: false,
        expires_at: expiresAt.toISOString(),
        memo: memo || null,
        golf_course: golfCourse || null,
        pay_method: payMethod,
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
    tier?: TierType;
}> => {
    const trimmed = inputKey.trim().toUpperCase();

    // 마스터 키 (Supabase 조회 없이 통과)
    if (trimmed === '0827') return { valid: true, tier: 'premium' };

    const { data, error } = await supabase
        .from('aone_pro_caddypro_licenses')
        .select('code, plan, days, expires_at, first_used_at, is_active, tier')
        .ilike('code', trimmed)
        .maybeSingle();

    if (error || !data) return { valid: false, reason: 'not_found' };

    const tier: TierType = (data.tier === 'premium') ? 'premium' : 'standard';

    // 이미 만료일이 있는 경우 → 만료 여부만 체크
    if (data.expires_at) {
        const now = new Date();
        const expires = new Date(data.expires_at);
        if (now > expires) return { valid: false, reason: 'expired', expiresAt: data.expires_at };
        const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / 86_400_000);
        return { valid: true, expiresAt: data.expires_at, daysLeft, tier };
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
            .eq('code', data.code);
        return { valid: true, expiresAt: expiresAt.toISOString(), daysLeft: data.days, tier };
    }

    return { valid: true, tier };
};

/**
 * 전화번호로 이용권 검색 (갱신용)
 * 가장 최근 만료일 기준 이용권 1건 반환
 */
export const searchLicenseByPhone = async (phone: string): Promise<{
    found: boolean;
    id?: string;
    code?: string;
    plan?: string;
    expiresAt?: string | null;
    userName?: string | null;
    daysLeft?: number;
    isExpired?: boolean;
}> => {
    const { data } = await supabase
        .from('aone_pro_caddypro_licenses')
        .select('id, code, plan, expires_at, user_name, is_active')
        .eq('user_phone', phone.replace(/\D/g, '').replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3').trim())
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    // 하이픈 없는 경우도 시도
    if (!data) {
        const digits = phone.replace(/\D/g, '');
        const { data: data2 } = await supabase
            .from('aone_pro_caddypro_licenses')
            .select('id, code, plan, expires_at, user_name, is_active')
            .or(`user_phone.eq.${digits},user_phone.ilike.%${digits}%`)
            .order('expires_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (!data2) return { found: false };
        const now2 = new Date();
        const exp2 = data2.expires_at ? new Date(data2.expires_at) : null;
        const dl2 = exp2 ? Math.ceil((exp2.getTime() - now2.getTime()) / 86_400_000) : undefined;
        return {
            found: true, id: data2.id, code: data2.code, plan: data2.plan,
            expiresAt: data2.expires_at, userName: data2.user_name,
            daysLeft: dl2, isExpired: exp2 ? now2 > exp2 : false,
        };
    }

    const now = new Date();
    const expires = data.expires_at ? new Date(data.expires_at) : null;
    const daysLeft = expires ? Math.ceil((expires.getTime() - now.getTime()) / 86_400_000) : undefined;
    return {
        found: true, id: data.id, code: data.code, plan: data.plan,
        expiresAt: data.expires_at, userName: data.user_name,
        daysLeft, isExpired: expires ? now > expires : false,
    };
};

/**
 * 기존 이용권 기간 연장 (코드 불변, 만료일만 업데이트)
 * - 아직 유효: 기존 만료일 기준으로 days 추가
 * - 이미 만료: 오늘을 기준으로 days 추가
 */
export const extendLicense = async ({
    licenseId,
    plan,
    days,
    dealerToken,
}: {
    licenseId: string;
    plan: PlanType;
    days: number;
    dealerToken: string;
}): Promise<{ success: boolean; newExpiresAt?: string; error?: string }> => {
    const { data: current, error: fetchError } = await supabase
        .from('aone_pro_caddypro_licenses')
        .select('expires_at')
        .eq('id', licenseId)
        .maybeSingle();
    if (fetchError || !current) return { success: false, error: '이용권을 찾을 수 없습니다.' };

    const now = new Date();
    const baseDate = current.expires_at && new Date(current.expires_at) > now
        ? new Date(current.expires_at)
        : now;
    const newExpiresAt = new Date(baseDate.getTime() + days * 86_400_000);

    const { error } = await supabase
        .from('aone_pro_caddypro_licenses')
        .update({
            expires_at: newExpiresAt.toISOString(),
            is_active: true,
            plan,
            days,
            issued_by: `dealer_${dealerToken}`,
        })
        .eq('id', licenseId);

    if (error) return { success: false, error: error.message };
    return { success: true, newExpiresAt: newExpiresAt.toISOString() };
};

/**
 * 이름 + 전화번호 + 코드(선택)로 이용권 검색
 * 기존 회원 찾기용: 랜딩 페이지에서 사용
 */
export type MemberSearchResult = {
    id: string;
    code: string;
    plan: string;
    expiresAt: string | null;
    userName: string | null;
    userPhone: string | null;
    issuedBy: string | null;
    tier: TierType;
    isExpired: boolean;
    daysLeft?: number;
};

export const searchLicenseByNamePhone = async ({
    name, phone, code,
}: {
    name?: string;
    phone?: string;
    code?: string;
}): Promise<MemberSearchResult[]> => {
    const now = new Date();

    const toResult = (d: {
        id: string; code: string; plan: string; tier?: string | null;
        expires_at: string | null; user_name: string | null; user_phone: string | null; issued_by: string | null;
    }): MemberSearchResult => {
        const exp = d.expires_at ? new Date(d.expires_at) : null;
        return {
            id: d.id, code: d.code, plan: d.plan,
            expiresAt: d.expires_at, userName: d.user_name, userPhone: d.user_phone,
            issuedBy: d.issued_by,
            tier: (d.tier === 'premium') ? 'premium' : 'standard',
            isExpired: exp ? now > exp : false,
            daysLeft: exp ? Math.ceil((exp.getTime() - now.getTime()) / 86_400_000) : undefined,
        };
    };

    // 코드 직접 검색 (가장 정확)
    if (code && code.trim().replace(/\D/g, '').length === 0 && code.trim().length >= 5) {
        const { data } = await supabase
            .from('aone_pro_caddypro_licenses')
            .select('id, code, plan, tier, expires_at, user_name, user_phone, issued_by')
            .ilike('code', code.trim())
            .maybeSingle();
        return data ? [toResult(data)] : [];
    }

    const hasPhone = phone && phone.replace(/\D/g, '').length >= 9;
    const hasName = name && name.trim().length >= 1;
    const hasCode = code && code.trim().length >= 5;

    if (!hasPhone && !hasName && !hasCode) return [];

    // 코드 포함 시 → 코드 우선 exact match
    if (hasCode) {
        const { data } = await supabase
            .from('aone_pro_caddypro_licenses')
            .select('id, code, plan, tier, expires_at, user_name, user_phone')
            .ilike('code', code!.trim())
            .maybeSingle();
        return data ? [toResult(data)] : [];
    }

    // 이름 + 전화번호 복합 검색
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
        .from('aone_pro_caddypro_licenses')
        .select('id, code, plan, tier, expires_at, user_name, user_phone, issued_by')
        .order('expires_at', { ascending: false })
        .limit(20);

    if (hasPhone) {
        const digits = phone!.replace(/\D/g, '');
        // 하이픈 포함 형식으로도 변환 (010-XXXX-XXXX)
        const hyphenated = digits.length === 11
            ? `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`
            : digits.length === 10
            ? `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`
            : digits;
        query = query.or(`user_phone.eq.${digits},user_phone.eq.${hyphenated}`);
    }
    if (hasName) {
        query = query.ilike('user_name', `%${name!.trim()}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(toResult);
};
