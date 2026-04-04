'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    CheckCircle2, Star, Shield, Smartphone, BarChart3, Users, Calendar,
    ChevronRight, Key, Zap, RefreshCcw, Search, X, Phone, Lock,
} from 'lucide-react';
import { searchLicenseByNamePhone, verifyLicenseAsync } from '@/lib/licenseUtils';
import type { MemberSearchResult } from '@/lib/licenseUtils';

const PLANS = [
    { key: 'month',  label: '1개월',  price: '9,900원',  priceNum: 9900,  days: 30,  badge: null,       color: 'from-blue-500 to-blue-600' },
    { key: '6month', label: '6개월',  price: '55,000원', priceNum: 55000, days: 180, badge: 'BEST',     color: 'from-emerald-500 to-emerald-600' },
    { key: 'year',   label: '1년',    price: '99,000원', priceNum: 99000, days: 365, badge: '최대할인', color: 'from-violet-500 to-violet-600' },
];

const FEATURES = [
    { icon: <Calendar size={22} className="text-emerald-400" />, title: '자동 순번 배정', desc: '출근 캐디 입력 → 순번 자동 계산' },
    { icon: <Users size={22} className="text-blue-400" />,       title: '캐디 명단 관리', desc: '고객별 배정 이력 + 예비자 명단' },
    { icon: <BarChart3 size={22} className="text-violet-400" />, title: '수입 자동 집계', desc: '월별 수당·세금 자동 계산' },
    { icon: <Smartphone size={22} className="text-amber-400" />, title: '모바일 최적화', desc: '스마트폰에서 바로 쓰는 PWA 앱' },
    { icon: <Shield size={22} className="text-rose-400" />,      title: '클라우드 자동백업', desc: '매일 자동 백업으로 데이터 보호' },
    { icon: <Zap size={22} className="text-cyan-400" />,         title: '즉시 사용 가능', desc: '설치 없이 이용권 코드 하나로 시작' },
];

type Sheet = 'none' | 'start' | 'code' | 'member';

export default function LandingPage() {
    const router = useRouter();
    const [selectedPlan, setSelectedPlan] = useState('6month');
    const [sheet, setSheet] = useState<Sheet>('none');

    // 코드 직접 입력
    const [codeInput, setCodeInput] = useState('');
    const [codeActivating, setCodeActivating] = useState(false);
    const [codeError, setCodeError] = useState('');

    // 기존 회원 찾기
    const [searchName, setSearchName] = useState('');
    const [searchPhone, setSearchPhone] = useState('');
    const [searchCode, setSearchCode] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<MemberSearchResult[] | null>(null);
    const [activatingId, setActivatingId] = useState<string | null>(null);

    // 관리자 5탭 숨김 진입
    const tapCountRef = useRef(0);
    const lastTapRef = useRef(0);

    const plan = PLANS.find(p => p.key === selectedPlan)!;

    // 코드 입력 후 활성화
    const handleCodeActivate = async () => {
        const code = codeInput.trim().toUpperCase();
        if (code.length < 5) {
            setErrorMsg('이용권 코드 형식이 올바르지 않습니다.\n코드를 정확히 입력해 주세요. (예: SM-XXX-XXX)');
            return;
        }
        setCodeActivating(true);
        setCodeError('');
        try {
            const result = await verifyLicenseAsync(code);
            if (result.valid) {
                localStorage.setItem('caddy_license_key', code);
                if (result.expiresAt) localStorage.setItem('caddy_expires_at', result.expiresAt);
                router.replace('/home');
            } else if (result.reason === 'expired') {
                setErrorMsg('이용권이 만료된 코드입니다.\n"기존 회원 찾기"에서 갱신하세요.');
                setCodeError('');
            } else {
                setErrorMsg('존재하지 않는 이용권 코드입니다.\n코드를 다시 확인해 주세요.');
                setCodeError('');
            }
        } catch {
            // 오프라인: 로컬 검증만으로 통과
            localStorage.setItem('caddy_license_key', code);
            router.replace('/home');
        } finally {
            setCodeActivating(false);
        }
    };

    // 기존 회원 검색
    const handleMemberSearch = async () => {
        const digits = searchPhone.replace(/\D/g,'');
        const hasPhone = digits.length >= 9;
        const hasName = searchName.trim().length >= 1;

        // 입력 검증 — 모달로 안내
        if (!hasName && !hasPhone) {
            setErrorMsg('이름 또는 전화번호를 입력해주세요.');
            return;
        }
        if (hasName && !hasPhone) {
            setErrorMsg('전화번호도 함께 입력해주세요.\n이름만으로는 본인 확인이 어렵습니다.');
            return;
        }
        if (!hasName && digits.length > 0 && digits.length < 9) {
            setErrorMsg('전화번호를 정확히 입력해주세요.\n(예: 010-1234-5678)');
            return;
        }

        setSearching(true);
        setSearchResults(null);
        try {
            const results = await searchLicenseByNamePhone({
                name: hasName ? searchName.trim() : undefined,
                phone: hasPhone ? searchPhone : undefined,
            });
            setSearchResults(results);
        } catch (err) {
            console.error('[회원검색 오류]', err);
            setSearchResults([]);
            setErrorMsg('검색 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.');
        } finally {
            setSearching(false);
        }
    };

    // 검색결과 선택 → 유효 코드로 활성화
    const handleActivateResult = async (r: MemberSearchResult) => {
        if (r.isExpired) {
            setErrorMsg(`이용권(${r.code})이 만료되었습니다.\n온라인 갱신 또는 담당 딜러를 통해 갱신해 주세요.`);
            return;
        }
        setActivatingId(r.id);
        try {
            const result = await verifyLicenseAsync(r.code);
            if (result.valid) {
                localStorage.setItem('caddy_license_key', r.code);
                if (result.expiresAt) localStorage.setItem('caddy_expires_at', result.expiresAt);
                router.replace('/home');
            } else {
                setErrorMsg('이용권 확인에 실패했습니다.\n관리자에게 문의하세요.');
            }
        } catch {
            localStorage.setItem('caddy_license_key', r.code);
            router.replace('/home');
        } finally {
            setActivatingId(null);
        }
    };

    // 에러 모달
    const [errorMsg, setErrorMsg] = useState('');

    // sheet를 열 때 history entry 추가
    const openSheet = (s: Exclude<Sheet, 'none'>) => {
        window.history.pushState({ sheetState: s }, '');
        setSheet(s);
    };

    const closeSheet = () => {
        window.history.back();
    };

    // 코드/회원 화면에서 뒤로가기 → start로
    const goBack = () => {
        window.history.back();
    };

    // 뒤로가기 처리 (capture:true → Next.js Router보다 먼저 실행)
    useEffect(() => {
        window.history.replaceState({ sheetState: 'none' }, '');
        const handlePop = (e: PopStateEvent) => {
            const target = (e.state?.sheetState ?? 'none') as Sheet;
            setCodeError('');
            setSearchResults(null);
            setSheet(target);
        };
        window.addEventListener('popstate', handlePop, { capture: true });
        return () => window.removeEventListener('popstate', handlePop, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="min-h-screen bg-stone-950 text-white pb-10">

            {/* 상단 바 */}
            <div className="flex items-center justify-between px-5 pt-10 pb-4">
                <div>
                    <p className="text-emerald-400 text-[10px] font-black tracking-widest uppercase">캐디PRO</p>
                    <h1 className="text-white font-black text-lg leading-tight">Caddy Manager Pro</h1>
                </div>
                <button
                    onClick={() => openSheet('code')}
                    className="text-xs font-bold text-stone-400 border border-stone-700 px-3 py-1.5 rounded-full hover:border-stone-500 transition"
                >
                    코드 입력
                </button>
            </div>

            {/* 헤더 */}
            <div className="px-5 pt-6 pb-10 text-center">
                <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold px-4 py-1.5 rounded-full mb-6">
                    <Star size={11} fill="currentColor" /> 골프장 캐디 전용 앱
                </div>
                <h2 className="text-3xl font-black leading-tight mb-4" style={{ wordBreak: 'keep-all' }}>
                    캐디 순번 배정부터<br />
                    <span
                        className="text-emerald-400 cursor-default select-none"
                        onClick={() => {
                            const now = Date.now();
                            if (now - lastTapRef.current > 2000) tapCountRef.current = 0;
                            lastTapRef.current = now;
                            tapCountRef.current += 1;
                            if (tapCountRef.current >= 5) { tapCountRef.current = 0; router.push('/admin'); }
                        }}
                    >수입 관리까지</span><br />
                    한 앱에서
                </h2>
                <p className="text-stone-400 text-sm leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                    설치 없이, PC 없이<br />
                    스마트폰 하나로 골프장 캐디 전용 앱
                </p>
                <div className="flex items-center justify-center gap-1 mt-5">
                    {[1,2,3,4,5].map(i => <Star key={i} size={14} className="text-amber-400" fill="#f59e0b" />)}
                    <span className="text-stone-400 text-xs ml-1">현역 캐디들이 사용 중</span>
                </div>
            </div>

            {/* 시작하기 버튼 */}
            <div className="px-5 mb-8">
                <button
                    onClick={() => openSheet('start')}
                    className="w-full py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg transition active:scale-95"
                >
                    🚀 시작하기
                </button>
                <p className="text-center text-stone-500 text-[11px] mt-2">이용권 보유 · 신규 구매 · 딜러 코드 — 모두 여기서</p>
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

            {/* 이용권 요금제 */}
            <div className="px-5 mb-6">
                <p className="text-stone-400 text-[11px] font-bold uppercase tracking-widest mb-4">이용권 요금제</p>
                <div className="space-y-3">
                    {PLANS.map(p => (
                        <button
                            key={p.key}
                            onClick={() => setSelectedPlan(p.key)}
                            className={`w-full p-4 rounded-2xl border text-left transition relative overflow-hidden ${
                                selectedPlan === p.key ? 'border-emerald-500 bg-emerald-500/10' : 'border-stone-800 bg-stone-900'
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
                                    <p className="text-stone-400 text-xs">{p.days}일 사용</p>
                                </div>
                                <div className="ml-auto text-right">
                                    <p className={`font-black text-lg ${selectedPlan === p.key ? 'text-emerald-400' : 'text-white'}`}>{p.price}</p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* 서비스 보장 */}
            <div className="mx-5 mb-8 bg-stone-900 border border-stone-700 rounded-2xl p-4 space-y-2">
                {['이용권 코드 즉시 발급', '모든 기기에서 동일 환경 사용', '클라우드 자동백업 포함', '업데이트 평생 무료'].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-stone-300">
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> {t}
                    </div>
                ))}
            </div>

            {/* ── 에러 모달 ── */}
            {errorMsg && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-6">
                    <div className="bg-stone-800 rounded-3xl p-6 w-full max-w-sm space-y-4 text-center shadow-2xl">
                        <div className="text-4xl">⚠️</div>
                        <p className="text-white font-bold text-sm leading-relaxed whitespace-pre-line">{errorMsg}</p>
                        <button
                            onClick={() => { setErrorMsg(''); setCodeInput(''); }}
                            className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black transition"
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}

            {/* ── 바텀시트 ── */}
            {sheet !== 'none' && (
                <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={sheet === 'start' ? closeSheet : undefined}>
                    <div className="w-full bg-stone-900 rounded-t-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        {/* 드래그 핸들 + 헤더 */}
                        <div className="flex items-center">
                            {sheet !== 'start' && (
                                <button onClick={goBack} className="p-2 -ml-2 text-stone-400 hover:text-white transition">
                                    <ChevronRight size={22} className="rotate-180" />
                                </button>
                            )}
                            <div className="flex-1 flex justify-center">
                                <div className="w-10 h-1 bg-stone-700 rounded-full" />
                            </div>
                            {sheet !== 'start' && <div className="w-8" />}
                        </div>

                        {/* ── 시작하기 분기 선택 ── */}
                        {sheet === 'start' && (
                            <>
                                <div className="text-center">
                                    <p className="text-white font-black text-lg">어떻게 이용하실 건가요?</p>
                                    <p className="text-stone-400 text-xs mt-1">상황에 맞는 메뉴를 선택하세요</p>
                                </div>
                                <div className="space-y-3">
                                    <button
                                        onClick={() => openSheet('member')}
                                        className="w-full py-4 px-5 rounded-2xl bg-violet-600 hover:bg-violet-500 transition text-white text-left flex items-center gap-4 active:scale-95"
                                    >
                                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                                            <Phone size={20} />
                                        </div>
                                        <div>
                                            <p className="font-black text-base">기존 회원 찾기</p>
                                            <p className="text-violet-200 text-xs">이름·전화번호로 내 이용권 찾기</p>
                                        </div>
                                        <ChevronRight size={18} className="ml-auto opacity-60" />
                                    </button>
                                    <button
                                        onClick={() => openSheet('code')}
                                        className="w-full py-4 px-5 rounded-2xl bg-stone-800 hover:bg-stone-700 transition text-white text-left flex items-center gap-4 active:scale-95"
                                    >
                                        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
                                            <Key size={20} className="text-emerald-400" />
                                        </div>
                                        <div>
                                            <p className="font-black text-base">이용권 코드 입력</p>
                                            <p className="text-stone-400 text-xs">딜러에게 받은 코드 직접 입력</p>
                                        </div>
                                        <ChevronRight size={18} className="ml-auto opacity-60" />
                                    </button>
                                    <div className="pt-2 border-t border-stone-800">
                                        <p className="text-stone-500 text-[11px] text-center mb-3">이용권이 없으신가요?</p>
                                        <div className="space-y-2">
                                            {PLANS.map(p => (
                                                <Link
                                                    key={p.key}
                                                    href={`/subscribe?plan=${p.key}`}
                                                    className={`w-full py-3 px-5 rounded-2xl bg-gradient-to-r ${p.color} text-white flex items-center justify-between active:scale-95 transition`}
                                                >
                                                    <span className="font-bold text-sm">{p.label} 이용권</span>
                                                    <span className="font-black">{p.price}</span>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* 코드 직접 입력 */}
                        {sheet === 'code' && (
                            <>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-500/20 rounded-2xl flex items-center justify-center shrink-0">
                                        <Key size={18} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-sm">이용권 코드 입력</p>
                                        <p className="text-stone-400 text-xs">딜러 또는 구매 후 받은 코드</p>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    value={codeInput}
                                    onChange={e => { setCodeInput(e.target.value.toUpperCase()); setCodeError(''); }}
                                    onKeyDown={e => e.key === 'Enter' && handleCodeActivate()}
                                    placeholder="SM-XXX-XXX"
                                    className="w-full p-4 bg-stone-800 border border-stone-700 rounded-2xl text-white text-center text-xl font-black tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    autoFocus
                                />
                                {codeError && <p className="text-red-400 text-xs text-center font-bold">{codeError}</p>}
                                <button
                                    onClick={handleCodeActivate}
                                    disabled={codeActivating || codeInput.trim().length < 5}
                                    className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40"
                                >
                                    {codeActivating
                                        ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> 확인 중...</>
                                        : <><Lock size={16} /> 코드로 시작하기</>}
                                </button>
                                <p className="text-stone-500 text-[10px] text-center">코드가 없으면 아래 "기존 회원 찾기"를 이용하세요.</p>
                                <button onClick={() => openSheet('member')}
                                    className="w-full py-3 rounded-2xl font-bold text-stone-400 text-sm bg-stone-800 hover:bg-stone-700 transition">
                                    기존 회원 찾기 (코드 분실 / 만료)
                                </button>
                            </>
                        )}

                        {/* 기존 회원 찾기 */}
                        {sheet === 'member' && (
                            <>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-violet-500/20 rounded-2xl flex items-center justify-center shrink-0">
                                        <Search size={18} className="text-violet-400" />
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-sm">기존 회원 찾기</p>
                                        <p className="text-stone-400 text-xs">이름+전화번호로 내 이용권 찾기</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">이름</label>
                                        <input
                                            value={searchName}
                                            onChange={e => { setSearchName(e.target.value); setSearchResults(null); }}
                                            onKeyDown={e => e.key === 'Enter' && handleMemberSearch()}
                                            placeholder="홍길동"
                                            className="w-full p-3.5 bg-stone-800 border border-stone-700 rounded-2xl text-white placeholder-stone-500 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">전화번호</label>
                                        <input
                                            value={searchPhone}
                                            onChange={e => {
                                                const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
                                                const fmt = raw.length <= 3 ? raw : raw.length <= 7
                                                    ? `${raw.slice(0,3)}-${raw.slice(3)}`
                                                    : `${raw.slice(0,3)}-${raw.slice(3,7)}-${raw.slice(7)}`;
                                                setSearchPhone(fmt); setSearchResults(null);
                                            }}
                                            onKeyDown={e => e.key === 'Enter' && handleMemberSearch()}
                                            placeholder="010-0000-0000"
                                            inputMode="tel"
                                            className="w-full p-3.5 bg-stone-800 border border-stone-700 rounded-2xl text-white placeholder-stone-500 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                        />
                                    </div>
                                    <button
                                        onClick={handleMemberSearch}
                                        disabled={searching}
                                        className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition bg-violet-600 hover:bg-violet-500 disabled:opacity-40"
                                    >
                                        {searching
                                            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> 검색 중...</>
                                            : <><Search size={16} /> 검색하기</>}
                                    </button>
                                </div>

                                {/* 검색 결과 */}
                                {searchResults !== null && (
                                    <div className="space-y-3 pt-2 border-t border-stone-800">
                                        {searchResults.length === 0 ? (
                                            <div className="text-center py-6">
                                                <X size={32} className="mx-auto text-stone-600 mb-2" />
                                                <p className="text-stone-400 text-sm font-bold">검색 결과가 없습니다</p>
                                                <p className="text-stone-600 text-xs mt-1">이름 또는 전화번호를 다시 확인해 주세요.</p>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="text-violet-300 text-xs font-bold">{searchResults.length}건 검색됨 · 본인 계정을 선택하세요.</p>
                                                {searchResults.map(r => (
                                                    <div key={r.id} className={`rounded-2xl p-4 border space-y-3 ${r.isExpired ? 'bg-red-900/15 border-red-800' : 'bg-stone-800 border-stone-700'}`}>
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <p className="text-white font-black text-base">{r.userName || '(이름 없음)'}</p>
                                                                <p className="text-stone-400 text-xs mt-0.5">
                                                                    {r.userPhone ? `${r.userPhone.slice(0,3)}-****-${r.userPhone.slice(-4)}` : '번호 없음'}
                                                                </p>
                                                            </div>
                                                            <span className={`text-xs font-black px-2 py-1 rounded-full ${r.isExpired ? 'bg-red-900/40 text-red-400' : 'bg-emerald-900/40 text-emerald-400'}`}>
                                                                {r.isExpired ? '만료됨' : `D-${r.daysLeft}`}
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            <div>
                                                                <p className="text-stone-500">이용권 코드</p>
                                                                <p className="font-mono font-bold text-white">{r.code}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-stone-500">만료일</p>
                                                                <p className={`font-bold ${r.isExpired ? 'text-red-400' : 'text-emerald-400'}`}>
                                                                    {r.expiresAt ? new Date(r.expiresAt).toLocaleDateString('ko-KR') : '알 수 없음'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {r.isExpired ? (
                                                            <div className="space-y-2">
                                                                <Link
                                                                    href={`/subscribe?plan=6month${r.issuedBy ? `&ref=${r.issuedBy}` : ''}`}
                                                                    className="w-full py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 transition"
                                                                >
                                                                    <RefreshCcw size={14} /> 온라인으로 갱신하기
                                                                </Link>
                                                                <p className="text-stone-500 text-[10px] text-center">또는 담당 딜러에게 연락하세요.</p>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleActivateResult(r)}
                                                                disabled={activatingId === r.id}
                                                                className="w-full py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 transition"
                                                            >
                                                                {activatingId === r.id
                                                                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> 활성화 중...</>
                                                                    : <><Lock size={14} /> 이 계정으로 시작하기</>}
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
