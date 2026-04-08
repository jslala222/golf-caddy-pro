'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { issueVoucher, PLANS, CHANNELS, TIER_PRICES, searchLicenseByPhone } from '@/lib/licenseUtils';
import type { PlanType, ChannelType, TierType } from '@/lib/licenseUtils';
import { supabase } from '@/lib/supabaseClient';
import {
    ShieldCheck, Key, RefreshCcw, Copy, Check, ChevronLeft,
    CalendarX, Users2, GripVertical, UserPlus, Link2, Plus, Minus,
    Search, Receipt, BadgeCheck, Clock, AlertCircle, ChevronDown, ChevronUp,
    HardDriveDownload, FileJson, CloudOff, Coins, X
} from 'lucide-react';
import Link from 'next/link';

// ── 딜러 토큰 생성 ─────────────────────────────────────────────
const DEALER_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function makeDealerToken(): string {
    let t = '';
    for (let i = 0; i < 8; i++) t += DEALER_CHARS[Math.floor(Math.random() * DEALER_CHARS.length)];
    return t;
}

// ── 딜러 크레딧 상수 ──────────────────────────────────────────
const CREDIT_COL_ADMIN: Record<'standard' | 'premium', Record<PlanType, string>> = {
    standard: { month: 'credits_month', '6month': 'credits_6month', year: 'credits_year' },
    premium:  { month: 'credits_month_premium', '6month': 'credits_6month_premium', year: 'credits_year_premium' },
};
const CREDIT_PRICE: Record<'standard' | 'premium', Record<PlanType, number>> = {
    standard: { month: 7_000, '6month': 40_000, year: 70_000 },
    premium:  { month: 10_000, '6month': 50_000, year: 100_000 },
};

type AdminTab = 'issue' | 'licenses' | 'dealers' | 'settlements' | 'caddy' | 'restore' | 'receipt';

interface Dealer {
    id: string;
    name: string;
    phone: string;
    email: string | null;
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
    channel: string;
    plan: string;
    days: number;
    expires_at: string | null;
    first_used_at: string | null;
    is_active: boolean;
    memo: string | null;
    user_name: string | null;
    user_phone: string | null;
    issued_by: string;
    created_at: string;
}

interface Settlement {
    id: string;
    dealer_id: string;
    license_code: string;
    type: 'first' | 'renewal';
    plan: string;
    sale_amount: number;
    commission_rate: number;
    commission_amount: number;
    settled: boolean;
    settled_at: string | null;
    created_at: string;
    dealer?: { name: string; phone: string };
}

export default function AdminPage() {
    const [password, setPassword] = useState('');
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [lockoutExpiry, setLockoutExpiry] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<AdminTab>('issue');

    // 이용권 발급 폼 상태
    const [channel, setChannel] = useState<ChannelType>('direct');
    const [plan, setPlan] = useState<PlanType>('month');
    const [days, setDays] = useState(30);
    const [memo, setMemo] = useState('');
    const [userName, setUserName] = useState('');
    const [userPhone, setUserPhone] = useState('');
    const [isIssuing, setIsIssuing] = useState(false);
    const [generatedKey, setGeneratedKey] = useState('');
    const [copied, setCopied] = useState(false);
    const [generatedCount, setGeneratedCount] = useState(0);
    const [issueTier, setIssueTier] = useState<TierType>('standard');

    // 현금영수증 상태
    const [receiptType, setReceiptType] = useState<'PERSONAL' | 'CORPORATE'>('PERSONAL');
    const [receiptIdentifier, setReceiptIdentifier] = useState('');
    const [receiptAmount, setReceiptAmount] = useState('');
    const [receiptOrderName, setReceiptOrderName] = useState('Caddy Manager Pro 이용권');
    const [isIssuingReceipt, setIsIssuingReceipt] = useState(false);
    const [receiptResult, setReceiptResult] = useState<{ success: boolean; message: string; receiptUrl?: string } | null>(null);

    // 딜러 관리 상태
    const [dealers, setDealers] = useState<Dealer[]>([]);
    const [newDealerName, setNewDealerName] = useState('');
    const [newDealerPhone, setNewDealerPhone] = useState('');
    const [newDealerEmail, setNewDealerEmail] = useState('');
    const [newDealerPin, setNewDealerPin] = useState('');
    const [copiedDashToken, setCopiedDashToken] = useState('');
    const [dealerFormError, setDealerFormError] = useState('');
    const [isAddingDealer, setIsAddingDealer] = useState(false);
    const [copiedToken, setCopiedToken] = useState('');

    // 크레딧 충전 모달 상태
    const [creditModalDealer, setCreditModalDealer] = useState<Dealer | null>(null);
    const [creditPlan, setCreditPlan] = useState<PlanType>('month');
    const [creditTier, setCreditTier] = useState<'standard' | 'premium'>('standard');
    const [creditQty, setCreditQty] = useState(1);
    const [isChargingCredit, setIsChargingCredit] = useState(false);

    // 이용권 내역 상태
    const [licenseSearch, setLicenseSearch] = useState('');
    const [licenses, setLicenses] = useState<License[]>([]);
    const [licenseLoading, setLicenseLoading] = useState(false);
    const [expandedLicense, setExpandedLicense] = useState<string | null>(null);
    const [bonusDays, setBonusDays] = useState<Record<string, number>>({});
    const [bonusLoading, setBonusLoading] = useState<string | null>(null);

    // 정산 관리 상태
    const [settlements, setSettlements] = useState<Settlement[]>([]);
    const [settlementLoading, setSettlementLoading] = useState(false);
    const [settlementFilter, setSettlementFilter] = useState<'all' | 'pending' | 'done'>('pending');
    const [selectedDealerFilter, setSelectedDealerFilter] = useState<string>('all');

    // 데이터 복구 상태
    const [restoreCode, setRestoreCode] = useState('');
    const [restoreStatus, setRestoreStatus] = useState<'idle' | 'loading' | 'found' | 'notfound' | 'error'>('idle');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [restoreData, setRestoreData] = useState<any>(null);

    // 이름/전화번호 검색
    const [restoreSearchMode, setRestoreSearchMode] = useState<'code' | 'phone'>('code');
    const [restoreSearchPhone, setRestoreSearchPhone] = useState('');
    const [restoreSearchName, setRestoreSearchName] = useState('');
    const [restoreSearching, setRestoreSearching] = useState(false);
    const [restoreSearchResults, setRestoreSearchResults] = useState<{
        id: string; code: string; plan: string;
        expiresAt: string | null; userName: string | null; isExpired: boolean;
    }[]>([]);

    // 파일 직접 복원
    const [importCode, setImportCode] = useState('');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importStatus, setImportStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
    const [importLog, setImportLog] = useState('');

    // 요금제 변경 시 일수 자동 세팅
    useEffect(() => {
        setDays(PLANS[plan].days);
    }, [plan]);

    useEffect(() => {
        const storedExpiry = localStorage.getItem('caddy_admin_lockout');
        if (storedExpiry) {
            const expiry = parseInt(storedExpiry, 10);
            if (expiry > Date.now()) setLockoutExpiry(expiry);
            else localStorage.removeItem('caddy_admin_lockout');
        }
    }, []);

    const loadDealers = useCallback(async () => {
        const { data } = await supabase
            .from('aone_pro_caddypro_dealers')
            .select('id, name, phone, email, token, is_active, total_issued, pin, credits_month, credits_6month, credits_year, credits_month_premium, credits_6month_premium, credits_year_premium')
            .order('created_at', { ascending: false });
        if (data) setDealers(data as Dealer[]);
    }, []);

    const searchLicenses = useCallback(async (query: string) => {
        setLicenseLoading(true);
        let q = supabase
            .from('aone_pro_caddypro_licenses')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        if (query.trim()) {
            q = q.or(`user_name.ilike.%${query.trim()}%,user_phone.ilike.%${query.trim()}%,code.ilike.%${query.trim()}%`);
        }
        const { data } = await q;
        setLicenses((data as License[]) || []);
        setLicenseLoading(false);
    }, []);

    const loadSettlements = useCallback(async () => {
        setSettlementLoading(true);
        const { data } = await supabase
            .from('aone_pro_caddypro_settlements')
            .select('*, dealer:aone_pro_caddypro_dealers(name, phone)')
            .order('created_at', { ascending: false });
        setSettlements((data as Settlement[]) || []);
        setSettlementLoading(false);
    }, []);

    useEffect(() => {
        if (isAuthorized) {
            loadDealers();
            searchLicenses('');
            loadSettlements();
        }
    }, [isAuthorized, loadDealers, searchLicenses, loadSettlements]);

    useEffect(() => {
        if (activeTab === 'licenses') searchLicenses(licenseSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'settlements') loadSettlements();
    }, [activeTab, loadSettlements]);

    const handleAuth = (e: React.FormEvent) => {
        e.preventDefault();
        if (lockoutExpiry && lockoutExpiry > Date.now()) {
            alert(`보안 차단 중입니다. ${Math.ceil((lockoutExpiry - Date.now()) / 60000)}분 후 재시도하세요.`);
            return;
        }
        if (password === '0827') {
            setIsAuthorized(true);
            setFailedAttempts(0);
            localStorage.removeItem('caddy_admin_lockout');
        } else {
            const attempts = failedAttempts + 1;
            setFailedAttempts(attempts);
            if (attempts >= 5) {
                const expiry = Date.now() + 30 * 60_000;
                setLockoutExpiry(expiry);
                localStorage.setItem('caddy_admin_lockout', expiry.toString());
                alert('5회 실패 — 30분 차단됩니다.');
            } else {
                alert(`비밀번호 오류 (${5 - attempts}회 남음)`);
            }
        }
    };

    const handleIssue = async () => {
        if (!userPhone.trim()) {
            alert('연락처를 입력해야 가입 완료 문자가 발송됩니다.');
            return;
        }
        setIsIssuing(true);
        setGeneratedKey('');
        const result = await issueVoucher({ channel, plan, days, memo, userName, userPhone, issuedBy: 'admin', tier: issueTier });
        setIsIssuing(false);
        if (result.success && result.code) {
            setGeneratedKey(result.code);
            setCopied(false);
            setGeneratedCount(prev => prev + 1);
            setMemo('');
            setUserName('');
            setUserPhone('');
        } else {
            alert(`발급 실패: ${result.error}`);
        }
    };

    const handleCopy = () => {
        if (!generatedKey) return;
        navigator.clipboard.writeText(generatedKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleAddDealer = async () => {
        if (!newDealerName.trim()) { setDealerFormError('딜러 이름을 입력해주세요.'); return; }
        if (newDealerEmail.trim() && (!newDealerEmail.includes('@') || !newDealerEmail.includes('.'))) {
            setDealerFormError('이메일 형식이 올바르지 않습니다.\n@ 가 포함되어야 하며 . 도 포함되어야 합니다.')
            return;
        }
        if (newDealerPin && !/^\d{4,8}$/.test(newDealerPin)) { setDealerFormError('PIN은 4~8자리 숫자로 입력해주세요.'); return; }
        setIsAddingDealer(true);
        try {
            const token = makeDealerToken();
            const { error } = await supabase.from('aone_pro_caddypro_dealers').insert({
                name: newDealerName.trim(),
                phone: newDealerPhone.trim() || null,
                email: newDealerEmail.trim() || null,
                token,
                pin: newDealerPin.trim() || null,
            });
            if (error) { setDealerFormError(`딜러 등록 실패: ${error.message}`); return; }
            setNewDealerName('');
            setNewDealerPhone('');
            setNewDealerEmail('');
            setNewDealerPin('');
            loadDealers();
        } catch (e: any) {
            setDealerFormError(`오류: ${e?.message ?? '알 수 없는 오류'}`);
        } finally {
            setIsAddingDealer(false);
        }
    };

    const copyDealerDashboardUrl = (token: string) => {
        const url = `${window.location.origin}/dealer/${token}/dashboard`;
        navigator.clipboard.writeText(url);
        setCopiedDashToken(token);
        setTimeout(() => setCopiedDashToken(''), 2000);
    };

    const handleToggleDealer = async (id: string, current: boolean) => {
        await supabase.from('aone_pro_caddypro_dealers').update({ is_active: !current }).eq('id', id);
        loadDealers();
    };

    const copyDealerUrl = (token: string) => {
        const url = `${window.location.origin}/dealer/${token}`;
        navigator.clipboard.writeText(url);
        setCopiedToken(token);
        setTimeout(() => setCopiedToken(''), 2000);
    };

    const handleMarkSettled = async (ids: string[]) => {
        if (!confirm(`${ids.length}건을 정산 완료 처리할까요?`)) return;
        await supabase
            .from('aone_pro_caddypro_settlements')
            .update({ settled: true, settled_at: new Date().toISOString() })
            .in('id', ids);
        loadSettlements();
    };

    // ── 크레딧 충전 ──
    const handleChargeCredit = async () => {
        if (!creditModalDealer || creditQty < 1) return;
        setIsChargingCredit(true);
        const col = CREDIT_COL_ADMIN[creditTier][creditPlan];
        const current = (creditModalDealer[col as keyof Dealer] as number) ?? 0;
        const { error } = await supabase
            .from('aone_pro_caddypro_dealers')
            .update({ [col]: current + creditQty })
            .eq('id', creditModalDealer.id);
        if (error) { alert(`충전 실패: ${error.message}`); setIsChargingCredit(false); return; }
        await supabase.from('aone_pro_caddypro_dealer_credit_history').insert({
            dealer_id: creditModalDealer.id,
            type: 'charge',
            plan: creditPlan,
            tier: creditTier,
            qty: creditQty,
            memo: `관리자 충전`,
        });
        setIsChargingCredit(false);
        setCreditModalDealer(null);
        loadDealers();
    };

    const handleLicenseSearchKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') searchLicenses(licenseSearch);
    };

    const formatDate = (iso: string | null) => {
        if (!iso) return '-';
        return new Date(iso).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
    };

    const getDaysLeft = (expiresAt: string | null) => {
        if (!expiresAt) return null;
        const diff = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
        return diff;
    };

    if (!isAuthorized) {
        const isLocked = lockoutExpiry && lockoutExpiry > Date.now();
        return (
            <div className="fixed inset-0 bg-stone-900 flex items-center justify-center p-6 text-white z-[10000]">
                <form onSubmit={handleAuth} className="w-full max-w-xs space-y-6 text-center">
                    <ShieldCheck size={64} className={`mx-auto mb-2 ${isLocked ? 'text-red-500' : 'text-emerald-500'}`} />
                    <h1 className="text-xl font-black">관리자 인증</h1>
                    <p className="text-stone-700 text-sm">대표님 전용 관리 페이지입니다.</p>
                    {isLocked ? (
                        <div className="bg-red-500/20 border border-red-500/50 p-4 rounded-2xl text-red-400 text-sm font-bold">
                            {Math.ceil((lockoutExpiry! - Date.now()) / 60000)}분간 차단됨
                        </div>
                    ) : (
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                            placeholder="관리자 암호 입력"
                            className="w-full p-4 bg-stone-800 border-none rounded-2xl text-center text-xl tracking-wider font-mono focus:ring-2 focus:ring-emerald-500"
                            autoFocus />
                    )}
                    {!isLocked && <button type="submit" className="w-full bg-emerald-600 py-4 rounded-2xl font-bold text-lg">로그인</button>}
                    <Link href="/" className="block text-stone-700 text-sm font-bold mt-4">나가기</Link>
                </form>
            </div>
        );
    }

    const planBase = PLANS[plan].days;
    const minDays = Math.max(1, planBase - 15);
    const maxDays = planBase + 30;

    // 정산 필터링
    const filteredSettlements = settlements
        .filter(s => settlementFilter === 'all' ? true : settlementFilter === 'pending' ? !s.settled : s.settled)
        .filter(s => selectedDealerFilter === 'all' ? true : s.dealer_id === selectedDealerFilter);
    const pendingTotal = filteredSettlements.filter(s => !s.settled).reduce((acc, s) => acc + s.commission_amount, 0);
    const uniqueDealersInSettlements = Array.from(new Map(settlements.map(s => [s.dealer_id, s.dealer?.name || s.dealer_id])));

    const handleRestoreSearch = async () => {
        const code = restoreCode.trim().toUpperCase();
        if (!code) return;
        setRestoreStatus('loading');
        setRestoreData(null);
        try {
            const res = await fetch('/api/backup/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseCode: code }),
            });
            if (res.status === 404) { setRestoreStatus('notfound'); return; }
            if (!res.ok) { setRestoreStatus('error'); return; }
            const json = await res.json();
            setRestoreData(json);
            setRestoreStatus('found');
        } catch {
            setRestoreStatus('error');
        }
    };

    const handlePhoneSearch = async () => {
        const phone = restoreSearchPhone.trim();
        const name = restoreSearchName.trim();
        if (!phone && !name) return;
        setRestoreSearching(true);
        setRestoreSearchResults([]);
        try {
            // 전화번호로 검색 (있으면)
            if (phone) {
                const single = await searchLicenseByPhone(phone);
                if (single.found && single.id && single.code) {
                    // 이름 필터 적용
                    if (!name || (single.userName && single.userName.includes(name))) {
                        setRestoreSearchResults([{
                            id: single.id, code: single.code!, plan: single.plan || '',
                            expiresAt: single.expiresAt ?? null, userName: single.userName ?? null,
                            isExpired: single.isExpired ?? false,
                        }]);
                    } else {
                        setRestoreSearchResults([]);
                    }
                } else {
                    setRestoreSearchResults([]);
                }
            } else {
                // 이름만으로 검색
                const { data } = await supabase
                    .from('aone_pro_caddypro_licenses')
                    .select('id, code, plan, expires_at, user_name, is_active')
                    .ilike('user_name', `%${name}%`)
                    .order('expires_at', { ascending: false })
                    .limit(20);
                if (data) {
                    const now = new Date();
                    setRestoreSearchResults(data.map((d: any) => ({
                        id: d.id, code: d.code, plan: d.plan,
                        expiresAt: d.expires_at, userName: d.user_name,
                        isExpired: d.expires_at ? now > new Date(d.expires_at) : false,
                    })));
                }
            }
        } finally {
            setRestoreSearching(false);
        }
    };

    const handleRestoreDownload = () => {
        if (!restoreData) return;
        const blob = new Blob([JSON.stringify(restoreData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `caddy-restore-${restoreCode.trim().toUpperCase()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleFileRestore = async () => {
        const code = importCode.trim().toUpperCase();
        if (!code || !importFile) return;

        // 1단계: 이용권 코드 존재 확인
        setImportStatus('running');
        setImportLog('이용권 코드 확인 중...');
        const { data: licenseRow, error: licenseErr } = await supabase
            .from('aone_pro_caddypro_licenses')
            .select('id, user_name')
            .eq('code', code)
            .maybeSingle();
        if (licenseErr || !licenseRow) {
            setImportLog(`❌ 이용권 코드 [${code}] 가 존재하지 않습니다. 코드를 다시 확인해주세요.`);
            setImportStatus('error');
            return;
        }

        if (!confirm(`[${code}] ${licenseRow.user_name ?? ''} — 백업 파일 데이터를 수파베이스에 추가합니다 (기존 데이터 유지). 계속할까요?`)) {
            setImportStatus('idle');
            setImportLog('');
            return;
        }

        try {
            const text = await importFile.text();
            const data = JSON.parse(text);
            const schedules = (data.schedules || []).map((s: any) => ({ ...s, holes: s.holes ?? 18 }));
            const transactions: any[] = data.transactions || [];
            const clients: any[] = data.clients || [];

            const headers = { 'Content-Type': 'application/json', 'x-license-code': code };
            let sFail = 0, tFail = 0, cFail = 0;

            // DELETE 없이 upsert
            setImportLog(`스케줄 ${schedules.length}건 저장 중...`);
            for (const s of schedules) {
                const r = await fetch('/api/db/schedules', { method: 'POST', headers, body: JSON.stringify(s) });
                if (!r.ok && r.status !== 409) sFail++;
            }
            setImportLog(`거래내역 ${transactions.length}건 저장 중...`);
            for (const t of transactions) {
                const r = await fetch('/api/db/transactions', { method: 'POST', headers, body: JSON.stringify(t) });
                if (!r.ok) tFail++;
            }
            setImportLog(`고객 ${clients.length}건 저장 중...`);
            for (const c of clients) {
                const r = await fetch('/api/db/clients', { method: 'POST', headers, body: JSON.stringify(c) });
                if (!r.ok) cFail++;
            }

            const failMsg = (sFail + tFail + cFail) > 0
                ? ` (실패: 스케줄 ${sFail}, 거래 ${tFail}, 고객 ${cFail})`
                : '';
            setImportLog(`✅ 완료! 스케줄 ${schedules.length - sFail}건 / 거래 ${transactions.length - tFail}건 / 고객 ${clients.length - cFail}건${failMsg}`);
            setImportStatus('done');
        } catch (e: any) {
            setImportLog(`❌ 오류: ${e?.message ?? '알 수 없는 오류'}`);
            setImportStatus('error');
        }
    };

    const handleIssueReceipt = async () => {
        const cleanIdentifier = receiptIdentifier.replace(/[^0-9]/g, '');
        const cleanAmount = parseInt(receiptAmount.replace(/[^0-9]/g, ''), 10);
        if (!cleanIdentifier || !cleanAmount) return;
        setIsIssuingReceipt(true);
        setReceiptResult(null);
        try {
            const res = await fetch('/api/admin/cash-receipt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    adminPassword: '0827',
                    amount: cleanAmount,
                    type: receiptType,
                    identifier: cleanIdentifier,
                    orderName: receiptOrderName || 'Caddy Manager Pro 이용권',
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setReceiptResult({ success: true, message: '현금영수증 발행 완료!', receiptUrl: data.receiptUrl });
                setReceiptIdentifier('');
                setReceiptAmount('');
            } else {
                setReceiptResult({ success: false, message: data.error || '발행 실패' });
            }
        } catch {
            setReceiptResult({ success: false, message: '네트워크 오류' });
        } finally {
            setIsIssuingReceipt(false);
        }
    };

    const TABS: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
        { key: 'issue',       label: '코드발급',  icon: <Key size={14} /> },
        { key: 'licenses',    label: '이용내역',  icon: <Search size={14} /> },
        { key: 'dealers',     label: '딜러관리',  icon: <Link2 size={14} /> },
        { key: 'settlements', label: '정산관리',  icon: <Receipt size={14} /> },
        { key: 'caddy',       label: '캐디관리',  icon: <Users2 size={14} /> },
        { key: 'restore',     label: '데이터복구', icon: <HardDriveDownload size={14} /> },
        { key: 'receipt',     label: '영수증발행', icon: <BadgeCheck size={14} /> },
    ];

    return (
        <div className="bg-stone-950 min-h-screen pb-24 text-white">
            {/* ── 크레딧 충전 모달 ── */}
            {creditModalDealer && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4" onClick={() => setCreditModalDealer(null)}>
                    <div className="bg-stone-900 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl border border-stone-700" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-bold text-white">
                                <Coins size={18} className="text-blue-400" /> 크레딧 충전
                            </div>
                            <button onClick={() => setCreditModalDealer(null)} className="text-stone-500 hover:text-stone-300">
                                <X size={20} />
                            </button>
                        </div>
                        <p className="text-stone-300 text-sm font-bold">{creditModalDealer.name}</p>

                        {/* 티어 선택 */}
                        <div className="grid grid-cols-2 gap-2">
                            {(['standard', 'premium'] as const).map(t => (
                                <button key={t} onClick={() => setCreditTier(t)}
                                    className={`py-2.5 rounded-xl text-sm font-bold border-2 transition ${creditTier === t ? (t === 'premium' ? 'border-emerald-500 bg-emerald-900/40 text-emerald-300' : 'border-blue-500 bg-blue-900/40 text-blue-300') : 'border-stone-700 text-stone-400'}`}>
                                    {t === 'premium' ? '⭐ 프리미엄' : '스탠다드'}
                                </button>
                            ))}
                        </div>

                        {/* 플랜 선택 */}
                        <div className="grid grid-cols-3 gap-2">
                            {([['month','1개월'], ['6month','6개월'], ['year','1년']] as [PlanType, string][]).map(([key, label]) => (
                                <button key={key} onClick={() => setCreditPlan(key)}
                                    className={`py-2.5 rounded-xl text-sm font-bold border-2 transition ${creditPlan === key ? 'border-blue-500 bg-blue-900/40 text-blue-300' : 'border-stone-700 text-stone-400'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* 공급가 표시 */}
                        <div className="bg-stone-800 rounded-2xl p-3 text-center">
                            <p className="text-xs text-stone-500">공급가 (장당)</p>
                            <p className="text-xl font-black text-white">
                                ₩{(CREDIT_PRICE[creditTier][creditPlan]).toLocaleString()}
                            </p>
                        </div>

                        {/* 수량 */}
                        <div className="flex items-center gap-4">
                            <button onClick={() => setCreditQty(q => Math.max(1, q - 1))}
                                className="w-11 h-11 bg-stone-800 hover:bg-stone-700 rounded-full flex items-center justify-center">
                                <Minus size={18} className="text-stone-300" />
                            </button>
                            <div className="flex-1 text-center">
                                <p className="text-3xl font-black text-white">{creditQty}장</p>
                                <p className="text-xs text-stone-500">합계 ₩{(CREDIT_PRICE[creditTier][creditPlan] * creditQty).toLocaleString()}</p>
                            </div>
                            <button onClick={() => setCreditQty(q => Math.min(100, q + 1))}
                                className="w-11 h-11 bg-stone-800 hover:bg-stone-700 rounded-full flex items-center justify-center">
                                <Plus size={18} className="text-stone-300" />
                            </button>
                        </div>

                        <button onClick={handleChargeCredit} disabled={isChargingCredit}
                            className="w-full py-4 bg-blue-600 text-white font-black text-lg rounded-2xl hover:bg-blue-700 disabled:opacity-60 transition flex items-center justify-center gap-2">
                            {isChargingCredit ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Coins size={20} />}
                            {isChargingCredit ? '충전 중...' : `${creditQty}장 충전하기`}
                        </button>
                    </div>
                </div>
            )}
            <header className="bg-stone-950 border-b border-stone-800 px-6 pt-12 pb-4 sticky top-0 z-10">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <Link href="/settings" className="inline-flex items-center text-stone-400 text-xs font-bold gap-1 mb-1">
                            <ChevronLeft size={14} /> 설정
                        </Link>
                        <h1 className="text-xl font-black text-white flex items-center gap-2">
                            <ShieldCheck size={20} className="text-emerald-400" /> 관리자 도구
                        </h1>
                    </div>
                </div>
                {/* 탭 */}
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                    {TABS.map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                                activeTab === tab.key
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-white'
                            }`}>
                            {tab.icon}{tab.label}
                        </button>
                    ))}
                </div>
            </header>

            <div className="p-6 space-y-6">

                {/* ══ 탭: 코드 발급 ══ */}
                {activeTab === 'issue' && (
                    <div className="space-y-4">
                        <section className="bg-stone-900 rounded-3xl p-5 space-y-4">
                            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                <Key size={16} /> 이용권 코드 발급
                            </div>

                            {/* 채널 선택 */}
                            <div>
                                <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest mb-2">판매 채널</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {(Object.entries(CHANNELS) as [ChannelType, string][]).map(([key, label]) => (
                                        <button key={key} onClick={() => setChannel(key)}
                                            className={`py-2.5 rounded-2xl text-[11px] font-bold transition ${channel === key ? 'bg-emerald-700 text-white' : 'bg-stone-800 text-stone-400 hover:text-white'}`}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 이용권 종류 (스탠다드/프리미엄) */}
                            <div>
                                <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest mb-2">이용권 종류</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setIssueTier('standard')}
                                        className={`py-3 rounded-2xl text-sm font-bold transition ${issueTier === 'standard' ? 'bg-emerald-700 text-white border-2 border-emerald-500' : 'bg-stone-800 text-stone-400 border-2 border-transparent'}`}>
                                        <p>스탠다드</p>
                                        <p className="text-[10px] mt-0.5 opacity-70">수동 복구</p>
                                    </button>
                                    <button onClick={() => setIssueTier('premium')}
                                        className={`py-3 rounded-2xl text-sm font-bold transition relative ${issueTier === 'premium' ? 'bg-amber-600 text-white border-2 border-amber-400' : 'bg-stone-800 text-stone-400 border-2 border-transparent'}`}>
                                        <span className="absolute top-1.5 right-1.5 bg-amber-500/30 text-amber-200 text-[8px] font-black px-1.5 py-0.5 rounded-full">추천</span>
                                        <p>⭐ 프리미엄</p>
                                        <p className="text-[10px] mt-0.5 opacity-70">자동 복구</p>
                                    </button>
                                </div>
                            </div>

                            {/* 요금제 선택 */}
                            <div>
                                <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest mb-2">요금제</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {(Object.entries(PLANS) as [PlanType, typeof PLANS[PlanType]][]).map(([key, info]) => (
                                        <button key={key} onClick={() => setPlan(key)}
                                            className={`py-3 rounded-2xl text-center transition border-2 ${plan === key ? 'bg-stone-700 border-blue-500' : 'bg-stone-800 border-transparent'}`}>
                                            <p className="text-xs font-bold text-stone-200">{info.label}</p>
                                            <p className="text-[9px] text-stone-500 mt-0.5">{info.days}일</p>
                                            <p className={`text-[11px] font-black mt-1 ${issueTier === 'premium' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                ₩{TIER_PRICES[issueTier][key].toLocaleString()}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 일수 조정 */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">부여 일수</p>
                                    <p className="text-stone-600 text-[10px]">{minDays}~{maxDays}일 조정 가능</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button onClick={() => setDays(d => Math.max(minDays, d - 5))}
                                        className="w-12 h-12 bg-stone-800 hover:bg-stone-700 rounded-full flex items-center justify-center transition">
                                        <Minus size={18} className="text-stone-300" />
                                    </button>
                                    <div className="flex-1 text-center text-3xl font-black text-white">{days}일</div>
                                    <button onClick={() => setDays(d => Math.min(maxDays, d + 5))}
                                        className="w-12 h-12 bg-stone-800 hover:bg-stone-700 rounded-full flex items-center justify-center transition">
                                        <Plus size={18} className="text-stone-300" />
                                    </button>
                                </div>
                            </div>

                            {/* 고객 정보 */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-stone-400 text-[10px] font-bold mb-1.5 block">고객 이름 (선택)</label>
                                    <input value={userName} onChange={e => setUserName(e.target.value)}
                                        placeholder="홍길동"
                                        className="w-full p-3 bg-stone-800 border border-stone-700 rounded-xl text-white placeholder-stone-600 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
                                </div>
                                <div>
                                    <label className="text-stone-400 text-[10px] font-bold mb-1.5 block">연락처 (필수: 문자 발송)</label>
                                    <input value={userPhone} onChange={e => {
                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                        let formatted = raw;
                                        if (raw.length > 7) formatted = raw.slice(0,3)+'-'+raw.slice(3,7)+'-'+raw.slice(7,11);
                                        else if (raw.length > 3) formatted = raw.slice(0,3)+'-'+raw.slice(3);
                                        setUserPhone(formatted);
                                    }}
                                        type="tel" placeholder="010-0000-0000"
                                        className="w-full p-3 bg-stone-800 border border-stone-700 rounded-xl text-white placeholder-stone-600 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
                                </div>
                            </div>

                            {/* 메모 */}
                            <div>
                                <label className="text-stone-400 text-[10px] font-bold mb-1.5 block">메모 (선택)</label>
                                <input value={memo} onChange={e => setMemo(e.target.value)}
                                    placeholder="예: 3월 이벤트, 기기변경 복원 요청..."
                                    className="w-full p-3 bg-stone-800 border border-stone-700 rounded-xl text-white placeholder-stone-600 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
                            </div>

                            <button onClick={handleIssue} disabled={isIssuing}
                                className={`w-full py-5 rounded-3xl font-black text-xl flex items-center justify-center gap-3 transition disabled:opacity-50 ${
                                    issueTier === 'premium'
                                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-stone-900'
                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                }`}>
                                {isIssuing ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Key size={22} />}
                                {isIssuing ? '발급 중...' : `${issueTier === 'premium' ? '⭐ 프리미엄' : '스탠다드'} 이용권 발급`}
                            </button>
                        </section>

                        {/* 발급 결과 */}
                        {generatedKey && (
                            <section className={`p-6 rounded-3xl text-white shadow-xl ${issueTier === 'premium' ? 'bg-gradient-to-br from-amber-700 to-yellow-600' : 'bg-emerald-700'}`}>
                                <div className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-3">✅ 발급 완료</div>
                                <div className="flex flex-col items-center gap-4">
                                    <div className="text-4xl font-black tracking-[0.2em] font-mono">{generatedKey}</div>
                                    <div className="flex gap-2 flex-wrap justify-center text-xs text-white/80">
                                        <span className="bg-white/20 px-2 py-1 rounded-full">{CHANNELS[channel]}</span>
                                        <span className="bg-white/20 px-2 py-1 rounded-full">{PLANS[plan].label} ({days}일)</span>
                                        <span className="bg-white/20 px-2 py-1 rounded-full">{issueTier === 'premium' ? '⭐ 프리미엄' : '스탠다드'}</span>
                                    </div>
                                    <button onClick={handleCopy}
                                        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-6 py-2 rounded-full text-xs font-bold transition">
                                        {copied ? <Check size={14} /> : <Copy size={14} />}
                                        {copied ? '복사 완료!' : '코드 복사'}
                                    </button>
                                </div>
                                <div className="mt-4 pt-4 border-t border-white/10 text-[10px] text-white/40 text-center">
                                    구매자에게 전달하세요 · 오늘 총 {generatedCount}개 발급
                                </div>
                            </section>
                        )}
                    </div>
                )}

                {/* ══ 탭: 이용권 내역 ══ */}
                {activeTab === 'licenses' && (
                    <div className="space-y-4">
                        <div className="relative">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-700" />
                            <input
                                value={licenseSearch}
                                onChange={e => setLicenseSearch(e.target.value)}
                                onKeyDown={handleLicenseSearchKey}
                                placeholder="고객 이름, 전화번호, 코드로 검색 (Enter)"
                                className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
                            />
                            <button onClick={() => searchLicenses(licenseSearch)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 bg-stone-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl">
                                검색
                            </button>
                        </div>

                        {licenseLoading && (
                            <div className="flex justify-center py-8">
                                <RefreshCcw size={24} className="animate-spin text-stone-700" />
                            </div>
                        )}

                        {!licenseLoading && licenses.length === 0 && (
                            <p className="text-center text-stone-700 text-sm py-8">검색 결과가 없습니다.</p>
                        )}

                        {!licenseLoading && licenses.map(lic => {
                            const daysLeft = getDaysLeft(lic.expires_at);
                            const isExpired = daysLeft !== null && daysLeft <= 0;
                            const isWarning = daysLeft !== null && daysLeft > 0 && daysLeft <= 7;
                            const isExpanded = expandedLicense === lic.id;

                            return (
                                <div key={lic.id}
                                    className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isExpired ? 'border-red-100' : isWarning ? 'border-amber-100' : 'border-stone-100'}`}>
                                    <button className="w-full p-4 text-left" onClick={() => setExpandedLicense(isExpanded ? null : lic.id)}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {isExpired ? <AlertCircle size={16} className="text-red-400 shrink-0" />
                                                    : isWarning ? <Clock size={16} className="text-amber-400 shrink-0" />
                                                    : <BadgeCheck size={16} className="text-emerald-500 shrink-0" />}
                                                <div>
                                                    <p className="font-bold text-stone-900 text-sm">
                                                        {lic.user_name || '(이름 없음)'}
                                                        {lic.user_phone && <span className="text-stone-700 font-normal ml-2 text-xs">{lic.user_phone}</span>}
                                                    </p>
                                                    <p className="font-mono text-xs text-stone-700 tracking-wider">{lic.code}</p>
                                                </div>
                                            </div>
                                            <div className="text-right flex items-center gap-2">
                                                <div>
                                                    {daysLeft === null
                                                        ? <span className="text-[10px] text-stone-700">미사용</span>
                                                        : isExpired
                                                        ? <span className="text-[10px] font-bold text-red-500">만료됨</span>
                                                        : <span className={`text-[10px] font-bold ${isWarning ? 'text-amber-600' : 'text-emerald-600'}`}>{daysLeft}일 남음</span>
                                                    }
                                                </div>
                                                {isExpanded ? <ChevronUp size={14} className="text-stone-700" /> : <ChevronDown size={14} className="text-stone-700" />}
                                            </div>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="px-4 pb-4 border-t border-stone-50 pt-3 space-y-2">
                                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                <div><span className="text-stone-700">채널</span> <span className="font-bold ml-1">{CHANNELS[lic.channel as ChannelType] || lic.channel}</span></div>
                                                <div><span className="text-stone-700">요금제</span> <span className="font-bold ml-1">{PLANS[lic.plan as PlanType]?.label || lic.plan} ({lic.days}일)</span></div>
                                                <div><span className="text-stone-700">발급일</span> <span className="font-bold ml-1">{formatDate(lic.created_at)}</span></div>
                                                <div><span className="text-stone-700">첫 사용</span> <span className="font-bold ml-1">{formatDate(lic.first_used_at)}</span></div>
                                                <div><span className="text-stone-700">만료일</span> <span className="font-bold ml-1">{formatDate(lic.expires_at)}</span></div>
                                                <div><span className="text-stone-700">발급자</span> <span className="font-bold ml-1">{lic.issued_by}</span></div>
                                            </div>
                                            {lic.memo && <p className="text-[11px] text-stone-700 bg-stone-50 p-2 rounded-xl">📝 {lic.memo}</p>}
                                            <button onClick={() => { navigator.clipboard.writeText(lic.code); }}
                                                className="flex items-center gap-1 text-[10px] bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-xl font-bold text-stone-600 transition">
                                                <Copy size={11} /> 코드 복사 (기기변경 복원용)
                                            </button>

                                            {/* 보너스 일수 부여 */}
                                            <div className="flex items-center gap-2 pt-1">
                                                <span className="text-[10px] text-stone-500 font-bold whitespace-nowrap">🎁 보너스</span>
                                                {[7, 14, 30, 60, 90].map(d => (
                                                    <button key={d}
                                                        onClick={async () => {
                                                            if (!confirm(`${lic.user_name || '이 고객'}에게 ${d}일 보너스를 추가하시겠습니까?`)) return;
                                                            setBonusLoading(lic.id);
                                                            const cur = await supabase.from('aone_pro_caddypro_licenses').select('expires_at').eq('id', lic.id).maybeSingle();
                                                            const base = cur.data?.expires_at && new Date(cur.data.expires_at) > new Date() ? new Date(cur.data.expires_at) : new Date();
                                                            const newExp = new Date(base.getTime() + d * 86_400_000);
                                                            await supabase.from('aone_pro_caddypro_licenses').update({ expires_at: newExp.toISOString(), is_active: true }).eq('id', lic.id);
                                                            setBonusLoading(null);
                                                            alert(`✅ ${d}일 추가 완료!\n새 만료일: ${newExp.toLocaleDateString('ko-KR')}`);
                                                            searchLicenses(licenseSearch);
                                                        }}
                                                        disabled={bonusLoading === lic.id}
                                                        className="text-[10px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-2 py-1 rounded-lg transition disabled:opacity-40">
                                                        +{d}일
                                                    </button>
                                                ))}
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number" min={1} max={365}
                                                        value={bonusDays[lic.id] ?? ''}
                                                        onChange={e => setBonusDays(prev => ({ ...prev, [lic.id]: Number(e.target.value) }))}
                                                        placeholder="직접"
                                                        className="w-14 text-[10px] border border-stone-200 rounded-lg px-1.5 py-1 text-center focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                                    />
                                                    <button
                                                        onClick={async () => {
                                                            const d = bonusDays[lic.id];
                                                            if (!d || d < 1) return;
                                                            if (!confirm(`${lic.user_name || '이 고객'}에게 ${d}일 보너스를 추가하시겠습니까?`)) return;
                                                            setBonusLoading(lic.id);
                                                            const cur = await supabase.from('aone_pro_caddypro_licenses').select('expires_at').eq('id', lic.id).maybeSingle();
                                                            const base = cur.data?.expires_at && new Date(cur.data.expires_at) > new Date() ? new Date(cur.data.expires_at) : new Date();
                                                            const newExp = new Date(base.getTime() + d * 86_400_000);
                                                            await supabase.from('aone_pro_caddypro_licenses').update({ expires_at: newExp.toISOString(), is_active: true }).eq('id', lic.id);
                                                            setBonusLoading(null);
                                                            alert(`✅ ${d}일 추가 완료!\n새 만료일: ${newExp.toLocaleDateString('ko-KR')}`);
                                                            setBonusDays(prev => ({ ...prev, [lic.id]: 0 }));
                                                            searchLicenses(licenseSearch);
                                                        }}
                                                        disabled={!bonusDays[lic.id] || bonusLoading === lic.id}
                                                        className="text-[10px] font-bold bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded-lg transition disabled:opacity-40">
                                                        추가
                                                    </button>
                                                </div>
                                                {bonusLoading === lic.id && <span className="text-[10px] text-emerald-600 animate-pulse">처리 중...</span>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        <p className="text-center text-stone-700 text-[10px]">최근 50건 표시 · 검색으로 더 찾기</p>
                    </div>
                )}

                {/* ══ 탭: 딜러 관리 ══ */}
                {activeTab === 'dealers' && (
                    <div className="space-y-6">
                        <section className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
                                <Link2 size={18} /> 현장 딜러 관리
                            </div>
                            <p className="text-stone-700 text-[11px] leading-relaxed">
                                딜러를 등록하면 전용 URL이 생성됩니다. 딜러는 현장에서 고객 정보를 입력하고 즉시 이용권을 발급할 수 있습니다.
                            </p>

                            {/* 딜러 등록 폼 오류 모달 */}
                            {dealerFormError && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={() => setDealerFormError('')}>
                                    <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-xs w-full text-center space-y-4" onClick={e => e.stopPropagation()}>
                                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                                            <AlertCircle size={24} className="text-red-500" />
                                        </div>
                                        <p className="text-stone-800 text-sm font-bold whitespace-pre-line">{dealerFormError}</p>
                                        <button onClick={() => setDealerFormError('')}
                                            className="w-full bg-stone-900 text-white font-bold py-3 rounded-2xl text-sm">
                                            확인
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <input value={newDealerName} onChange={e => setNewDealerName(e.target.value)}
                                        placeholder="딜러 이름 *"
                                        className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none" />
                                    <input
                                        value={newDealerPhone}
                                        onChange={e => {
                                            const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                                            let formatted = digits;
                                            if (digits.length >= 4 && digits.length <= 7) formatted = digits.slice(0,3) + '-' + digits.slice(3);
                                            else if (digits.length >= 8) formatted = digits.slice(0,3) + '-' + digits.slice(3,7) + '-' + digits.slice(7);
                                            setNewDealerPhone(formatted);
                                        }}
                                        placeholder="010-0000-0000"
                                        inputMode="tel"
                                        className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none" />
                                </div>
                                <input value={newDealerEmail} onChange={e => setNewDealerEmail(e.target.value)}
                                    placeholder="이메일 (선택)"
                                    type="email" inputMode="email"
                                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none" />
                                <input value={newDealerPin} onChange={e => setNewDealerPin(e.target.value)}
                                    placeholder="대시보드 PIN (4~8자리, 선택)"
                                    inputMode="numeric" maxLength={8}
                                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none" />
                            </div>
                            <button onClick={handleAddDealer} disabled={isAddingDealer}
                                className="w-full bg-blue-600 text-white font-bold py-3 rounded-2xl hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-60">
                                <UserPlus size={18} /> {isAddingDealer ? '등록 중...' : '딜러 등록'}
                            </button>

                            {dealers.length > 0 && (
                                <div className="space-y-2 mt-2">
                                    {dealers.map(d => (
                                        <div key={d.id} className={`p-4 rounded-2xl border ${d.is_active ? 'bg-blue-50 border-blue-100' : 'bg-stone-50 border-stone-200 opacity-60'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div>
                                                    <span className="font-bold text-sm text-stone-800">{d.name}</span>
                                                    {d.phone && <span className="text-stone-700 text-xs ml-2">{d.phone}</span>}
                                                    <span className="ml-2 text-[10px] text-stone-700">누적 {d.total_issued}건</span>
                                                    {d.pin && <span className="ml-2 text-[10px] text-stone-700">PIN: {d.pin}</span>}
                                                </div>
                                                <button onClick={() => handleToggleDealer(d.id, d.is_active)}
                                                    className={`text-[10px] font-bold px-2 py-1 rounded-full ${d.is_active ? 'bg-blue-100 text-blue-700' : 'bg-stone-200 text-stone-700'}`}>
                                                    {d.is_active ? '활성' : '비활성'}
                                                </button>
                                            </div>
                                            {/* 크레딧 현황 */}
                                            <div className="mb-2 flex flex-wrap gap-1">
                                                {[
                                                    { label: '1개월', col: 'credits_month', val: d.credits_month },
                                                    { label: '6개월', col: 'credits_6month', val: d.credits_6month },
                                                    { label: '1년',   col: 'credits_year',   val: d.credits_year },
                                                    { label: '1개월P', col: 'credits_month_premium', val: d.credits_month_premium },
                                                    { label: '6개월P', col: 'credits_6month_premium', val: d.credits_6month_premium },
                                                    { label: '1년P',   col: 'credits_year_premium',   val: d.credits_year_premium },
                                                ].map(item => (
                                                    <span key={item.col} className={`flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${item.val > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-400'}`}>
                                                        <Coins size={8} /> {item.label} {item.val}
                                                    </span>
                                                ))}
                                                <button onClick={() => { setCreditModalDealer(d); setCreditPlan('month'); setCreditTier('standard'); setCreditQty(1); }}
                                                    className="flex items-center gap-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-stone-500 text-white hover:bg-stone-600 transition">
                                                    <Plus size={8} /> 수동충전(비상용)
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <code className="text-[10px] bg-white/70 px-2 py-1 rounded-lg font-mono text-stone-600 flex-1 truncate">
                                                    /dealer/{d.token}
                                                </code>
                                                <button onClick={() => copyDealerUrl(d.token)}
                                                    className="flex items-center gap-1 text-[10px] bg-blue-600 text-white px-2 py-1 rounded-lg font-bold hover:bg-blue-700 transition shrink-0">
                                                    {copiedToken === d.token ? <Check size={12} /> : <Copy size={12} />}
                                                    {copiedToken === d.token ? '복사됨' : '발급 URL'}
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <code className="text-[10px] bg-emerald-50 px-2 py-1 rounded-lg font-mono text-emerald-700 flex-1 truncate">
                                                    /dealer/{d.token}/dashboard
                                                </code>
                                                <button onClick={() => copyDealerDashboardUrl(d.token)}
                                                    className="flex items-center gap-1 text-[10px] bg-emerald-600 text-white px-2 py-1 rounded-lg font-bold hover:bg-emerald-700 transition shrink-0">
                                                    {copiedDashToken === d.token ? <Check size={12} /> : <Copy size={12} />}
                                                    {copiedDashToken === d.token ? '복사됨' : '대시보드'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {dealers.length === 0 && (
                                <p className="text-center text-stone-500 text-xs py-4">등록된 딜러가 없습니다.</p>
                            )}
                        </section>
                    </div>
                )}

                {/* ══ 탭: 정산 관리 ══ */}
                {activeTab === 'settlements' && (
                    <div className="space-y-4">
                        {/* 필터 */}
                        <div className="flex gap-2 flex-wrap">
                            {(['pending', 'done', 'all'] as const).map(f => (
                                <button key={f} onClick={() => setSettlementFilter(f)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${settlementFilter === f ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200 text-stone-700'}`}>
                                    {f === 'pending' ? '미정산' : f === 'done' ? '정산완료' : '전체'}
                                </button>
                            ))}
                            <select value={selectedDealerFilter} onChange={e => setSelectedDealerFilter(e.target.value)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold border border-stone-200 bg-white text-stone-700 focus:outline-none">
                                <option value="all">전체 딜러</option>
                                {uniqueDealersInSettlements.map(([id, name]) => (
                                    <option key={id} value={id}>{name}</option>
                                ))}
                            </select>
                        </div>

                        {/* 미정산 합계 */}
                        {settlementFilter !== 'done' && pendingTotal > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">미지급 합계</p>
                                    <p className="text-2xl font-black text-amber-900">₩{pendingTotal.toLocaleString()}</p>
                                </div>
                                <button
                                    onClick={() => handleMarkSettled(filteredSettlements.filter(s => !s.settled).map(s => s.id))}
                                    className="bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-amber-700 transition">
                                    전체 정산완료
                                </button>
                            </div>
                        )}

                        {settlementLoading && (
                            <div className="flex justify-center py-8">
                                <RefreshCcw size={24} className="animate-spin text-stone-700" />
                            </div>
                        )}

                        {!settlementLoading && filteredSettlements.length === 0 && (
                            <p className="text-center text-stone-700 text-sm py-8">
                                {settlementFilter === 'pending' ? '미정산 내역이 없습니다.' : '내역이 없습니다.'}
                            </p>
                        )}

                        {!settlementLoading && filteredSettlements.map(s => (
                            <div key={s.id} className={`bg-white rounded-2xl border p-4 shadow-sm ${s.settled ? 'opacity-60 border-stone-100' : 'border-amber-100'}`}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-sm text-stone-900">{s.dealer?.name || '알 수 없는 딜러'}</span>
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${s.type === 'first' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                {s.type === 'first' ? '최초' : '재구독'}
                                            </span>
                                        </div>
                                        <p className="font-mono text-[10px] text-stone-700">{s.license_code}</p>
                                        <p className="text-[10px] text-stone-700 mt-1">{formatDate(s.created_at)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-stone-700">판매가 ₩{s.sale_amount.toLocaleString()}</p>
                                        <p className="text-lg font-black text-stone-900">₩{s.commission_amount.toLocaleString()}</p>
                                        <p className="text-[9px] text-stone-700">({Math.round(s.commission_rate * 100)}%)</p>
                                        {s.settled
                                            ? <p className="text-[10px] text-emerald-600 font-bold mt-1">✓ {formatDate(s.settled_at)}</p>
                                            : <button onClick={() => handleMarkSettled([s.id])}
                                                className="mt-1 text-[10px] bg-emerald-600 text-white px-2 py-1 rounded-lg font-bold hover:bg-emerald-700 transition">
                                                정산완료
                                              </button>
                                        }
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ══ 탭: 캐디 관리 ══ */}
                {activeTab === 'caddy' && (
                    <section className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
                            <Users2 size={18} className="text-emerald-600" /> 캐디 현황 관리
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Link href="/admin/holidays" className="flex flex-col items-center justify-center p-4 bg-stone-50 rounded-2xl border border-stone-100 hover:bg-emerald-50 hover:border-emerald-100 transition">
                                <CalendarX className="text-red-500 mb-2" size={24} />
                                <span className="text-xs font-bold text-stone-700">월간 휴무표</span>
                            </Link>
                            <Link href="/admin/reserves" className="flex flex-col items-center justify-center p-4 bg-stone-50 rounded-2xl border border-stone-100 hover:bg-blue-50 hover:border-blue-100 transition">
                                <Users2 className="text-blue-500 mb-2" size={24} />
                                <span className="text-xs font-bold text-stone-700">예비자 명단</span>
                            </Link>
                            <Link href="/admin/members" className="col-span-2 flex items-center justify-center gap-3 p-4 bg-emerald-600 rounded-2xl text-white hover:bg-emerald-700 transition shadow-lg mt-2">
                                <GripVertical size={20} />
                                <span className="font-bold">기본 순번(명단) 관리</span>
                            </Link>
                        </div>

                        <div className="bg-orange-50 p-5 rounded-2xl border border-orange-100 mt-4">
                            <h3 className="text-xs font-bold text-orange-800 mb-2">⚠️ 주의사항</h3>
                            <ul className="text-[10px] text-orange-700 space-y-1.5 leading-relaxed font-medium">
                                <li>• 이 페이지 주소는 본인만 알고 있어야 합니다.</li>
                                <li>• 딜러 URL은 딜러 본인에게만 공유하세요.</li>
                                <li>• 발급된 코드는 Supabase DB에 기록됩니다.</li>
                            </ul>
                        </div>
                    </section>
                )}

                {activeTab === 'restore' && (
                    <section className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm space-y-5">
                        <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
                            <HardDriveDownload size={18} className="text-blue-600" /> 데이터 복구
                        </div>

                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-xs text-blue-800 leading-relaxed font-medium space-y-1">
                            <p className="font-bold">💾 복구 서비스 안내</p>
                            <p>• 복구비 수취 후 아래에서 이용권 코드를 조회하세요.</p>
                            <p>• JSON 파일을 다운로드하여 고객에게 전달합니다.</p>
                            <p>• 고객은 설정 → 파일 불러오기로 복원합니다.</p>
                        </div>

                        {/* 검색 모드 토글 */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setRestoreSearchMode('code'); setRestoreSearchResults([]); }}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition ${restoreSearchMode === 'code' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-stone-500 border-stone-200 hover:border-blue-300'}`}
                            >
                                🔑 이용권 코드로 찾기
                            </button>
                            <button
                                onClick={() => { setRestoreSearchMode('phone'); setRestoreStatus('idle'); setRestoreData(null); }}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition ${restoreSearchMode === 'phone' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-stone-500 border-stone-200 hover:border-blue-300'}`}
                            >
                                🔍 이름·전화로 찾기
                            </button>
                        </div>

                        {restoreSearchMode === 'code' ? (
                        /* 코드 입력 */
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={restoreCode}
                                onChange={e => { setRestoreCode(e.target.value); setRestoreStatus('idle'); }}
                                onKeyDown={e => e.key === 'Enter' && handleRestoreSearch()}
                                placeholder="이용권 코드 입력 (예: SM-2B4-F7A)"
                                className="flex-1 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono"
                            />
                            <button
                                onClick={handleRestoreSearch}
                                disabled={restoreStatus === 'loading' || !restoreCode.trim()}
                                className="px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition whitespace-nowrap"
                            >
                                {restoreStatus === 'loading' ? '조회 중…' : '백업 조회'}
                            </button>
                        </div>
                        ) : (
                        /* 이름 / 전화번호 검색 */
                        <div className="space-y-2">
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        value={restoreSearchName}
                                        onChange={e => setRestoreSearchName(e.target.value)}
                                        placeholder="이름 (예: 홍길동)"
                                        className="border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    />
                                    <input
                                        type="text"
                                        value={restoreSearchPhone}
                                        onChange={e => {
                                            const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
                                            const fmt = raw.length <= 3 ? raw : raw.length <= 7
                                                ? `${raw.slice(0,3)}-${raw.slice(3)}`
                                                : `${raw.slice(0,3)}-${raw.slice(3,7)}-${raw.slice(7)}`;
                                            setRestoreSearchPhone(fmt);
                                        }}
                                        onKeyDown={e => e.key === 'Enter' && handlePhoneSearch()}
                                        inputMode="tel"
                                        placeholder="전화번호 (예: 010-1234-5678)"
                                        className="border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    />
                                </div>
                                <button
                                    onClick={handlePhoneSearch}
                                    disabled={restoreSearching || (!restoreSearchPhone.trim() && !restoreSearchName.trim())}
                                    className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition flex items-center justify-center gap-1.5"
                                >
                                    {restoreSearching
                                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        : <Search size={14} />}
                                    검색
                                </button>
                            </div>
                            {/* 검색 결과 목록 */}
                            {!restoreSearching && restoreSearchResults.length === 0 && (restoreSearchPhone || restoreSearchName) && (
                                <p className="text-xs text-stone-400 text-center py-2">검색 결과가 없습니다.</p>
                            )}
                            {restoreSearchResults.length > 0 && (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {restoreSearchResults.map(r => (
                                        <div key={r.id}
                                            className="flex items-center justify-between border border-stone-200 rounded-xl px-4 py-3 bg-stone-50 hover:bg-blue-50 transition cursor-pointer"
                                            onClick={() => {
                                                setRestoreCode(r.code);
                                                setRestoreSearchMode('code');
                                                setRestoreSearchResults([]);
                                            }}
                                        >
                                            <div>
                                                <p className="text-sm font-bold text-stone-800">{r.userName || '이름 없음'}</p>
                                                <p className="font-mono text-xs text-stone-500">{r.code}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.isExpired ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {r.isExpired ? '만료' : '유효'}
                                                </span>
                                                <p className="text-[10px] text-stone-400 mt-0.5">
                                                    {r.expiresAt ? new Date(r.expiresAt).toLocaleDateString('ko-KR') : '-'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        )}

                        {/* 결과 */}
                        {restoreStatus === 'found' && restoreData && (
                            <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 space-y-3">
                                <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                                    <FileJson size={16} /> 백업 데이터 발견
                                </div>
                                <div className="text-xs text-stone-600 space-y-1">
                                    <p>코드: <span className="font-mono font-bold text-stone-800">{restoreCode.trim().toUpperCase()}</span></p>
                                    <p>데이터 크기: <span className="font-bold">{(JSON.stringify(restoreData).length / 1024).toFixed(1)} KB</span></p>
                                </div>
                                <button
                                    onClick={handleRestoreDownload}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition text-sm"
                                >
                                    <HardDriveDownload size={16} /> JSON 파일 다운로드
                                </button>
                            </div>
                        )}

                        {restoreStatus === 'notfound' && (
                            <div className="flex items-center gap-3 bg-stone-50 p-4 rounded-2xl border border-stone-200 text-stone-700 text-xs font-medium">
                                <CloudOff size={18} className="text-stone-700" />
                                해당 코드의 백업 데이터가 없습니다.
                            </div>
                        )}

                        {restoreStatus === 'error' && (
                            <div className="flex items-center gap-3 bg-red-50 p-4 rounded-2xl border border-red-100 text-red-600 text-xs font-medium">
                                <AlertCircle size={18} /> 조회 중 오류가 발생했습니다. 다시 시도해 주세요.
                            </div>
                        )}

                        {/* ── 파일 직접 복원 ── */}
                        <div className="border-t border-stone-100 pt-5 space-y-3">
                            <div className="flex items-center gap-2 text-stone-700 font-bold text-sm">
                                <FileJson size={16} className="text-violet-600" /> 파일로 직접 복원 (수파베이스 저장)
                            </div>
                            <input
                                type="text"
                                value={importCode}
                                onChange={e => { setImportCode(e.target.value); setImportStatus('idle'); setImportLog(''); }}
                                placeholder="이용권 코드 (예: DC-AWA-S72)"
                                className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 font-mono"
                            />
                            <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-stone-300 rounded-xl py-4 cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition">
                                <FileJson size={18} className="text-stone-400" />
                                <span className="text-sm text-stone-500">
                                    {importFile ? importFile.name : 'JSON 파일 선택'}
                                </span>
                                <input type="file" accept=".json" className="hidden"
                                    onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportStatus('idle'); setImportLog(''); }} />
                            </label>
                            <button
                                onClick={handleFileRestore}
                                disabled={!importCode.trim() || !importFile || importStatus === 'running'}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 disabled:opacity-40 transition text-sm"
                            >
                                {importStatus === 'running'
                                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> 복원 중...</>
                                    : <><HardDriveDownload size={16} /> 수파베이스로 복원</>}
                            </button>
                            {importLog && (
                                <div className={`p-3 rounded-xl text-xs font-mono border ${
                                    importStatus === 'done' ? 'bg-emerald-900/30 border-emerald-700 text-emerald-300' :
                                    importStatus === 'error' ? 'bg-red-900/30 border-red-700 text-red-400' :
                                    'bg-stone-800 border-stone-700 text-stone-400'
                                }`}>{importLog}</div>
                            )}
                        </div>
                    </section>
                )}

                {/* ══ 탭: 현금영수증 발행 ══ */}
                {activeTab === 'receipt' && (
                    <div className="space-y-4">
                        <h2 className="text-white font-bold text-sm flex items-center gap-2">
                            <BadgeCheck size={16} className="text-emerald-400" /> 현금영수증 발행 (본사 명의)
                        </h2>

                        {/* 🏢 사업자 딜러 경고 */}
                        <div className="bg-blue-900/20 border border-blue-700 rounded-2xl p-5 space-y-3">
                            <p className="font-black text-blue-300 text-base">🏢 사업자 딜러 — 본인 명의 직접 발행</p>
                            <p className="text-blue-100 text-sm leading-relaxed">사업자등록증이 있으면 <strong>본인 사업자 명의</strong>로 직접 발행하세요.</p>
                            <div className="bg-blue-950/60 rounded-xl p-4 space-y-1.5 text-xs text-blue-200 leading-relaxed">
                                <p className="font-bold text-blue-100 mb-2">발행 방법</p>
                                <p>① ARS <strong>126</strong> → 2번 → 사업자번호 → 금액 → 고객번호 (30초)</p>
                                <p>② 스마트폰 <strong>손택스 앱</strong> → 현금영수증 → 발급</p>
                                <p>③ PC <strong>홈택스 (hometax.go.kr)</strong> → 현금영수증 발급</p>
                            </div>
                        </div>

                        {/* 👤 프리랜서 딜러 경고 */}
                        <div className="bg-amber-900/20 border border-amber-700 rounded-2xl p-5 space-y-3">
                            <p className="font-black text-amber-300 text-base">👤 프리랜서 딜러 — 직접 발행 불가</p>
                            <p className="text-amber-100 text-sm leading-relaxed">사업자가 없으면 고객에게 <strong className="text-red-300">현금영수증을 직접 발행할 수 없습니다.</strong></p>
                            <div className="bg-amber-950/60 rounded-xl p-4 space-y-1.5 text-xs text-amber-200 leading-relaxed">
                                <p className="font-bold text-amber-100 mb-2">고객이 영수증 원할 때</p>
                                <p>→ <strong>본사 결제 페이지로 유도</strong>하세요</p>
                                <p>→ 포트원 결제 시 영수증 자동 발행됩니다 ✅</p>
                            </div>
                        </div>

                        {receiptResult && (
                            <div className={`rounded-3xl p-5 text-center space-y-3 ${receiptResult.success ? 'bg-emerald-900/20 border border-emerald-700' : 'bg-red-900/20 border border-red-700'}`}>
                                <div className="text-4xl">{receiptResult.success ? '✅' : '❌'}</div>
                                <p className={`font-black text-lg ${receiptResult.success ? 'text-emerald-300' : 'text-red-300'}`}>{receiptResult.message}</p>
                                {receiptResult.receiptUrl && (
                                    <a href={receiptResult.receiptUrl} target="_blank" rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs text-blue-400 underline">
                                        영수증 확인 →
                                    </a>
                                )}
                                <button onClick={() => setReceiptResult(null)}
                                    className="w-full py-2.5 bg-stone-800 rounded-2xl text-stone-300 text-sm font-bold">닫기</button>
                            </div>
                        )}

                        {/* 종류 선택 */}
                        <section className="bg-stone-900 rounded-3xl p-5 space-y-4">
                            <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">영수증 종류</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => { setReceiptType('PERSONAL'); setReceiptIdentifier(''); }}
                                    className={`py-3 rounded-2xl font-bold text-sm transition border-2 ${receiptType === 'PERSONAL' ? 'bg-emerald-700 text-white border-emerald-500' : 'bg-stone-800 text-stone-400 border-transparent'}`}>
                                    👤 소득공제용
                                </button>
                                <button onClick={() => { setReceiptType('CORPORATE'); setReceiptIdentifier(''); }}
                                    className={`py-3 rounded-2xl font-bold text-sm transition border-2 ${receiptType === 'CORPORATE' ? 'bg-blue-700 text-white border-blue-500' : 'bg-stone-800 text-stone-400 border-transparent'}`}>
                                    🏢 지출증빙용
                                </button>
                            </div>
                            <p className="text-stone-600 text-[10px]">
                                {receiptType === 'PERSONAL' ? '소득공제용: 고객 휴대폰번호 입력' : '지출증빙용: 사업자등록번호 10자리 입력'}
                            </p>
                        </section>

                        {/* 입력 폼 */}
                        <section className="bg-stone-900 rounded-3xl p-5 space-y-4">
                            <div>
                                <label className="text-stone-400 text-[10px] font-bold mb-1.5 block">
                                    {receiptType === 'PERSONAL' ? '고객 휴대폰번호' : '사업자등록번호'} <span className="text-red-400">*</span>
                                </label>
                                <input
                                    value={receiptIdentifier}
                                    onChange={e => {
                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                        if (receiptType === 'PERSONAL') {
                                            let f = raw;
                                            if (raw.length > 7) f = raw.slice(0,3)+'-'+raw.slice(3,7)+'-'+raw.slice(7,11);
                                            else if (raw.length > 3) f = raw.slice(0,3)+'-'+raw.slice(3);
                                            setReceiptIdentifier(f);
                                        } else {
                                            let f = raw;
                                            if (raw.length > 7) f = raw.slice(0,3)+'-'+raw.slice(3,5)+'-'+raw.slice(5,10);
                                            else if (raw.length > 3) f = raw.slice(0,3)+'-'+raw.slice(3);
                                            setReceiptIdentifier(f);
                                        }
                                    }}
                                    type="tel"
                                    placeholder={receiptType === 'PERSONAL' ? '010-0000-0000' : '000-00-00000'}
                                    maxLength={receiptType === 'PERSONAL' ? 13 : 12}
                                    className="w-full bg-stone-800 text-white rounded-2xl px-4 py-3.5 text-sm font-mono placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-stone-700"
                                />
                            </div>
                            <div>
                                <label className="text-stone-400 text-[10px] font-bold mb-1.5 block">거래금액 (원) <span className="text-red-400">*</span></label>
                                <input
                                    value={receiptAmount}
                                    onChange={e => { const r = e.target.value.replace(/[^0-9]/g, ''); setReceiptAmount(r ? Number(r).toLocaleString() : ''); }}
                                    type="text" inputMode="numeric" placeholder="9,900"
                                    className="w-full bg-stone-800 text-white rounded-2xl px-4 py-3.5 text-sm font-mono placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-stone-700"
                                />
                            </div>
                            <div>
                                <label className="text-stone-400 text-[10px] font-bold mb-1.5 block">상품명</label>
                                <input
                                    value={receiptOrderName}
                                    onChange={e => setReceiptOrderName(e.target.value)}
                                    type="text" placeholder="Caddy Manager Pro 이용권"
                                    className="w-full bg-stone-800 text-white rounded-2xl px-4 py-3.5 text-sm placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-stone-700"
                                />
                            </div>
                        </section>

                        <button
                            onClick={handleIssueReceipt}
                            disabled={isIssuingReceipt || !receiptIdentifier || !receiptAmount}
                            className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-3xl font-black text-white text-xl flex items-center justify-center gap-3 transition">
                            {isIssuingReceipt
                                ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <BadgeCheck size={22} />}
                            {isIssuingReceipt ? '발행 중...' : '현금영수증 발행'}
                        </button>

                        <div className="bg-stone-900 rounded-2xl p-4 text-xs text-stone-500 leading-relaxed space-y-1">
                            <p className="font-bold text-stone-400 mb-1">안내</p>
                            <p>• 본사 명의로 발행됩니다 (PortOne V2)</p>
                            <p>• 소득공제용: 고객 휴대폰번호로 국세청 자동 전송</p>
                            <p>• 지출증빙용: 법인/사업자 부가세 공제용</p>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
