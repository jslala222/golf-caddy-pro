'use client';

import { useState, useMemo, useRef } from 'react';
import { useAppStore, type TransactionType, type ExpenseCategory } from '@/lib/store';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Wallet, Plus, X, ArrowUp, ArrowDown, Trash2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Camera, Loader2 } from 'lucide-react';


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
    const today = new Date().toISOString().split('T')[0];
    const realizedSchedules = filteredSchedules.filter(s => s.date <= today); // Calculate realized income based on filter range

    const scheduleIncome = realizedSchedules.reduce((acc, s) => acc + getCaddyFee(s) + (s.overFee || 0), 0);
    const manualIncome = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const totalIncome = scheduleIncome + manualIncome;

    // Calculate Rounding Stats
    const roundStats = useMemo(() => {
        const stats = { h18: 0, h9: 0, other: 0 };
        realizedSchedules.forEach(s => {
            if (s.holes === 18) stats.h18++;
            else if (s.holes === 9) stats.h9++;
            else stats.other++;
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
                category: 'work'
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
                category: t.category
            });
        });

        return history.sort((a, b) => b.date.localeCompare(a.date));
    }, [filteredSchedules, filteredTransactions, today, feeSettings]); // Added dependencies

    // ... (keep modal form state)
    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [type, setType] = useState<TransactionType>('expense');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<ExpenseCategory>('food');
    const [memo, setMemo] = useState('');

    // 영수증 사진 업로드
    const receiptRef = useRef<HTMLInputElement>(null);
    const [receiptUploading, setReceiptUploading] = useState(false);
    const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

    const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
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
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.75));
        const compressed = new File([blob], 'receipt.jpg', { type: 'image/jpeg' });

        setReceiptUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', compressed);
            fd.append('licenseCode', licenseCode);
            const res = await fetch('/api/receipt/upload', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) {
                setReceiptUrl(data.url);
                if (data.ocrAmount && !amount) setAmount(String(data.ocrAmount));
                if (data.ocrMemo && !memo) setMemo(data.ocrMemo);
            }
        } catch (err) {
            console.warn('영수증 업로드 실패', err);
        } finally {
            setReceiptUploading(false);
        }
        e.target.value = '';
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount) return;

        addTransaction({
            date,
            type,
            amount: parseInt(amount.replace(/,/g, '')),
            category: type === 'expense' ? category : undefined,
            memo
        });

        setIsModalOpen(false);
        setAmount('');
        setMemo('');
        setReceiptUrl(null);
    };

    // Modal defaulting logic adjusted for period
    const handleOpenModal = () => {
        const now = new Date();
        const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
        const todayStr = localNow.toISOString().split('T')[0];

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
                        <div className="flex-1 text-center">
                            <div className="text-[10px] text-stone-400 mb-1">9홀</div>
                            <div className="text-lg font-black text-stone-700">{roundStats.h9}<span className="text-xs font-normal ml-0.5">회</span></div>
                        </div>
                        <div className="flex-1 text-center font-bold text-stone-800">
                            <div className="text-[10px] text-stone-400 mb-1">기타(중단)</div>
                            <div className="text-lg font-black text-emerald-600">{roundStats.other}<span className="text-xs font-normal ml-0.5">회</span></div>
                        </div>
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
            <div className="space-y-3">
                <h3 className="text-sm font-bold text-stone-500 mb-2">
                    {dateRange.label} 내역 ({combinedHistory.length}건)
                </h3>

                {combinedHistory.length === 0 ? (
                    <div className="text-center py-10 text-stone-400 text-xs">
                        내역이 없습니다.
                    </div>
                ) : (
                    combinedHistory.map((item, index) => (
                        <div key={`${item.id}-${index}`} className="bg-white p-4 rounded-xl border border-stone-100 flex justify-between items-center shadow-sm">
                            <div className="flex items-center">
                                <div className={`p-2.5 rounded-full mr-3 ${item.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                                    {item.type === 'income' ? <ArrowUp size={20} /> : <ArrowDown size={20} />}
                                </div>
                                <div>
                                    <div className="text-xs text-stone-400 mb-0.5">{formatDate(item.date)}</div>
                                    <div className="font-bold text-stone-800 text-sm">
                                        {item.memo || (item.type === 'income' ? '수입' : '지출')}
                                        {item.isSchedule && <span className="ml-2 text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">자동</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center">
                                <span className={`font-bold mr-3 text-lg ${item.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount).replace('₩', '')}
                                </span>
                                {!item.isSchedule && (
                                    <button onClick={() => deleteTransaction(item.id)} className="text-stone-300 hover:text-red-400 p-1">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

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
                                        type="text"
                                        value={amount ? Number(amount).toLocaleString() : ''}
                                        onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                                        placeholder="0"
                                        className="w-full p-4 pl-4 pr-12 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 text-right font-black text-2xl"
                                        required
                                    />
                                    <span className="absolute right-5 top-5 text-stone-400 font-bold">원</span>
                                </div>
                            </div>

                            {type === 'expense' && (
                                <div>
                                    <label className="block text-sm font-bold text-stone-500 mb-1.5 ml-1">카테고리</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { id: 'food', label: '🍚 식비' },
                                            { id: 'transport', label: '🚕 교통' },
                                            { id: 'gear', label: '⛳️ 용품' },
                                            { id: 'other', label: '🎸 기타' }
                                        ].map(cat => (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => setCategory(cat.id as ExpenseCategory)}
                                                className={`py-2.5 rounded-xl text-xs font-bold border transition ${category === cat.id ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-400 border-stone-200 hover:border-stone-300'}`}
                                            >
                                                {cat.label}
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
                                    <label className="block text-sm font-bold text-stone-500 mb-1.5 ml-1">혁신 영수증 찍기 (선택)</label>
                                    <input ref={receiptRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReceiptChange} />
                                    <button
                                        type="button"
                                        onClick={() => receiptRef.current?.click()}
                                        disabled={receiptUploading}
                                        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-stone-200 rounded-2xl py-3 text-sm text-stone-400 hover:border-emerald-300 hover:text-emerald-600 transition"
                                    >
                                        {receiptUploading ? <><Loader2 size={16} className="animate-spin" /> 인식 중...</> : receiptUrl ? '✅ 영수증 등록됨 (재쳄용)' : <><Camera size={16} /> 영수증 사진 / 실시간 OCR</>}
                                    </button>
                                    {receiptUrl && <p className="text-[10px] text-stone-400 mt-1 text-center">OCR 자동 인식 완료 — 위에서 금액/메모 확인하세요</p>}
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
