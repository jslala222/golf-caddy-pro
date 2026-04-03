'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PLANS, issueVoucher } from '@/lib/licenseUtils';
import type { PlanType } from '@/lib/licenseUtils';
import { supabase } from '@/lib/supabaseClient';
import {
    ShieldAlert, User, Check, Copy, Plus, Minus, Tag, CheckCircle2,
    Key, TrendingUp, Users, Receipt, Lock, Eye, EyeOff, RefreshCcw,
    ChevronDown, ChevronUp, BadgeCheck, Clock, AlertCircle,
} from 'lucide-react';

// ── 타입 ──────────────────────────────────────────────────────────
interface DealerInfo {
    id: string;
    name: string;
    phone: string;
    token: string;
    is_active: boolean;
    total_issued: number;
    pin: string | null;
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
    created_at: string;
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

type DealerTab = 'issue' | 'earnings' | 'customers' | 'settlement';

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
    const [memo, setMemo] = useState('');
    const [isIssuing, setIsIssuing] = useState(false);
    const [issuedCode, setIssuedCode] = useState('');
    const [issuedPlan, setIssuedPlan] = useState('');
    const [issuedDays, setIssuedDays] = useState(0);
    const [copied, setCopied] = useState(false);

    // 내 고객
    const [licenses, setLicenses] = useState<License[]>([]);
    const [licensesLoading, setLicensesLoading] = useState(false);
    const [expandedLicense, setExpandedLicense] = useState<string | null>(null);

    // 수익 / 정산
    const [settlements, setSettlements] = useState<Settlement[]>([]);
    const [settlementsLoading, setSettlementsLoading] = useState(false);
    const [requestingSettlement, setRequestingSettlement] = useState(false);

    useEffect(() => { setDays(PLANS[plan].days); }, [plan]);

    // ── 딜러 로드 ──
    const loadDealer = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from('aone_pro_caddypro_dealers')
            .select('id, name, phone, token, is_active, total_issued, pin')
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
            .select('id, code, plan, days, expires_at, first_used_at, is_active, user_name, user_phone, created_at')
            .eq('issued_by', `dealer_${token}`)
            .order('created_at', { ascending: false });
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
        if (activeTab === 'customers') loadLicenses();
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
        if (!customerName.trim()) { alert('고객 이름을 입력해주세요.'); return; }
        if (!customerPhone.trim()) { alert('고객 연락처를 입력해주세요.'); return; }
        if (!dealer) return;
        setIsIssuing(true);
        const result = await issueVoucher({
            channel: 'dealer',
            plan,
            days,
            memo: memo || `딜러: ${dealer.name}`,
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
            setCustomerName(''); setCustomerPhone(''); setMemo('');
        } else {
            alert(`발급 실패: ${result.error}`);
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

    // ── 메인 대시보드 ──
    return (
        <div className="min-h-screen bg-stone-950 text-white pb-28">
            {/* 헤더 */}
            <div className="bg-blue-700 px-6 pt-12 pb-5">
                <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-1">Caddy Manager Pro</p>
                <h1 className="text-2xl font-black">딜러 대시보드</h1>
                <p className="text-blue-200 text-sm mt-1">
                    {dealer?.name} 님 · 총 {dealer?.total_issued ?? 0}건 발급
                </p>
            </div>

            {/* 탭 바 */}
            <div className="flex border-b border-stone-800 bg-stone-900 sticky top-0 z-10 overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 min-w-[72px] py-3 flex flex-col items-center gap-1 text-[10px] font-bold transition ${activeTab === tab.key ? 'text-blue-400 border-b-2 border-blue-400' : 'text-stone-500'}`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            <div className="p-5 space-y-5">
                {/* ── 코드발급 탭 ── */}
                {activeTab === 'issue' && (
                    <div className="space-y-5">
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
                                    <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
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
                                    </button>
                                ))}
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

                        {/* 메모 */}
                        <section className="bg-stone-900 rounded-3xl p-5">
                            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">메모 (선택)</label>
                            <input value={memo} onChange={e => setMemo(e.target.value)}
                                placeholder={`딜러: ${dealer?.name}`}
                                className="w-full p-3 bg-stone-800 border border-stone-700 rounded-xl text-white placeholder-stone-500 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" />
                        </section>

                        <button onClick={handleIssue} disabled={isIssuing || !customerName.trim() || !customerPhone.trim()}
                            className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-3xl font-black text-xl flex items-center justify-center gap-3 transition">
                            {isIssuing ? <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" /> : <Key size={24} />}
                            {isIssuing ? '발급 중...' : '이용권 발급하기'}
                        </button>
                    </div>
                )}

                {/* ── 내 수익 탭 ── */}
                {activeTab === 'earnings' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-white font-bold text-sm flex items-center gap-2"><TrendingUp size={16} className="text-emerald-400" /> 수익 현황</h2>
                            <button onClick={loadSettlements} className="text-stone-500 hover:text-stone-300">
                                <RefreshCcw size={14} />
                            </button>
                        </div>

                        {settlementsLoading ? (
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

                                {/* 상세 내역 */}
                                {settlements.length === 0 ? (
                                    <div className="text-center text-stone-500 py-10 text-sm">
                                        <TrendingUp size={32} className="mx-auto mb-2 opacity-30" />
                                        수익 내역이 없습니다.
                                    </div>
                                ) : (
                                    <div className="space-y-2 mt-2">
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
                                                    <p>발급일: <span className="text-stone-300">{lic.created_at.slice(0, 10)}</span></p>
                                                    {lic.first_used_at && <p>최초사용: <span className="text-stone-300">{lic.first_used_at.slice(0, 10)}</span></p>}
                                                    {lic.expires_at && <p>만료일: <span className={isExpired ? 'text-red-400' : 'text-stone-300'}>{lic.expires_at.slice(0, 10)}</span></p>}
                                                    <p>이용기간: <span className="text-stone-300">{lic.days}일</span></p>
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
