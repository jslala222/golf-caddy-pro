'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { Calendar as CalendarIcon, Wallet, ChevronRight, TrendingUp, TrendingDown, LogOut, Plus, X, DollarSign } from 'lucide-react';
import { Calendar } from '@/components/Calendar';

export default function HomePage() {
  const store = useAppStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userName, setUserName] = useState<string | null>(null);

  // 빠른 수입 입력 모달
  const [quickOpen, setQuickOpen] = useState(false);
  const [qCaddyFee, setQCaddyFee] = useState('');
  const [qTip, setQTip] = useState('');
  const [qOverFee, setQOverFee] = useState('');
  const [qMemo, setQMemo] = useState('');

  useEffect(() => {
    const code = localStorage.getItem('caddy_license_key');
    if (!code) return;
    if (code.trim().toUpperCase() === '0827') {
      setUserName('관리자');
      localStorage.setItem(`caddy_user_name_0827`, '관리자');
      return;
    }
    const cached = localStorage.getItem(`caddy_user_name_${code}`);
    if (cached) { setUserName(cached); return; }
    import('@/lib/supabaseClient').then(({ supabase }) => {
      supabase
        .from('aone_pro_caddypro_licenses')
        .select('user_name')
        .ilike('code', code.trim())
        .maybeSingle()
        .then(({ data }) => {
          if (data?.user_name) {
            setUserName(data.user_name);
            localStorage.setItem(`caddy_user_name_${code}`, data.user_name);
          }
        });
    });
  }, []);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated) {
    return (
      <div className="flex justify-center min-h-screen bg-stone-100">
        <div className="w-full max-w-[480px] bg-white p-6 flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-emerald-600 font-bold text-lg">골프 캐디 매니저</p>
          <p className="text-stone-400 text-sm">Ver 1.5.130 • 휴무 기능 전면 개편 완료!</p>
        </div>
      </div>
    );
  }

  const { transactions = [], schedules = [], clients = [], feeSettings, addTransaction } = store;

  // 빠른 수입 입력 모달 열기 (캐디피 기본값 자동 설정)
  const openQuickModal = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const alreadyToday = transactions.filter(t => t.date === todayStr && t.type === 'income');
    // 오늘 이미 캐디피 입력 없을 때만 기본값 설정
    const hasFeesToday = alreadyToday.some(t => t.category === 'caddy_fee');
    if (!hasFeesToday && feeSettings) {
      setQCaddyFee(fmtInput(String(feeSettings.shift1)));
    } else {
      setQCaddyFee('');
    }
    setQTip('');
    setQOverFee('');
    setQMemo('');
    setQuickOpen(true);
  };

  const handleQuickIncome = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const toNum = (s: string) => parseInt(s.replace(/[^0-9]/g, ''), 10) || 0;
    if (toNum(qCaddyFee) > 0) addTransaction({ date: todayStr, type: 'income', amount: toNum(qCaddyFee), category: 'caddy_fee', memo: '캐디피' + (qMemo ? ` (${qMemo})` : '') });
    if (toNum(qTip)      > 0) addTransaction({ date: todayStr, type: 'income', amount: toNum(qTip),      category: 'tip',       memo: '팁' });
    if (toNum(qOverFee)  > 0) addTransaction({ date: todayStr, type: 'income', amount: toNum(qOverFee),  category: 'over_fee',  memo: '오버피' });
    setQuickOpen(false);
  };

  const fmtInput = (v: string) => {
    const n = v.replace(/[^0-9]/g, '');
    return n ? parseInt(n, 10).toLocaleString() : '';
  };
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date().toISOString().split('T')[0];

  const monthlyTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const monthlySchedules = schedules.filter(s => {
    const d = new Date(s.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const workSchedules = monthlySchedules.filter(s => s.type === 'work');
  const holidaySchedules = monthlySchedules.filter(s => s.type === 'holiday');
  const uniqueHolidayDays = new Set(holidaySchedules.map(h => h.date)).size;

  const getCaddyFee = (s: any) => {
    if (s.caddyFee) return s.caddyFee;
    if (!feeSettings) return 150000;
    if (s.shift === '1') return feeSettings.shift1;
    if (s.shift === '2') return feeSettings.shift2;
    if (s.shift === '3') return feeSettings.shift3;
    return 150000;
  };

  const scheduleIncomeRealized = workSchedules.filter(s => s.date <= today).reduce((acc, s) => acc + getCaddyFee(s) + (s.overFee || 0), 0);
  const scheduleIncomeExpected = workSchedules.reduce((acc, s) => acc + getCaddyFee(s) + (s.overFee || 0), 0);
  const manualIncome = monthlyTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalIncomeRealized = scheduleIncomeRealized + manualIncome;
  const totalIncomeExpected = scheduleIncomeExpected + manualIncome;
  const totalExpense = monthlyTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  const netIncomeRealized = totalIncomeRealized - totalExpense;
  const netIncomeExpected = totalIncomeExpected - totalExpense;

  const roundStats = {
    realized: { h18: 0, h9: 0, other: 0, total: 0 },
    expected: { h18: 0, h9: 0, other: 0, total: 0 }
  };

  workSchedules.forEach(s => {
    const isRealized = s.date <= today;
    const target = isRealized ? roundStats.realized : roundStats.expected;
    const holes = parseInt(String(s.holes || '18').replace(/[^0-9]/g, '')) || 18;
    if (holes === 18) target.h18++; else if (holes === 9) target.h9++; else target.other++;
    target.total++;
  });

  const todaySchedule = schedules.filter(s => s.date === today);

  return (
    <>
    <div className="p-6 space-y-8 pb-32" style={{ backgroundColor: 'white', minHeight: '100vh' }}>
      {/* Header */}
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">캐디 매니저 프로</h1>
          <p className="text-stone-500 text-sm">
            {userName ? <><span className="font-semibold text-emerald-600">{userName}</span>님 환영합니다! ⛳️</> : '오늘도 굿샷 하세요! ⛳️'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!confirm('로그아웃 하시겠습니까?')) return;
              // 현재 데이터를 계정별 키에 백업 후 메인 스토리지 초기화
              const activeKey = localStorage.getItem('caddy_active_key');
              const currentData = localStorage.getItem('caddy-manager-storage');
              if (activeKey && currentData) {
                localStorage.setItem(`caddy-manager-storage_${activeKey}`, currentData);
              }
              localStorage.removeItem('caddy-manager-storage');
              localStorage.removeItem('caddy_license_key');
              localStorage.removeItem('caddy_expires_at');
              localStorage.removeItem('caddy_tier');
              localStorage.removeItem('caddy_active_key');
              if (activeKey) localStorage.removeItem(`caddy_user_name_${activeKey}`);
              localStorage.removeItem('caddy_user_name');
              window.location.replace('/landing');
            }}
            className="p-2 bg-stone-100 rounded-full text-stone-400 hover:bg-red-50 hover:text-red-400 transition"
            title="로그아웃"
          >
            <LogOut size={18} />
          </button>
          <Link href="/settings" className="p-2 bg-stone-100 rounded-full text-stone-600 hover:bg-stone-200">
            <ChevronRight size={20} />
          </Link>
        </div>
      </header>

      {/* Net Income Card */}
      <section className="bg-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200 transition-all relative overflow-hidden">
        <div className="absolute right-[-20px] top-[-20px] opacity-10">
          <Wallet size={120} />
        </div>

        <div className="flex justify-between items-start mb-2 relative z-10">
          <p className="text-emerald-100 text-sm">
            <span className="font-bold text-emerald-50">{month + 1}월</span> 현재 순수익
          </p>
          {totalIncomeExpected > totalIncomeRealized && (
            <div className="bg-emerald-700/60 px-2 py-1 rounded-lg text-[10px] text-emerald-100 backdrop-blur-sm">
              예상 합계: {formatCurrency(netIncomeExpected).replace('₩', '')}원
            </div>
          )}
        </div>

        <div className="text-4xl font-bold mb-5 relative z-10">
          {formatCurrency(netIncomeRealized).replace('₩', '')}<span className="text-xl font-normal ml-1">원</span>
        </div>

        <div className="flex gap-3 text-xs font-medium relative z-10">
          <div className="flex items-center bg-red-500/80 px-3 py-1.5 rounded-full backdrop-blur-md text-white shadow-sm">
            <TrendingUp size={14} className="mr-1 text-red-100" />
            수입 {formatCurrency(totalIncomeRealized).replace('₩', '')}
          </div>
          <div className="flex items-center bg-blue-500/80 px-3 py-1.5 rounded-full backdrop-blur-md text-white shadow-sm">
            <TrendingDown size={14} className="mr-1 text-blue-100" />
            지출 {formatCurrency(totalExpense).replace('₩', '')}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center relative z-10">
          <div className="flex gap-4">
            <div className="text-center">
              <span className="text-[10px] text-emerald-200 block">18홀</span>
              <span className="font-bold text-lg">
                {roundStats.realized.h18}
                {roundStats.expected.h18 > 0 && <span className="text-[10px] ml-0.5 text-emerald-300">+{roundStats.expected.h18}</span>}
              </span>
            </div>
            <div className="text-center">
              <span className="text-[10px] text-emerald-200 block">9홀</span>
              <span className="font-bold text-lg">
                {roundStats.realized.h9}
                {roundStats.expected.h9 > 0 && <span className="text-[10px] ml-0.5 text-emerald-300">+{roundStats.expected.h9}</span>}
              </span>
            </div>
            {(roundStats.realized.other > 0 || roundStats.expected.other > 0) && (
              <div className="text-center">
                <span className="text-[10px] text-emerald-200 block">기타</span>
                <span className="font-bold text-lg">
                  {roundStats.realized.other}
                  {roundStats.expected.other > 0 && <span className="text-[10px] ml-0.5 text-emerald-300">+{roundStats.expected.other}</span>}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <div className="text-[10px] bg-white/10 px-2 py-1 rounded text-white font-bold">
              휴무: {uniqueHolidayDays}일
            </div>
            <div className="text-[10px] bg-white/10 px-2 py-1 rounded text-white font-bold">
              현재 {roundStats.realized.total}회 / 전체 {roundStats.realized.total + roundStats.expected.total}회
            </div>
          </div>
        </div>
      </section>

      {/* 오늘 수입 빠른 입력 버튼 */}
      <section>
        <button
          onClick={openQuickModal}
          className="w-full flex items-center justify-center gap-2 bg-emerald-50 border-2 border-emerald-200 border-dashed rounded-2xl py-4 text-emerald-700 font-bold text-sm hover:bg-emerald-100 active:scale-[.98] transition"
        >
          <Plus size={18} />
          오늘 수입 입력
        </button>
        {/* 오늘 입력된 수입 리스트 */}
        {(() => {
          const todayStr = new Date().toISOString().split('T')[0];
          const todayIncomes = transactions.filter(t => t.date === todayStr && t.type === 'income');
          if (todayIncomes.length === 0) return null;
          const todayTotal = todayIncomes.reduce((s, t) => s + t.amount, 0);
          return (
            <div className="mt-2 bg-white border border-stone-100 rounded-xl p-3 space-y-1">
              <p className="text-[11px] text-stone-400 font-semibold mb-1">오늘 수입 합계 — <span className="text-emerald-600 font-bold">{todayTotal.toLocaleString()}원</span></p>
              {todayIncomes.map(t => (
                <div key={t.id} className="flex justify-between items-center text-xs">
                  <span className="text-stone-500">{t.memo || t.category}</span>
                  <span className="font-bold text-stone-800">{t.amount.toLocaleString()}원</span>
                </div>
              ))}
            </div>
          );
        })()}
      </section>

      {/* Monthly Calendar */}
      <section>
        <Calendar
          schedules={schedules}
          selectedDate={currentDate.toISOString().split('T')[0]}
          viewDate={currentDate}
          onMonthChange={setCurrentDate}
        />
      </section>

      {/* Quick Actions */}
      <section className="grid grid-cols-2 gap-4">
        <Link href="/schedule" className="bg-white p-4 rounded-xl border border-stone-100 shadow-sm hover:shadow-md transition flex flex-col items-center justify-center h-32">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
            <CalendarIcon size={24} />
          </div>
          <span className="font-bold text-stone-700">일정 추가</span>
        </Link>
        <Link href="/money" className="bg-white p-4 rounded-xl border border-stone-100 shadow-sm hover:shadow-md transition flex flex-col items-center justify-center h-32">
          <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center mb-3">
            <Wallet size={24} />
          </div>
          <span className="font-bold text-stone-700">수입/지출 전체</span>
        </Link>
      </section>

      {/* 연간 수입 현황 카드 */}
      {(() => {
        const yearStr = String(year);
        const yearlyWork = schedules.filter(s => s.type === 'work' && s.date.startsWith(yearStr) && s.date <= today);
        const yearlyScheduleIncome = yearlyWork.reduce((acc, s) => acc + getCaddyFee(s) + (s.overFee || 0), 0);
        const yearlyManualIncome = transactions.filter(t => t.type === 'income' && t.date.startsWith(yearStr)).reduce((acc, t) => acc + t.amount, 0);
        const yearlyExpense = transactions.filter(t => t.type === 'expense' && t.date.startsWith(yearStr)).reduce((acc, t) => acc + t.amount, 0);
        const yearlyNet = yearlyScheduleIncome + yearlyManualIncome - yearlyExpense;
        const totalRounds = yearlyWork.length;
        const h18 = yearlyWork.filter(s => (s.holes ?? 18) === 18).length;
        const h9 = yearlyWork.filter(s => s.holes === 9).length;
        return (
          <section className="bg-stone-800 rounded-2xl p-5 text-white">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-stone-300">{year}년 연간 현황</span>
              <Link href="/money" className="text-[11px] text-stone-400 hover:text-emerald-400">전체보기 →</Link>
            </div>
            <div className="text-3xl font-black mb-1">{yearlyNet.toLocaleString()}<span className="text-sm font-normal text-stone-400 ml-1">원 (순수익)</span></div>
            <div className="text-xs text-stone-400 mb-4">수입 {(yearlyScheduleIncome + yearlyManualIncome).toLocaleString()} — 지출 {yearlyExpense.toLocaleString()}</div>
            <div className="grid grid-cols-3 divide-x divide-stone-700 bg-stone-700/50 rounded-xl py-3">
              <div className="text-center">
                <div className="text-[10px] text-stone-400 mb-1">총 라운드</div>
                <div className="text-xl font-black text-emerald-400">{totalRounds}<span className="text-xs font-normal ml-0.5">회</span></div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-stone-400 mb-1">18홀</div>
                <div className="text-xl font-black">{h18}<span className="text-xs font-normal ml-0.5">회</span></div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-stone-400 mb-1">9홀</div>
                <div className="text-xl font-black">{h9}<span className="text-xs font-normal ml-0.5">회</span></div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* Today's Schedule */}
      <section>
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-lg font-bold text-stone-800">오늘의 일정</h2>
          <span className="text-xs text-stone-400">{today}</span>
        </div>

        {todaySchedule.length > 0 ? (
          <div className="space-y-3">
            {todaySchedule.map(s => (
              <div key={s.id} className="bg-white p-4 rounded-xl border border-stone-100 shadow-sm flex items-center">
                <div className={`w-2 h-12 rounded-full mr-4 ${s.type === 'work' ? (s.shift === '1' ? 'bg-red-500' : s.shift === '2' ? 'bg-blue-500' : 'bg-emerald-500') : 'bg-orange-400'}`}></div>
                <div>
                  <p className="font-bold text-stone-800">{s.title}</p>
                  <p className="text-sm text-stone-500">{s.time} • {s.type === 'work' ? `${s.shift}부 근무` : '개인 일정'}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-stone-50 p-8 rounded-xl text-center text-stone-400">
            <p>오늘 잡힌 일정이 없네요.</p>
            <p className="text-xs mt-1">푹 쉬세요! 🍵</p>
          </div>
        )}
      </section>

      {/* Recent Clients Preview */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-stone-800">최근 고객</h2>
          <Link href="/clients" className="text-xs text-emerald-600 font-bold">전체보기</Link>
        </div>
        <div className="space-y-3">
          {clients.slice(-3).reverse().map(c => (
            <div key={c.id} className={`p-4 bg-white rounded-xl shadow-sm border-l-4 ${c.grade === 'gn' ? 'border-l-red-500' : c.grade === 'vip' ? 'border-l-blue-500' : 'border-l-stone-300'}`}>
              <div className="flex justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{c.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.grade === 'gn' ? 'bg-red-100 text-red-600' : c.grade === 'vip' ? 'bg-blue-100 text-blue-600' : 'bg-stone-100 text-stone-500'}`}>
                    {c.grade === 'gn' ? '진상' : c.grade === 'vip' ? 'VIP' : '일반'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-stone-500 mt-1 line-clamp-1">{c.memo || '특이사항 없음'}</p>
            </div>
          ))}
          {clients.length === 0 && (
            <div className="text-center text-xs text-stone-400 py-4">
              등록된 고객이 없습니다.
            </div>
          )}
        </div>
      </section>
    </div>

    {/* 빠른 수입 입력 모달 */}
    {quickOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setQuickOpen(false)}>
        <div
          className="w-full max-w-[420px] bg-white rounded-3xl p-6 shadow-2xl space-y-4 overflow-y-auto max-h-[calc(100dvh-80px)]"
          onClick={e => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <DollarSign size={20} className="text-emerald-600" />
              오늘 수입 입력
            </h3>
            <button onClick={() => setQuickOpen(false)} className="p-1 text-stone-400 hover:text-stone-600">
              <X size={22} />
            </button>
          </div>

          {/* 캐디피 */}
          <div>
            <label className="text-xs font-bold text-stone-500 block mb-1">캐디피 (원)</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="150,000"
              value={qCaddyFee}
              onChange={e => setQCaddyFee(fmtInput(e.target.value))}
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-stone-900 font-bold text-right text-lg focus:outline-none focus:border-emerald-400"
            />
          </div>

          {/* 팁 */}
          <div>
            <label className="text-xs font-bold text-stone-500 block mb-1">팁 (원)</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={qTip}
              onChange={e => setQTip(fmtInput(e.target.value))}
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-stone-900 font-bold text-right text-lg focus:outline-none focus:border-emerald-400"
            />
          </div>

          {/* 오버피 */}
          <div>
            <label className="text-xs font-bold text-stone-500 block mb-1">오버피 (원)</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={qOverFee}
              onChange={e => setQOverFee(fmtInput(e.target.value))}
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-stone-900 font-bold text-right text-lg focus:outline-none focus:border-emerald-400"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="text-xs font-bold text-stone-500 block mb-1">메모 (선택)</label>
            <input
              type="text"
              placeholder="골프장명, 특이사항 등"
              value={qMemo}
              onChange={e => setQMemo(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-stone-700 text-sm focus:outline-none focus:border-emerald-400"
            />
          </div>

          {/* 합계 미리보기 */}
          {(parseInt(qCaddyFee.replace(/,/g,''),10)||0) + (parseInt(qTip.replace(/,/g,''),10)||0) + (parseInt(qOverFee.replace(/,/g,''),10)||0) > 0 && (
            <div className="bg-emerald-50 rounded-xl px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-emerald-700 font-semibold">오늘 총 수입</span>
              <span className="text-emerald-700 font-bold text-lg">
                {((parseInt(qCaddyFee.replace(/,/g,''),10)||0) + (parseInt(qTip.replace(/,/g,''),10)||0) + (parseInt(qOverFee.replace(/,/g,''),10)||0)).toLocaleString()}원
              </span>
            </div>
          )}

          {/* 저장 버튼 */}
          <button
            onClick={handleQuickIncome}
            disabled={!qCaddyFee && !qTip && !qOverFee}
            className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl text-base disabled:opacity-40 active:scale-[.98] transition"
          >
            저장
          </button>
        </div>
      </div>
    )}
    </>
  );
}
