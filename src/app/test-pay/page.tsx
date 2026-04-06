'use client';
import React, { useState } from 'react';

export default function TestIssuePage() {
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const formatPhone = (v: string) => {
    const n = v.replace(/[^0-9]/g, '');
    if (n.length <= 3) return n;
    if (n.length <= 7) return `${n.slice(0,3)}-${n.slice(3)}`;
    return `${n.slice(0,3)}-${n.slice(3,7)}-${n.slice(7,11)}`;
  };
  const [plan, setPlan] = useState('month');
  const [tier, setTier] = useState('standard');
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleIssue = async () => {
    setLoading(true);
    setCode('');
    setError('');
    const res = await fetch('/api/test/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterPin: pin, name, phone, plan, tier }),
    });
    const data = await res.json();
    if (data.code) setCode(data.code);
    else setError(data.error ?? '오류 발생');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-stone-900 rounded-3xl p-6 space-y-4 text-white">
        <div className="text-center">
          <p className="text-xs text-amber-400 font-bold uppercase tracking-widest mb-1">⚠️ 테스트 전용</p>
          <h1 className="text-xl font-black">코드 직접 발급</h1>
          <p className="text-stone-400 text-xs mt-1">결제 없이 Supabase에 이용권 코드 생성</p>
        </div>

        <input
          type="password"
          placeholder="마스터 비번"
          value={pin}
          onChange={e => setPin(e.target.value)}
          className="w-full p-3 rounded-2xl bg-stone-800 border border-stone-700 text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-stone-400 mb-1">이름</p>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full p-2 rounded-xl bg-stone-800 border border-stone-700 text-sm focus:outline-none" />
          </div>
          <div>
            <p className="text-xs text-stone-400 mb-1">전화번호</p>
            <input type="tel" value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
              placeholder="010-0000-0000"
              className="w-full p-2 rounded-xl bg-stone-800 border border-stone-700 text-sm focus:outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-stone-400 mb-1">플랜</p>
            <select value={plan} onChange={e => setPlan(e.target.value)}
              className="w-full p-2 rounded-xl bg-stone-800 border border-stone-700 text-sm focus:outline-none">
              <option value="month">1개월</option>
              <option value="6month">6개월</option>
              <option value="year">1년</option>
            </select>
          </div>
          <div>
            <p className="text-xs text-stone-400 mb-1">티어</p>
            <select value={tier} onChange={e => setTier(e.target.value)}
              className="w-full p-2 rounded-xl bg-stone-800 border border-stone-700 text-sm focus:outline-none">
              <option value="standard">스탠다드</option>
              <option value="premium">프리미엄</option>
            </select>
          </div>
        </div>

        <button onClick={handleIssue} disabled={loading || !pin}
          className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 font-bold text-stone-900 transition">
          {loading ? '발급 중...' : '코드 발급'}
        </button>

        {code && (
          <div className="bg-emerald-900/50 border border-emerald-500 rounded-2xl p-4 text-center space-y-1">
            <p className="text-xs text-emerald-400 font-bold">✅ 발급 완료</p>
            <p className="text-2xl font-black tracking-widest font-mono text-emerald-300">{code}</p>
            <p className="text-xs text-stone-400">랜딩 페이지에서 이 코드로 로그인하면 됩니다</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-2xl p-3 text-center">
            <p className="text-red-400 text-sm font-bold">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
