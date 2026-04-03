'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
    CheckCircle2, Star, Shield, Smartphone, BarChart3, Users, Calendar,
    ChevronRight, Key, Zap, RefreshCcw,
} from 'lucide-react';

const PLANS = [
    { key: 'month',  label: '1개월',  price: '9,900원',  priceNum: 9900,  days: 30,  badge: null,        color: 'from-blue-500 to-blue-600' },
    { key: '6month', label: '6개월',  price: '55,000원', priceNum: 55000, days: 180, badge: 'BEST',      color: 'from-emerald-500 to-emerald-600' },
    { key: 'year',   label: '1년',    price: '99,000원', priceNum: 99000, days: 365, badge: '최대할인',  color: 'from-violet-500 to-violet-600' },
];

const FEATURES = [
    { icon: <Calendar size={22} className="text-emerald-400" />, title: '자동 순번 배정', desc: '출근 캐디 입력 → 순번 자동 계산' },
    { icon: <Users size={22} className="text-blue-400" />,       title: '캐디 명단 관리', desc: '고객별 배정 이력 + 예비자 명단' },
    { icon: <BarChart3 size={22} className="text-violet-400" />, title: '수입 자동 집계', desc: '월별 수당·세금 자동 계산' },
    { icon: <Smartphone size={22} className="text-amber-400" />, title: '모바일 최적화', desc: '스마트폰에서 바로 쓰는 PWA 앱' },
    { icon: <Shield size={22} className="text-rose-400" />,      title: '클라우드 자동백업', desc: '매일 자동 백업으로 데이터 보호' },
    { icon: <Zap size={22} className="text-cyan-400" />,         title: '즉시 사용 가능', desc: '설치 없이 이용권 코드 하나로 시작' },
];

export default function LandingPage() {
    const [selectedPlan, setSelectedPlan] = useState('6month');
    const [showCodeInput, setShowCodeInput] = useState(false);
    const [codeInput, setCodeInput] = useState('');

    const plan = PLANS.find(p => p.key === selectedPlan)!;

    return (
        <div className="min-h-screen bg-stone-950 text-white pb-24">

            {/* 상단 바 */}
            <div className="flex items-center justify-between px-5 pt-10 pb-4">
                <div>
                    <p className="text-emerald-400 text-[10px] font-black tracking-widest uppercase">에이원PRO</p>
                    <h1 className="text-white font-black text-lg leading-tight">Caddy Manager Pro</h1>
                </div>
                <button
                    onClick={() => setShowCodeInput(true)}
                    className="text-xs font-bold text-stone-400 border border-stone-700 px-3 py-1.5 rounded-full hover:border-stone-500 transition"
                >
                    코드 입력
                </button>
            </div>

            {/* 히어로 */}
            <div className="px-5 pt-6 pb-10 text-center">
                <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold px-4 py-1.5 rounded-full mb-6">
                    <Star size={11} fill="currentColor" /> 골프장 캐디 전용 관리 솔루션
                </div>
                <h2 className="text-3xl font-black leading-tight mb-4" style={{ wordBreak: 'keep-all' }}>
                    캐디 순번 배정부터<br />
                    <span className="text-emerald-400">수입 관리까지</span><br />
                    한 번에
                </h2>
                <p className="text-stone-400 text-sm leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                    엑셀 없이, PC 없이<br />
                    스마트폰 하나로 골프장 운영 완성
                </p>

                {/* 평점 */}
                <div className="flex items-center justify-center gap-1 mt-5">
                    {[1,2,3,4,5].map(i => <Star key={i} size={14} className="text-amber-400" fill="#f59e0b" />)}
                    <span className="text-stone-400 text-xs ml-1">현장 캐디 매니저 사용 중</span>
                </div>
            </div>

            {/* 기능 목록 */}
            <div className="px-5 mb-10">
                <p className="text-stone-400 text-[11px] font-bold uppercase tracking-widest mb-4">주요 기능</p>
                <div className="grid grid-cols-2 gap-3">
                    {FEATURES.map((f, i) => (
                        <div key={i} className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-2">
                            {f.icon}
                            <p className="text-white text-xs font-bold">{f.title}</p>
                            <p className="text-stone-500 text-[10px] leading-relaxed">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* 요금제 선택 */}
            <div className="px-5 mb-6">
                <p className="text-stone-400 text-[11px] font-bold uppercase tracking-widest mb-4">요금제 선택</p>
                <div className="space-y-3">
                    {PLANS.map(p => (
                        <button
                            key={p.key}
                            onClick={() => setSelectedPlan(p.key)}
                            className={`w-full p-4 rounded-2xl border text-left transition relative overflow-hidden ${
                                selectedPlan === p.key
                                    ? 'border-emerald-500 bg-emerald-500/10'
                                    : 'border-stone-800 bg-stone-900'
                            }`}
                        >
                            {p.badge && (
                                <span className={`absolute top-3 right-3 text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r ${p.color} text-white`}>
                                    {p.badge}
                                </span>
                            )}
                            <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedPlan === p.key ? 'border-emerald-500' : 'border-stone-600'}`}>
                                    {selectedPlan === p.key && <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />}
                                </div>
                                <div>
                                    <p className="text-white font-bold text-sm">{p.label} 이용권</p>
                                    <p className="text-stone-400 text-xs">{p.days}일 이용</p>
                                </div>
                                <div className="ml-auto text-right">
                                    <p className={`font-black text-lg ${selectedPlan === p.key ? 'text-emerald-400' : 'text-white'}`}>{p.price}</p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* 혜택 요약 */}
            <div className="mx-5 mb-8 bg-stone-900 border border-stone-700 rounded-2xl p-4 space-y-2">
                {['이용권 코드 즉시 발급', '모든 기기에서 동일 계정 사용', '클라우드 자동 백업 포함', '업데이트 무료 제공'].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-stone-300">
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> {t}
                    </div>
                ))}
            </div>

            {/* CTA 버튼 고정 */}
            <div className="fixed bottom-0 left-0 right-0 bg-stone-950/95 backdrop-blur-sm px-5 py-4 border-t border-stone-800 space-y-2">
                <Link
                    href={`/subscribe?plan=${selectedPlan}`}
                    className={`w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 bg-gradient-to-r ${plan.color} text-white shadow-lg transition active:scale-95`}
                >
                    {plan.label} 구매하기 — {plan.price}
                    <ChevronRight size={20} />
                </Link>
                <button
                    onClick={() => setShowCodeInput(true)}
                    className="w-full py-3 rounded-2xl font-bold text-stone-400 text-sm bg-stone-800 hover:bg-stone-700 transition flex items-center justify-center gap-2"
                >
                    <Key size={14} /> 이용권 코드가 있으신가요?
                </button>
            </div>

            {/* 코드 입력 바텀시트 */}
            {showCodeInput && (
                <div
                    className="fixed inset-0 z-50 flex items-end bg-black/60"
                    onClick={() => setShowCodeInput(false)}
                >
                    <div
                        className="w-full bg-stone-900 rounded-t-3xl p-6 space-y-5"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-10 h-1 bg-stone-700 rounded-full mx-auto" />
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                                <Key size={18} className="text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-white font-bold text-sm">이용권 코드 입력</p>
                                <p className="text-stone-400 text-xs">구매 후 받은 코드를 입력하세요</p>
                            </div>
                        </div>
                        <input
                            type="text"
                            value={codeInput}
                            onChange={e => setCodeInput(e.target.value.toUpperCase())}
                            placeholder="SM-XXX-XXX"
                            className="w-full p-4 bg-stone-800 border border-stone-700 rounded-2xl text-white text-center text-xl font-black tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            autoFocus
                        />
                        <Link
                            href={`/?code=${codeInput}`}
                            className={`w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition ${
                                codeInput.length >= 3
                                    ? 'bg-emerald-600 hover:bg-emerald-500'
                                    : 'bg-stone-700 opacity-50 pointer-events-none'
                            }`}
                            onClick={() => {
                                if (codeInput.length >= 3) {
                                    localStorage.setItem('caddy_pending_code', codeInput);
                                }
                            }}
                        >
                            <RefreshCcw size={16} /> 코드로 시작하기
                        </Link>
                        <p className="text-stone-500 text-[10px] text-center">
                            코드 입력 후 앱 메인 화면에서 자동으로 활성화됩니다
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
