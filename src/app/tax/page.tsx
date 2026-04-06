'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { calculateCaddyTax, TaxResult } from '@/lib/taxUtils';
import { formatCurrency, todayKST } from '@/lib/utils';
import { Wallet, Share2, Info, RefreshCcw, Calculator } from 'lucide-react';
import Link from 'next/link';

export default function TaxPage() {
    const { schedules, transactions, feeSettings } = useAppStore();
    const [revenue, setRevenue] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [personalDeduction, setPersonalDeduction] = useState<number>(1500000); // 기본 150만원
    const [hasHydrated, setHasHydrated] = useState(false);

    useEffect(() => {
        setHasHydrated(true);
    }, []);

    const yearStr = String(selectedYear);
    const today = todayKST();

    const getCaddyFee = (s: any) => {
        if (s.caddyFee) return s.caddyFee;
        if (!feeSettings) return 150000;
        if (s.shift === '1') return feeSettings.shift1;
        if (s.shift === '2') return feeSettings.shift2;
        if (s.shift === '3') return feeSettings.shift3;
        return 150000;
    };

    // 1. 일정 기반 캐디피+오버피
    const yearlyScheduleIncome = useMemo(() => {
        return schedules
            .filter(s => s.type === 'work' && s.date.startsWith(yearStr) && s.date <= today)
            .reduce((acc, s) => acc + getCaddyFee(s) + (s.overFee || 0), 0);
    }, [schedules, selectedYear]);

    // 2. transactions 기반 수입 (팁 등 수동 입력)
    const yearlyTxIncome = useMemo(() => {
        return transactions
            .filter(t => t.type === 'income' && t.date.startsWith(yearStr))
            .reduce((acc, t) => acc + t.amount, 0);
    }, [transactions, selectedYear]);

    // 3. 경비 인정 지출 (세금 감면 가능)
    const DEDUCTIBLE_CATS = ['transport', 'meal', 'gear', 'etc_expense', 'swap_thanks'];
    const yearlyDeductibleExpense = useMemo(() => {
        return transactions
            .filter(t => t.type === 'expense' && t.date.startsWith(yearStr) && DEDUCTIBLE_CATS.includes(t.category || ''))
            .reduce((acc, t) => acc + t.amount, 0);
    }, [transactions, selectedYear]);

    // 3-2. 개인지출 (세금 감면 안 됨)
    const yearlyPersonalExpense = useMemo(() => {
        return transactions
            .filter(t => t.type === 'expense' && t.date.startsWith(yearStr) && t.category === 'personal')
            .reduce((acc, t) => acc + t.amount, 0);
    }, [transactions, selectedYear]);

    // 하위 호환: 전체 지출 (기존 코드 참조용)
    const yearlyExpense = yearlyDeductibleExpense;

    // 합산 수입 (schedule + tx 중 큰 값)
    const yearlyRevenue = Math.max(yearlyScheduleIncome, yearlyTxIncome);

    // 4. 세금 계산 결과
    const taxResult = useMemo(() => {
        const revNum = Number(revenue.replace(/[^0-9]/g, '')) || 0;
        return calculateCaddyTax(revNum, personalDeduction);
    }, [revenue, personalDeduction]);

    const handleLoadRevenue = () => {
        setRevenue(String(yearlyRevenue));
    };

    const formatNumberInput = (val: string) => {
        const num = val.replace(/[^0-9]/g, '');
        return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    if (!hasHydrated) return <div className="p-6 bg-stone-50 min-h-screen animate-pulse" />;

    return (
        <div className="p-6 pb-24 space-y-8 bg-stone-50 min-h-screen">
            {/* 가계부 / 세금 탭 */}
            <div className="flex gap-1 p-1 bg-stone-100 rounded-2xl">
                <Link href="/money" className="flex-1 flex items-center justify-center gap-1.5 py-2 text-stone-400 rounded-xl font-bold text-sm hover:text-stone-600">
                    <Wallet size={16} /> 가계부
                </Link>
                <span className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white text-emerald-700 rounded-xl font-black text-sm shadow-sm">
                    <Calculator size={16} /> 세금
                </span>
            </div>
            <header className="flex items-center justify-between">
                <h1 className="text-2xl font-black text-stone-900 flex items-center gap-2">
                    <Wallet size={24} className="text-emerald-500" /> 예상 세금 계산기
                </h1>
                <button className="p-2 text-stone-400">
                    <Share2 size={20} />
                </button>
            </header>

            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-sm text-emerald-800 flex gap-3">
                <Info className="flex-shrink-0" size={20} />
                <p className="leading-relaxed">
                    종합소득이 있는 캐디는 다음해 5월 1일부터 5월 31일까지 종합소득세를 신고/납부해야 합니다.
                </p>
            </div>

            {/* Input Section */}
            <section className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-6">
                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <label className="text-lg font-black text-stone-800">총 소득금액</label>
                        <div className="text-[10px] text-stone-400 mb-1 leading-tight text-right italic">
                            * 홈택스에 신고된 연간 수입 금액이나<br />기록한 캐디피를 입력하세요.
                        </div>
                    </div>

                    <div className="relative">
                        <input
                            type="text"
                            value={formatNumberInput(revenue)}
                            onChange={(e) => setRevenue(e.target.value)}
                            placeholder="0"
                            className="w-full p-5 bg-stone-50 border-2 border-stone-100 rounded-2xl text-2xl font-black text-right pr-12 focus:outline-none focus:border-emerald-500 transition"
                        />
                        <span className="absolute right-5 top-1/2 -translate-y-1/2 font-bold text-stone-400 text-lg">원</span>
                    </div>

                    <div className="flex bg-stone-100 p-1 rounded-xl">
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="bg-transparent px-4 py-2 font-bold text-stone-600 focus:outline-none"
                        >
                            {[2024, 2025, 2026].map(year => (
                                <option key={year} value={year}>{year}년</option>
                            ))}
                        </select>
                        <button
                            onClick={handleLoadRevenue}
                            className="flex-1 bg-white ml-1 py-2 px-4 rounded-lg text-sm font-black text-emerald-600 shadow-sm flex items-center justify-center gap-2 active:scale-95 transition"
                        >
                            <RefreshCcw size={14} /> 연간 캐디피 불러오기
                        </button>
                    </div>

                    {/* 수입/경비 요약 카드 */}
                    <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4 space-y-2">
                        <p className="text-xs font-bold text-emerald-700 mb-2">{selectedYear}년 앱 기록 요약</p>
                        <div className="flex justify-between text-xs">
                            <span className="text-stone-500">일정 기반 캐디피+오버피</span>
                            <span className="font-bold text-stone-800">{yearlyScheduleIncome.toLocaleString()}원</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-stone-500">수동 입력 수입 (팁 등)</span>
                            <span className="font-bold text-stone-800">{yearlyTxIncome.toLocaleString()}원</span>
                        </div>
                        <div className="flex justify-between text-xs border-t border-emerald-200 pt-2">
                            <span className="text-stone-500">✅ 경비 인정 지출</span>
                            <span className="font-bold text-red-600">-{yearlyDeductibleExpense.toLocaleString()}원</span>
                        </div>
                        {yearlyPersonalExpense > 0 && (
                            <div className="flex justify-between text-xs">
                                <span className="text-amber-500">⚠️ 개인지출 (경비 불인정)</span>
                                <span className="font-bold text-amber-500">{yearlyPersonalExpense.toLocaleString()}원</span>
                            </div>
                        )}
                        <button
                            onClick={handleLoadRevenue}
                            className="w-full mt-1 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1"
                        >
                            <RefreshCcw size={12} /> {yearlyRevenue.toLocaleString()}원으로 로드
                        </button>
                    </div>
                </div>

                <div className="pt-2 space-y-3">
                    <div className="flex items-center gap-1">
                        <label className="text-lg font-black text-stone-800">경비 선택</label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button className="bg-emerald-500 text-white p-4 rounded-2xl font-black shadow-lg shadow-emerald-100">단순경비율</button>
                        <button className="bg-stone-100 text-stone-400 p-4 rounded-2xl font-black cursor-not-allowed">기준경비율</button>
                    </div>

                    {/* Tax Logic Explanations */}
                    <div className="mt-4 grid grid-cols-1 gap-3">
                        <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                            <h4 className="text-xs font-bold text-orange-700 mb-1 flex items-center gap-1">
                                <Info size={14} /> 단순경비율 (68.2%)
                            </h4>
                            <p className="text-[10px] text-orange-600 leading-relaxed">
                                <strong>&quot;나라에서 주는 보너스 점수&quot;</strong><br />
                                장부 쓰기 힘든 분들을 위해 수입의 68%를 비용으로 퉁쳐주는 제도입니다. 3,600만원 미만 수익일 때 가장 유리합니다.
                            </p>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                            <h4 className="text-xs font-bold text-blue-700 mb-1 flex items-center gap-1">
                                <Info size={14} /> 기준경비율
                            </h4>
                            <p className="text-[10px] text-blue-600 leading-relaxed">
                                <strong>&quot;나라의 깐깐한 검사&quot;</strong><br />
                                수입이 많아지면(3,600만원 이상) 적용되며, 장부를 직접 써서 증명하지 않으면 경비를 아주 조금(10~20%)만 인정해줍니다.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Results Section */}
            {Number(revenue.replace(/[^0-9]/g, '')) > 0 && (
                <section className="animate-in fade-in slide-in-from-bottom-5 duration-500 space-y-4">
                    <h2 className="text-lg font-black text-stone-800 px-1">예상 세액 계산 결과</h2>

                    <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden divide-y divide-stone-100">
                        {/* 1단계: 소득금액 */}
                        <div className="p-5 space-y-3">
                            <ResultRow label="종합소득" value={taxResult.revenue} />
                            <ResultRow label="필요경비" value={taxResult.expenses} isNegative />
                            <div className="pt-2 border-t border-stone-100 flex justify-between items-center">
                                <span className="text-sm font-bold text-stone-400">종합소득금액</span>
                                <span className="text-lg font-black text-emerald-600">{formatCurrency(taxResult.incomeAmount)}</span>
                            </div>
                        </div>

                        {/* 2단계: 과세표준 */}
                        <div className="p-5 space-y-3 bg-stone-50/30">
                            <ResultRow label="소득공제" value={taxResult.deduction} isNegative />
                            <div className="pt-2 border-t border-stone-100 flex justify-between items-center">
                                <span className="text-sm font-bold text-stone-400">과세표준</span>
                                <span className="text-lg font-black text-stone-800 font-mono">{formatCurrency(taxResult.taxBase)}</span>
                            </div>
                        </div>

                        {/* 3단계: 세액계산 */}
                        <div className="p-5 space-y-3">
                            <ResultRow label="종합소득세" value={taxResult.calculatedTax} />
                            <ResultRow label="세액공제" value={taxResult.taxCredit} isNegative />
                        </div>

                        {/* 4단계: 최종납부액 */}
                        <div className="p-6 bg-stone-900 text-white rounded-t-[2.5rem]">
                            <div className="space-y-2 mb-6">
                                <div className="flex justify-between text-stone-400 text-sm font-bold">
                                    <span>결정세액</span>
                                    <span>{formatCurrency(taxResult.finalTax)}</span>
                                </div>
                                <div className="flex justify-between text-stone-400 text-sm font-bold">
                                    <span>지방소득세 (10%)</span>
                                    <span>{formatCurrency(taxResult.localTax)}</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-end border-t border-white/10 pt-6">
                                <span className="text-lg font-black text-stone-400">총 납부세액</span>
                                <span className="text-3xl font-black text-orange-400">{formatCurrency(taxResult.totalTax).replace('₩', '')}<span className="text-xl ml-1">원</span></span>
                            </div>
                        </div>
                    </div>
                    <p className="text-[10px] text-stone-400 p-2 leading-relaxed">
                        * 위 금액은 단순경비율 적용 대상임을 가정한 예상 수치이며, 부양가족 공제 등 실제 세무 조건에 따라 차이가 발생할 수 있습니다. 정확한 금액은 반드시 세무 전문가와 상담하세요.
                    </p>
                </section>
            )}

            {/* Yearly Statistics Table Section */}
            <YearlyStatsSection schedules={schedules} year={selectedYear} />
        </div>
    );
}

function ResultRow({ label, value, isNegative }: { label: string, value: number, isNegative?: boolean }) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-stone-500">{label}</span>
            <span className={`text-base font-black font-mono ${isNegative ? 'text-red-500' : 'text-stone-800'}`}>
                {isNegative && '- '}{formatCurrency(value).replace('₩', '')} 원
            </span>
        </div>
    );
}

function YearlyStatsSection({ schedules = [], year }: { schedules: any[], year: number }) {
    const monthlyStats = useMemo(() => {
        const stats = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            roundCount: 0,
            caddyFee: 0,
            overFee: 0,
            total: 0
        }));

        schedules.forEach(s => {
            if (s && s.type === 'work' && s.date && s.date.startsWith(String(year))) {
                const month = parseInt(s.date.split('-')[1]);
                if (month >= 1 && month <= 12) {
                    const idx = month - 1;
                    stats[idx].roundCount += 1;
                    stats[idx].caddyFee += (s.caddyFee || 0);
                    stats[idx].overFee += (s.overFee || 0);
                    stats[idx].total += (s.caddyFee || 0) + (s.overFee || 0);
                }
            }
        });

        return stats;
    }, [schedules, year]);

    const totals = useMemo(() => {
        return monthlyStats.reduce((acc, curr) => ({
            roundCount: acc.roundCount + curr.roundCount,
            caddyFee: acc.caddyFee + curr.caddyFee,
            overFee: acc.overFee + curr.overFee,
            total: acc.total + curr.total
        }), { roundCount: 0, caddyFee: 0, overFee: 0, total: 0 });
    }, [monthlyStats]);

    return (
        <section className="space-y-4">
            <h2 className="text-lg font-black text-stone-800 px-1">{year}년 근무 기록도</h2>
            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
                <table className="w-full text-center border-collapse">
                    <thead className="bg-stone-100 text-stone-500 text-[11px] font-bold">
                        <tr>
                            <th className="py-3 border-b border-stone-200">월</th>
                            <th className="py-3 border-b border-stone-200">라운딩수</th>
                            <th className="py-3 border-b border-stone-200 text-emerald-600">캐디피</th>
                            <th className="py-3 border-b border-stone-200">오버피</th>
                            <th className="py-3 border-b border-stone-200">합계</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs font-bold text-stone-600 divide-y divide-stone-50">
                        {monthlyStats.map((stat) => (
                            <tr key={stat.month} className={stat.roundCount > 0 ? "bg-white" : "bg-stone-50/30 text-stone-300"}>
                                <td className="py-3">{stat.month}월</td>
                                <td className="py-3">{stat.roundCount}</td>
                                <td className="py-3 text-emerald-600">{stat.caddyFee.toLocaleString()}</td>
                                <td className="py-3">{stat.overFee.toLocaleString()}</td>
                                <td className="py-3">{stat.total.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-emerald-500 text-white text-xs font-black">
                        <tr>
                            <td className="py-4">합계</td>
                            <td className="py-4">{totals.roundCount}</td>
                            <td className="py-4">{totals.caddyFee.toLocaleString()}</td>
                            <td className="py-4">{totals.overFee.toLocaleString()}</td>
                            <td className="py-4 font-mono">{totals.total.toLocaleString()}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <p className="text-[10px] text-stone-400 px-2 italic">
                * 세금 신고 대상은 캐디피 합계입니다. (오버피는 제외)
            </p>
        </section>
    );
}
