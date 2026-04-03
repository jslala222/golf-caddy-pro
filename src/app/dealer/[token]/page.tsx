'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PLANS, issueVoucher } from '@/lib/licenseUtils';
import type { PlanType } from '@/lib/licenseUtils';
import { supabase } from '@/lib/supabaseClient';
import { ShieldAlert, User, Check, Copy, Plus, Minus, Tag, CheckCircle2 } from 'lucide-react';

interface DealerInfo {
    id: string;
    name: string;
    phone: string;
    token: string;
    is_active: boolean;
    total_issued: number;
}

export default function DealerPage({ params }: { params: { token: string } }) {
    const { token } = params;

    const [dealer, setDealer] = useState<DealerInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [invalid, setInvalid] = useState(false);

    // 발급 폼
    const [plan, setPlan] = useState<PlanType>('month');
    const [days, setDays] = useState(30);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [memo, setMemo] = useState('');
    const [isIssuing, setIsIssuing] = useState(false);

    // 결과
    const [issuedCode, setIssuedCode] = useState('');
    const [issuedPlan, setIssuedPlan] = useState('');
    const [issuedDays, setIssuedDays] = useState(0);
    const [copied, setCopied] = useState(false);

    // 요금제 변경 시 일수 자동 세팅
    useEffect(() => {
        setDays(PLANS[plan].days);
    }, [plan]);

    const loadDealer = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from('aone_pro_caddypro_dealers')
            .select('id, name, phone, token, is_active, total_issued')
            .eq('token', token)
            .maybeSingle();

        setLoading(false);
        if (!data || !data.is_active) {
            setInvalid(true);
        } else {
            setDealer(data as DealerInfo);
        }
    }, [token]);

    useEffect(() => {
        loadDealer();
    }, [loadDealer]);

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
            // 딜러 발급 카운트 증가
            await supabase
                .from('aone_pro_caddypro_dealers')
                .update({ total_issued: dealer.total_issued + 1 })
                .eq('id', dealer.id);
            setDealer(prev => prev ? { ...prev, total_issued: prev.total_issued + 1 } : prev);

            setIssuedCode(result.code);
            setIssuedPlan(PLANS[plan].label);
            setIssuedDays(days);
            setCopied(false);
            // 폼 초기화
            setCustomerName('');
            setCustomerPhone('');
            setMemo('');
        } else {
            alert(`발급 실패: ${result.error}`);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(issuedCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
    };

    const handleNewIssue = () => {
        setIssuedCode('');
        setIssuedPlan('');
        setIssuedDays(0);
        setCopied(false);
    };

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

    // ── 발급 완료 화면 ──
    if (issuedCode) {
        return (
            <div className="fixed inset-0 bg-stone-900 flex items-center justify-center p-6 text-white">
                <div className="w-full max-w-sm space-y-6 text-center animate-in fade-in zoom-in duration-300">
                    <CheckCircle2 size={72} className="mx-auto text-emerald-400" />
                    <div>
                        <h1 className="text-2xl font-black text-emerald-400 mb-1">발급 완료!</h1>
                        <p className="text-stone-400 text-sm">{issuedPlan} · {issuedDays}일권</p>
                    </div>

                    {/* 코드 강조 표시 */}
                    <div className="bg-stone-800 rounded-3xl p-8 space-y-4">
                        <p className="text-stone-400 text-xs">고객에게 전달할 이용권 코드</p>
                        <div className="text-5xl font-black tracking-[0.15em] font-mono text-white">
                            {issuedCode}
                        </div>
                        <p className="text-stone-500 text-[10px]">앱 실행 후 이 코드를 입력하면 즉시 활성화됩니다</p>
                    </div>

                    <button onClick={handleCopy}
                        className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition ${copied ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-500'}`}>
                        {copied ? <Check size={22} /> : <Copy size={22} />}
                        {copied ? '클립보드에 복사됨!' : '코드 복사하기'}
                    </button>

                    <button onClick={handleNewIssue}
                        className="w-full py-3 rounded-2xl font-bold text-stone-400 bg-stone-800 hover:bg-stone-700 transition text-sm">
                        새 고객 발급하기
                    </button>

                    <p className="text-stone-600 text-xs">
                        오늘까지 총 {dealer?.total_issued || 0}건 발급 · 딜러: {dealer?.name}
                    </p>
                </div>
            </div>
        );
    }

    // ── 메인 딜러 폼 ──
    return (
        <div className="min-h-screen bg-stone-950 text-white pb-24">
            {/* 헤더 */}
            <div className="bg-blue-600 px-6 pt-12 pb-6">
                <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">Caddy Manager Pro</p>
                <h1 className="text-2xl font-black">현장 이용권 발급</h1>
                <p className="text-blue-100 text-sm mt-1">담당 딜러: <span className="font-bold">{dealer?.name}</span></p>
            </div>

            <div className="p-6 space-y-6">

                {/* 고객 정보 */}
                <section className="bg-stone-900 rounded-3xl p-5 space-y-4">
                    <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                        <User size={16} /> 고객 정보
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">
                                이름 <span className="text-red-400">*</span>
                            </label>
                            <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                                placeholder="홍길동"
                                className="w-full p-4 bg-stone-800 border border-stone-700 rounded-2xl text-white placeholder-stone-500 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-transparent text-lg" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">
                                연락처 <span className="text-red-400">*</span>
                            </label>
                            <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                                placeholder="010-0000-0000"
                                inputMode="tel"
                                className="w-full p-4 bg-stone-800 border border-stone-700 rounded-2xl text-white placeholder-stone-500 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-transparent text-lg" />
                        </div>
                    </div>
                </section>

                {/* 요금제 선택 */}
                <section className="bg-stone-900 rounded-3xl p-5 space-y-4">
                    <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                        <Tag size={16} /> 요금제 선택
                    </div>
                    <div className="space-y-2">
                        {(['month', '6month', 'year'] as PlanType[]).map(key => (
                            <button key={key} onClick={() => setPlan(key)}
                                className={`w-full p-4 rounded-2xl border-2 text-left transition flex justify-between items-center ${plan === key ? 'bg-blue-600 border-blue-400 text-white' : 'bg-stone-800 border-stone-700 text-stone-300 hover:border-stone-500'}`}>
                                <span className="font-bold text-lg">{PLANS[key].label}</span>
                                <span className={`text-sm font-bold ${plan === key ? 'text-blue-100' : 'text-stone-400'}`}>
                                    ₩{PLANS[key].price.toLocaleString()}
                                </span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* 일수 조정 */}
                <section className="bg-stone-900 rounded-3xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-blue-400 font-bold text-sm">이용 기간 조정</span>
                        <span className="text-stone-400 text-xs">기본 {PLANS[plan].days}일</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setDays(d => Math.max(minDays, d - 5))}
                            className="w-14 h-14 rounded-2xl bg-stone-800 flex items-center justify-center hover:bg-stone-700 transition text-white border border-stone-700">
                            <Minus size={20} />
                        </button>
                        <div className="flex-1 text-center">
                            <div className="text-5xl font-black text-white">{days}</div>
                            <div className="text-stone-400 text-sm">일</div>
                        </div>
                        <button onClick={() => setDays(d => Math.min(maxDays, d + 5))}
                            className="w-14 h-14 rounded-2xl bg-stone-800 flex items-center justify-center hover:bg-stone-700 transition text-white border border-stone-700">
                            <Plus size={20} />
                        </button>
                    </div>
                    <p className="text-stone-500 text-[10px] text-center">
                        기본 {planBase}일 · 최대 {maxDays}일 (+{bonusDays[plan] ?? 7}일 서비스 가능)
                    </p>
                </section>

                {/* 메모 (선택) */}
                <section className="bg-stone-900 rounded-3xl p-5 space-y-3">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block">메모 (선택)</label>
                    <input value={memo} onChange={e => setMemo(e.target.value)}
                        placeholder="특이사항 기록 (예: 행사장 현장 판매)"
                        className="w-full p-4 bg-stone-800 border border-stone-700 rounded-2xl text-white placeholder-stone-500 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" />
                </section>

                {/* 발급 버튼 */}
                <button onClick={handleIssue}
                    disabled={isIssuing || !customerName.trim() || !customerPhone.trim()}
                    className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl text-xl hover:bg-blue-500 transition shadow-2xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isIssuing
                        ? <><div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" /> 발급 중...</>
                        : <><CheckCircle2 size={24} /> 이용권 즉시 발급</>
                    }
                </button>

                <p className="text-center text-stone-600 text-xs">
                    발급된 코드는 고객이 앱 첫 실행 시부터 카운트 시작<br />
                    딜러 누적 발급: {dealer?.total_issued || 0}건
                </p>

            </div>
        </div>
    );
}
