'use client';
import React, { useState } from 'react';
import { Minus, Plus, ShoppingCart, Trash2, CheckCircle2, Copy, Check, Star, Shield } from 'lucide-react';

// ── 요금제 정의 ─────────────────────────────────────────────────
const PRICES = {
  standard: { month: 9_900,  '6month': 55_000, year: 99_000  },
  premium:  { month: 12_900, '6month': 69_000, year: 129_000 },
};
const PLAN_META: Record<string, { label: string; days: number; badge?: string }> = {
  month:    { label: '1개월', days: 30 },
  '6month': { label: '6개월', days: 180, badge: 'BEST' },
  year:     { label: '1년',   days: 365, badge: '🔥 최고' },
};
type TierKey = 'standard' | 'premium';
type PlanKey = 'month' | '6month' | 'year';

// ── 할인율 계산 ─────────────────────────────────────────────────
function discountPct(tier: TierKey, plan: PlanKey): number | null {
  if (plan === 'month') return null;
  const base = PRICES[tier].month;
  const { days } = PLAN_META[plan];
  const monthly = Math.round(PRICES[tier][plan] / (days / 30));
  const pct = Math.round((1 - monthly / base) * 100);
  return pct > 0 ? pct : null;
}

interface CartItem { tier: TierKey; plan: PlanKey; qty: number; }
interface IssuedResult { tier: TierKey; plan: PlanKey; code: string; }

const formatPhone = (v: string) => {
  const n = v.replace(/[^0-9]/g, '').slice(0, 11);
  if (n.length <= 3) return n;
  if (n.length <= 7) return `${n.slice(0,3)}-${n.slice(3)}`;
  return `${n.slice(0,3)}-${n.slice(3,7)}-${n.slice(7)}`;
};

export default function TestCartPage() {
  // ── PIN 게이트 ─────────────────────────────────────────────
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [authed, setAuthed] = useState(false);

  const handlePinSubmit = () => {
    if (pin === '0827') { setAuthed(true); setPinError(''); }
    else setPinError('비밀번호가 틀렸습니다');
  };

  // ── 쇼핑 상태 ─────────────────────────────────────────────
  const [selectedTier, setSelectedTier] = useState<TierKey>('standard');
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('month');
  const [qty, setQty] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // ── 결제/결과 상태 ─────────────────────────────────────────
  const [step, setStep] = useState<'shop' | 'result'>('shop');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<IssuedResult[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // ── 장바구니 조작 ──────────────────────────────────────────
  const addToCart = () => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.tier === selectedTier && c.plan === selectedPlan);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, { tier: selectedTier, plan: selectedPlan, qty }];
    });
    setQty(1);
  };

  const removeFromCart = (i: number) => setCart(prev => prev.filter((_, idx) => idx !== i));

  const totalAmount = cart.reduce((sum, c) => sum + PRICES[c.tier][c.plan] * c.qty, 0);
  const totalQty    = cart.reduce((sum, c) => sum + c.qty, 0);

  // ── 카트 수량 요약 (그리드용) ─────────────────────────────
  const cartQty = (tier: TierKey, plan: PlanKey) =>
    cart.find(c => c.tier === tier && c.plan === plan)?.qty ?? 0;

  // ── 코드 일괄 발급 ─────────────────────────────────────────
  const handleCheckout = async () => {
    if (!name.trim()) { setError('이름을 입력해주세요'); return; }
    if (phone.replace(/\D/g,'').length < 9) { setError('연락처를 정확히 입력해주세요'); return; }
    if (cart.length === 0) { setError('장바구니가 비어 있습니다'); return; }
    setLoading(true);
    setError('');
    const res = await fetch('/api/test/issue-cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterPin: pin, name: name.trim(), phone: phone.trim(), items: cart }),
    });
    const data = await res.json();
    if (data.results) {
      setResults(data.results);
      setStep('result');
    } else {
      setError(data.error ?? '발급 실패');
    }
    setLoading(false);
  };

  const handleCopy = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2500);
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(results.map(r => r.code).join('\n'));
    setCopiedIdx(-1);
    setTimeout(() => setCopiedIdx(null), 2500);
  };

  // ── 1. PIN 게이트 ──────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6">
        <div className="w-full max-w-xs bg-stone-900 rounded-3xl p-7 space-y-5 text-white">
          <div className="text-center space-y-1">
            <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest">⚠️ 테스트 전용</p>
            <h1 className="text-xl font-black">크레딧 구매 테스트</h1>
            <p className="text-stone-400 text-xs">마스터 비번으로 진입</p>
          </div>
          <input
            type="password"
            placeholder="비밀번호"
            value={pin}
            onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
            className="w-full p-3 rounded-2xl bg-stone-800 border border-stone-700 text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {pinError && <p className="text-red-400 text-xs text-center">{pinError}</p>}
          <button
            onClick={handlePinSubmit}
            className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 font-black text-stone-900 transition"
          >
            진입
          </button>
        </div>
      </div>
    );
  }

  // ── 2. 결과 화면 ───────────────────────────────────────────
  if (step === 'result') {
    return (
      <div className="min-h-screen bg-stone-950 text-white pb-10">
        <div className="px-5 pt-10 pb-6 text-center">
          <CheckCircle2 size={52} className="mx-auto text-emerald-400 mb-3" />
          <h1 className="text-2xl font-black">발급 완료!</h1>
          <p className="text-stone-400 text-sm mt-1">{results.length}개 이용권 코드 생성됨</p>
        </div>

        <div className="px-5 space-y-3">
          {results.map((r, i) => (
            <div key={i} className="bg-stone-900 border border-stone-700 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] text-stone-400 font-bold uppercase">
                  {r.tier === 'premium' ? '⭐ 프리미엄' : '스탠다드'} · {PLAN_META[r.plan].label}
                </p>
                <p className="text-lg font-black font-mono tracking-widest text-emerald-300 mt-0.5">{r.code}</p>
              </div>
              <button
                onClick={() => handleCopy(r.code, i)}
                className="shrink-0 p-2 rounded-xl bg-stone-700 hover:bg-stone-600 transition"
              >
                {copiedIdx === i ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} className="text-stone-300" />}
              </button>
            </div>
          ))}
        </div>

        <div className="px-5 mt-5 space-y-3">
          <button
            onClick={handleCopyAll}
            className="w-full py-3 rounded-2xl bg-stone-700 hover:bg-stone-600 font-bold text-sm flex items-center justify-center gap-2 transition"
          >
            {copiedIdx === -1 ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            {copiedIdx === -1 ? '전체 복사 완료' : '전체 코드 복사'}
          </button>
          <button
            onClick={() => { setCart([]); setResults([]); setStep('shop'); }}
            className="w-full py-3 rounded-2xl border border-stone-700 text-stone-400 font-bold text-sm transition hover:border-stone-500"
          >
            다시 발급하기
          </button>
        </div>
      </div>
    );
  }

  // ── 3. 쇼핑 화면 ──────────────────────────────────────────
  const curPrice = PRICES[selectedTier][selectedPlan];
  const curDiscount = discountPct(selectedTier, selectedPlan);
  const baseMonthlyPrice = PRICES[selectedTier].month;

  return (
    <div className="min-h-screen bg-stone-950 text-white pb-32">

      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 pt-10 pb-4">
        <div>
          <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest">⚠️ 테스트 전용</p>
          <h1 className="text-lg font-black">크레딧 구매</h1>
        </div>
        {cart.length > 0 && (
          <div className="flex items-center gap-1.5 bg-stone-800 border border-stone-700 rounded-full px-3 py-1.5">
            <ShoppingCart size={13} className="text-emerald-400" />
            <span className="text-xs font-black text-emerald-400">{totalQty}장</span>
          </div>
        )}
      </div>

      {/* ── 현재 담긴 항목 (장바구니 요약 그리드) ────────────── */}
      <div className="mx-5 mb-5 bg-stone-900 border border-stone-800 rounded-2xl p-4">
        <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest mb-3">현재 담긴 항목</p>
        <div className="grid grid-cols-3 gap-2">
          {(['month','6month','year'] as PlanKey[]).map(p => (
            <div key={`s-${p}`} className="bg-stone-800 rounded-xl p-2.5 text-center">
              <p className="text-[9px] text-stone-500 mb-0.5">{PLAN_META[p].label}</p>
              <p className={`text-xl font-black ${cartQty('standard', p) > 0 ? 'text-emerald-400' : 'text-stone-600'}`}>
                {cartQty('standard', p)}
              </p>
              <p className="text-[9px] text-stone-500">스탠다드</p>
            </div>
          ))}
          {(['month','6month','year'] as PlanKey[]).map(p => (
            <div key={`p-${p}`} className="bg-stone-800 rounded-xl p-2.5 text-center">
              <p className="text-[9px] text-stone-500 mb-0.5">{PLAN_META[p].label}P</p>
              <p className={`text-xl font-black ${cartQty('premium', p) > 0 ? 'text-amber-400' : 'text-stone-600'}`}>
                {cartQty('premium', p)}
              </p>
              <p className="text-[9px] text-stone-500">프리미엄</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 구매자 정보 ──────────────────────────────────────── */}
      <div className="mx-5 mb-5 space-y-2">
        <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest">구매자 정보</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="이름"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full p-3 rounded-xl bg-stone-900 border border-stone-700 text-sm focus:outline-none focus:border-emerald-500"
          />
          <input
            type="tel"
            placeholder="010-0000-0000"
            value={phone}
            onChange={e => setPhone(formatPhone(e.target.value))}
            className="w-full p-3 rounded-xl bg-stone-900 border border-stone-700 text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* ── 크레딧 선택 ──────────────────────────────────────── */}
      <div className="mx-5 mb-5">
        <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest mb-3">크레딧 선택</p>

        {/* 이용권 종류 탭 */}
        <div className="mb-3">
          <p className="text-stone-500 text-xs mb-2">이용권 종류</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSelectedTier('standard')}
              className={`py-3 rounded-2xl font-black text-sm border-2 flex items-center justify-center gap-1.5 transition ${
                selectedTier === 'standard'
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                  : 'border-stone-700 text-stone-400'
              }`}
            >
              <Shield size={14} /> 스탠다드
            </button>
            <button
              onClick={() => setSelectedTier('premium')}
              className={`py-3 rounded-2xl font-black text-sm border-2 flex items-center justify-center gap-1.5 transition ${
                selectedTier === 'premium'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                  : 'border-stone-700 text-stone-400'
              }`}
            >
              <Star size={14} /> 프리미엄
            </button>
          </div>
        </div>

        {/* 기간 선택 */}
        <div className="mb-4">
          <p className="text-stone-500 text-xs mb-2">기간</p>
          <div className="grid grid-cols-3 gap-2">
            {(['month','6month','year'] as PlanKey[]).map(p => {
              const disc = discountPct(selectedTier, p);
              const isActive = selectedPlan === p;
              return (
                <button
                  key={p}
                  onClick={() => setSelectedPlan(p)}
                  className={`relative p-3 rounded-2xl border-2 text-center transition ${
                    isActive
                      ? selectedTier === 'premium'
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-emerald-500 bg-emerald-500/10'
                      : 'border-stone-700 bg-stone-900'
                  }`}
                >
                  {PLAN_META[p].badge && (
                    <span className={`absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                      selectedTier === 'premium' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
                    }`}>
                      {PLAN_META[p].badge}
                    </span>
                  )}
                  <p className={`font-black text-sm mt-1 ${isActive ? (selectedTier === 'premium' ? 'text-amber-400' : 'text-emerald-400') : 'text-white'}`}>
                    {PLAN_META[p].label}
                  </p>
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    {(PRICES[selectedTier][p]).toLocaleString('ko-KR')}원
                  </p>
                  {disc !== null && (
                    <span className="inline-block mt-1 text-[9px] font-black bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-full">
                      {disc}% 할인
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 수량 선택 */}
        <div>
          <p className="text-stone-500 text-xs mb-2">수량</p>
          <div className="flex items-center justify-between bg-stone-900 border border-stone-700 rounded-2xl px-5 py-3">
            <button
              onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-9 h-9 rounded-full bg-stone-700 hover:bg-stone-600 flex items-center justify-center transition"
            >
              <Minus size={16} />
            </button>
            <span className="text-2xl font-black tabular-nums">{qty}장</span>
            <button
              onClick={() => setQty(q => Math.min(20, q + 1))}
              className="w-9 h-9 rounded-full bg-stone-700 hover:bg-stone-600 flex items-center justify-center transition"
            >
              <Plus size={16} />
            </button>
          </div>
          <p className="text-center text-stone-500 text-[10px] mt-1">최대 20장</p>
        </div>
      </div>

      {/* ── 장바구니 목록 ────────────────────────────────────── */}
      {cart.length > 0 && (
        <div className="mx-5 mb-4 space-y-2">
          <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest">장바구니</p>
          {cart.map((item, i) => (
            <div key={i} className="flex items-center justify-between bg-stone-900 border border-stone-800 rounded-xl px-4 py-2.5">
              <div>
                <span className={`text-[10px] font-bold ${item.tier === 'premium' ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {item.tier === 'premium' ? '⭐ 프리미엄' : '스탠다드'}
                </span>
                <span className="text-xs text-white font-bold ml-2">{PLAN_META[item.plan].label} × {item.qty}장</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white">
                  {(PRICES[item.tier][item.plan] * item.qty).toLocaleString('ko-KR')}원
                </span>
                <button onClick={() => removeFromCart(i)} className="p-1 text-stone-500 hover:text-rose-400 transition">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          <div className="flex justify-between px-1 pt-1">
            <span className="text-stone-400 text-xs">합계</span>
            <span className="text-white font-black text-sm">{totalAmount.toLocaleString('ko-KR')}원 ({totalQty}장)</span>
          </div>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="mx-5 mb-4 bg-red-900/30 border border-red-700 rounded-xl px-4 py-2.5">
          <p className="text-red-400 text-xs font-bold">{error}</p>
        </div>
      )}

      {/* ── 하단 고정 버튼 ←─────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-stone-950/90 backdrop-blur-sm border-t border-stone-800 space-y-2">
        {/* 담기 버튼 */}
        <button
          onClick={addToCart}
          className={`w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition active:scale-95 ${
            selectedTier === 'premium'
              ? 'bg-amber-500 hover:bg-amber-400 text-stone-900'
              : 'bg-emerald-500 hover:bg-emerald-400 text-stone-900'
          }`}
        >
          <ShoppingCart size={18} />
          {PLAN_META[selectedPlan].label} {selectedTier === 'premium' ? '프리미엄' : '스탠다드'} {qty}장 담기
          <span className="ml-1 opacity-70 text-sm font-bold">₩{(curPrice * qty).toLocaleString('ko-KR')}</span>
          {curDiscount && <span className="text-xs bg-rose-500/30 text-rose-200 px-1.5 py-0.5 rounded-full">{curDiscount}% 할인</span>}
        </button>

        {/* 결제하기 버튼 — 장바구니에 항목 있을 때만 */}
        {cart.length > 0 && (
          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-stone-100 hover:bg-white text-stone-900 font-black text-sm flex items-center justify-center gap-2 transition disabled:opacity-40"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                발급 중...
              </>
            ) : (
              <>
                🧾 총 {totalQty}장 모의 결제 · {totalAmount.toLocaleString('ko-KR')}원
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
