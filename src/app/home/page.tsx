'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import type { Diary } from '@/lib/store';
import { formatCurrency, todayKST } from '@/lib/utils';
import { Calendar as CalendarIcon, Wallet, ChevronRight, TrendingUp, TrendingDown, LogOut, Plus, X, BookOpen } from 'lucide-react';
import { Calendar } from '@/components/Calendar';

export default function HomePage() {
  const store = useAppStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userName, setUserName] = useState<string | null>(null);
  const [selectedModalDate, setSelectedModalDate] = useState<string | null>(null);

  // 빠른 수입 입력 모달
  const [quickOpen, setQuickOpen] = useState(false);
  const [qSaving, setQSaving] = useState(false);
  // 1부/2부/3부 팁
  const [qTip1, setQTip1] = useState('');
  const [qTip2, setQTip2] = useState('');
  const [qTip3, setQTip3] = useState('');
  // 기타수입
  const [qExtraReason, setQExtraReason] = useState('');
  const [qExtraAmount, setQExtraAmount] = useState('');
  // 메모
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

  const { transactions = [], schedules = [], clients = [], feeSettings, addTransaction, upsertDiary, getDiaryByDate, updateSchedule } = store;

  // 빠른 수입 입력 모달 열기
  const openQuickModal = () => {
    const todayStr = todayKST();
    const existing = getDiaryByDate(todayStr);
    // 팁은 schedule.overFee에서 불러오기
    const todayWork = schedules
      .filter(s => s.date === todayStr && s.type === 'work')
      .sort((a, b) => (a.shift ?? '1').localeCompare(b.shift ?? '1'));
    setQTip1(todayWork[0]?.overFee ? fmtInput(String(todayWork[0].overFee)) : '');
    setQTip2(todayWork[1]?.overFee ? fmtInput(String(todayWork[1].overFee)) : '');
    setQTip3(todayWork[2]?.overFee ? fmtInput(String(todayWork[2].overFee)) : '');
    setQExtraReason(existing?.extra_reason ?? '');
    setQExtraAmount(existing?.extra_amount ? fmtInput(String(existing.extra_amount)) : '');
    setQMemo(existing?.memo ?? '');
    setQuickOpen(true);
  };

  const handleQuickIncome = async () => {
    const todayStr = todayKST();
    const toNum = (s: string) => parseInt(s.replace(/[^0-9]/g, ''), 10) || 0;
    const todayWork = schedules
      .filter(s => s.date === todayStr && s.type === 'work')
      .sort((a, b) => (a.shift ?? '1').localeCompare(b.shift ?? '1'));
    const getCF = (s: any) => {
      if (s.caddyFee) return s.caddyFee;
      if (!feeSettings) return 150000;
      if (s.shift === '1') return feeSettings.shift1;
      if (s.shift === '2') return feeSettings.shift2;
      if (s.shift === '3') return feeSettings.shift3;
      return 150000;
    };
    setQSaving(true);
    // 팁 → schedule.overFee 업데이트 (수입 집계에 즉시 반영)
    const tipValues = [toNum(qTip1), toNum(qTip2), toNum(qTip3)];
    for (let i = 0; i < todayWork.length; i++) {
      const newTip = tipValues[i];
      if (newTip !== (todayWork[i].overFee ?? 0)) {
        updateSchedule(todayWork[i].id, { overFee: newTip || undefined });
      }
    }
    // diary: 캐디피 스냅샷 + 기타수입 + 메모 (팁은 schedule에 저장)
    const diary: Omit<Diary, 'id' | 'license_code' | 'updated_at'> = {
      date: todayStr,
      caddy_fee_1: todayWork[0] ? getCF(todayWork[0]) : 0,
      caddy_fee_2: todayWork[1] ? getCF(todayWork[1]) : 0,
      caddy_fee_3: todayWork[2] ? getCF(todayWork[2]) : 0,
      tip_1: 0, tip_2: 0, tip_3: 0,
      extra_reason: qExtraReason.trim(),
      extra_amount: toNum(qExtraAmount),
      memo: qMemo.trim(),
    };
    await upsertDiary(diary);
    setQSaving(false);
    setQuickOpen(false);
  };

  const fmtInput = (v: string) => {
    const n = v.replace(/[^0-9]/g, '');
    return n ? parseInt(n, 10).toLocaleString() : '';
  };
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = todayKST();

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
    realized: { h18: 0, h36: 0, h54: 0, h9: 0, other: 0, total: 0 },
    expected: { h18: 0, h36: 0, h54: 0, h9: 0, other: 0, total: 0 }
  };

  // 날짜별 그룹핑: 같은 날 2 shift = 36홀(투), 3 shift = 54홀(쓰리)
  const workByDate = new Map<string, { realized: boolean; shifts: typeof workSchedules }>();
  workSchedules.forEach(s => {
    const existing = workByDate.get(s.date);
    if (existing) {
      existing.shifts.push(s);
    } else {
      workByDate.set(s.date, { realized: s.date <= today, shifts: [s] });
    }
  });
  workByDate.forEach(({ realized, shifts }) => {
    const target = realized ? roundStats.realized : roundStats.expected;
    const shiftCount = shifts.length;
    if (shiftCount >= 3) target.h54++;
    else if (shiftCount === 2) target.h36++;
    else {
      const holes = parseInt(String(shifts[0].holes || '18').replace(/[^0-9]/g, '')) || 18;
      if (holes === 18) target.h18++;
      else if (holes === 36) target.h36++;
      else if (holes === 54) target.h54++;
      else if (holes === 9) target.h9++;
      else target.other++;
    }
    target.total++;
  });

  const todaySchedule = schedules.filter(s => s.date === today);

  return (
    <>
    <div className="px-4 py-5 space-y-5 pb-32" style={{ backgroundColor: 'white', minHeight: '100vh' }}>
      {/* Header */}
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 whitespace-nowrap">캐디 매니저 프로</h1>
          <p className="text-stone-500 text-sm">
            {userName ? <><span className="font-semibold text-emerald-600">{userName}</span>님 환영합니다! ⛳️</> : '오늘도 굿샷 하세요! ⛳️'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!confirm('로그아웃 하시겠습니까?')) return;
              // Zustand store 메모리 초기화 (다음 사용자 데이터 노출 방지)
              useAppStore.setState({
                schedules: [], clients: [], transactions: [],
                feeSettings: { shift1: 150000, shift2: 150000, shift3: 160000, useShift3: true },
                _initialized: false,
              });
              // localStorage 정리
              const activeKey = localStorage.getItem('caddy_active_key');
              localStorage.removeItem('caddy-manager-storage');
              localStorage.removeItem('caddy_license_key');
              localStorage.removeItem('caddy_expires_at');
              localStorage.removeItem('caddy_tier');
              localStorage.removeItem('caddy_plan');
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
      <section className="bg-emerald-600 rounded-2xl p-4 text-white shadow-lg shadow-emerald-200 transition-all relative overflow-hidden">
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

        <div className="text-3xl font-bold mb-4 relative z-10 break-all">
          {formatCurrency(netIncomeRealized).replace('₩', '')}<span className="text-lg font-normal ml-1">원</span>
        </div>

        <div className="flex gap-2 text-xs font-medium relative z-10">
          <div className="flex items-center flex-1 min-w-0 bg-red-500/80 px-2 py-1.5 rounded-full backdrop-blur-md text-white shadow-sm overflow-hidden">
            <TrendingUp size={13} className="mr-1 flex-shrink-0 text-red-100" />
            <span className="truncate">수입 {formatCurrency(totalIncomeRealized).replace('₩', '')}</span>
          </div>
          <div className="flex items-center flex-1 min-w-0 bg-blue-500/80 px-2 py-1.5 rounded-full backdrop-blur-md text-white shadow-sm overflow-hidden">
            <TrendingDown size={13} className="mr-1 flex-shrink-0 text-blue-100" />
            <span className="truncate">지출 {formatCurrency(totalExpense).replace('₩', '')}</span>
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
            {(roundStats.realized.h36 > 0 || roundStats.expected.h36 > 0) && (
              <div className="text-center">
                <span className="text-[10px] text-emerald-200 block">36홀</span>
                <span className="font-bold text-lg">
                  {roundStats.realized.h36}
                  {roundStats.expected.h36 > 0 && <span className="text-[10px] ml-0.5 text-emerald-300">+{roundStats.expected.h36}</span>}
                </span>
              </div>
            )}
            {(roundStats.realized.h54 > 0 || roundStats.expected.h54 > 0) && (
              <div className="text-center">
                <span className="text-[10px] text-emerald-200 block">54홀</span>
                <span className="font-bold text-lg">
                  {roundStats.realized.h54}
                  {roundStats.expected.h54 > 0 && <span className="text-[10px] ml-0.5 text-emerald-300">+{roundStats.expected.h54}</span>}
                </span>
              </div>
            )}
            {(roundStats.realized.h9 > 0 || roundStats.expected.h9 > 0) && (
              <div className="text-center">
                <span className="text-[10px] text-emerald-200 block">9홀</span>
                <span className="font-bold text-lg">
                  {roundStats.realized.h9}
                  {roundStats.expected.h9 > 0 && <span className="text-[10px] ml-0.5 text-emerald-300">+{roundStats.expected.h9}</span>}
                </span>
              </div>
            )}
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
          <div className="flex gap-1.5 flex-shrink-0">
            <div className="text-[9px] bg-white/10 px-1.5 py-1 rounded text-white font-bold whitespace-nowrap">
              휴무:{uniqueHolidayDays}일
            </div>
            <div className="text-[9px] bg-white/10 px-1.5 py-1 rounded text-white font-bold whitespace-nowrap">
              {roundStats.realized.total}/{roundStats.realized.total + roundStats.expected.total}회
            </div>
          </div>
        </div>
      </section>

      {/* 오늘 수입 빠른 입력 버튼 */}
      <section>
        <button
          onClick={openQuickModal}
          className="w-full flex items-center justify-center gap-2 bg-emerald-500 border-2 border-emerald-600 rounded-2xl py-4 text-white font-extrabold text-base shadow-md hover:bg-emerald-600 active:scale-[.98] transition"
        >
          <Plus size={18} />
          오늘 수입 입력
        </button>
        {/* 오늘 입력된 수입 리스트 */}
        {(() => {
          const todayStr = todayKST();
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
          onDateClick={setSelectedModalDate}
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

      <section>
        <Link
          href="/settings/#calendar-sync"
          className="w-full h-12 rounded-2xl bg-stone-900 text-white text-sm font-bold flex items-center justify-center"
        >
          캘린더 동기화는 설정에서 관리
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
        // 날짜별 그룹핑: 같은 날 2 shift = 36홀(투), 3 shift = 54홀(쓰리)
        const yearlyByDate = new Map<string, typeof yearlyWork>();
        yearlyWork.forEach(s => {
          const arr = yearlyByDate.get(s.date) ?? [];
          arr.push(s);
          yearlyByDate.set(s.date, arr);
        });
        const totalRounds = yearlyByDate.size;
        let h18 = 0, h36 = 0, h54 = 0, h9 = 0, hOther = 0;
        yearlyByDate.forEach(shifts => {
          const shiftCount = shifts.length;
          if (shiftCount >= 3) h54++;
          else if (shiftCount === 2) h36++;
          else {
            const h = shifts[0].holes ?? 18;
            if (h === 18) h18++;
            else if (h === 36) h36++;
            else if (h === 54) h54++;
            else if (h === 9) h9++;
            else hOther++;
          }
        });
        const holeItems = [
          { label: '18홀', count: h18 },
          ...(h36 > 0 ? [{ label: '36홀', count: h36 }] : []),
          ...(h54 > 0 ? [{ label: '54홀', count: h54 }] : []),
          ...(h9 > 0 ? [{ label: '9홀', count: h9 }] : []),
          ...(hOther > 0 ? [{ label: '기타', count: hOther }] : []),
        ];
        return (
          <section className="bg-stone-800 rounded-2xl p-5 text-white">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-stone-300">{year}년 연간 현황</span>
              <Link href="/money" className="text-[11px] text-stone-400 hover:text-emerald-400">전체보기 →</Link>
            </div>
            <div className="text-2xl font-black mb-1 break-all">{yearlyNet.toLocaleString()}<span className="text-xs font-normal text-stone-400 ml-1">원 (순수익)</span></div>
            <div className="text-xs text-stone-400 mb-4">수입 {(yearlyScheduleIncome + yearlyManualIncome).toLocaleString()} — 지출 {yearlyExpense.toLocaleString()}</div>
            <div className="divide-x divide-stone-700 bg-stone-700/50 rounded-xl py-3 flex">
              <div className="text-center flex-1">
                <div className="text-[10px] text-stone-400 mb-1">총 라운드</div>
                <div className="text-xl font-black text-emerald-400">{totalRounds}<span className="text-xs font-normal ml-0.5">회</span></div>
              </div>
              {holeItems.map(item => (
                <div key={item.label} className="text-center flex-1">
                  <div className="text-[10px] text-stone-400 mb-1">{item.label}</div>
                  <div className="text-xl font-black">{item.count}<span className="text-xs font-normal ml-0.5">회</span></div>
                </div>
              ))}
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

    {/* 날짜 일정 요약 모달 */}
    {selectedModalDate && (() => {
      const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
      const [year, month, day] = selectedModalDate.split('-');
      const monthNum = parseInt(month);
      const dayNum = parseInt(day);
      const dateObj = new Date(parseInt(year), monthNum - 1, dayNum);
      const weekday = weekdays[dateObj.getDay()];
      const dateDisplay = `${monthNum}-${String(dayNum).padStart(2, '0')} (${weekday})`;

      const dateSchedules = schedules.filter(s => s.date === selectedModalDate);
      const holidays = dateSchedules.filter(s => s.type === 'holiday');
      const works = dateSchedules.filter(s => s.type === 'work').sort((a, b) => (a.shift ?? '1').localeCompare(b.shift ?? '1'));
      const personals = dateSchedules.filter(s => s.type === 'personal');

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setSelectedModalDate(null)}>
          <div
            className="w-full max-w-[480px] bg-white rounded-3xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="bg-emerald-50 px-6 py-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-stone-900">{dateDisplay}</h3>
              <button onClick={() => setSelectedModalDate(null)} className="p-1 text-stone-400 hover:text-stone-600">
                <X size={24} />
              </button>
            </div>

            {/* 일정 목록 */}
            <div className="px-6 py-4 space-y-4 max-h-[60dvh] overflow-y-auto">
              {holidays.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-stone-500 mb-2">휴무</p>
                  <div className="space-y-2">
                    {holidays.map(s => (
                      <div key={s.id} className="bg-red-50 p-3 rounded-xl border border-red-200">
                        <p className="font-semibold text-red-600">{s.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {works.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-stone-500 mb-2">근무</p>
                  <div className="space-y-2">
                    {works.map(s => (
                      <div key={s.id} className={`p-3 rounded-xl border ${
                        s.shift === '1' ? 'bg-red-50 border-red-200' :
                        s.shift === '2' ? 'bg-blue-50 border-blue-200' :
                        'bg-emerald-50 border-emerald-200'
                      }`}>
                        <div className={`font-semibold ${
                          s.shift === '1' ? 'text-red-600' :
                          s.shift === '2' ? 'text-blue-600' :
                          'text-emerald-600'
                        }`}>
                          {s.shift}부 · {s.time}
                        </div>
                        {s.title && <p className="text-xs text-stone-600 mt-1">{s.title}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {personals.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-stone-500 mb-2">개인일정</p>
                  <div className="space-y-2">
                    {personals.map(s => (
                      <div key={s.id} className="bg-orange-50 p-3 rounded-xl border border-orange-200">
                        <div className="font-semibold text-orange-600">{s.time}</div>
                        {s.title && <p className="text-xs text-stone-600 mt-1">{s.title}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dateSchedules.length === 0 && (
                <div className="text-center py-6 text-stone-400">
                  <p>약속이 없습니다</p>
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="border-t border-stone-100 px-6 py-4 flex gap-3">
              <Link
                href={`/schedule?date=${selectedModalDate}`}
                className="flex-[2.33] bg-emerald-600 text-white font-bold py-3 rounded-2xl text-base hover:bg-emerald-700 active:scale-[.98] transition text-center"
              >
                일정 추가
              </Link>
              <button
                onClick={() => setSelectedModalDate(null)}
                className="flex-1 bg-stone-100 text-stone-700 font-bold py-3 rounded-2xl text-base hover:bg-stone-200 active:scale-[.98] transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      );
    })()}

    {/* 빠른 수입 입력 모달 */}
    {quickOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setQuickOpen(false)}>
        <div
          className="w-full max-w-[480px] bg-white rounded-3xl p-6 shadow-2xl space-y-4 overflow-y-auto max-h-[88dvh]"
          onClick={e => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <BookOpen size={20} className="text-emerald-600" />
              오늘 수입 일지
            </h3>
            <button onClick={() => setQuickOpen(false)} className="p-1 text-stone-400 hover:text-stone-600">
              <X size={22} />
            </button>
          </div>

          {/* 오늘 스케줄 기반 캐디피 자동 표시 */}
          {(() => {
            const todayStr = todayKST();
            const todayWork = schedules
              .filter(s => s.date === todayStr && s.type === 'work')
              .sort((a, b) => (a.shift ?? '1').localeCompare(b.shift ?? '1'));
            const hasWork = todayWork.length > 0;
            const getCF = (s: any) => {
              if (s.caddyFee) return s.caddyFee;
              if (!feeSettings) return 150000;
              if (s.shift === '1') return feeSettings.shift1;
              if (s.shift === '2') return feeSettings.shift2;
              if (s.shift === '3') return feeSettings.shift3;
              return 150000;
            };
            return (
              <>
                {!hasWork && (
                  <p className="text-xs text-stone-400 bg-stone-50 rounded-xl px-4 py-2">오늘 등록된 근무 일정이 없습니다.</p>
                )}
                {hasWork && (
                  <div className="bg-emerald-50 rounded-2xl p-4 space-y-2">
                    <p className="text-xs font-bold text-emerald-700 mb-2">캐디피 (원) — 일정 자동</p>
                    <div className="grid grid-cols-3 gap-2">
                      {([1,2,3] as const).map(n => {
                        const s = todayWork[n-1];
                        return (
                          <div key={n} className="text-center">
                            <p className="text-[10px] text-stone-400 mb-1">{n}부</p>
                            <p className={`font-bold text-sm ${s ? 'text-emerald-700' : 'text-stone-300'}`}>
                              {s ? `₩${getCF(s).toLocaleString()}` : '—'}
                            </p>
                            {s?.title && <p className="text-[9px] text-stone-400 truncate">{s.title}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 팁·오버피 — 근무 있을 때만 표시 */}
                {hasWork && (
                  <div>
                    <p className="text-xs font-bold text-stone-500 mb-2">팁·오버피 (원)</p>
                    <div className="grid grid-cols-3 gap-2">
                      {([['1부', qTip1, setQTip1], ['2부', qTip2, setQTip2], ['3부', qTip3, setQTip3]] as [string, string, (v:string)=>void][]).map(([label, val, setter]) => (
                        <div key={label}>
                          <p className="text-[10px] text-stone-400 mb-1 text-center">{label}</p>
                          <input type="text" inputMode="numeric" placeholder="0"
                            value={val} onChange={e => setter(fmtInput(e.target.value))}
                            className="w-full border border-stone-200 rounded-xl px-2 py-2 text-stone-900 font-bold text-right text-sm focus:outline-none focus:border-emerald-400" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* 기타수입 */}
          <div>
            <p className="text-xs font-bold text-stone-500 mb-2">기타수입 (원)</p>
            <div className="flex gap-2">
              <input type="text" placeholder="수입 사유 (선택)"
                value={qExtraReason} onChange={e => setQExtraReason(e.target.value)}
                className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-stone-700 text-sm focus:outline-none focus:border-emerald-400" />
              <input type="text" inputMode="numeric" placeholder="0"
                value={qExtraAmount} onChange={e => setQExtraAmount(fmtInput(e.target.value))}
                className="w-28 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-bold text-right text-sm focus:outline-none focus:border-emerald-400" />
            </div>
          </div>

          {/* 메모 */}
          <div>
            <p className="text-xs font-bold text-stone-500 mb-2">오늘의 메모</p>
            <textarea placeholder="오늘의 메모  잘한걸까 ? 못한걸까 ?"
              value={qMemo} onChange={e => setQMemo(e.target.value)} rows={3}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-stone-700 text-sm focus:outline-none focus:border-emerald-400 resize-none" />
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={handleQuickIncome}
            disabled={qSaving}
            className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl text-base disabled:opacity-40 active:scale-[.98] transition"
          >
            {qSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    )}

    </>
  );
}
