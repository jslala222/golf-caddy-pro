
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { Calendar as CalendarIcon, Users, Wallet, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { Calendar } from '@/components/Calendar';

export default function Home() {
  const store = useAppStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // 하이드레이션 전에는 아무 계산도 하지 않고 투명한 로딩만 보여줌
  if (!isHydrated) {
    return (
      <div className="p-6 space-y-8 animate-pulse bg-white min-h-screen">
        <div className="h-8 bg-stone-100 rounded-md w-1/2"></div>
        <div className="h-48 bg-stone-100 rounded-2xl w-full"></div>
        <div className="h-32 bg-stone-100 rounded-2xl w-full"></div>
      </div>
    );
  }

  // 화면이 뜬 후에만 안전하게 데이터 가공 시작
  const { transactions = [], schedules = [], clients = [], feeSettings } = store;
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date().toISOString().split('T')[0];

  const monthlyTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const monthlySchedules = schedules.filter(s => {
    const d = new Date(s.date);
    return d.getFullYear() === year && d.getMonth() === month && s.type === 'work';
  });

  const getCaddyFee = (s: any) => {
    if (s.caddyFee) return s.caddyFee;
    if (!feeSettings) return 150000;
    if (s.shift === '1') return feeSettings.shift1;
    if (s.shift === '2') return feeSettings.shift2;
    if (s.shift === '3') return feeSettings.shift3;
    return 150000;
  };

  const scheduleIncomeRealized = monthlySchedules.filter(s => s.date <= today).reduce((acc, s) => acc + getCaddyFee(s) + (s.overFee || 0), 0);
  const scheduleIncomeExpected = monthlySchedules.reduce((acc, s) => acc + getCaddyFee(s) + (s.overFee || 0), 0);
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

  monthlySchedules.forEach(s => {
    const isRealized = s.date <= today;
    const target = isRealized ? roundStats.realized : roundStats.expected;
    const holes = parseInt(String(s.holes || '18').replace(/[^0-9]/g, '')) || 18;
    if (holes === 18) target.h18++; else if (holes === 9) target.h9++; else target.other++;
    target.total++;
  });

  const todaySchedule = schedules.filter(s => s.date === today);

  return (
    <div className="p-6 space-y-8 pb-32" style={{ backgroundColor: 'white', minHeight: '100vh' }}>
      {/* Header */}
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">캐디 매니저 프로</h1>
          <p className="text-stone-500 text-sm">오늘도 굿샷 하세요! ⛳️</p>
        </div>
        <Link href="/settings" className="p-2 bg-stone-100 rounded-full text-stone-600 hover:bg-stone-200">
          <ChevronRight size={20} />
        </Link>
      </header>

      {/* Net Income Card */}
      <section className="bg-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200 transition-all relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute right-[-20px] top-[-20px] opacity-10">
          <Wallet size={120} />
        </div>

        <div className="flex justify-between items-start mb-2 relative z-10">
          <p className="text-emerald-100 text-sm">
            <span className="font-bold text-emerald-50">{month + 1}월</span> 현재 순수익
          </p>
          {/* Expected Badge */}
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

        {/* Rounding Quick Stats */}
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
          <div className="text-[10px] bg-white/10 px-2 py-1 rounded text-white font-bold">
            현재 {roundStats.realized.total}회 / 전체 {roundStats.realized.total + roundStats.expected.total}회
          </div>
        </div>
      </section>

      {/* Monthly Calendar */}
      <section>
        <Calendar
          schedules={schedules}
          selectedDate={currentDate.toISOString().split('T')[0]}
          viewDate={currentDate} // Pass viewDate to control calendar month
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
          <span className="font-bold text-stone-700">수입 기록</span>
        </Link>
      </section>

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
  );
}
