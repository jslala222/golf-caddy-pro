'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useAppStore, type TransactionType, type ExpenseCategory } from '@/lib/store';
import { formatDate, formatCurrency, todayKST } from '@/lib/utils';
import { Wallet, Plus, X, ArrowUp, ArrowDown, Trash2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Camera, Loader2, Calculator } from 'lucide-react';
import Link from 'next/link';


export default function MoneyPage() {
    const { transactions, addTransaction, deleteTransaction, schedules, feeSettings } = useAppStore();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Filter Type State
    type FilterType = 'week' | 'month' | 'year';
    const [filterType, setFilterType] = useState<FilterType>('month');
    const [currentDate, setCurrentDate] = useState(new Date());

    // Navigation Logic
    const navigate = (direction: 'prev' | 'next') => {
        const val = direction === 'prev' ? -1 : 1;
        const newDate = new Date(currentDate);

        if (filterType === 'week') {
            newDate.setDate(newDate.getDate() + (val * 7));
        } else if (filterType === 'month') {
            newDate.setMonth(newDate.getMonth() + val);
        } else {
            newDate.setFullYear(newDate.getFullYear() + val);
        }
        setCurrentDate(newDate);
    };

    // Calculate Date Range Strings (YYYY-MM-DD) for filtering
    const dateRange = useMemo(() => {
        const d = new Date(currentDate);
        let startStr = '';
        let endStr = '';
        let label = '';

        if (filterType === 'week') {
            const day = d.getDay(); // 0(Sun) ~ 6(Sat)
            const diff = d.getDate() - day; // Adjust to Sunday
            const start = new Date(d);
            start.setDate(diff);
            start.setHours(0, 0, 0, 0);

            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);

            // Format YYYY-MM-DD
            startStr = start.toISOString().split('T')[0];
            endStr = end.toISOString().split('T')[0];

            // Calculate week number of month
            const firstDayOfMonth = new Date(start.getFullYear(), start.getMonth(), 1);
            const weekNum = Math.ceil((((start.getTime() - firstDayOfMonth.getTime()) / 86400000) + firstDayOfMonth.getDay() + 1) / 7);
            label = `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${weekNum}주차`;

        } else if (filterType === 'month') {
            const y = d.getFullYear();
            const m = d.getMonth();
            const start = new Date(y, m, 1);
            const end = new Date(y, m + 1, 0); // Last day

            // Adjust for timezone offset to prevent off-by-one errors when converting TO ISO
            const offset = start.getTimezoneOffset() * 60000;
            const startLocal = new Date(start.getTime() - offset);
            const endLocal = new Date(end.getTime() - offset);

            startStr = startLocal.toISOString().split('T')[0];
            endStr = endLocal.toISOString().split('T')[0];
            label = `${y}년 ${m + 1}월`;

        } else {
            // Year
            const y = d.getFullYear();
            startStr = `${y}-01-01`;
            endStr = `${y}-12-31`;
            label = `${y}년 전체`;
        }

        return { startStr, endStr, label };
    }, [currentDate, filterType]);

    // Filter Data by Range
    const filteredSchedules = useMemo(() => {
        return (schedules || []).filter(s => {
            if (!s || !s.date) return false;
            return s.date >= dateRange.startStr && s.date <= dateRange.endStr && s.type === 'work';
        });
    }, [schedules, dateRange]);

    const filteredTransactions = useMemo(() => {
        return (transactions || []).filter(t => {
            if (!t || !t.date) return false;
            return t.date >= dateRange.startStr && t.date <= dateRange.endStr;
        });
    }, [transactions, dateRange]);

    // Helper for fallback fee
    // Helper for fallback fee
    const getCaddyFee = (s: any) => {
        if (s.caddyFee) return s.caddyFee;
        if (!feeSettings) return 150000;
        if (s.shift === '1') return feeSettings.shift1;
        if (s.shift === '2') return feeSettings.shift2;
        if (s.shift === '3') return feeSettings.shift3;
        // Default based on current setting if available? No, safe fallback.
        return 150000;
    };

    // Calculate Totals
    const today = todayKST();
    const realizedSchedules = filteredSchedules.filter(s => s.date <= today); // Calculate realized income based on filter range

    const scheduleIncome = realizedSchedules.reduce((acc, s) => acc + getCaddyFee(s) + (s.overFee || 0), 0);
    const manualIncome = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const totalIncome = scheduleIncome + manualIncome;

    // Calculate Rounding Stats (날짜별 그룹: 2건=투라운드, 단독 36홀도 36홀 카운트)
    const roundStats = useMemo(() => {
        const stats = { h18: 0, h36: 0, h54: 0, h9: 0, other: 0 };
        // 날짜별 그룹핑
        const byDate: Record<string, typeof realizedSchedules> = {};
        realizedSchedules.forEach(s => {
            if (!byDate[s.date]) byDate[s.date] = [];
            byDate[s.date].push(s);
        });
        Object.values(byDate).forEach(group => {
            if (group.length >= 2) {
                // 투라운드: 36홀로 집계
                stats.h36++;
            } else {
                const holes = group[0].holes ?? 18;
                if (holes === 18) stats.h18++;
                else if (holes === 36) stats.h36++;
                else if (holes === 54) stats.h54++;
                else if (holes === 9) stats.h9++;
                else stats.other++;
            }
        });
        return stats;
    }, [realizedSchedules]);

    const totalExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const netIncome = totalIncome - totalExpense;

    // Combined List for Display (Sorted by Date DESC)
    const combinedHistory = useMemo(() => {
        interface HistoryItem {
            id: string;
            date: string;
            type: 'income' | 'expense';
            amount: number;
            memo?: string;
            isSchedule: boolean;
            category?: string;
            receiptUrl?: string;
            shift?: string;
            holes?: number;
            isFuture?: boolean;
        }
        const history: HistoryItem[] = [];

        filteredSchedules.forEach(s => {
            const isFuture = s.date > today;
            history.push({
                id: s.id,
                date: s.date,
                type: 'income',
                amount: getCaddyFee(s) + (s.overFee || 0),
                memo: `${s.title || '근무'}${isFuture ? ' (예정)' : ' (완료)'}`,
                isSchedule: true,
                category: 'work',
                shift: s.shift,
                holes: s.holes || 18,
                isFuture,
            });
        });

        filteredTransactions.forEach(t => {
            history.push({
                id: t.id,
                date: t.date,
                type: t.type,
                amount: t.amount,
                memo: t.memo,
                isSchedule: false,
                category: t.category,
                receiptUrl: t.receiptUrl,
            });
        });

        return history.sort((a, b) => b.date.localeCompare(a.date));
    }, [filteredSchedules, filteredTransactions, today, feeSettings]); // Added dependencies

    // 날짜별 그룹핑: 같은 날 근무(work) 2건 이상이면 묶음 카드로 표시
    const groupedDays = useMemo(() => {
        const byDate: Record<string, { scheduleItems: typeof combinedHistory; txItems: typeof combinedHistory }> = {};
        combinedHistory.forEach(item => {
            if (!byDate[item.date]) byDate[item.date] = { scheduleItems: [], txItems: [] };
            if (item.isSchedule) byDate[item.date].scheduleItems.push(item);
            else byDate[item.date].txItems.push(item);
        });
        return Object.keys(byDate)
            .sort((a, b) => b.localeCompare(a))
            .map(date => {
                const { scheduleItems, txItems } = byDate[date];
                const dayIncome = [...scheduleItems, ...txItems].filter(i => i.type === 'income').reduce((a, i) => a + i.amount, 0);
                const dayExpense = txItems.filter(i => i.type === 'expense').reduce((a, i) => a + i.amount, 0);
                return { date, scheduleItems, txItems, dayIncome, dayExpense };
            });
    }, [combinedHistory]);

    // ... (keep modal form state)
    // Form State
    const [date, setDate] = useState(todayKST());
    const [type, setType] = useState<TransactionType>('expense');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<ExpenseCategory>('meal');
    const [memo, setMemo] = useState('');

    // 삭제 확인 모달
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // 영수증 사진 업로드
    const receiptRef = useRef<HTMLInputElement>(null);
    const [receiptUploading, setReceiptUploading] = useState(false);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
    const [ocrError, setOcrError] = useState<string | null>(null);
    const [ocrResult, setOcrResult] = useState<{ amount: number | null; memo: string | null } | null>(null);

    // OCR 월별 제한 (plan별: 1개월=5회, 6개월=30회, 1년=무제한)
    const getOcrLimit = (): number => {
        const plan = typeof window !== 'undefined' ? localStorage.getItem('caddy_plan') : null;
        if (plan === 'year') return 999;
        if (plan === '6month') return 30;
        return 5; // 1개월 기본
    };

    const [ocrUsed, setOcrUsed] = useState(0);
    const ocrLimit = getOcrLimit();
    const ocrRemaining = Math.max(0, ocrLimit - ocrUsed);

    // 마운트 시 Supabase에서 이번 달 OCR 사용 횟수 조회
    useEffect(() => {
        const licenseCode = localStorage.getItem('caddy_license_key');
        if (!licenseCode) return;
        const ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        fetch(`/api/db/ocr-usage?ym=${ym}`, {
            headers: { 'x-license-code': licenseCode }
        })
            .then(r => r.json())
            .then(d => { if (typeof d.count === 'number') setOcrUsed(d.count); })
            .catch(() => {});
    }, []);

    const incrementOcrCount = async () => {
        const licenseCode = localStorage.getItem('caddy_license_key');
        if (!licenseCode) return;
        try {
            const res = await fetch('/api/db/ocr-usage', {
                method: 'POST',
                headers: { 'x-license-code': licenseCode }
            });
            const d = await res.json();
            if (typeof d.count === 'number') setOcrUsed(d.count);
        } catch {}
    };

    const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // OCR 월별 제한 체크
        if (ocrLimit < 999 && ocrUsed >= ocrLimit) {
            setOcrError(`이번 달 OCR 사용 횟수(${ocrLimit}회)를 모두 사용하셨습니다.\n장기 이용권으로 업그레이드 시 더 많이 사용 가능합니다.`);
            e.target.value = '';
            return;
        }

        const licenseCode = typeof window !== 'undefined' ? localStorage.getItem('caddy_license_key') : null;
        if (!licenseCode) return;

        // Canvas로 압축 (10MB → ~400KB)
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
        await new Promise(resolve => { img.onload = resolve; });
        URL.revokeObjectURL(objectUrl);

        const canvas = document.createElement('canvas');
        const MAX = 1200;
        const MIN_W = 400; // 세로로 긴 영수증도 가독성 보장
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width = Math.max(img.width * ratio, MIN_W);
        canvas.height = img.height * (canvas.width / img.width);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.75));
        const compressed = new File([blob], 'receipt.jpg', { type: 'image/jpeg' });

        // 파일은 State에 보관, 미리보기는 로컬 URL로 설정 (R2 업로드는 등록 버튼 클릭 시)
        setReceiptFile(compressed);
        setReceiptUrl(URL.createObjectURL(blob));

        setReceiptUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', compressed);
            const res = await fetch('/api/receipt/ocr', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) {
                await incrementOcrCount();
                setOcrResult({ amount: data.ocrAmount ?? null, memo: data.ocrMemo ?? null });
                if (data.ocrAmount) setAmount(String(data.ocrAmount));
                if (data.ocrMemo && !memo) setMemo(data.ocrMemo);
                const validCats = ['transport','meal','gear','etc_expense','personal'];
                if (data.ocrCategory && validCats.includes(data.ocrCategory)) setCategory(data.ocrCategory as ExpenseCategory);
            }
        } catch (err) {
            console.warn('OCR 실패', err);
        } finally {
            setReceiptUploading(false);
        }
        e.target.value = '';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseInt(amount.replace(/,/g, '') || '0');
        if (!numAmount || numAmount <= 0) {
            document.getElementById('amount-input')?.focus();
            return;
        }

        // 지출등록 시점에 R2 업로드
        let finalReceiptUrl: string | undefined = undefined;
        if (receiptFile) {
            const licenseCode = typeof window !== 'undefined' ? localStorage.getItem('caddy_license_key') : null;
            if (licenseCode) {
                try {
                    setReceiptUploading(true);
                    const fd = new FormData();
                    fd.append('file', receiptFile);
                    fd.append('licenseCode', licenseCode);
                    fd.append('skipOcr', 'true');
                    const res = await fetch('/api/receipt/upload', { method: 'POST', body: fd });
                    const data = await res.json();
                    if (data.success) finalReceiptUrl = data.url;
                } catch (err) {
                    console.warn('영수증 R2 업로드 실패', err);
                } finally {
                    setReceiptUploading(false);
                }
            }
        }

        addTransaction({
            date,
            type,
            amount: numAmount,
            category: type === 'expense' ? category : undefined,
            memo,
            receiptUrl: finalReceiptUrl,
        });

        setIsModalOpen(false);
        setAmount('');
        setMemo('');
        setReceiptUrl(null);
        setReceiptFile(null);
        setOcrResult(null);
    };

    // Modal defaulting logic adjusted for period
    const handleOpenModal = () => {
        const todayStr = todayKST();

        // If "Today" is within the currently viewed range, default to "Today".
        // Otherwise, default to range start date?
        if (todayStr >= dateRange.startStr && todayStr <= dateRange.endStr) {
            setDate(todayStr);
        } else {
            // Default to start of range (or end of range? Start is safer)
            setDate(dateRange.startStr);
        }

        setAmount('');
        setMemo('');
        setIsModalOpen(true);
    };


    return (
        <div className="p-6 pb-24 relative min-h-screen">
            {/* 가계부 / 세금 탭 */}
            <div className="flex gap-1 p-1 bg-stone-100 rounded-2xl mb-5">
                <span className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white text-emerald-700 rounded-xl font-black text-sm shadow-sm">
                    <Wallet size={16} /> 가계부
                </span>
                <Link href="/tax" className="flex-1 flex items-center justify-center gap-1.5 py-2 text-stone-400 rounded-xl font-bold text-sm hover:text-stone-600">
                    <Calculator size={16} /> 세금
                </Link>
            </div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-stone-900 flex items-center">
                    <Wallet className="mr-2 text-emerald-600" /> 가계부
                </h1>
                <button
                    onClick={handleOpenModal}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-2xl shadow-lg hover:bg-emerald-700 transition flex items-center gap-2 text-sm font-bold"
                >
                    <Plus size={18} /> 수입/지출 추가 입력
                </button>
            </div>

            {/* Filter Tabs & Navigation */}
            <div className="mb-6 space-y-3">
                {/* Tabs */}
                <div className="flex p-1 bg-stone-100 rounded-xl">
                    {(['week', 'month', 'year'] as const).map((ft) => (
                        <button
                            key={ft}
                            onClick={() => setFilterType(ft)}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${filterType === ft ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                        >
                            {ft === 'week' ? '주간' : ft === 'month' ? '월간' : '연간'}
                        </button>
                    ))}
                </div>

                {/* Date Navigator */}
                <div className="flex items-center justify-between bg-stone-50 p-4 rounded-2xl border border-stone-100">
                    <button onClick={() => navigate('prev')} className="p-2 hover:bg-stone-200 rounded-full transition">
                        <ChevronLeft className="text-stone-500" />
                    </button>
                    <div className="text-center">
                        <h2 className="text-lg font-black text-stone-800">
                            {dateRange.label}
                        </h2>
                        <p className="text-xs text-stone-400 font-medium">
                            {formatDate(dateRange.startStr)} ~ {formatDate(dateRange.endStr)}
                        </p>
                    </div>
                    <button onClick={() => navigate('next')} className="p-2 hover:bg-stone-200 rounded-full transition">
                        <ChevronRight className="text-stone-500" />
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <div className="text-xs text-emerald-700 font-bold mb-1">총 수입</div>
                    <div className="text-xl font-bold text-emerald-600">{formatCurrency(totalIncome).replace('₩', '')}</div>
                    <div className="grid grid-cols-2 gap-1 mt-2 pt-2 border-t border-emerald-200/50">
                        <div>
                            <span className="text-[10px] text-emerald-500 block">캐디피</span>
                            <span className="text-xs font-bold text-emerald-700">{formatCurrency(realizedSchedules.reduce((acc, s) => acc + getCaddyFee(s), 0)).replace('₩', '')}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-emerald-500 block">오버피</span>
                            <span className="text-xs font-bold text-emerald-700">{formatCurrency(realizedSchedules.reduce((acc, s) => acc + (s.overFee || 0), 0)).replace('₩', '')}</span>
                        </div>
                    </div>
                </div>
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 relative">
                    <div className="text-xs text-red-700 font-bold mb-1">총 지출</div>
                    <div className="text-xl font-bold text-red-600">-{formatCurrency(totalExpense).replace('₩', '')}</div>
                    <div className="text-[10px] text-red-400 mt-2 pt-2 border-t border-red-200/50">
                        기타 수입: {formatCurrency(manualIncome).replace('₩', '')}
                    </div>
                </div>

                {/* Rounding Status Card */}
                <div className="col-span-2 bg-white p-4 rounded-xl border border-stone-200">
                    <div className="text-xs text-stone-500 font-bold mb-3 flex items-center justify-between">
                        <span>⛳️ 라운딩 현황 ({dateRange.label})</span>
                        <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">정수 카운트</span>
                    </div>
                    <div className="flex justify-around items-center divide-x divide-stone-100">
                        <div className="flex-1 text-center">
                            <div className="text-[10px] text-stone-400 mb-1">18홀</div>
                            <div className="text-lg font-black text-stone-700">{roundStats.h18}<span className="text-xs font-normal ml-0.5">회</span></div>
                        </div>
                        {roundStats.h36 > 0 && (
                            <div className="flex-1 text-center">
                                <div className="text-[10px] text-stone-400 mb-1">36홀(투)</div>
                                <div className="text-lg font-black text-red-500">{roundStats.h36}<span className="text-xs font-normal ml-0.5">회</span></div>
                            </div>
                        )}
                        {roundStats.h54 > 0 && (
                            <div className="flex-1 text-center">
                                <div className="text-[10px] text-stone-400 mb-1">54홀</div>
                                <div className="text-lg font-black text-stone-700">{roundStats.h54}<span className="text-xs font-normal ml-0.5">회</span></div>
                            </div>
                        )}
                        {roundStats.h9 > 0 && (
                            <div className="flex-1 text-center">
                                <div className="text-[10px] text-stone-400 mb-1">9홀</div>
                                <div className="text-lg font-black text-stone-700">{roundStats.h9}<span className="text-xs font-normal ml-0.5">회</span></div>
                            </div>
                        )}
                        {roundStats.other > 0 && (
                            <div className="flex-1 text-center">
                                <div className="text-[10px] text-stone-400 mb-1">기타</div>
                                <div className="text-lg font-black text-stone-500">{roundStats.other}<span className="text-xs font-normal ml-0.5">회</span></div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="col-span-2 bg-stone-800 p-5 rounded-xl text-white shadow-xl flex justify-between items-center">
                    <div>
                        <span className="text-sm text-stone-300 block mb-1">순수익 (내가 번 돈)</span>
                        <span className="text-3xl font-black">{formatCurrency(netIncome).replace('₩', '')} <span className="text-lg font-normal text-stone-400">원</span></span>
                    </div>
                </div>
            </div>

            {/* Transaction List */}
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-stone-500 mb-2">
                    {dateRange.label} 내역 ({combinedHistory.length}건)
                </h3>

                {groupedDays.length === 0 ? (
                    <div className="text-center py-10 text-stone-400 text-xs">
                        내역이 없습니다.
                    </div>
                ) : (
                    groupedDays.map(dayGroup => (
                        <div key={dayGroup.date}>
                            {/* 날짜 섹션 헤더 */}
                            <div className="flex justify-between items-center px-1 mb-2 pb-1 border-b border-stone-100">
                                <span className="text-xs font-bold text-stone-400">{formatDate(dayGroup.date)}</span>
                                <div className="flex gap-2 text-xs">
                                    {dayGroup.dayIncome > 0 && <span className="text-emerald-600 font-bold">+{dayGroup.dayIncome.toLocaleString()}</span>}
                                    {dayGroup.dayExpense > 0 && <span className="text-red-500 font-bold">-{dayGroup.dayExpense.toLocaleString()}</span>}
                                </div>
                            </div>

                            <div className="space-y-2">
                                {/* 근무 카드: 2건 이상이면 묶음 */}
                                {dayGroup.scheduleItems.length >= 2 ? (
                                    <div className="bg-white rounded-xl border-2 border-red-400 shadow-sm overflow-hidden">
                                        <div className="p-4 pb-2 flex justify-between items-center">
                                            <div className="flex items-center">
                                                <div className="p-2.5 rounded-full mr-3 bg-emerald-100 text-emerald-600">
                                                    <ArrowUp size={20} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-stone-800 text-sm">
                                                        🏌️ {dayGroup.scheduleItems.reduce((a, i) => a + (i.holes || 18), 0)}홀(투) 근무
                                                        <span className="ml-2 text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">자동</span>
                                                    </div>
                                                    <div className="text-xs text-blue-600 font-bold mt-0.5">
                                                        합계 +{dayGroup.scheduleItems.reduce((a, i) => a + i.amount, 0).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="border-t border-stone-50">
                                            {dayGroup.scheduleItems.map((item, idx) => (
                                                <div key={item.id} className={`px-4 py-3 flex justify-between items-center ${idx < dayGroup.scheduleItems.length - 1 ? 'border-b border-stone-50' : ''}`}>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${item.shift === '1' ? 'bg-red-100 text-red-600' : item.shift === '2' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-700'}`}>
                                                            {item.shift || '?'}부
                                                        </span>
                                                        <span className="text-sm text-stone-500">{item.holes || 18}홀 · {item.memo}</span>
                                                    </div>
                                                    <span className="font-bold text-blue-600 text-sm">+{item.amount.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : dayGroup.scheduleItems.length === 1 ? (
                                    <div className="bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden">
                                        <div className="p-4 flex justify-between items-center">
                                            <div className="flex items-center">
                                                <div className="p-2.5 rounded-full mr-3 bg-emerald-100 text-emerald-600">
                                                    <ArrowUp size={20} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-stone-800 text-sm">
                                                        {dayGroup.scheduleItems[0].memo || '근무'}
                                                        <span className="ml-2 text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">자동</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="font-bold text-emerald-600 text-lg">+{formatCurrency(dayGroup.scheduleItems[0].amount).replace('₩', '')}</span>
                                        </div>
                                    </div>
                                ) : null}

                                {/* 개별 거래 내역 카드 */}
                                {dayGroup.txItems.map((item, index) => (
                                    <div key={`${item.id}-${index}`} className="bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden">
                                        <div className="p-4 flex justify-between items-center">
                                            <div className="flex items-center">
                                                <div className={`p-2.5 rounded-full mr-3 ${item.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                                                    {item.type === 'income' ? <ArrowUp size={20} /> : <ArrowDown size={20} />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-stone-800 text-sm">
                                                        {item.memo || (item.type === 'income' ? '수입' : '지출')}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center">
                                                <span className={`font-bold mr-3 text-lg ${item.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount).replace('₩', '')}
                                                </span>
                                                <button onClick={() => setDeleteConfirmId(item.id)} className="text-stone-300 hover:text-red-400 p-1">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        {item.receiptUrl && (
                                            <a href={item.receiptUrl} target="_blank" rel="noopener noreferrer" className="block border-t border-stone-100">
                                                <img
                                                    src={item.receiptUrl}
                                                    alt="영수증"
                                                    className="w-full max-h-48 object-cover object-top"
                                                    loading="lazy"
                                                />
                                                <div className="text-[10px] text-stone-400 text-center py-1 bg-stone-50">🧾 영수증 보기 (탭하면 원본)</div>
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* 삭제 확인 모달 */}
            {deleteConfirmId && (
                <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-[320px] rounded-3xl p-6 shadow-2xl text-center">
                        <div className="text-3xl mb-3">🗑️</div>
                        <h3 className="text-lg font-bold text-stone-800 mb-2">내역을 삭제하시겠습니까?</h3>
                        <p className="text-sm text-stone-400 mb-6">삭제 후 복구할 수 없습니다.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 py-3 rounded-2xl bg-stone-100 text-stone-600 font-bold text-sm"
                            >
                                취소
                            </button>
                            <button
                                onClick={() => { deleteTransaction(deleteConfirmId); setDeleteConfirmId(null); }}
                                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm"
                            >
                                삭제
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-[440px] rounded-3xl p-6 animate-in slide-in-from-bottom-10 shadow-2xl overflow-y-auto max-h-[calc(100dvh-64px)]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">간편 내역 추가</h2>
                            <button onClick={() => setIsModalOpen(false)} className="bg-stone-100 p-2 rounded-full text-stone-400 hover:text-stone-600">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Type Toggle */}
                            <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1.5 rounded-2xl">
                                <button
                                    type="button"
                                    onClick={() => setType('income')}
                                    className={`py-3 rounded-xl text-sm font-bold transition flex justify-center items-center ${type === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                                >
                                    <ArrowUp size={18} className="mr-1.5" /> 수입 (용돈 등)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setType('expense')}
                                    className={`py-3 rounded-xl text-sm font-bold transition flex justify-center items-center ${type === 'expense' ? 'bg-white text-red-500 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                                >
                                    <ArrowDown size={18} className="mr-1.5" /> 지출 (소비)
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-stone-500 mb-1.5 ml-1">날짜</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full p-4 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 text-stone-800 font-bold"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-stone-500 mb-1.5 ml-1">금액</label>
                                <div className="relative">
                                    <input
                                        id="amount-input"
                                        type="text"
                                        value={amount ? Number(amount).toLocaleString() : ''}
                                        onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                                        placeholder="0"
                                        className={`w-full p-4 pl-4 pr-12 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 text-right font-black text-2xl ${!amount ? 'ring-2 ring-red-300' : ''}`}
                                    />
                                    <span className="absolute right-5 top-5 text-stone-400 font-bold">원</span>
                                </div>
                            </div>

                            {type === 'expense' && (
                                <div>
                                    <label className="block text-sm font-bold text-stone-500 mb-1.5 ml-1">
                                        카테고리
                                        <span className="ml-2 text-[10px] font-normal text-stone-400">(세무 경비 구분)</span>
                                    </label>
                                    <div className="grid grid-cols-3 gap-2 mb-2">
                                        {[
                                            { id: 'transport', label: '🚌 교통비', sub: '✅ 경비 인정' },
                                            { id: 'meal', label: '🍱 업무식비', sub: '✅ 경비 인정' },
                                            { id: 'gear', label: '👔 업무용품', sub: '✅ 경비 인정' },
                                        ].map(cat => (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => setCategory(cat.id as ExpenseCategory)}
                                                className={`py-2.5 rounded-xl text-xs font-bold border transition flex flex-col items-center gap-0.5 ${category === cat.id ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-400 border-stone-200 hover:border-emerald-300'}`}
                                            >
                                                <span>{cat.label}</span>
                                                <span className={`text-[9px] ${category === cat.id ? 'text-emerald-200' : 'text-emerald-400'}`}>{cat.sub}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'etc_expense', label: '📱 기타경비', sub: '✅ 경비 인정' },
                                            { id: 'personal', label: '⚠️ 개인지출', sub: '❌ 경비 불인정' },
                                        ].map(cat => (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => setCategory(cat.id as ExpenseCategory)}
                                                className={`py-2.5 rounded-xl text-xs font-bold border transition flex flex-col items-center gap-0.5 ${category === cat.id ? (cat.id === 'personal' ? 'bg-amber-500 text-white border-amber-500' : 'bg-emerald-700 text-white border-emerald-700') : 'bg-white text-stone-400 border-stone-200 hover:border-stone-300'}`}
                                            >
                                                <span>{cat.label}</span>
                                                <span className={`text-[9px] ${category === cat.id ? 'text-white/80' : cat.id === 'personal' ? 'text-amber-400' : 'text-emerald-400'}`}>{cat.sub}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-stone-500 mb-1.5 ml-1">메모</label>
                                <input
                                    type="text"
                                    value={memo}
                                    onChange={(e) => setMemo(e.target.value)}
                                    placeholder={type === 'income' ? "예: 팁, 용돈" : "예: 점심값, 기름값"}
                                    className="w-full p-4 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* 영수증 사진 청구 뺄지 (expense일 때만) */}
                            {type === 'expense' && (
                                <div>
                                    <label className="block text-sm font-bold text-stone-500 mb-1.5 ml-1">
                                        영수증 합계 부분 찍기 (선택)
                                        {ocrLimit < 999 && (
                                            <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${ocrRemaining === 0 ? 'bg-red-100 text-red-500' : 'bg-emerald-100 text-emerald-600'}`}>
                                                이번 달 {ocrRemaining}/{ocrLimit}회 남음
                                            </span>
                                        )}
                                    </label>
                                    <input ref={receiptRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReceiptChange} />
                                    <button
                                        type="button"
                                        onClick={() => receiptRef.current?.click()}
                                        disabled={receiptUploading || (ocrLimit < 999 && ocrRemaining === 0)}
                                        className={`w-full flex items-center justify-center gap-2 border-2 border-dashed rounded-2xl py-3 text-sm transition ${ocrLimit < 999 && ocrRemaining === 0 ? 'border-stone-100 text-stone-300 cursor-not-allowed' : 'border-stone-200 text-stone-400 hover:border-emerald-300 hover:text-emerald-600'}`}
                                    >
                                        {receiptUploading ? <><Loader2 size={16} className="animate-spin" /> 인식 중...</> : receiptUrl ? '✅ 영수증 등록됨 (다시 찍기)' : ocrLimit < 999 && ocrRemaining === 0 ? '이번 달 OCR 한도 초과' : <><Camera size={16} /> 합계금액 부분 찍기 / OCR</>}
                                    </button>
                                    <p className="text-[11px] text-stone-400 mt-1 text-center">
                                        💡 긴 영수증은 <span className="font-bold text-stone-500">합계금액이 있는 아랫부분만</span> 찍으면 정확도가 높아요
                                    </p>
                                    {receiptUrl && ocrResult && (
                                        <p className={`text-[10px] mt-0.5 text-center font-bold ${ocrResult.amount ? 'text-emerald-600' : 'text-amber-500'}`}>
                                            {ocrResult.amount
                                                ? `✅ OCR 인식 완료 — ${ocrResult.amount.toLocaleString()}원 자동 입력됨`
                                                : '⚠️ 금액 인식 실패 — 직접 입력해 주세요 (합계 부분만 다시 찍어보세요)'}
                                        </p>
                                    )}
                                    {ocrLimit < 999 && ocrRemaining === 0 && (
                                        <p className="text-[11px] text-red-400 mt-1 text-center">
                                            6개월/1년 이용권으로 업그레이드 시 최대 30회/무제한 사용 가능합니다.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* OCR 한도 초과 오류 모달 */}
                            {ocrError && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
                                        <p className="font-bold text-stone-800 text-center whitespace-pre-line">{ocrError}</p>
                                        <button onClick={() => setOcrError(null)} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl">확인</button>
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                className={`w-full text-white font-bold text-lg py-4 rounded-2xl shadow-xl transition active:scale-[0.98] mt-4 ${type === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'}`}
                            >
                                {type === 'income' ? '💰 수입 등록하기' : '💸 지출 등록하기'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
