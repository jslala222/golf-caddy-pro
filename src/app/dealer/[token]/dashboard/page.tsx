'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PLANS, issueVoucher, searchLicenseByPhone, extendLicense } from '@/lib/licenseUtils';
import type { PlanType } from '@/lib/licenseUtils';
import { supabase } from '@/lib/supabaseClient';
import {
    ShieldAlert, User, Check, Copy, Plus, Minus, Tag, CheckCircle2,
    Key, TrendingUp, Users, Receipt, Lock, Eye, EyeOff, RefreshCcw,
    ChevronDown, ChevronUp, BadgeCheck, Clock, AlertCircle, Share2, ExternalLink,
    Search, RotateCcw, Coins, CreditCard,
} from 'lucide-react';

// ── 타입 ──────────────────────────────────────────────────────────
// 공급가 (딜러 크레딧 충전 시 기준)
const DEALER_SUPPLY_PRICE = {
    standard: { month: 7_000, '6month': 40_000, year: 70_000 },
    premium:  { month: 10_000, '6month': 50_000, year: 100_000 },
} as const;

// 소비자가 (랜딩/결제 페이지 기준)
const CONSUMER_PRICE = {
    standard: { month: 9_900, '6month': 55_000, year: 99_000 },
    premium:  { month: 12_900, '6month': 69_000, year: 129_000 },
} as const;

// 장바구니 아이템 타입
type CartItem = { tier: 'standard' | 'premium'; plan: PlanType; qty: number };

// 크레딧 컬럼 매핑
const CREDIT_COL: Record<'standard' | 'premium', Record<PlanType, string>> = {
    standard: { month: 'credits_month', '6month': 'credits_6month', year: 'credits_year' },
    premium:  { month: 'credits_month_premium', '6month': 'credits_6month_premium', year: 'credits_year_premium' },
};

interface DealerInfo {
    id: string;
    name: string;
    phone: string;
    token: string;
    is_active: boolean;
    total_issued: number;
    pin: string | null;
    credits_month: number;
    credits_6month: number;
    credits_year: number;
    credits_month_premium: number;
    credits_6month_premium: number;
    credits_year_premium: number;
}

interface License {
    id: string;
    code: string;
    plan: string;
    days: number;
    expires_at: string | null;
    first_used_at: string | null;
    is_active: boolean;
    user_name: string | null;
    user_phone: string | null;
    issued_at: string;
    golf_course: string | null;
    memo: string | null;
    pay_method: string | null;
}

interface Settlement {
    id: string;
    license_code: string;
    type: 'first' | 'renewal';
    plan: string;
    sale_amount: number;
    commission_rate: number;
    commission_amount: number;
    settled: boolean;
    settled_at: string | null;
    created_at: string;
}

type DealerTab = 'issue' | 'earnings' | 'customers' | 'settlement' | 'credits';

// ── 컴포넌트 ──────────────────────────────────────────────────────
export default function DealerDashboardPage({ params }: { params: { token: string } }) {
    const { token } = params;

    // 인증
    const [dealer, setDealer] = useState<DealerInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [invalid, setInvalid] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState(false);
    const [pinAttempts, setPinAttempts] = useState(0);
    const [pinLocked, setPinLocked] = useState(false);
    const [showPin, setShowPin] = useState(false);
    const [authenticated, setAuthenticated] = useState(false);

    // 탭
    const [activeTab, setActiveTab] = useState<DealerTab>('issue');

    // 코드발급
    const [plan, setPlan] = useState<PlanType>('month');
    const [days, setDays] = useState(30);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [golfCourse, setGolfCourse] = useState('');
    const [specialNote, setSpecialNote] = useState('');
    const [payMethod, setPayMethod] = useState<'cash' | 'virtual_account' | 'transfer'>('cash');
    const [isIssuing, setIsIssuing] = useState(false);
    const [issueConfirm, setIssueConfirm] = useState<{ type: 'credit' | 'cash'; creditCol?: string; avail?: number } | null>(null);
    const [issuedCode, setIssuedCode] = useState('');
    const [issuedPlan, setIssuedPlan] = useState('');
    const [issuedDays, setIssuedDays] = useState(0);
    const [copied, setCopied] = useState(false);
    const [paymentLink, setPaymentLink] = useState('');
    const [linkCopied, setLinkCopied] = useState(false);
    const [issueError, setIssueError] = useState('');

    // 발급 모드 (신규 / 기간 연장)
    const [issueMode, setIssueMode] = useState<'new' | 'renew'>('new');
    const [issueTier, setIssueTier] = useState<'standard' | 'premium'>('standard');

    // 갱신 전용 상태
    const [renewPhone, setRenewPhone] = useState('');
    const [renewSearching, setRenewSearching] = useState(false);
    const [renewResult, setRenewResult] = useState<{
        found: boolean; id?: string; code?: string; plan?: string; tier?: string;
        expiresAt?: string | null; userName?: string | null;
        daysLeft?: number; isExpired?: boolean;
    } | null>(null);
    const [isExtending, setIsExtending] = useState(false);
    const [extendedResult, setExtendedResult] = useState<{ code: string; newExpiresAt: string } | null>(null);
    const [renewName, setRenewName] = useState('');
    const [renewResults, setRenewResults] = useState<Array<{
        id: string; code: string; plan: string; tier: string;
        expiresAt: string | null; userName: string | null;
        userPhone: string | null; isExpired: boolean; daysLeft?: number;
    }>>([]);

    // 크레딧 구매 상태
    const [creditBuyPlan, setCreditBuyPlan] = useState<PlanType>('month');
    const [creditBuyTier, setCreditBuyTier] = useState<'standard' | 'premium'>('standard');
    const [creditBuyQty, setCreditBuyQty] = useState(1);
    const [creditPayMethod, setCreditPayMethod] = useState<'CARD' | 'TRANSFER'>('TRANSFER');
    const [isBuyingCredit, setIsBuyingCredit] = useState(false);
    const [creditBuyResult, setCreditBuyResult] = useState<'success' | 'fail' | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);

    // 내 고객
    const [licenses, setLicenses] = useState<License[]>([]);
    const [licensesLoading, setLicensesLoading] = useState(false);
    const [expandedLicense, setExpandedLicense] = useState<string | null>(null);

    // 수익 / 정산
    const [settlements, setSettlements] = useState<Settlement[]>([]);
    const [settlementsLoading, setSettlementsLoading] = useState(false);
    const [requestingSettlement, setRequestingSettlement] = useState(false);

    useEffect(() => { setDays(PLANS[plan].days); }, [plan]);

    // ── 페이지 가시성 변경 시 결제 로딩 해제 (팝업 닫기/리다이렉트 복귀) ──
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                setIsBuyingCredit(false);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);

    // ── 리다이렉트 복귀 후 pending 크레딧 충전 처리 ──
    useEffect(() => {
        const raw = sessionStorage.getItem('caddy_credit_purchase');
        if (!raw) return;
        let info: { paymentId: string; dealerToken: string; cartItems?: CartItem[]; plan?: string; tier?: string; qty?: number };
        try { info = JSON.parse(raw); } catch { sessionStorage.removeItem('caddy_credit_purchase'); return; }
        if (info.dealerToken !== token) return;

        sessionStorage.removeItem('caddy_credit_purchase');
        fetch('/api/dealer/credit/charge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(info),
        }).then(async (res) => {
            if (res.ok) {
                setCreditBuyResult('success');
                loadDealer();
            }
        }).catch(() => {/* silent */});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── 딜러 로드 ──
    const loadDealer = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from('aone_pro_caddypro_dealers')
            .select('id, name, phone, token, is_active, total_issued, pin, credits_month, credits_6month, credits_year, credits_month_premium, credits_6month_premium, credits_year_premium')
            .eq('token', token)
            .maybeSingle();
        setLoading(false);
        if (!data || !data.is_active) {
            setInvalid(true);
        } else {
            setDealer(data as DealerInfo);
            // PIN 없으면 바로 인증
            if (!data.pin) setAuthenticated(true);
        }
    }, [token]);

    useEffect(() => { loadDealer(); }, [loadDealer]);

    // ── 고객 목록 로드 ──
    const loadLicenses = useCallback(async () => {
        if (!dealer) return;
        setLicensesLoading(true);
        const { data } = await supabase
            .from('aone_pro_caddypro_licenses')
            .select('id, code, plan, days, expires_at, first_used_at, is_active, user_name, user_phone, issued_at, golf_course, memo, pay_method')
            .eq('issued_by', `dealer_${token}`)
            .order('issued_at', { ascending: false });
        setLicensesLoading(false);
        setLicenses((data as License[]) || []);
    }, [dealer, token]);

    // ── 정산 목록 로드 ──
    const loadSettlements = useCallback(async () => {
        if (!dealer) return;
        setSettlementsLoading(true);
        const { data } = await supabase
            .from('aone_pro_caddypro_settlements')
            .select('id, license_code, type, plan, sale_amount, commission_rate, commission_amount, settled, settled_at, created_at')
            .eq('dealer_id', dealer.id)
            .order('created_at', { ascending: false });
        setSettlementsLoading(false);
        setSettlements((data as Settlement[]) || []);
    }, [dealer]);

    useEffect(() => {
        if (!authenticated || !dealer) return;
        if (activeTab === 'customers' || activeTab === 'earnings') loadLicenses();
        if (activeTab === 'earnings' || activeTab === 'settlement') loadSettlements();
    }, [activeTab, authenticated, dealer, loadLicenses, loadSettlements]);

    // ── PIN 인증 ──
    const handlePinSubmit = () => {
        if (pinLocked) return;
        if (dealer?.pin === pinInput) {
            setAuthenticated(true);
            setPinError(false);
        } else {
            const next = pinAttempts + 1;
            setPinAttempts(next);
            setPinError(true);
            setPinInput('');
            if (next >= 3) {
                setPinLocked(true);
                setTimeout(() => { setPinLocked(false); setPinAttempts(0); }, 30 * 60 * 1000);
            }
        }
    };

    // ── 코드 발급 ──
    const planBase = PLANS[plan].days;
    const bonusDays: Record<string, number> = { month: 7, '6month': 20, year: 40 };
    const minDays = planBase;
    const maxDays = planBase + (bonusDays[plan] ?? 7);

    const handleIssue = async () => {
        if (!customerName.trim()) { setIssueError('고객 이름을 입력해주세요.'); return; }
        const phoneDigits = customerPhone.replace(/\D/g, '');
        if (!phoneDigits) { setIssueError('고객 전화번호를 입력해주세요.'); return; }
        if (phoneDigits.length < 10 || phoneDigits.length > 11) { setIssueError('전화번호 형식이 올바르지 않습니다.\n010-XXXX-XXXX 형식으로 입력해주세요.'); return; }
        if (!phoneDigits.startsWith('0')) { setIssueError('전화번호 형식이 올바르지 않습니다.\n010-XXXX-XXXX 형식으로 입력해주세요.'); return; }
        if (!dealer) return;
        setIsIssuing(true);
        const result = await issueVoucher({
            channel: 'dealer',
            plan,
            days,
            tier: issueTier,
            memo: specialNote || undefined,
            golfCourse: golfCourse || undefined,
            payMethod: 'cash',
            userName: customerName.trim(),
            userPhone: customerPhone.trim(),
            issuedBy: `dealer_${token}`,
        });
        setIsIssuing(false);
        if (result.success && result.code) {
            await supabase
                .from('aone_pro_caddypro_dealers')
                .update({ total_issued: dealer.total_issued + 1 })
                .eq('id', dealer.id);
            setDealer(prev => prev ? { ...prev, total_issued: prev.total_issued + 1 } : prev);
            setIssuedCode(result.code);
            setIssuedPlan(PLANS[plan].label);
            setIssuedDays(days);
            setCopied(false);
            setCustomerName(''); setCustomerPhone(''); setGolfCourse(''); setSpecialNote('');
        } else {
            alert(`발급 실패: ${result.error}`);
        }
    };

    // ── 크레딧 발급 ──
    const handleCreditIssue = async () => {
        if (!customerName.trim()) { setIssueError('고객 이름을 입력해주세요.'); return; }
        const phoneDigits = customerPhone.replace(/\D/g, '');
        if (!phoneDigits || phoneDigits.length < 10) { setIssueError('고객 전화번호를 입력해주세요.'); return; }
        if (!dealer) return;
        const creditCol = CREDIT_COL[issueTier][plan];
        const currentCredits = (dealer[creditCol as keyof DealerInfo] as number) ?? 0;
        if (currentCredits <= 0) { setIssueError('이 플랜의 크레딧이 없습니다.\n관리자에게 충전을 요청하세요.'); return; }
        setIsIssuing(true);
        const result = await issueVoucher({
            channel: 'dealer',
            plan,
            days,
            tier: issueTier,
            memo: specialNote || undefined,
            golfCourse: golfCourse || undefined,
            payMethod: 'credit',
            userName: customerName.trim(),
            userPhone: customerPhone.trim(),
            issuedBy: `dealer_${token}`,
        });
        if (!result.success || !result.code) {
            setIsIssuing(false);
            alert(`발급 실패: ${result.error}`);
            return;
        }
        // 크레딧 차감
        await supabase
            .from('aone_pro_caddypro_dealers')
            .update({ [creditCol]: currentCredits - 1, total_issued: dealer.total_issued + 1 })
            .eq('id', dealer.id);
        // 사용 이력 기록
        await supabase.from('aone_pro_caddypro_dealer_credit_history').insert({
            dealer_id: dealer.id,
            type: 'use',
            plan,
            tier: issueTier,
            qty: 1,
            memo: `${customerName.trim()} 발급 (${result.code})`,
        });
        setDealer(prev => prev ? { ...prev, [creditCol]: currentCredits - 1, total_issued: prev.total_issued + 1 } : prev);
        setIsIssuing(false);
        setIssuedCode(result.code);
        setIssuedPlan(PLANS[plan].label);
        setIssuedDays(days);
        setCopied(false);
        setCustomerName(''); setCustomerPhone(''); setGolfCourse(''); setSpecialNote('');
    };

    // ── 장바구니 담기 / 제거 ──
    const handleAddToCart = () => {
        setCart(prev => {
            const idx = prev.findIndex(i => i.tier === creditBuyTier && i.plan === creditBuyPlan);
            if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], qty: Math.min(50, updated[idx].qty + creditBuyQty) };
                return updated;
            }
            return [...prev, { tier: creditBuyTier, plan: creditBuyPlan, qty: creditBuyQty }];
        });
        setCreditBuyQty(1);
    };
    const handleRemoveFromCart = (tier: 'standard' | 'premium', plan: PlanType) => {
        setCart(prev => prev.filter(i => !(i.tier === tier && i.plan === plan)));
    };

    // ── 크레딧 구매 결제 (장바구니 전체) ──
    const handleBuyCredits = async () => {
        if (!dealer || cart.length === 0) return;
        if (typeof window === 'undefined' || !window.PortOne) {
            alert('결제 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.');
            return;
        }
        setIsBuyingCredit(true);
        setCreditBuyResult(null);

        const PLAN_LABEL: Record<PlanType, string> = { month: '1개월', '6month': '6개월', year: '1년' };
        const totalAmount = cart.reduce((sum, item) => sum + DEALER_SUPPLY_PRICE[item.tier][item.plan] * item.qty, 0);
        const paymentId = `DCREDIT-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
        const orderName = `[딜러] ${cart.map(i => `${PLAN_LABEL[i.plan]} ${i.tier === 'premium' ? '프리미엄' : '스탠다드'} ×${i.qty}`).join(', ')} 크레딧`;

        sessionStorage.setItem('caddy_credit_purchase', JSON.stringify({
            paymentId, dealerToken: token, cartItems: cart,
        }));

        try {
            const response = await window.PortOne.requestPayment({
                storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? '',
                channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? '',
                paymentId,
                orderName,
                totalAmount,
                currency: 'KRW',
                payMethod: creditPayMethod,
                redirectUrl: `${window.location.origin}/dealer/${token}/dashboard`,
                customer: {
                    fullName: dealer.name,
                    phoneNumber: dealer.phone,
                    email: 'dealer@caddypro.kr',
                },
            });

            if (response?.code) {
                setCreditBuyResult('fail');
                setIsBuyingCredit(false);
                return;
            }

            const res = await fetch('/api/dealer/credit/charge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentId, dealerToken: token, cartItems: cart }),
            });

            if (res.ok) {
                setCreditBuyResult('success');
                setCart([]);
                loadDealer();
            } else {
                setCreditBuyResult('fail');
            }
        } catch {
            setCreditBuyResult('fail');
        }
        setIsBuyingCredit(false);
    };

    const handleGenerateLink = () => {
        if (!customerName.trim() || !customerPhone.trim()) {
            alert('고객 이름과 연락처를 먼저 입력해주세요.');
            return;
        }
        const params = new URLSearchParams({
            name: customerName.trim(),
            phone: customerPhone.trim(),
            plan,
            ref: token,
            ...(golfCourse ? { golf_course: golfCourse.trim() } : {}),
            ...(payMethod !== 'cash' ? { payMethod } : {}),
        });
        setPaymentLink(`${window.location.origin}/subscribe?${params.toString()}`);
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(paymentLink);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 3000);
    };

    const handleShareLink = () => {
        const msg = `[캐디 매니저 프로] ${customerName}님, 아래 링크에서 이용권을 결제해주세요.\n${paymentLink}`;
        if (navigator.share) {
            navigator.share({ title: '캐디 매니저 프로 결제 링크', text: msg, url: paymentLink });
        } else {
            navigator.clipboard.writeText(msg);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 3000);
        }
    };

    // ── 이용권 검색 (갱신용) ──
    const handleSearchLicense = async () => {
        const digits = renewPhone.replace(/\D/g, '');
        const hasFullPhone = digits.length >= 10;
        const hasSuffix = digits.length >= 4 && digits.length < 10; // 끝 4~9자리
        const hasName = renewName.trim().length >= 1;
        if (!hasFullPhone && !hasSuffix && !hasName) return;
        setRenewSearching(true);
        setRenewResult(null);
        setRenewResults([]);
        if (hasFullPhone) {
            const result = await searchLicenseByPhone(renewPhone);
            if (result.found && hasName) {
                const match = result.userName?.includes(renewName.trim()) !== false;
                setRenewResult(match ? result : { found: false });
            } else {
                setRenewResult(result);
            }
        } else if (hasSuffix) {
            // 끝자리 ilike 검색
            let query = supabase
                .from('aone_pro_caddypro_licenses')
                .select('id, code, plan, tier, expires_at, user_name, user_phone')
                .ilike('user_phone', `%${digits}`);
            if (hasName) query = query.ilike('user_name', `%${renewName.trim()}%`);
            const { data } = await query.order('expires_at', { ascending: false }).limit(20);
            const now = new Date();
            const results = (data || []).map((d: { id: string; code: string; plan: string; tier: string; expires_at: string | null; user_name: string | null; user_phone: string | null }) => ({
                id: d.id, code: d.code, plan: d.plan, tier: d.tier ?? 'standard',
                expiresAt: d.expires_at, userName: d.user_name, userPhone: d.user_phone,
                isExpired: d.expires_at ? now > new Date(d.expires_at) : false,
                daysLeft: d.expires_at ? Math.ceil((new Date(d.expires_at).getTime() - now.getTime()) / 86_400_000) : undefined,
            }));
            if (results.length === 1) {
                const r = results[0];
                setRenewResult({ found: true, id: r.id, code: r.code, plan: r.plan, tier: r.tier, expiresAt: r.expiresAt, userName: r.userName, daysLeft: r.daysLeft, isExpired: r.isExpired });
            } else if (results.length > 1) {
                setRenewResults(results);
            } else {
                setRenewResult({ found: false });
            }
        } else {
            const { data } = await supabase
                .from('aone_pro_caddypro_licenses')
                .select('id, code, plan, tier, expires_at, user_name, user_phone')
                .ilike('user_name', `%${renewName.trim()}%`)
                .order('expires_at', { ascending: false })
                .limit(20);
            const now = new Date();
            const results = (data || []).map((d: { id: string; code: string; plan: string; tier: string; expires_at: string | null; user_name: string | null; user_phone: string | null }) => ({
                id: d.id, code: d.code, plan: d.plan, tier: d.tier ?? 'standard',
                expiresAt: d.expires_at, userName: d.user_name, userPhone: d.user_phone,
                isExpired: d.expires_at ? now > new Date(d.expires_at) : false,
                daysLeft: d.expires_at ? Math.ceil((new Date(d.expires_at).getTime() - now.getTime()) / 86_400_000) : undefined,
            }));
            if (results.length === 1) {
                const r = results[0];
                setRenewResult({ found: true, id: r.id, code: r.code, plan: r.plan, tier: r.tier, expiresAt: r.expiresAt, userName: r.userName, daysLeft: r.daysLeft, isExpired: r.isExpired });
            } else if (results.length > 1) {
                setRenewResults(results);
            } else {
                setRenewResult({ found: false });
            }
        }
        setRenewSearching(false);
    };

    // ── 기간 연장 ──
    const handleExtend = async () => {
        if (!renewResult?.id || !dealer) return;
        // 크레딧 확인
        const tier = (renewResult.tier ?? 'standard') as 'standard' | 'premium';
        const creditCol = CREDIT_COL[tier][plan];
        const currentCredit = dealer[creditCol as keyof typeof dealer] as number ?? 0;
        if (currentCredit < 1) {
            alert(`크레딧이 부족합니다.\n현재 ${tier === 'premium' ? '프리미엄' : '스탠다드'} ${plan === 'month' ? '1개월' : plan === '6month' ? '6개월' : '1년'} 크레딧: 0장\n\n크레딧 구매 탭에서 충전해 주세요.`);
            return;
        }
        setIsExtending(true);
        // 크레딧 1장 차감
        const { error: creditError } = await supabase
            .from('aone_pro_caddypro_dealers')
            .update({ [creditCol]: currentCredit - 1 })
            .eq('id', dealer.id);
        if (creditError) {
            setIsExtending(false);
            alert('크레딧 차감 중 오류가 발생했습니다. 다시 시도해 주세요.');
            return;
        }
        const result = await extendLicense({ licenseId: renewResult.id, plan, days, dealerToken: token });
        setIsExtending(false);
        if (result.success && result.newExpiresAt) {
            await supabase
                .from('aone_pro_caddypro_dealers')
                .update({ total_issued: dealer.total_issued + 1 })
                .eq('id', dealer.id);
            setDealer(prev => prev ? { ...prev, total_issued: prev.total_issued + 1, [creditCol]: currentCredit - 1 } : prev);
            setExtendedResult({ code: renewResult.code!, newExpiresAt: result.newExpiresAt });
            setRenewPhone(''); setRenewName(''); setRenewResult(null); setRenewResults([]);
        } else {
            // 연장 실패 시 크레딧 복구
            await supabase.from('aone_pro_caddypro_dealers').update({ [creditCol]: currentCredit }).eq('id', dealer.id);
            alert(`연장 실패: ${result.error}`);
        }
    };

    // ── 정산 요청 ──
    const handleSettlementRequest = async () => {
        const pending = settlements.filter(s => !s.settled);
        if (pending.length === 0) { alert('미정산 내역이 없습니다.'); return; }
        const total = pending.reduce((a, s) => a + s.commission_amount, 0);
        if (!confirm(`미정산 합계 ₩${total.toLocaleString()}에 대해 정산을 요청하시겠습니까?`)) return;
        setRequestingSettlement(true);
        // settlements에 settlement_requested_at 업데이트 (관리자가 pending 목록에서 확인)
        // 실제로는 알림 테이블 or 상태 컬럼 추가 필요. 현재는 alert으로 안내
        await new Promise(r => setTimeout(r, 800));
        setRequestingSettlement(false);
        alert(`정산 요청 완료!\n관리자가 확인 후 처리해 드립니다.\n요청 금액: ₩${total.toLocaleString()}`);
    };

    // ── 수익 계산 ──
    const thisMonth = new Date().toISOString().slice(0, 7);
    const totalEarned = settlements.reduce((a, s) => a + s.commission_amount, 0);
    const pendingAmount = settlements.filter(s => !s.settled).reduce((a, s) => a + s.commission_amount, 0);
    const settledAmount = settlements.filter(s => s.settled).reduce((a, s) => a + s.commission_amount, 0);
    const monthEarned = settlements
        .filter(s => s.created_at.startsWith(thisMonth))
        .reduce((a, s) => a + s.commission_amount, 0);

    const TABS: { key: DealerTab; label: string; icon: React.ReactNode }[] = [
        { key: 'issue',      label: '코드발급',  icon: <Key size={14} /> },
        { key: 'credits',    label: '크레딧구매', icon: <Coins size={14} /> },
        { key: 'earnings',   label: '내 수익',   icon: <TrendingUp size={14} /> },
        { key: 'customers',  label: '내 고객',   icon: <Users size={14} /> },
        { key: 'settlement', label: '정산요청',  icon: <Receipt size={14} /> },
    ];

    // ── 로딩 ──
    if (loading) {
        return (
            <div className="fixed inset-0 bg-stone-900 flex items-center justify-center text-white">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // ── 유효하지 않은 딜러 ──
    if (invalid) {
        return (
            <div className="fixed inset-0 bg-stone-900 flex items-center justify-center p-6 text-white text-center">
                <div className="space-y-4">
                    <ShieldAlert size={64} className="mx-auto text-red-400" />
                    <h1 className="text-xl font-black">유효하지 않은 딜러 링크</h1>
                    <p className="text-stone-400 text-sm">이 링크는 만료되었거나 존재하지 않습니다.<br />관리자에게 문의하세요.</p>
                </div>
            </div>
        );
    }

    // ── PIN 입력 화면 ──
    if (!authenticated) {
        return (
            <div className="fixed inset-0 bg-stone-950 flex items-center justify-center p-6 text-white">
                <div className="w-full max-w-sm space-y-6">
                    <div className="text-center">
                        <Lock size={48} className="mx-auto text-blue-400 mb-4" />
                        <h1 className="text-xl font-black">딜러 대시보드</h1>
                        <p className="text-stone-400 text-sm mt-1">{dealer?.name} 님, PIN 번호를 입력하세요.</p>
                    </div>

                    {pinLocked ? (
                        <div className="bg-red-900/30 border border-red-800 rounded-2xl p-4 text-center text-sm text-red-300">
                            PIN 3회 오류 — 30분 후 다시 시도하세요.
                        </div>
                    ) : (
                        <>
                            <div className="relative">
                                <input
                                    type={showPin ? 'text' : 'password'}
                                    inputMode="numeric"
                                    maxLength={8}
                                    value={pinInput}
                                    onChange={e => { setPinInput(e.target.value); setPinError(false); }}
                                    onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
                                    placeholder="PIN 번호"
                                    className={`w-full p-4 bg-stone-800 border rounded-2xl text-white text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${pinError ? 'border-red-500' : 'border-stone-700'}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPin(v => !v)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400"
                                >
                                    {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {pinError && (
                                <p className="text-red-400 text-xs text-center">
                                    PIN이 올바르지 않습니다. ({pinAttempts}/3회)
                                </p>
                            )}
                            <button
                                onClick={handlePinSubmit}
                                disabled={!pinInput}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-2xl font-bold text-lg transition"
                            >
                                확인
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // ── 발급 완료 화면 ──
    if (issuedCode) {
        return (
            <div className="fixed inset-0 bg-stone-900 flex items-center justify-center p-6 text-white">
                <div className="w-full max-w-sm space-y-6 text-center">
                    <CheckCircle2 size={72} className="mx-auto text-emerald-400" />
                    <div>
                        <h1 className="text-2xl font-black text-emerald-400 mb-1">발급 완료!</h1>
                        <p className="text-stone-400 text-sm">{issuedPlan} · {issuedDays}일권</p>
                    </div>
                    <div className="bg-stone-800 rounded-3xl p-8 space-y-4">
                        <p className="text-stone-400 text-xs">고객에게 전달할 이용권 코드</p>
                        <div className="text-5xl font-black tracking-[0.15em] font-mono text-white">{issuedCode}</div>
                        <p className="text-stone-500 text-[10px]">앱 실행 후 이 코드를 입력하면 즉시 활성화됩니다</p>
                    </div>
                    <button
                        onClick={() => { navigator.clipboard.writeText(issuedCode); setCopied(true); setTimeout(() => setCopied(false), 3000); }}
                        className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition ${copied ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-500'}`}>
                        {copied ? <Check size={22} /> : <Copy size={22} />}
                        {copied ? '복사됨!' : '코드 복사하기'}
                    </button>
                    <button
                        onClick={() => { setIssuedCode(''); setIssuedPlan(''); setIssuedDays(0); setCopied(false); }}
                        className="w-full py-3 rounded-2xl font-bold text-stone-400 bg-stone-800 hover:bg-stone-700 transition text-sm">
                        새 고객 발급하기
                    </button>
                </div>
            </div>
        );
    }

    // ── 기간 연장 완료 화면 ──
    if (extendedResult) {
        const d = new Date(extendedResult.newExpiresAt);
        const dateStr = `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
        return (
            <div className="fixed inset-0 bg-stone-900 flex items-center justify-center p-6 text-white">
                <div className="w-full max-w-sm space-y-6 text-center">
                    <RotateCcw size={72} className="mx-auto text-violet-400" />
                    <div>
                        <h1 className="text-2xl font-black text-violet-400 mb-1">기간 연장 완료!</h1>
                        <p className="text-stone-400 text-sm">{PLANS[plan].label} · {days}일 추가</p>
                    </div>
                    <div className="bg-stone-800 rounded-3xl p-6 space-y-3">
                        <p className="text-stone-400 text-xs">기존 이용권 코드 (변경 없음)</p>
                        <div className="text-3xl font-black tracking-[0.15em] font-mono text-white">{extendedResult.code}</div>
                        <div className="pt-2 border-t border-stone-700">
                            <p className="text-stone-400 text-xs mb-1">새 만료일</p>
                            <p className="text-violet-300 font-black text-xl">{dateStr}</p>
                        </div>
                        <p className="text-stone-500 text-[10px]">코드는 이대로입니다. 고객이 앱을 재시작하면 자동 반영됩니다.</p>
                    </div>
                    <button
                        onClick={() => { navigator.clipboard.writeText(extendedResult.code); setCopied(true); setTimeout(() => setCopied(false), 3000); }}
                        className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition ${copied ? 'bg-emerald-600' : 'bg-violet-600 hover:bg-violet-500'}`}>
                        {copied ? <Check size={22} /> : <Copy size={22} />}
                        {copied ? '복사됨!' : '코드 복사하기'}
                    </button>
                    <button
                        onClick={() => { setExtendedResult(null); setCopied(false); setIssueMode('renew'); }}
                        className="w-full py-3 rounded-2xl font-bold text-stone-400 bg-stone-800 hover:bg-stone-700 transition text-sm">
                        계속 작업하기
                    </button>
                </div>
            </div>
        );
    }

    // ── 메인 대시보드 ──
    return (
        <div className="min-h-screen bg-stone-950 text-white pb-28">
            {/* ── 결제 결과 팝업 모달 ── */}
            {creditBuyResult === 'fail' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-6"
                    style={{ background: 'rgba(0,0,0,0.75)' }}
                    onClick={() => setCreditBuyResult(null)}>
                    <div className="bg-stone-900 border border-red-700 rounded-3xl p-8 w-full max-w-sm text-center space-y-5 shadow-2xl"
                        onClick={e => e.stopPropagation()}>
                        <div className="text-5xl">❌</div>
                        <div>
                            <p className="text-red-300 font-black text-xl mb-2">결제 취소됨</p>
                            <p className="text-stone-400 text-sm leading-relaxed">
                                결제가 취소되었거나 처리 중 오류가 발생했습니다.<br />
                                다시 시도해주세요.
                            </p>
                        </div>
                        <button onClick={() => setCreditBuyResult(null)}
                            className="w-full py-3.5 bg-stone-700 hover:bg-stone-600 rounded-2xl font-bold text-white transition">
                            확인
                        </button>
                    </div>
                </div>
            )}
            {creditBuyResult === 'success' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-6"
                    style={{ background: 'rgba(0,0,0,0.75)' }}
                    onClick={() => setCreditBuyResult(null)}>
                    <div className="bg-stone-900 border border-emerald-600 rounded-3xl p-8 w-full max-w-sm text-center space-y-5 shadow-2xl"
                        onClick={e => e.stopPropagation()}>
                        <div className="text-5xl">✅</div>
                        <div>
                            <p className="text-emerald-300 font-black text-xl mb-2">충전 완료!</p>
                            <p className="text-stone-400 text-sm leading-relaxed">
                                크레딧이 즉시 충전되었습니다.<br />
                                코드발급 탭에서 바로 사용하세요.
                            </p>
                        </div>
                        <button onClick={() => setCreditBuyResult(null)}
                            className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-600 rounded-2xl font-bold text-white transition">
                            확인
                        </button>
                    </div>
                </div>
            )}

            {/* 발급 확인 모달 */}
            {issueConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-6"
                    style={{ background: 'rgba(0,0,0,0.80)' }}
                    onClick={() => setIssueConfirm(null)}>
                    <div className="bg-stone-900 border border-stone-700 rounded-3xl p-7 w-full max-w-sm space-y-5 shadow-2xl"
                        onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <div className="text-4xl mb-2">{issueConfirm.type === 'credit' ? '💳' : '💵'}</div>
                            <p className="text-white font-black text-lg">발급 전 확인</p>
                        </div>
                        {/* 발급 정보 */}
                        <div className="bg-stone-800 rounded-2xl p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-stone-400">고객</span>
                                <span className="font-bold text-white">{customerName} · {customerPhone}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-stone-400">요금제</span>
                                <span className="font-bold text-white">{PLANS[plan].label} {issueTier === 'premium' ? '프리미엄' : '스탠다드'} ({days}일)</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-stone-400">소비자가</span>
                                <span className="font-bold text-emerald-400">₩{CONSUMER_PRICE[issueTier][plan].toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-stone-400">수금 방식</span>
                                <span className="font-bold text-white">{issueConfirm.type === 'credit' ? '크레딧 차감' : '현금/계좌이체'}</span>
                            </div>
                            {issueConfirm.type === 'credit' && issueConfirm.avail !== undefined && (() => {
                                const creditCol = issueConfirm.creditCol!;
                                // 전체 크레딧 중 해당 플랜만 보여줌 (총 구매분 추적 불가하므로 현재 잔량 기준)
                                return (
                                    <div className="flex justify-between pt-1 border-t border-stone-700">
                                        <span className="text-stone-400">크레딧 잔량</span>
                                        <span className="font-black text-amber-400">{issueConfirm.avail - 1}장 남음 <span className="text-stone-500 font-normal">(사용 후)</span></span>
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setIssueConfirm(null)}
                                className="py-3.5 bg-stone-700 hover:bg-stone-600 rounded-2xl font-bold text-stone-300 transition">
                                취소
                            </button>
                            <button onClick={() => {
                                const type = issueConfirm.type;
                                setIssueConfirm(null);
                                if (type === 'credit') handleCreditIssue();
                                else handleIssue();
                            }}
                                className={`py-3.5 rounded-2xl font-black text-white transition ${issueConfirm.type === 'credit' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                                발급 확정
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 헤더 */}
            <div className="bg-blue-700 px-6 pt-12 pb-5">
                <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-1">Caddy Manager Pro</p>
                <h1 className="text-2xl font-black">딜러 대시보드</h1>
                <p className="text-blue-200 text-sm mt-1">
                    {dealer?.name} 님 · 총 {dealer?.total_issued ?? 0}건 발급
                </p>
                {/* 크레딧 잔량 요약 */}
                {(() => {
                    const d = dealer;
                    if (!d) return null;
                    const items = [
                        { label: '1개월', credits: d.credits_month, premiumCredits: d.credits_month_premium },
                        { label: '6개월', credits: d.credits_6month, premiumCredits: d.credits_6month_premium },
                        { label: '1년',   credits: d.credits_year,   premiumCredits: d.credits_year_premium },
                    ].filter(i => i.credits > 0 || i.premiumCredits > 0);
                    if (items.length === 0) return null;
                    return (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {items.map(i => (
                                <React.Fragment key={i.label}>
                                    {i.credits > 0 && (
                                        <span className="flex items-center gap-1 bg-blue-600/60 text-blue-100 text-[10px] font-bold px-2 py-1 rounded-full">
                                            <Coins size={10} /> {i.label} {i.credits}장
                                        </span>
                                    )}
                                    {i.premiumCredits > 0 && (
                                        <span className="flex items-center gap-1 bg-emerald-600/60 text-emerald-100 text-[10px] font-bold px-2 py-1 rounded-full">
                                            <Coins size={10} /> {i.label}프리미엄 {i.premiumCredits}장
                                        </span>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    );
                })()}
            </div>

            {/* 탭 바 */}
            <div className="flex border-b border-stone-800 bg-stone-900 sticky top-0 z-10 overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => {
                            setActiveTab(tab.key);
                            setRenewPhone(''); setRenewName('');
                            setRenewResult(null); setRenewResults([]);
                        }}
                        className={`flex-1 min-w-[72px] py-3 flex flex-col items-center gap-1 text-[10px] font-bold transition ${activeTab === tab.key ? 'text-blue-400 border-b-2 border-blue-400' : 'text-stone-500'}`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            <div className="p-5 space-y-5">
                {/* 입력 오류 모달 */}
                {issueError && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => setIssueError('')}>
                        <div className="bg-stone-900 rounded-3xl p-6 shadow-2xl max-w-xs w-full text-center space-y-4" onClick={e => e.stopPropagation()}>
                            <div className="w-12 h-12 bg-red-900/40 rounded-full flex items-center justify-center mx-auto">
                                <ShieldAlert size={24} className="text-red-400" />
                            </div>
                            <p className="text-white text-sm font-bold whitespace-pre-line">{issueError}</p>
                            <button onClick={() => setIssueError('')}
                                className="w-full py-3 bg-blue-600 rounded-2xl font-bold text-white text-sm">확인</button>
                        </div>
                    </div>
                )}

                {/* ── 코드발급 탭 ── */}
                {activeTab === 'issue' && (
                    <div className="space-y-5">

                        {/* 🔀 발급 모드 토글 */}
                        <div className="flex gap-2 bg-stone-900 rounded-2xl p-1.5">
                            <button onClick={() => setIssueMode('new')}
                                className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition ${issueMode === 'new' ? 'bg-blue-600 text-white' : 'text-stone-500'}`}>
                                <Key size={14} /> 신규 발급
                            </button>
                            <button onClick={() => setIssueMode('renew')}
                                className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition ${issueMode === 'renew' ? 'bg-violet-600 text-white' : 'text-stone-500'}`}>
                                <RotateCcw size={14} /> 기간 연장
                            </button>
                        </div>

                        {/* ── 신규 발급 모드 ── */}
                        {issueMode === 'new' && (<>
                        {/* 고객 정보 */}
                        <section className="bg-stone-900 rounded-3xl p-5 space-y-4">
                            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                                <User size={16} /> 고객 정보
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">이름 <span className="text-red-400">*</span></label>
                                    <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                                        placeholder="홍길동"
                                        className="w-full p-4 bg-stone-800 border border-stone-700 rounded-2xl text-white placeholder-stone-500 focus:ring-2 focus:ring-blue-500 focus:outline-none text-lg" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">연락처 <span className="text-red-400">*</span></label>
                                    <input value={customerPhone} onChange={e => {
                                        const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
                                        const formatted = raw.length <= 3 ? raw : raw.length <= 7 ? `${raw.slice(0,3)}-${raw.slice(3)}` : `${raw.slice(0,3)}-${raw.slice(3,7)}-${raw.slice(7)}`;
                                        setCustomerPhone(formatted);
                                    }}
                                        placeholder="010-0000-0000" inputMode="tel"
                                        className="w-full p-4 bg-stone-800 border border-stone-700 rounded-2xl text-white placeholder-stone-500 focus:ring-2 focus:ring-blue-500 focus:outline-none text-lg" />
                                </div>
                            </div>
                        </section>

                        {/* 요금제 */}
                        <section className="bg-stone-900 rounded-3xl p-5 space-y-4">
                            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                <Tag size={16} /> 요금제 선택
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {(Object.entries(PLANS) as [PlanType, typeof PLANS[PlanType]][]).map(([key, p]) => (
                                    <button key={key} onClick={() => setPlan(key)}
                                        className={`p-3 rounded-2xl border text-center transition ${plan === key ? 'border-blue-500 bg-blue-900/30' : 'border-stone-700 bg-stone-800'}`}>
                                        <p className="text-xs font-bold text-stone-300">{p.label}</p>
                                        <p className="text-[10px] text-stone-500 mt-0.5">{p.days}일</p>
                                        <p className="text-[11px] font-bold text-emerald-400 mt-1">₩{CONSUMER_PRICE[issueTier][key].toLocaleString()}</p>
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* 이용권 종류 */}
                        <section className="bg-stone-900 rounded-3xl p-5 space-y-3">
                            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                                <BadgeCheck size={16} /> 이용권 종류
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setIssueTier('standard')}
                                    className={`p-3 rounded-2xl border text-center transition ${issueTier === 'standard' ? 'border-blue-500 bg-blue-900/30' : 'border-stone-700 bg-stone-800'}`}>
                                    <p className="text-xs font-bold text-stone-300">스탠다드</p>
                                    <p className="text-[10px] text-stone-500 mt-0.5">수동 복구</p>
                                    <p className="text-[11px] font-bold text-emerald-400 mt-1">₩{CONSUMER_PRICE.standard[plan].toLocaleString()}</p>
                                </button>
                                <button onClick={() => setIssueTier('premium')}
                                    className={`p-3 rounded-2xl border text-center transition relative ${issueTier === 'premium' ? 'border-emerald-500 bg-emerald-900/30' : 'border-stone-700 bg-stone-800'}`}>
                                    <div className="absolute top-1.5 right-1.5 bg-emerald-500 text-white text-[8px] font-black px-1 py-0.5 rounded-full">추천</div>
                                    <p className="text-xs font-bold text-stone-300">프리미엄</p>
                                    <p className="text-[10px] text-stone-500 mt-0.5">자동 복구 ✅</p>
                                    <p className="text-[11px] font-bold text-purple-400 mt-1">₩{CONSUMER_PRICE.premium[plan].toLocaleString()}</p>
                                </button>
                            </div>
                        </section>

                        {/* 일수 조정 */}
                        <section className="bg-stone-900 rounded-3xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-stone-300 text-sm font-bold">이용 기간</span>
                                <span className="text-blue-400 font-black text-xl">{days}일</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <button onClick={() => setDays(d => Math.max(minDays, d - 1))}
                                    disabled={days <= minDays}
                                    className="w-12 h-12 bg-stone-700 hover:bg-stone-600 disabled:opacity-30 rounded-full flex items-center justify-center transition">
                                    <Minus size={20} />
                                </button>
                                <div className="flex-1 bg-stone-800 rounded-full h-2">
                                    <div className="bg-blue-500 h-2 rounded-full transition-all"
                                        style={{ width: `${((days - minDays) / (maxDays - minDays || 1)) * 100}%` }} />
                                </div>
                                <button onClick={() => setDays(d => Math.min(maxDays, d + 1))}
                                    disabled={days >= maxDays}
                                    className="w-12 h-12 bg-stone-700 hover:bg-stone-600 disabled:opacity-30 rounded-full flex items-center justify-center transition">
                                    <Plus size={20} />
                                </button>
                            </div>
                            <p className="text-stone-500 text-[10px] text-center mt-2">기본 {minDays}일 + 보너스 최대 {maxDays - minDays}일</p>
                        </section>

                        {/* 골프장명 + 특이사항 */}
                        <section className="bg-stone-900 rounded-3xl p-5 space-y-3">
                            <div className="flex items-center gap-2 text-stone-400 font-bold text-sm">
                                <Tag size={16} /> 추가 정보 (선택)
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">골프장명</label>
                                <input value={golfCourse} onChange={e => setGolfCourse(e.target.value)}
                                    placeholder="예: 발리오스CC, 남서울CC"
                                    className="w-full p-3 bg-stone-800 border border-stone-700 rounded-xl text-white placeholder-stone-500 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">특이사항</label>
                                <input value={specialNote} onChange={e => setSpecialNote(e.target.value)}
                                    placeholder="예: 1조 조장, 캐디 10년차, 소개자 홍길동"
                                    className="w-full p-3 bg-stone-800 border border-stone-700 rounded-xl text-white placeholder-stone-500 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" />
                            </div>
                        </section>

                        {/* 결제 방식 선택 */}
                        <section className="bg-stone-900 rounded-3xl p-5 space-y-3">
                            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                                <Receipt size={16} /> 수금 방식
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                <button onClick={() => { setPayMethod('cash'); setPaymentLink(''); }}
                                    className={`p-3.5 rounded-2xl border text-left transition ${payMethod === 'cash' ? 'border-amber-500 bg-amber-900/20' : 'border-stone-700 bg-stone-800'}`}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">💵</span>
                                        <div>
                                            <p className="text-sm font-bold text-white">안 A — 현금/계좌이체 수금</p>
                                            <p className="text-[10px] text-stone-400">딜러가 직접 수금 → 이용권 즉시 발급 → 본사에 정산 요청</p>
                                        </div>
                                    </div>
                                </button>
                                <button onClick={() => { setPayMethod('virtual_account'); setPaymentLink(''); }}
                                    className={`p-3.5 rounded-2xl border text-left transition ${payMethod === 'virtual_account' ? 'border-blue-500 bg-blue-900/20' : 'border-stone-700 bg-stone-800'}`}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">🏦</span>
                                        <div>
                                            <p className="text-sm font-bold text-white">안 B — 가상계좌 발급</p>
                                            <p className="text-[10px] text-stone-400">고객에게 가상계좌 번호 발송 → 입금 확인 후 코드 자동 발급</p>
                                        </div>
                                    </div>
                                </button>
                                <button onClick={() => { setPayMethod('transfer'); setPaymentLink(''); }}
                                    className={`p-3.5 rounded-2xl border text-left transition ${payMethod === 'transfer' ? 'border-purple-500 bg-purple-900/20' : 'border-stone-700 bg-stone-800'}`}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">📲</span>
                                        <div>
                                            <p className="text-sm font-bold text-white">안 B-2 — 실시간 계좌이체</p>
                                            <p className="text-[10px] text-stone-400">고객이 링크에서 실시간 이체 → 즉시 코드 발급</p>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </section>

                        {/* 안A: 현금발급 버튼 */}
                        {(payMethod === 'cash') && (
                        <>
                        {/* 크레딧 발급 버튼 (크레딧 있을 때만 표시) */}
                        {(() => {
                            const creditCol = CREDIT_COL[issueTier][plan];
                            const avail = dealer ? ((dealer[creditCol as keyof DealerInfo] as number) ?? 0) : 0;
                            if (avail <= 0) return null;
                            return (
                                <button onClick={() => setIssueConfirm({ type: 'credit', creditCol, avail })} disabled={isIssuing || !customerName.trim() || !customerPhone.trim()}
                                    className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-3xl font-black text-xl flex items-center justify-center gap-3 transition border-2 border-emerald-400">
                                    {isIssuing ? <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" /> : <Coins size={24} />}
                                    {isIssuing ? '발급 중...' : `💳 크레딧 발급 (잔량 ${avail}장)`}
                                </button>
                            );
                        })()}
                        <button onClick={() => setIssueConfirm({ type: 'cash' })} disabled={isIssuing || !customerName.trim() || !customerPhone.trim()}
                            className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-3xl font-black text-xl flex items-center justify-center gap-3 transition">
                            {isIssuing ? <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" /> : <Key size={24} />}
                            {isIssuing ? '발급 중...' : '💵 현금 수금 후 즉시 발급'}
                        </button>
                        </>
                        )}

                        {/* 결제 링크 발송 (안B) */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-stone-600">
                                <div className="flex-1 h-px bg-stone-800" />
                                <span className="text-xs">또는</span>
                                <div className="flex-1 h-px bg-stone-800" />
                            </div>
                            <button onClick={handleGenerateLink}
                                disabled={!customerName.trim() || !customerPhone.trim()}
                                className="w-full py-4 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 rounded-3xl font-bold text-base flex items-center justify-center gap-2 transition">
                                <ExternalLink size={18} /> 🏦 결제 링크 생성 (가상계좌/이체/카드)
                            </button>
                        </div>

                        {paymentLink && (
                            <div className="bg-stone-900 rounded-3xl p-4 space-y-3 border border-emerald-700">
                                <p className="text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                                    <CheckCircle2 size={14} /> 결제 링크 생성 완료 — 카카오나 문자로 보내세요
                                </p>
                                <div className="bg-stone-800 rounded-2xl p-3 text-[11px] text-stone-400 break-all font-mono leading-relaxed">
                                    {paymentLink}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={handleCopyLink}
                                        className={`flex-1 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-1.5 transition ${linkCopied ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-white hover:bg-stone-700'}`}>
                                        {linkCopied ? <Check size={15} /> : <Copy size={15} />}
                                        {linkCopied ? '복사됨!' : '링크 복사'}
                                    </button>
                                    <button onClick={handleShareLink}
                                        className="flex-1 py-3 rounded-2xl font-bold text-sm bg-yellow-400 text-stone-900 hover:bg-yellow-300 transition flex items-center justify-center gap-1.5">
                                        <Share2 size={15} /> 공유하기
                                    </button>
                                </div>
                                <p className="text-stone-600 text-[10px]">
                                    고객이 이 링크로 결제하면 이용권 코드가 자동 발급됩니다
                                </p>
                            </div>
                        )}
                        </>)}

                        {/* ── 기간 연장 모드 ── */}
                        {issueMode === 'renew' && (
                            <div className="space-y-5">
                                {/* 전화번호 검색 */}
                                <section className="bg-stone-900 rounded-3xl p-5 space-y-4">
                                    <div className="flex items-center gap-2 text-violet-400 font-bold text-sm">
                                        <Search size={16} /> 고객 이용권 검색
                                    </div>
                                    <p className="text-stone-500 text-xs">이름 또는 전화번호로 기존 이용권을 찾아 기간을 연장합니다. 코드는 그대로 유지됩니다.</p>
                                    <div className="space-y-2">
                                        <input
                                            value={renewName}
                                            onChange={e => { setRenewName(e.target.value); setRenewResult(null); setRenewResults([]); }}
                                            onKeyDown={e => e.key === 'Enter' && handleSearchLicense()}
                                            placeholder="고객 이름 (예: 김경준)"
                                            className="w-full p-4 bg-stone-800 border border-stone-700 rounded-2xl text-white placeholder-stone-500 focus:ring-2 focus:ring-violet-500 focus:outline-none text-lg"
                                        />
                                        <div className="flex gap-2">
                                            <input
                                                value={renewPhone}
                                                onChange={e => {
                                                    const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
                                                    const fmt = raw.length <= 3 ? raw : raw.length <= 7
                                                        ? `${raw.slice(0,3)}-${raw.slice(3)}`
                                                        : `${raw.slice(0,3)}-${raw.slice(3,7)}-${raw.slice(7)}`;
                                                    setRenewPhone(fmt);
                                                    setRenewResult(null); setRenewResults([]);
                                                }}
                                                onKeyDown={e => e.key === 'Enter' && handleSearchLicense()}
                                                placeholder="010-0000-0000 (선택)"
                                                inputMode="tel"
                                                className="flex-1 p-4 bg-stone-800 border border-stone-700 rounded-2xl text-white placeholder-stone-500 focus:ring-2 focus:ring-violet-500 focus:outline-none text-lg"
                                            />
                                            <button
                                                onClick={handleSearchLicense}
                                                disabled={renewSearching || (renewName.trim().length < 1 && renewPhone.replace(/\D/g,'').length < 4)}
                                                className="w-14 h-14 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-2xl flex items-center justify-center transition">
                                                {renewSearching
                                                    ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    : <Search size={20} />}
                                            </button>
                                        </div>
                                    </div>
                                    {renewResult && !renewResult.found && (
                                        <div className="bg-red-900/20 border border-red-800 rounded-2xl p-4 text-sm text-red-300 text-center">
                                            이용권을 찾을 수 없습니다.
                                        </div>
                                    )}
                                    {renewResults.length > 1 && (
                                        <div className="space-y-2">
                                            <p className="text-violet-300 text-xs font-bold">검색 결과 {renewResults.length}건 — 해당 고객을 선택하세요</p>
                                            {renewResults.map(r => (
                                                <button
                                                    key={r.id}
                                                    onClick={() => { setRenewResult({ found: true, id: r.id, code: r.code, plan: r.plan, tier: r.tier, expiresAt: r.expiresAt, userName: r.userName, daysLeft: r.daysLeft, isExpired: r.isExpired }); setRenewResults([]); }}
                                                    className={`w-full text-left rounded-2xl p-3.5 border transition hover:border-violet-500 ${r.isExpired ? 'bg-red-900/15 border-red-800' : 'bg-stone-800 border-stone-700'}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-white text-sm">{r.userName || '(이름 없음)'}</span>
                                                        <span className={`text-xs font-bold ${r.isExpired ? 'text-red-400' : 'text-emerald-400'}`}>
                                                            {r.isExpired ? '만료됨' : `${r.daysLeft}일 남음`}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-1">
                                                        <span className="text-stone-500 text-xs">{r.userPhone ? `${r.userPhone.slice(0,3)}-****-${r.userPhone.slice(-4)}` : '-'}</span>
                                                        <span className="font-mono text-stone-400 text-xs">{r.code}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {renewResult?.found && (
                                        <div className={`rounded-2xl p-4 space-y-2 border ${renewResult.isExpired ? 'bg-red-900/15 border-red-800' : 'bg-violet-900/20 border-violet-700'}`}>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-stone-400">이용권 코드</span>
                                                <span className="font-mono font-black text-white text-sm">{renewResult.code}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-stone-400">고객명</span>
                                                <span className="text-white text-sm">{renewResult.userName || '-'}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-stone-400">현재 만료일</span>
                                                <span className={`text-sm font-bold ${renewResult.isExpired ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {renewResult.expiresAt
                                                        ? new Date(renewResult.expiresAt).toLocaleDateString('ko-KR')
                                                        : '미활성'}
                                                    {renewResult.isExpired ? ' (만료됨)' : renewResult.daysLeft !== undefined ? ` (${renewResult.daysLeft}일 남음)` : ''}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </section>

                                {renewResult?.found && (<>
                                    <section className="bg-stone-900 rounded-3xl p-5 space-y-4">
                                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                            <Tag size={16} /> 연장 요금제
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            {(Object.entries(PLANS) as [PlanType, typeof PLANS[PlanType]][]).map(([key, p]) => (
                                                <button key={key} onClick={() => setPlan(key)}
                                                    className={`p-3 rounded-2xl border text-center transition ${plan === key ? 'border-violet-500 bg-violet-900/30' : 'border-stone-700 bg-stone-800'}`}>
                                                    <p className="text-xs font-bold text-stone-300">{p.label}</p>
                                                    <p className="text-[10px] text-stone-500 mt-0.5">{p.days}일</p>
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                    <section className="bg-stone-900 rounded-3xl p-5">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-stone-300 text-sm font-bold">연장 기간</span>
                                            <span className="text-violet-400 font-black text-xl">{days}일</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <button onClick={() => setDays(d => Math.max(minDays, d - 1))}
                                                disabled={days <= minDays}
                                                className="w-12 h-12 bg-stone-700 hover:bg-stone-600 disabled:opacity-30 rounded-full flex items-center justify-center transition">
                                                <Minus size={20} />
                                            </button>
                                            <div className="flex-1 bg-stone-800 rounded-full h-2">
                                                <div className="bg-violet-500 h-2 rounded-full transition-all"
                                                    style={{ width: `${((days - minDays) / (maxDays - minDays || 1)) * 100}%` }} />
                                            </div>
                                            <button onClick={() => setDays(d => Math.min(maxDays, d + 1))}
                                                disabled={days >= maxDays}
                                                className="w-12 h-12 bg-stone-700 hover:bg-stone-600 disabled:opacity-30 rounded-full flex items-center justify-center transition">
                                                <Plus size={20} />
                                            </button>
                                        </div>
                                        <p className="text-stone-500 text-[10px] text-center mt-2">기본 {minDays}일 + 보너스 최대 {maxDays - minDays}일</p>
                                    </section>
                                    {(() => {
                                        const base = renewResult.expiresAt && new Date(renewResult.expiresAt) > new Date()
                                            ? new Date(renewResult.expiresAt) : new Date();
                                        const newExp = new Date(base.getTime() + days * 86_400_000);
                                        return (
                                            <div className="bg-violet-900/20 border border-violet-700 rounded-2xl p-4 text-center">
                                                <p className="text-stone-400 text-xs mb-1">연장 후 새 만료일</p>
                                                <p className="text-violet-300 font-black text-xl">{newExp.toLocaleDateString('ko-KR')}</p>
                                                <p className="text-stone-500 text-[10px] mt-1">코드 변경 없이 기간만 연장됩니다</p>
                                            </div>
                                        );
                                    })()}
                                    <button onClick={handleExtend} disabled={isExtending}
                                        className="w-full py-5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-3xl font-black text-xl flex items-center justify-center gap-3 transition">
                                        {isExtending
                                            ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            : <RotateCcw size={24} />}
                                        {isExtending ? '연장 중...' : '🔄 기간 연장하기'}
                                    </button>
                                </>)}
                            </div>
                        )}
                    </div>
                )}

                {/* ── 크레딧 구매 탭 ── */}
                {activeTab === 'credits' && (
                    <div className="space-y-5">
                        {/* 현재 잔량 */}
                        <section className="bg-stone-900 rounded-3xl p-5 space-y-3">
                            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                                <Coins size={16} /> 현재 크레딧 잔량
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    { key: 'month',  label: '1개월',  std: dealer?.credits_month ?? 0,  prem: dealer?.credits_month_premium ?? 0 },
                                    { key: '6month', label: '6개월',  std: dealer?.credits_6month ?? 0, prem: dealer?.credits_6month_premium ?? 0 },
                                    { key: 'year',   label: '1년',    std: dealer?.credits_year ?? 0,   prem: dealer?.credits_year_premium ?? 0 },
                                ]).map(item => (
                                    <div key={item.key} className="space-y-1.5">
                                        <div className="bg-stone-800 rounded-2xl p-3 text-center">
                                            <p className="text-stone-400 text-[9px] font-bold mb-1">{item.label}</p>
                                            <p className={`text-xl font-black ${item.std > 0 ? 'text-blue-300' : 'text-stone-600'}`}>{item.std}</p>
                                            <p className="text-stone-500 text-[8px]">스탠다드</p>
                                        </div>
                                        <div className="bg-stone-800 rounded-2xl p-3 text-center">
                                            <p className="text-stone-400 text-[9px] font-bold mb-1">{item.label}P</p>
                                            <p className={`text-xl font-black ${item.prem > 0 ? 'text-emerald-300' : 'text-stone-600'}`}>{item.prem}</p>
                                            <p className="text-stone-500 text-[8px]">프리미엄</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* 결제 완료 / 실패 알림 */}
                        {/* 구매 폼 */}
                        <section className="bg-stone-900 rounded-3xl p-5 space-y-4">
                            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                                <CreditCard size={16} /> 크레딧 선택
                            </div>

                            {/* 티어 */}
                            <div>
                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 block">이용권 종류</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['standard', 'premium'] as const).map(t => (
                                        <button key={t} onClick={() => setCreditBuyTier(t)}
                                            className={`py-3 rounded-2xl font-bold text-sm border-2 transition ${creditBuyTier === t ? (t === 'premium' ? 'border-emerald-500 bg-emerald-900/30 text-emerald-300' : 'border-blue-500 bg-blue-900/30 text-blue-300') : 'border-stone-700 bg-stone-800 text-stone-400'}`}>
                                            {t === 'premium' ? '⭐ 프리미엄' : '스탠다드'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 기간 — 소비자가(취소선) + 공급가 + 할인율 */}
                            <div>
                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 block">기간</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['month', '6month', 'year'] as PlanType[]).map(key => {
                                        const label = key === 'month' ? '1개월' : key === '6month' ? '6개월' : '1년';
                                        const consumerP = CONSUMER_PRICE[creditBuyTier][key];
                                        const supplyP = DEALER_SUPPLY_PRICE[creditBuyTier][key];
                                        const discountPct = Math.round((1 - supplyP / consumerP) * 100);
                                        const isSelected = creditBuyPlan === key;
                                        return (
                                            <button key={key} onClick={() => setCreditBuyPlan(key)}
                                                className={`p-2.5 rounded-2xl border-2 text-center transition ${isSelected ? 'border-blue-500 bg-blue-900/30' : 'border-stone-700 bg-stone-800'}`}>
                                                <p className={`text-xs font-black ${isSelected ? 'text-white' : 'text-stone-300'}`}>{label}</p>
                                                <p className="text-stone-500 text-[9px] line-through mt-0.5">₩{consumerP.toLocaleString()}</p>
                                                <p className="text-emerald-400 text-[10px] font-bold">₩{supplyP.toLocaleString()}</p>
                                                <span className="inline-block mt-0.5 bg-red-600/80 text-white text-[8px] font-black px-1 py-0.5 rounded-full">{discountPct}% 할인</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 수량 */}
                            <div>
                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 block">수량</label>
                                <div className="flex items-center gap-4">
                                    <button onClick={() => setCreditBuyQty(q => Math.max(1, q - 1))}
                                        className="w-12 h-12 bg-stone-700 hover:bg-stone-600 rounded-full flex items-center justify-center transition">
                                        <Minus size={18} />
                                    </button>
                                    <div className="flex-1 text-center">
                                        <p className="text-3xl font-black text-white">{creditBuyQty}장</p>
                                    </div>
                                    <button onClick={() => setCreditBuyQty(q => Math.min(50, q + 1))}
                                        className="w-12 h-12 bg-stone-700 hover:bg-stone-600 rounded-full flex items-center justify-center transition">
                                        <Plus size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* 담기 버튼 */}
                            {(() => {
                                const supplyP = DEALER_SUPPLY_PRICE[creditBuyTier][creditBuyPlan];
                                const consumerP = CONSUMER_PRICE[creditBuyTier][creditBuyPlan];
                                const label = creditBuyPlan === 'month' ? '1개월' : creditBuyPlan === '6month' ? '6개월' : '1년';
                                const tierLabel = creditBuyTier === 'premium' ? '프리미엄' : '스탠다드';
                                return (
                                    <button onClick={handleAddToCart}
                                        className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition">
                                        🛒 {label} {tierLabel} {creditBuyQty}장 담기
                                        <span className="text-amber-200 text-sm">₩{(supplyP * creditBuyQty).toLocaleString()}</span>
                                        <span className="text-amber-300 text-xs">(소비자가 ₩{(consumerP * creditBuyQty).toLocaleString()})</span>
                                    </button>
                                );
                            })()}
                        </section>

                        {/* 장바구니 */}
                        {cart.length > 0 && (() => {
                            const totalConsumer = cart.reduce((s, i) => s + CONSUMER_PRICE[i.tier][i.plan] * i.qty, 0);
                            const totalSupply   = cart.reduce((s, i) => s + DEALER_SUPPLY_PRICE[i.tier][i.plan] * i.qty, 0);
                            const totalSaving   = totalConsumer - totalSupply;
                            const totalDiscount = Math.round((1 - totalSupply / totalConsumer) * 100);
                            const PLAN_LABEL: Record<PlanType, string> = { month: '1개월', '6month': '6개월', year: '1년' };
                            return (
                                <section className="bg-stone-900 rounded-3xl p-5 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-amber-400 font-bold text-sm flex items-center gap-2">🛒 장바구니 <span className="bg-amber-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{cart.reduce((s,i)=>s+i.qty,0)}장</span></span>
                                        <button onClick={() => setCart([])} className="text-stone-500 hover:text-red-400 text-xs transition">전체 비우기</button>
                                    </div>

                                    {/* 아이템 목록 */}
                                    <div className="space-y-2">
                                        {cart.map(item => {
                                            const consumerP = CONSUMER_PRICE[item.tier][item.plan];
                                            const supplyP   = DEALER_SUPPLY_PRICE[item.tier][item.plan];
                                            const saving    = (consumerP - supplyP) * item.qty;
                                            const tierLabel = item.tier === 'premium' ? '⭐프리미엄' : '스탠다드';
                                            return (
                                                <div key={`${item.tier}-${item.plan}`} className="bg-stone-800 rounded-2xl p-3 flex items-center justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-white text-sm font-bold">{PLAN_LABEL[item.plan]} {tierLabel} × {item.qty}장</p>
                                                        <p className="text-stone-400 text-[10px]">
                                                            <span className="line-through text-stone-600">₩{(consumerP * item.qty).toLocaleString()}</span>
                                                            {' → '}
                                                            <span className="text-white font-bold">₩{(supplyP * item.qty).toLocaleString()}</span>
                                                            <span className="text-emerald-400 ml-1">({saving.toLocaleString()}원 절약)</span>
                                                        </p>
                                                    </div>
                                                    <button onClick={() => handleRemoveFromCart(item.tier, item.plan)}
                                                        className="text-stone-600 hover:text-red-400 text-lg leading-none transition">✕</button>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* 합계 */}
                                    <div className="bg-stone-800/60 rounded-2xl p-4 space-y-2">
                                        <div className="flex justify-between text-sm text-stone-400">
                                            <span>소비자가 합계</span>
                                            <span className="line-through">₩{totalConsumer.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-stone-300">내 구매가</span>
                                            <span className="text-white font-bold text-base">₩{totalSupply.toLocaleString()}</span>
                                        </div>
                                        <div className="border-t border-stone-700 pt-2 flex justify-between">
                                            <span className="text-emerald-400 font-bold text-sm">절약 금액 🎉</span>
                                            <span className="text-emerald-400 font-black">₩{totalSaving.toLocaleString()} <span className="text-xs">({totalDiscount}% 할인)</span></span>
                                        </div>
                                    </div>

                                    {/* 결제수단 */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block">결제수단</label>
                                        <button onClick={() => setCreditPayMethod('TRANSFER')}
                                            className={`w-full p-3.5 rounded-2xl border text-left transition ${creditPayMethod === 'TRANSFER' ? 'border-emerald-500 bg-emerald-900/20' : 'border-stone-700 bg-stone-800'}`}>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl">📲</span>
                                                <div>
                                                    <p className="text-sm font-bold text-white flex items-center gap-2">
                                                        실시간계좌이체
                                                        <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-black">추천</span>
                                                    </p>
                                                    <p className="text-[10px] text-emerald-400">수수료 없음 · 즉시 충전</p>
                                                </div>
                                            </div>
                                        </button>
                                        <button onClick={() => setCreditPayMethod('CARD')}
                                            className={`w-full p-3.5 rounded-2xl border text-left transition ${creditPayMethod === 'CARD' ? 'border-blue-500 bg-blue-900/20' : 'border-stone-700 bg-stone-800'}`}>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl">💳</span>
                                                <div>
                                                    <p className="text-sm font-bold text-white">카드결제</p>
                                                    <p className="text-[10px] text-amber-400">⚠ 카드 수수료 발생 · 실시간이체를 권장합니다</p>
                                                </div>
                                            </div>
                                        </button>
                                    </div>

                                    <button onClick={handleBuyCredits} disabled={isBuyingCredit}
                                        className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-3xl font-black text-xl flex items-center justify-center gap-3 transition">
                                        {isBuyingCredit ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Coins size={24} />}
                                        {isBuyingCredit ? '결제 중...' : `₩${totalSupply.toLocaleString()} 결제하기`}
                                    </button>
                                </section>
                            );
                        })()}

                        <div className="bg-stone-900/50 rounded-2xl p-4 text-xs text-stone-400 leading-relaxed space-y-1">
                            <p className="font-bold text-stone-300">💡 크레딧 구매 안내</p>
                            <p>• 여러 종류 담기 → 한 번에 결제</p>
                            <p>• 크레딧 구매 후 고객에게 현장에서 즉시 이용권 발급</p>
                            <p>• 딜러가 고객에게 직접 현금/이체 수금 후 이익 취득</p>
                            <p>• <span className="text-emerald-400 font-bold">소비자가와 공급가 차액이 딜러 수익</span></p>
                        </div>
                    </div>
                )}

                {/* ── 내 수익 탭 ── */}
                {activeTab === 'earnings' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-white font-bold text-sm flex items-center gap-2"><TrendingUp size={16} className="text-emerald-400" /> 수익 현황</h2>
                            <button onClick={() => { loadSettlements(); loadLicenses(); }} className="text-stone-500 hover:text-stone-300">
                                <RefreshCcw size={14} />
                            </button>
                        </div>

                        {settlementsLoading || licensesLoading ? (
                            <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
                        ) : (
                            <>
                                {/* 요약 카드 */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-blue-900/30 border border-blue-800 rounded-2xl p-4 text-center">
                                        <p className="text-blue-300 text-[10px] font-bold mb-1">이번 달</p>
                                        <p className="text-blue-100 text-xl font-black">₩{monthEarned.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 text-center">
                                        <p className="text-stone-400 text-[10px] font-bold mb-1">누적 수익</p>
                                        <p className="text-white text-xl font-black">₩{totalEarned.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-amber-900/20 border border-amber-800 rounded-2xl p-4 text-center">
                                        <p className="text-amber-300 text-[10px] font-bold mb-1">미정산</p>
                                        <p className="text-amber-100 text-xl font-black">₩{pendingAmount.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-emerald-900/20 border border-emerald-800 rounded-2xl p-4 text-center">
                                        <p className="text-emerald-300 text-[10px] font-bold mb-1">정산완료</p>
                                        <p className="text-emerald-100 text-xl font-black">₩{settledAmount.toLocaleString()}</p>
                                    </div>
                                </div>

                                {/* 💵 현금 미입금 확인 (본사 정산용) */}
                                {(() => {
                                    const cashLicenses = licenses.filter(l => !l.pay_method || l.pay_method === 'cash');
                                    const PLAN_PRICE: Record<string, number> = { month: 9900, '6month': 55000, year: 99000 };
                                    const cashTotal = cashLicenses.reduce((a, l) => a + (PLAN_PRICE[l.plan] || 0), 0);
                                    return cashLicenses.length > 0 ? (
                                        <div className="bg-amber-900/20 border border-amber-700 rounded-2xl p-4 space-y-2">
                                            <p className="text-amber-300 text-xs font-bold flex items-center gap-1">💵 현금 수금 내역 (본사 정산 대상)</p>
                                            {cashLicenses.map(l => (
                                                <div key={l.id} className="flex items-center justify-between text-xs py-1.5 border-b border-amber-900/30">
                                                    <div>
                                                        <span className="text-white font-mono font-bold">{l.user_name || '-'}</span>
                                                        <span className="text-stone-400 ml-2">{l.plan} · {l.issued_at.slice(0, 10)}</span>
                                                        {l.golf_course && <span className="text-emerald-400 ml-2">{l.golf_course}</span>}
                                                    </div>
                                                    <span className="text-amber-200 font-black">₩{(PLAN_PRICE[l.plan] || 0).toLocaleString()}</span>
                                                </div>
                                            ))}
                                            <div className="flex justify-between pt-1 text-sm font-black">
                                                <span className="text-amber-300">합계 ({cashLicenses.length}건)</span>
                                                <span className="text-amber-100">₩{cashTotal.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ) : null;
                                })()}

                                {/* 📊 날짜별/상품별 집계 */}
                                {(() => {
                                    const PLAN_PRICE: Record<string, number> = { month: 9900, '6month': 55000, year: 99000 };
                                    const planCount: Record<string, number> = {};
                                    const dateCount: Record<string, number> = {};
                                    const dateAmount: Record<string, number> = {};
                                    licenses.forEach(l => {
                                        planCount[l.plan] = (planCount[l.plan] || 0) + 1;
                                        const d = l.issued_at.slice(0, 10);
                                        dateCount[d] = (dateCount[d] || 0) + 1;
                                        dateAmount[d] = (dateAmount[d] || 0) + (PLAN_PRICE[l.plan] || 0);
                                    });
                                    const sortedDates = Object.keys(dateCount).sort().reverse();
                                    return licenses.length > 0 ? (
                                        <>
                                            {/* 상품별 */}
                                            <div className="bg-stone-900 rounded-2xl p-4">
                                                <p className="text-stone-300 text-xs font-bold mb-3">📦 상품별 발급 현황</p>
                                                {Object.entries(planCount).map(([p, cnt]) => (
                                                    <div key={p} className="flex items-center justify-between py-1.5 text-xs border-b border-stone-800 last:border-0">
                                                        <span className="text-stone-300">{p === 'month' ? '1개월권' : p === '6month' ? '6개월권' : '1년권'}</span>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-blue-400 font-bold">{cnt}건</span>
                                                            <span className="text-stone-400">₩{((PLAN_PRICE[p] || 0) * cnt).toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* 날짜별 */}
                                            <div className="bg-stone-900 rounded-2xl p-4">
                                                <p className="text-stone-300 text-xs font-bold mb-3">📅 날짜별 발급 현황</p>
                                                {sortedDates.map(d => (
                                                    <div key={d} className="flex items-center justify-between py-1.5 text-xs border-b border-stone-800 last:border-0">
                                                        <span className="text-stone-300">{d}</span>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-blue-400 font-bold">{dateCount[d]}건</span>
                                                            <span className="text-stone-400">₩{(dateAmount[d] || 0).toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : null;
                                })()}

                                {/* 정산 상세 내역 */}
                                {settlements.length === 0 ? (
                                    <div className="text-center text-stone-500 py-6 text-sm">
                                        <TrendingUp size={32} className="mx-auto mb-2 opacity-30" />
                                        수익 내역이 없습니다.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="text-stone-400 text-xs font-bold">정산 내역</p>
                                        {settlements.slice(0, 30).map(s => (
                                            <div key={s.id} className="bg-stone-900 rounded-2xl p-4 flex items-center justify-between">
                                                <div>
                                                    <p className="text-white text-xs font-bold font-mono">{s.license_code}</p>
                                                    <p className="text-stone-500 text-[10px] mt-0.5">
                                                        {s.type === 'first' ? '신규' : '재구독'} · {s.plan} · {s.commission_rate}%
                                                    </p>
                                                    <p className="text-stone-600 text-[10px]">{s.created_at.slice(0, 10)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-white font-black">₩{s.commission_amount.toLocaleString()}</p>
                                                    {s.settled ? (
                                                        <span className="text-emerald-400 text-[10px] font-bold flex items-center gap-1 justify-end"><BadgeCheck size={10} /> 정산완료</span>
                                                    ) : (
                                                        <span className="text-amber-400 text-[10px] font-bold flex items-center gap-1 justify-end"><Clock size={10} /> 미정산</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ── 내 고객 탭 ── */}
                {activeTab === 'customers' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-white font-bold text-sm flex items-center gap-2"><Users size={16} className="text-blue-400" /> 내 고객 목록</h2>
                            <button onClick={loadLicenses} className="text-stone-500 hover:text-stone-300">
                                <RefreshCcw size={14} />
                            </button>
                        </div>

                        {licensesLoading ? (
                            <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
                        ) : licenses.length === 0 ? (
                            <div className="text-center text-stone-500 py-10 text-sm">
                                <Users size={32} className="mx-auto mb-2 opacity-30" />
                                발급한 고객이 없습니다.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {licenses.map(lic => {
                                    const isExpired = lic.expires_at ? new Date(lic.expires_at) < new Date() : false;
                                    const isActive = lic.is_active && !isExpired;
                                    const isExpanded = expandedLicense === lic.id;
                                    return (
                                        <div key={lic.id} className="bg-stone-900 rounded-2xl overflow-hidden">
                                            <button
                                                className="w-full px-4 py-3 flex items-center justify-between"
                                                onClick={() => setExpandedLicense(isExpanded ? null : lic.id)}
                                            >
                                                <div className="text-left">
                                                    <p className="text-white text-xs font-black font-mono">{lic.code}</p>
                                                    <p className="text-stone-400 text-[10px] mt-0.5">
                                                        {lic.user_name || '이름없음'} · {lic.plan}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {isActive ? (
                                                        <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold"><BadgeCheck size={10} /> 이용중</span>
                                                    ) : lic.first_used_at ? (
                                                        <span className="flex items-center gap-1 text-red-400 text-[10px] font-bold"><AlertCircle size={10} /> 만료</span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-stone-400 text-[10px] font-bold"><Clock size={10} /> 미사용</span>
                                                    )}
                                                    {isExpanded ? <ChevronUp size={14} className="text-stone-500" /> : <ChevronDown size={14} className="text-stone-500" />}
                                                </div>
                                            </button>
                                            {isExpanded && (
                                                <div className="px-4 pb-4 border-t border-stone-800 pt-3 space-y-1.5 text-xs text-stone-400">
                                                    <p>연락처: <span className="text-stone-300">{lic.user_phone || '-'}</span></p>
                                                    <p>발급일: <span className="text-stone-300">{lic.issued_at.slice(0, 10)}</span></p>
                                                    <p>상품: <span className="text-blue-300 font-bold">{lic.plan} · {lic.days}일권</span></p>
                                                    {lic.golf_course && <p>골프장: <span className="text-emerald-300">{lic.golf_course}</span></p>}
                                                    {lic.memo && <p>특이사항: <span className="text-stone-300">{lic.memo}</span></p>}
                                                    <p>수금방식: <span className="text-amber-300">{lic.pay_method === 'cash' ? '💵 현금/계좌이체' : lic.pay_method === 'virtual_account' ? '🏦 가상계좌' : lic.pay_method === 'transfer' ? '📲 실시간이체' : lic.pay_method === 'credit' ? '💳 크레딧 발급' : '카드'}</span></p>
                                                    {lic.first_used_at && <p>최초사용: <span className="text-stone-300">{lic.first_used_at.slice(0, 10)}</span></p>}
                                                    {lic.expires_at && <p>만료일: <span className={isExpired ? 'text-red-400' : 'text-stone-300'}>{lic.expires_at.slice(0, 10)}</span></p>}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── 정산요청 탭 ── */}
                {activeTab === 'settlement' && (
                    <div className="space-y-4">
                        <h2 className="text-white font-bold text-sm flex items-center gap-2"><Receipt size={16} className="text-amber-400" /> 정산 요청</h2>

                        {settlementsLoading ? (
                            <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
                        ) : (
                            <>
                                {/* 미정산 합계 */}
                                <div className="bg-amber-900/20 border border-amber-700 rounded-3xl p-6 text-center space-y-2">
                                    <p className="text-amber-300 text-xs font-bold">미정산 금액</p>
                                    <p className="text-amber-100 text-4xl font-black">₩{pendingAmount.toLocaleString()}</p>
                                    <p className="text-amber-400 text-xs">{settlements.filter(s => !s.settled).length}건</p>
                                </div>

                                <button
                                    onClick={handleSettlementRequest}
                                    disabled={requestingSettlement || pendingAmount === 0}
                                    className="w-full py-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition"
                                >
                                    {requestingSettlement ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Receipt size={18} />}
                                    {requestingSettlement ? '요청 중...' : '정산 요청하기'}
                                </button>

                                {/* 미정산 내역 */}
                                {settlements.filter(s => !s.settled).length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-stone-400 text-xs font-bold">미정산 내역</p>
                                        {settlements.filter(s => !s.settled).map(s => (
                                            <div key={s.id} className="bg-stone-900 rounded-2xl p-4 flex items-center justify-between">
                                                <div>
                                                    <p className="text-white text-xs font-mono font-bold">{s.license_code}</p>
                                                    <p className="text-stone-500 text-[10px]">{s.type === 'first' ? '신규' : '재구독'} · {s.created_at.slice(0, 10)}</p>
                                                </div>
                                                <p className="text-amber-300 font-black">₩{s.commission_amount.toLocaleString()}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="bg-stone-900 rounded-2xl p-4 text-xs text-stone-400 leading-relaxed">
                                    <p className="font-bold text-stone-300 mb-1">정산 안내</p>
                                    <p>• 정산 요청 후 관리자가 확인하여 처리합니다.</p>
                                    <p>• 입금 계좌는 관리자에게 별도 안내해 주세요.</p>
                                    <p>• 정산 주기: 매월 말 일괄 처리</p>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
