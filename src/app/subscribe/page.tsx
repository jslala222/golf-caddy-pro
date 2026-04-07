'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Copy, Check, CreditCard, ChevronRight, Shield, Star, Banknote } from 'lucide-react';
import { requestCaddyPayment, PORTONE_PRODUCTS, PORTONE_PRODUCTS_PREMIUM } from '@/lib/paymentService';
import type { PortOneProductKey } from '@/lib/paymentService';

// ── 요금제 카드 레이블 ────────────────────────────────────────
const PLAN_LABELS: Record<PortOneProductKey, { period: string; badge?: string; color: string }> = {
  month:    { period: '1개월',  color: 'border-blue-400 bg-blue-50'    },
  '6month': { period: '6개월',  badge: 'BEST',       color: 'border-emerald-400 bg-emerald-50' },
  year:     { period: '1년',    badge: '🔥 최고혜택', color: 'border-amber-400 bg-amber-50'    },
};

function formatKRW(amount: number) {
  return amount.toLocaleString('ko-KR') + '원';
}

// ── 결제 완료 처리 내부 컴포넌트 (useSearchParams 분리) ───────
function SubscribeInner() {
  const searchParams = useSearchParams();

  const [selectedPlan, setSelectedPlan] = useState<PortOneProductKey>('month');
  const [selectedTier, setSelectedTier] = useState<'standard' | 'premium'>('standard');
  const [selectedPayMethod, setSelectedPayMethod] = useState<'CARD' | 'TRANSFER'>('CARD');
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [modalMsg, setModalMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [issuedCode, setIssuedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [dealerRef, setDealerRef] = useState('');

  // ── 딜러 링크에서 온 경우 폼 자동입력 ──────────────────────
  useEffect(() => {
    const n  = searchParams.get('name');
    const p  = searchParams.get('phone');
    const pl = searchParams.get('plan');
    const r  = searchParams.get('ref');
    const t  = searchParams.get('tier');
    if (n) setName(n);
    if (p) setPhone(p);
    if (pl && ['month', '6month', 'year'].includes(pl)) setSelectedPlan(pl as PortOneProductKey);
    if (r) setDealerRef(r);
    if (t === 'premium') setSelectedTier('premium');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 모바일 리다이렉트 복구 ──────────────────────────────────
  useEffect(() => {
    const status    = searchParams.get('payment');
    const paymentId = searchParams.get('paymentId');
    if (status !== 'done' || !paymentId) return;

    const raw = sessionStorage.getItem('caddy_payment_info');
    if (!raw) return;

    let info: { name: string; phone: string; planKey: PortOneProductKey; paymentId: string; tier?: string; dealerRef?: string };
    try { info = JSON.parse(raw); } catch { return; }

    setLoading(true);
    fetch('/api/payment/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, name: info.name, phone: info.phone, planKey: info.planKey, tier: info.tier ?? 'standard', dealerRef: info.dealerRef }),
    })
      .then(r => r.json())
      .then(res => {
        if (res.code) {
          sessionStorage.removeItem('caddy_payment_info');
          setIssuedCode(res.code);
        } else {
          setError(res.error ?? '코드 발급에 실패했습니다.');
        }
      })
      .catch(() => setError('네트워크 오류가 발생했습니다.'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 모바일 결제숨 중 뒤로가기 시 loading 해제 ─────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') setLoading(false);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // ── 전화번호 자동 포맷 ──────────────────────────────────────
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 7) formatted = `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
    else if (digits.length > 3) formatted = `${digits.slice(0,3)}-${digits.slice(3)}`;
    setPhone(formatted);
  };

  // ── 결제 시작 ──────────────────────────────────────────────
  const handlePay = async () => {
    if (!name.trim() || phone.replace(/\D/g, '').length < 11) {
      setModalMsg('이름과 연락처는 필수입니다.\n정확히 입력하셔야 합니다.\n(예: 010-1234-5678)');
      return;
    }
    setError('');
    setLoading(true);

    const result = await requestCaddyPayment({ name: name.trim(), phone: phone.trim(), planKey: selectedPlan, tier: selectedTier, payMethod: selectedPayMethod, dealerRef });

    if (!result.success) {
      setModalMsg(result.error ?? '결제 처리 중 오류가 발생했습니다.');
      setLoading(false);
      return;
    }

    // PC 결제: paymentId 받아서 완료 API 호출
    if (result.paymentId) {
      const res = await fetch('/api/payment/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: result.paymentId, name: name.trim(), phone: phone.trim(), planKey: selectedPlan, tier: selectedTier, dealerRef }),
      });
      const data = await res.json();
      if (data.code) {
        setIssuedCode(data.code);
      } else {
        setError(data.error ?? '코드 발급에 실패했습니다.');
      }
    }

    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(issuedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // ── 로딩 화면 ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-stone-500 text-sm">결제 처리 중…</p>
        </div>
      </div>
    );
  }

  // ── 발급 완료 화면 ─────────────────────────────────────────
  if (issuedCode) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <CheckCircle2 size={72} className="mx-auto text-emerald-500" />
          <div>
            <h1 className="text-2xl font-black text-stone-900">결제 완료!</h1>
            <p className="text-stone-500 text-sm mt-1">이용권이 발급되었습니다.</p>
          </div>

          {/* 코드 카드 */}
          <div className="bg-stone-50 border border-stone-200 rounded-3xl p-8 space-y-3 relative">
            <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider">이용권 코드</p>
            <div className="text-4xl font-black tracking-[0.15em] font-mono text-stone-900">
              {issuedCode}
            </div>
            <p className="text-stone-400 text-xs">앱에서 이 코드를 입력하면 즉시 활성화됩니다</p>
          </div>

          <button
            onClick={handleCopy}
            className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
              copied ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            {copied ? <Check size={20} /> : <Copy size={20} />}
            {copied ? '복사 완료!' : '코드 복사하기'}
          </button>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-700 text-left leading-relaxed">
            ✅ 이 코드를 안전한 곳에 저장해두세요.<br />
            ✅ 기기 변경 시 코드만 입력하면 복구됩니다.<br />
            ✅ 코드 분실 시 고객센터에 문의해주세요.
          </div>
        </div>
      </div>
    );
  }

  // ── 메인 구매 폼 ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white pb-24">
      {/* 헤더 */}
      <div className="bg-stone-900 px-6 pt-12 pb-8 text-white">
        <p className="text-stone-400 text-xs font-bold uppercase tracking-widest mb-1">Caddy Manager Pro</p>
        <h1 className="text-2xl font-black">이용권 구매</h1>
        <p className="text-stone-400 text-sm mt-1">결제 즉시 코드가 발급됩니다</p>
      </div>

      {/* 딜러 추천 배너 */}
      {dealerRef && (
        <div className="mx-6 mt-4 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
          <span className="text-lg">⛳</span>
          <div>
            <p className="font-bold">딜러 추천 링크로 접속하셨습니다</p>
            <p className="text-xs text-emerald-600">이름과 연락처가 미리 입력되었습니다. 확인 후 결제해주세요.</p>
          </div>
        </div>
      )}

      <div className="p-6 space-y-6">

        {/* 티어 선택 */}
        <section className="space-y-3">
          <h2 className="font-bold text-stone-700 text-sm">이용권 종류</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedTier('standard')}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${
                selectedTier === 'standard'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Shield size={16} className={selectedTier === 'standard' ? 'text-emerald-500' : 'text-stone-400'} />
                <span className="font-black text-sm">스탠다드</span>
              </div>
              <p className="text-[10px] text-stone-400 leading-relaxed">자동 백업 O<br />복구 수동</p>
            </button>
            <button
              onClick={() => setSelectedTier('premium')}
              className={`p-4 rounded-2xl border-2 text-left transition-all relative ${
                selectedTier === 'premium'
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <div className="absolute top-2 right-2 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">추천</div>
              <div className="flex items-center gap-2 mb-2">
                <Star size={16} className={selectedTier === 'premium' ? 'text-amber-500' : 'text-stone-400'} />
                <span className="font-black text-sm">프리미엄</span>
              </div>
              <p className="text-[10px] text-stone-400 leading-relaxed">자동 백업 O<br />폰 바꿔도 자동 복구 ✅</p>
            </button>
          </div>
          {selectedTier === 'premium' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-700">
              💡 프리미엄: 폰 분실·기기 변경 시 코드 입력만 하면 <strong>데이터 자동 복구</strong>
            </div>
          )}
        </section>

        {/* 요금제 선택 */}
        <section className="space-y-3">
          <h2 className="font-bold text-stone-700 text-sm">요금제 선택</h2>
          {(Object.entries(selectedTier === 'premium' ? PORTONE_PRODUCTS_PREMIUM : PORTONE_PRODUCTS) as [PortOneProductKey, { name: string; amount: number; days: number }][]).map(([key, product]) => {
            const label = PLAN_LABELS[key];
            const isSelected = selectedPlan === key;
            const monthlyAmt = Math.round(product.amount / (product.days / 30));
            const baseMonthly = selectedTier === 'premium' ? 12900 : 9900;
            const discountPct = key === 'month' ? null : Math.round((1 - monthlyAmt / baseMonthly) * 100);
            return (
              <button
                key={key}
                onClick={() => setSelectedPlan(key)}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                  isSelected
                    ? selectedTier === 'premium' ? 'border-amber-500 bg-amber-50' : 'border-emerald-500 bg-emerald-50'
                    : 'border-stone-200 bg-white hover:border-stone-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? (selectedTier === 'premium' ? 'border-amber-500 bg-amber-500' : 'border-emerald-500 bg-emerald-500') : 'border-stone-300'}`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900">{label.period}</span>
                      {label.badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedTier === 'premium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {label.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-stone-400 text-xs">
                        월 {monthlyAmt.toLocaleString('ko-KR')}원
                        {discountPct && <span className="ml-1 text-emerald-600 font-bold">{discountPct}% 할인</span>}
                    </p>
                  </div>
                </div>
                <span className="font-black text-stone-900 text-lg">{(product.amount).toLocaleString('ko-KR')}원</span>
              </button>
            );
          })}
        </section>

        {/* 결제수단 선택 */}
        <section className="space-y-3">
          <h2 className="font-bold text-stone-700 text-sm">결제수단</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedPayMethod('CARD')}
              className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3 ${
                selectedPayMethod === 'CARD'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <CreditCard size={18} className={selectedPayMethod === 'CARD' ? 'text-emerald-500' : 'text-stone-400'} />
              <div>
                <p className="font-black text-sm">카드결제</p>
                <p className="text-[10px] text-stone-400">신용·체크카드</p>
              </div>
            </button>
            <button
              onClick={() => setSelectedPayMethod('TRANSFER')}
              className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3 ${
                selectedPayMethod === 'TRANSFER'
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <Banknote size={18} className={selectedPayMethod === 'TRANSFER' ? 'text-amber-500' : 'text-stone-400'} />
              <div>
                <p className="font-black text-sm">실시간이체</p>
              </div>
            </button>
          </div>
        </section>

        {/* 구매자 정보 */}
        <section className="space-y-3">
          <h2 className="font-bold text-stone-700 text-sm">구매자 정보</h2>
          <input
            type="text"
            placeholder="이름"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 border-2 border-stone-800 rounded-xl focus:outline-none focus:border-stone-600 text-stone-900 placeholder-stone-400"
          />
          <input
            type="tel"
            placeholder="연락처 (예: 010-0000-0000)"
            value={phone}
            onChange={handlePhoneChange}
            className="w-full px-4 py-3 border-2 border-stone-800 rounded-xl focus:outline-none focus:border-stone-600 text-stone-900 placeholder-stone-400"
          />
        </section>

        {/* 오류 메시지 */}
        {/* 인라인 error 표시 제거 — 모달로 대체 */}

        {/* 결제 버튼 */}
        <button
          onClick={handlePay}
          disabled={loading}
          className={`w-full py-4 text-white font-black text-lg rounded-2xl transition flex items-center justify-center gap-2 disabled:opacity-50 ${selectedTier === 'premium' ? 'bg-amber-500 hover:bg-amber-400' : 'bg-emerald-600 hover:bg-emerald-500'}`}
        >
          <CreditCard size={20} />
          {(selectedTier === 'premium' ? PORTONE_PRODUCTS_PREMIUM[selectedPlan].amount : PORTONE_PRODUCTS[selectedPlan].amount).toLocaleString('ko-KR')}원 결제하기
          <ChevronRight size={18} />
        </button>

        <p className="text-center text-stone-400 text-xs leading-relaxed">
          결제 즉시 이용권 코드가 발급됩니다.<br />
          카드 · 실시간계좌이체 모두 지원됩니다.
        </p>
      </div>

      {/* ── 필수값 입력 모달 ── */}
      {modalMsg && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 text-center shadow-2xl">
            <div className="text-4xl">⚠️</div>
            <p className="text-stone-800 font-bold text-sm leading-relaxed whitespace-pre-line">{modalMsg}</p>
            <button
              onClick={() => setModalMsg('')}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black transition"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Suspense 래퍼 (useSearchParams 요구사항) ──────────────────
export default function SubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SubscribeInner />
    </Suspense>
  );
}
