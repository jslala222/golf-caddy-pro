'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { issueVoucher, PLANS, CHANNELS } from '@/lib/licenseUtils';
import type { PlanType, ChannelType } from '@/lib/licenseUtils';
import { supabase } from '@/lib/supabaseClient';
import {
    ShieldCheck, Key, RefreshCcw, Copy, Check, ChevronLeft,
    CalendarX, Users2, GripVertical, UserPlus, Link2, Plus, Minus,
    Search, Receipt, BadgeCheck, Clock, AlertCircle, ChevronDown, ChevronUp,
    HardDriveDownload, FileJson, CloudOff
} from 'lucide-react';
import Link from 'next/link';

// ── 딜러 토큰 생성 ─────────────────────────────────────────────
const DEALER_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function makeDealerToken(): string {
    let t = '';
    for (let i = 0; i < 8; i++) t += DEALER_CHARS[Math.floor(Math.random() * DEALER_CHARS.length)];
    return t;
}

type AdminTab = 'issue' | 'licenses' | 'dealers' | 'settlements' | 'caddy' | 'restore';

interface Dealer {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    token: string;
    is_active: boolean;
    total_issued: number;
    pin: string | null;
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

    // 이용권 내역 상태
    const [licenseSearch, setLicenseSearch] = useState('');
    const [licenses, setLicenses] = useState<License[]>([]);
    const [licenseLoading, setLicenseLoading] = useState(false);
    const [expandedLicense, setExpandedLicense] = useState<string | null>(null);

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
            .select('id, name, phone, email, token, is_active, total_issued, pin')
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
            .from('aone_pro_caddypro_dealer_settlements')
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
        setIsIssuing(true);
        setGeneratedKey('');
        const result = await issueVoucher({ channel, plan, days, memo, userName, userPhone, issuedBy: 'admin' });
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
        const token = makeDealerToken();
        const { error } = await supabase.from('aone_pro_caddypro_dealers').insert({
            name: newDealerName.trim(),
            phone: newDealerPhone.trim() || null,
            email: newDealerEmail.trim() || null,
            token,
            pin: newDealerPin.trim() || null,
        });
        setIsAddingDealer(false);
        if (error) { setDealerFormError(`딜러 등록 실패: ${error.message}`); return; }
        setNewDealerName('');
        setNewDealerPhone('');
        setNewDealerEmail('');
        setNewDealerPin('');
        loadDealers();
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
            .from('aone_pro_caddypro_dealer_settlements')
            .update({ settled: true, settled_at: new Date().toISOString() })
            .in('id', ids);
        loadSettlements();
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
                    <p className="text-stone-400 text-sm">대표님 전용 관리 페이지입니다.</p>
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
                    <Link href="/" className="block text-stone-500 text-sm font-bold mt-4">나가기</Link>
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

    const TABS: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
        { key: 'issue',       label: '코드발급',  icon: <Key size={14} /> },
        { key: 'licenses',    label: '이용내역',  icon: <Search size={14} /> },
        { key: 'dealers',     label: '딜러관리',  icon: <Link2 size={14} /> },
        { key: 'settlements', label: '정산관리',  icon: <Receipt size={14} /> },
        { key: 'caddy',       label: '캐디관리',  icon: <Users2 size={14} /> },
        { key: 'restore',     label: '데이터복구', icon: <HardDriveDownload size={14} /> },
    ];

    return (
        <div className="bg-stone-50 min-h-screen pb-24">
            {/* 헤더 */}
            <header className="bg-white border-b border-stone-100 px-6 pt-12 pb-4 sticky top-0 z-10">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <Link href="/settings" className="inline-flex items-center text-stone-400 text-xs font-bold gap-1 mb-1">
                            <ChevronLeft size={14} /> 설정
                        </Link>
                        <h1 className="text-xl font-black text-stone-900 flex items-center gap-2">
                            <ShieldCheck size={20} className="text-emerald-600" /> 관리자 도구
                        </h1>
                    </div>
                </div>
                {/* 탭 */}
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                    {TABS.map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                                activeTab === tab.key
                                    ? 'bg-stone-900 text-white'
                                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                            }`}>
                            {tab.icon}{tab.label}
                        </button>
                    ))}
                </div>
            </header>

            <div className="p-6 space-y-6">

                {/* ══ 탭: 코드 발급 ══ */}
                {activeTab === 'issue' && (
                    <div className="space-y-6">
                        <section className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                                <Key size={18} /> 이용권 코드 발급
                            </div>

                            {/* 채널 선택 */}
                            <div>
                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">판매 채널</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(Object.entries(CHANNELS) as [ChannelType, string][]).map(([key, label]) => (
                                        <button key={key} onClick={() => setChannel(key)}
                                            className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition ${channel === key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-emerald-400'}`}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 요금제 선택 */}
                            <div>
                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">요금제</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(Object.entries(PLANS) as [PlanType, typeof PLANS[PlanType]][]).map(([key, info]) => (
                                        <button key={key} onClick={() => setPlan(key)}
                                            className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition flex flex-col items-center gap-0.5 ${plan === key ? 'bg-stone-900 text-white border-stone-900' : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-stone-400'}`}>
                                            <span>{info.label}</span>
                                            <span className="opacity-60 text-[9px]">₩{info.price.toLocaleString()}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 일수 조정 */}
                            <div>
                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">
                                    부여 일수 <span className="text-stone-300 normal-case">(기본 {PLANS[plan].days}일 / {minDays}~{maxDays}일 조정 가능)</span>
                                </label>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setDays(d => Math.max(minDays, d - 5))}
                                        className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center hover:bg-stone-200 transition">
                                        <Minus size={16} />
                                    </button>
                                    <div className="flex-1 text-center text-2xl font-black text-stone-900">{days}일</div>
                                    <button onClick={() => setDays(d => Math.min(maxDays, d + 5))}
                                        className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center hover:bg-stone-200 transition">
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* 고객 정보 */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-stone-400 mb-1 block">고객 이름 (선택)</label>
                                    <input value={userName} onChange={e => setUserName(e.target.value)}
                                        placeholder="홍길동"
                                        className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-stone-400 mb-1 block">연락처 (선택)</label>
                                    <input value={userPhone} onChange={e => setUserPhone(e.target.value)}
                                        placeholder="010-0000-0000"
                                        className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none" />
                                </div>
                            </div>

                            {/* 메모 */}
                            <div>
                                <label className="text-[10px] font-bold text-stone-400 mb-1 block">메모 (선택)</label>
                                <input value={memo} onChange={e => setMemo(e.target.value)}
                                    placeholder="예: 3월 이벤트, 기기변경 복원 요청..."
                                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none" />
                            </div>

                            <button onClick={handleIssue} disabled={isIssuing}
                                className="w-full bg-stone-900 text-white font-bold py-4 rounded-2xl hover:bg-stone-800 transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-60">
                                {isIssuing ? <RefreshCcw size={20} className="animate-spin" /> : <Key size={20} />}
                                {isIssuing ? '발급 중...' : '이용권 코드 발급'}
                            </button>
                        </section>

                        {/* 발급 결과 */}
                        {generatedKey && (
                            <section className="bg-emerald-600 p-6 rounded-3xl text-white shadow-xl animate-in fade-in slide-in-from-top-4">
                                <div className="text-[10px] font-black text-emerald-200 uppercase tracking-widest mb-3">발급된 이용권 코드</div>
                                <div className="flex flex-col items-center gap-4">
                                    <div className="text-4xl font-black tracking-[0.2em] font-mono">{generatedKey}</div>
                                    <div className="flex gap-2 flex-wrap justify-center text-xs text-emerald-100">
                                        <span className="bg-white/20 px-2 py-1 rounded-full">{CHANNELS[channel]}</span>
                                        <span className="bg-white/20 px-2 py-1 rounded-full">{PLANS[plan].label} ({days}일)</span>
                                    </div>
                                    <button onClick={handleCopy}
                                        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-6 py-2 rounded-full text-xs font-bold transition">
                                        {copied ? <Check size={14} /> : <Copy size={14} />}
                                        {copied ? '복사 완료!' : '코드 복사'}
                                    </button>
                                </div>
                                <div className="mt-4 pt-4 border-t border-white/10 text-[10px] text-emerald-100/70 text-center">
                                    이 코드를 구매자에게 전달하세요 · 오늘 총 {generatedCount}개 발급
                                </div>
                            </section>
                        )}
                    </div>
                )}

                {/* ══ 탭: 이용권 내역 ══ */}
                {activeTab === 'licenses' && (
                    <div className="space-y-4">
                        <div className="relative">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
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
                                <RefreshCcw size={24} className="animate-spin text-stone-400" />
                            </div>
                        )}

                        {!licenseLoading && licenses.length === 0 && (
                            <p className="text-center text-stone-400 text-sm py-8">검색 결과가 없습니다.</p>
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
                                                        {lic.user_phone && <span className="text-stone-400 font-normal ml-2 text-xs">{lic.user_phone}</span>}
                                                    </p>
                                                    <p className="font-mono text-xs text-stone-500 tracking-wider">{lic.code}</p>
                                                </div>
                                            </div>
                                            <div className="text-right flex items-center gap-2">
                                                <div>
                                                    {daysLeft === null
                                                        ? <span className="text-[10px] text-stone-400">미사용</span>
                                                        : isExpired
                                                        ? <span className="text-[10px] font-bold text-red-500">만료됨</span>
                                                        : <span className={`text-[10px] font-bold ${isWarning ? 'text-amber-600' : 'text-emerald-600'}`}>{daysLeft}일 남음</span>
                                                    }
                                                </div>
                                                {isExpanded ? <ChevronUp size={14} className="text-stone-400" /> : <ChevronDown size={14} className="text-stone-400" />}
                                            </div>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="px-4 pb-4 border-t border-stone-50 pt-3 space-y-2">
                                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                <div><span className="text-stone-400">채널</span> <span className="font-bold ml-1">{CHANNELS[lic.channel as ChannelType] || lic.channel}</span></div>
                                                <div><span className="text-stone-400">요금제</span> <span className="font-bold ml-1">{PLANS[lic.plan as PlanType]?.label || lic.plan} ({lic.days}일)</span></div>
                                                <div><span className="text-stone-400">발급일</span> <span className="font-bold ml-1">{formatDate(lic.created_at)}</span></div>
                                                <div><span className="text-stone-400">첫 사용</span> <span className="font-bold ml-1">{formatDate(lic.first_used_at)}</span></div>
                                                <div><span className="text-stone-400">만료일</span> <span className="font-bold ml-1">{formatDate(lic.expires_at)}</span></div>
                                                <div><span className="text-stone-400">발급자</span> <span className="font-bold ml-1">{lic.issued_by}</span></div>
                                            </div>
                                            {lic.memo && <p className="text-[11px] text-stone-500 bg-stone-50 p-2 rounded-xl">📝 {lic.memo}</p>}
                                            <button onClick={() => { navigator.clipboard.writeText(lic.code); }}
                                                className="flex items-center gap-1 text-[10px] bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-xl font-bold text-stone-600 transition">
                                                <Copy size={11} /> 코드 복사 (기기변경 복원용)
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        <p className="text-center text-stone-400 text-[10px]">최근 50건 표시 · 검색으로 더 찾기</p>
                    </div>
                )}

                {/* ══ 탭: 딜러 관리 ══ */}
                {activeTab === 'dealers' && (
                    <div className="space-y-6">
                        <section className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
                                <Link2 size={18} /> 현장 딜러 관리
                            </div>
                            <p className="text-stone-400 text-[11px] leading-relaxed">
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
                                                    {d.phone && <span className="text-stone-400 text-xs ml-2">{d.phone}</span>}
                                                    <span className="ml-2 text-[10px] text-stone-400">누적 {d.total_issued}건</span>
                                                    {d.pin && <span className="ml-2 text-[10px] text-stone-400">PIN: {d.pin}</span>}
                                                </div>
                                                <button onClick={() => handleToggleDealer(d.id, d.is_active)}
                                                    className={`text-[10px] font-bold px-2 py-1 rounded-full ${d.is_active ? 'bg-blue-100 text-blue-700' : 'bg-stone-200 text-stone-500'}`}>
                                                    {d.is_active ? '활성' : '비활성'}
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
                                <p className="text-center text-stone-300 text-xs py-4">등록된 딜러가 없습니다.</p>
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
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${settlementFilter === f ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200 text-stone-500'}`}>
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
                                <RefreshCcw size={24} className="animate-spin text-stone-400" />
                            </div>
                        )}

                        {!settlementLoading && filteredSettlements.length === 0 && (
                            <p className="text-center text-stone-400 text-sm py-8">
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
                                        <p className="font-mono text-[10px] text-stone-400">{s.license_code}</p>
                                        <p className="text-[10px] text-stone-400 mt-1">{formatDate(s.created_at)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-stone-400">판매가 ₩{s.sale_amount.toLocaleString()}</p>
                                        <p className="text-lg font-black text-stone-900">₩{s.commission_amount.toLocaleString()}</p>
                                        <p className="text-[9px] text-stone-400">({Math.round(s.commission_rate * 100)}%)</p>
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

                        {/* 코드 입력 */}
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
                            <div className="flex items-center gap-3 bg-stone-50 p-4 rounded-2xl border border-stone-200 text-stone-500 text-xs font-medium">
                                <CloudOff size={18} className="text-stone-400" />
                                해당 코드의 백업 데이터가 없습니다.
                            </div>
                        )}

                        {restoreStatus === 'error' && (
                            <div className="flex items-center gap-3 bg-red-50 p-4 rounded-2xl border border-red-100 text-red-600 text-xs font-medium">
                                <AlertCircle size={18} /> 조회 중 오류가 발생했습니다. 다시 시도해 주세요.
                            </div>
                        )}
                    </section>
                )}

            </div>
        </div>
    );
}
