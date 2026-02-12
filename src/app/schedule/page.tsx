
'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppStore, type ScheduleType, type Schedule } from '@/lib/store';
import { Calendar } from '@/components/Calendar';
import { Calendar as CalendarIcon, Clock, Plus, Trash2, X, Edit, ArrowLeft, MoreHorizontal } from 'lucide-react';
import { clsx } from 'clsx';

function ScheduleContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const dateParam = searchParams.get('date');

    const { schedules, addSchedule, updateSchedule, deleteSchedule, deleteSchedulesByDate, feeSettings, transactions, addTransaction, deleteTransaction } = useAppStore();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // View State (list | form)
    const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [date, setDate] = useState(dateParam || new Date().toISOString().split('T')[0]);
    const [hour, setHour] = useState('00');
    const [minute, setMinute] = useState('00');
    const [title, setTitle] = useState('');
    const [type, setType] = useState<ScheduleType>('work');
    const [shift, setShift] = useState<'1' | '2' | '3'>('1');
    const [caddyFee, setCaddyFee] = useState('');
    const [overFee, setOverFee] = useState('');
    const [isRain, setIsRain] = useState(false);
    const [holes, setHoles] = useState<number>(18); // Default 18 holes
    const [customHoles, setCustomHoles] = useState(''); // For custom hole entry

    // Transaction State
    const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseMemo, setExpenseMemo] = useState('');
    const [expenseCategory, setExpenseCategory] = useState<'food' | 'transport' | 'gear' | 'other'>('food');

    // Helpers
    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')); // 00 ~ 23
    const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')); // 00 ~ 59

    // Filter schedules for the selected/active date
    const activeDateSchedules = useMemo(() => {
        return schedules.filter(s => s.date === date).sort((a, b) => {
            // Sort by time
            return new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
        });
    }, [schedules, date]);

    // Filter transactions for the selected date
    const activeDateTransactions = useMemo(() => {
        return transactions.filter(t => t.date === date && t.type === 'expense');
    }, [transactions, date]);

    // Auto-fill fee when shift changes
    useEffect(() => {
        if (type === 'work' && !isRain) {
            // Only auto-fill if it's a new entry OR if the fee field is currently empty
            if (!editingId || caddyFee === '') {
                const defaultFee = feeSettings ? feeSettings[`shift${shift}`] : 150000;
                if (defaultFee) setCaddyFee(String(defaultFee));
            }
        }
    }, [shift, type, feeSettings, editingId]);

    useEffect(() => {
        if (dateParam) {
            setDate(dateParam);
            // setIsModalOpen(true); // No longer using modal
            setViewMode('list');
            setEditingId(null);

            // Scroll to details when date changes
            const detailsSection = document.getElementById('daily-schedule-section');
            if (detailsSection) {
                detailsSection.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [dateParam]);

    const handleClose = () => {
        // setIsModalOpen(false); // No longer using modal
        // router.push('/schedule'); // Keep the date selected, just go back to list if in form, or do nothing?
        // User asked to "show info below".
        // If we are in 'form' mode, 'handleClose' (or 'Confirm') should probably just go back to 'list' mode.
        // If we are in 'list' mode, maybe it clears selection?
        // But for "inline" view, usually it just stays there.
        // Let's make "Confirm (Close)" just ensure we are in list view and maybe scroll up?
        // Or strictly follow "Close" semantics implies clearing selection.
        // Let's make it go back to list view if in form. If in list, maybe clear param?

        if (viewMode === 'form') {
            setViewMode('list');
            resetForm(); // keep date
        } else {
            // If in list view, "Confirm" button acts as "I'm done checking".
            // We can clear the date param to "close" the detail view, or just leave it.
            // Given the previous modal behavior, "closing" meant hiding the details.
            // I will clear the param effectively "deselecting" the date visually (though calendar might still show it)
            router.push('/schedule');
        }
    };

    const resetForm = () => {
        setHour('00');
        setMinute('00');
        setTitle('');
        setType('work');
        setShift('1');
        setCaddyFee('');
        setOverFee('');
        setIsRain(false);
        setHoles(18);
        setCustomHoles('');
        setEditingId(null);
        setViewMode('list');
    };

    const handleAddNewClick = () => {
        resetForm();
        // Auto-select next available shift
        const existingWork = activeDateSchedules.filter(s => s.type === 'work');
        const takenShifts = existingWork.map(s => s.shift);
        let nextShift: '1' | '2' | '3' = '1';

        if (!takenShifts.includes('1')) nextShift = '1';
        else if (!takenShifts.includes('2')) nextShift = '2';
        else if (!takenShifts.includes('3')) nextShift = '3';

        setShift(nextShift);

        // Pre-fill fee for the determined shift
        const defaultFee = feeSettings ? feeSettings[`shift${nextShift}`] : 150000;
        setCaddyFee(String(defaultFee));
        setOverFee('');

        setViewMode('form');
    };

    const handleEditClick = (schedule: Schedule) => {
        setEditingId(schedule.id);
        setDate(schedule.date);
        const [h, m] = schedule.time.split(':');
        setHour(h);
        setMinute(m);
        setTitle(schedule.title);
        setType(schedule.type);
        // If shift is missing but it's work, default to 1 (or infer?)
        if (schedule.type === 'work') {
            setShift(schedule.shift || '1');
            setIsRain(!!schedule.isRain);
            // If caddy fee is missing (legacy data), try to auto-fill based on shift
            if (schedule.caddyFee) {
                setCaddyFee(String(schedule.caddyFee));
            } else {
                const defaultFee = feeSettings ? feeSettings[`shift${schedule.shift || '1'}` as keyof typeof feeSettings] : 150000;
                setCaddyFee(String(defaultFee));
            }

            setOverFee(schedule.overFee ? String(schedule.overFee) : '');
            setHoles(schedule.holes || 18);
            if (schedule.isRain && !([18, 9].includes(schedule.holes || 18))) {
                setCustomHoles(String(schedule.holes));
            } else {
                setCustomHoles('');
            }
        } else {
            setCaddyFee('');
            setOverFee('');
            setHoles(18);
        }

        setViewMode('form');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalTime = `${hour}:${minute}`;

        const scheduleData = {
            date,
            time: finalTime,
            title,
            type,
            shift: type === 'work' ? shift : undefined,
            isRain: type === 'work' ? isRain : undefined,
            holes: type === 'work' ? (isRain && customHoles ? Number(customHoles) : holes) : undefined,
            caddyFee: type === 'work' && caddyFee ? Number(caddyFee) : undefined,
            overFee: type === 'work' && overFee ? Number(overFee) : undefined,
        };

        if (editingId) {
            updateSchedule(editingId, scheduleData);
            setViewMode('list');
        } else {
            addSchedule(scheduleData);
            setViewMode('list');
        }
    };

    const handleDelete = (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            deleteSchedule(id);
            if (editingId === id) {
                setViewMode('list');
                setEditingId(null);
            }
        }
    };

    const handleAddExpense = (e: React.FormEvent) => {
        e.preventDefault();
        if (!expenseAmount) return;

        addTransaction({
            date,
            type: 'expense',
            amount: parseInt(expenseAmount.replace(/[^0-9]/g, '')),
            category: expenseCategory,
            memo: expenseMemo
        });

        setIsExpenseFormOpen(false);
        setExpenseAmount('');
        setExpenseMemo('');
    };

    return (
        <div className="p-6 pb-24 relative min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-stone-900 flex items-center">
                    <CalendarIcon className="mr-2 text-emerald-600" /> 근무 관리
                </h1>
                <div className="flex gap-2 text-xs">
                    <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-red-500 mr-1"></div>1부</span>
                    <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-blue-500 mr-1"></div>2부</span>
                    <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-emerald-500 mr-1"></div>3부</span>
                </div>
            </div>

            {/* Calendar View */}
            <div className="mb-6">
                <Calendar schedules={schedules} selectedDate={date} />
            </div>

            {/* Inline Detail / Edit Section */}
            {/* Always show this section if a date is selected, or maybe just show placeholder if not? */}
            {/* User said "When clicking date, show info below". */}
            {/* So I will conditionally render this only if `dateParam` exists (or `date` is set via interaction). */}
            {/* To preserve the "clean calendar" look, I'll only show it when selected. */}

            {(dateParam || viewMode === 'form') && (
                <div id="daily-schedule-section" className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 animate-in slide-in-from-top-4">

                    {/* Header */}
                    <div className="flex justify-between items-center mb-6 border-b border-stone-100 pb-4">
                        {viewMode === 'form' ? (
                            <button onClick={() => setViewMode('list')} className="text-stone-500 flex items-center font-bold">
                                <ArrowLeft size={24} className="mr-1" /> 목록으로
                            </button>
                        ) : (
                            <h2 className="text-2xl font-black text-stone-800">
                                {date.split('-')[1]}월 {date.split('-')[2]}일
                                <span className="text-base font-normal text-stone-500 ml-2">일정</span>
                            </h2>
                        )}
                        <button onClick={handleClose} className="p-2 bg-stone-50 rounded-full text-stone-400 hover:text-stone-600">
                            <X size={20} />
                        </button>
                    </div>

                    {/* LIST VIEW */}
                    {viewMode === 'list' && (
                        <div className="space-y-4">
                            {/* Schedule List */}
                            {activeDateSchedules.length === 0 ? (
                                <div className="py-6 text-center text-stone-400 border-b border-dashed border-stone-100 pb-6">
                                    <p className="mb-2">🌴 일정이 없습니다.</p>
                                    <p className="text-sm">근무나 약속을 등록해보세요!</p>
                                </div>
                            ) : (
                                activeDateSchedules.map(schedule => (
                                    <div key={schedule.id}
                                        onClick={() => handleEditClick(schedule)}
                                        className="bg-white border border-stone-200 p-5 rounded-2xl flex justify-between items-center cursor-pointer hover:border-emerald-500 hover:shadow-md transition relative overflow-hidden"
                                    >
                                        {/* Background Accent */}
                                        <div className={`absolute left-0 top-0 bottom-0 w-2
                                ${schedule.type === 'personal' ? 'bg-orange-400' :
                                                schedule.shift === '1' ? 'bg-red-500' :
                                                    schedule.shift === '2' ? 'bg-blue-500' :
                                                        schedule.shift === '3' ? 'bg-emerald-500' : 'bg-stone-300'
                                            }`}></div>

                                        <div className="pl-4 min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                {/* Shift Tag */}
                                                <span className={`text-xs font-black px-2 py-1 rounded-md flex-shrink-0
                                         ${schedule.type === 'work' ? 'bg-stone-100 text-stone-600' : 'bg-orange-50 text-orange-600'}`}>
                                                    {schedule.type === 'work' ? `${schedule.shift || '?'}부 · ${schedule.holes || 18}홀` : '개인'}
                                                </span>
                                                {/* Time */}
                                                <span className={`text-xl font-black font-mono tracking-tight flex-shrink-0
                                         ${schedule.type === 'work' ? 'text-emerald-700' : 'text-orange-600'}`}>
                                                    {schedule.time}
                                                </span>
                                            </div>
                                            <p className="text-base font-bold text-stone-800 line-clamp-2 break-all">
                                                {schedule.isRain && <span className="mr-1 text-sm">☔️❄️</span>}
                                                {schedule.title || '제목 없음'}
                                            </p>
                                        </div>
                                        <div className="p-3 flex-shrink-0">
                                            <span className="bg-stone-100 text-stone-500 px-3 py-1.5 rounded-lg text-sm font-bold group-hover:bg-emerald-100 group-hover:text-emerald-700 transition">
                                                수정
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}

                            {/* Add New Schedule Button */}
                            {activeDateSchedules.filter(s => s.type === 'work').length < 3 && (
                                <button
                                    onClick={handleAddNewClick}
                                    className="w-full py-4 border-2 border-dashed border-emerald-300 text-emerald-600 rounded-2xl font-bold flex items-center justify-center hover:bg-emerald-50 transition"
                                >
                                    <Plus size={24} className="mr-2" /> 일정 추가
                                </button>
                            )}
                            {activeDateSchedules.filter(s => s.type === 'work').length >= 3 && (
                                <p className="text-center text-sm font-medium text-red-500 mt-4 bg-red-50 p-3 rounded-xl">
                                    ℹ️ 하루 근무(3회)가 모두 찼습니다.
                                </p>
                            )}

                            {/* Daily Expense Section */}
                            <div className="mt-8 pt-6 border-t border-stone-100">
                                <h3 className="text-sm font-bold text-stone-500 mb-3 flex items-center justify-between">
                                    <span>💸 오늘의 지출 <span className="text-[10px] opacity-30 font-normal">v1.1</span></span>
                                    {!isExpenseFormOpen && (
                                        <button
                                            onClick={() => setIsExpenseFormOpen(true)}
                                            className="text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded-lg hover:bg-stone-200 transition"
                                        >
                                            + 지출 추가
                                        </button>
                                    )}
                                </h3>

                                {isExpenseFormOpen && (
                                    <form onSubmit={handleAddExpense} className="bg-stone-50 p-4 rounded-xl mb-4 animate-in slide-in-from-top-2">
                                        <div className="grid grid-cols-4 gap-2 mb-3">
                                            {[
                                                { id: 'food', label: '식대' },
                                                { id: 'transport', label: '교통' },
                                                { id: 'gear', label: '용품' },
                                                { id: 'other', label: '기타' }
                                            ].map(cat => (
                                                <button
                                                    key={cat.id}
                                                    type="button"
                                                    onClick={() => setExpenseCategory(cat.id as any)}
                                                    className={`py-2 rounded-lg text-xs font-bold border transition ${expenseCategory === cat.id ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-400 border-stone-200'}`}
                                                >
                                                    {cat.label}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-3 mb-3">
                                            <input
                                                type="text"
                                                value={expenseMemo}
                                                onChange={(e) => setExpenseMemo(e.target.value)}
                                                placeholder="내용 (예: 커피, 식사)"
                                                className="flex-[1.5] p-4 bg-white border-2 border-stone-200 rounded-2xl font-bold focus:outline-none focus:border-stone-400 transition-all"
                                                autoFocus
                                            />
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={expenseAmount ? Number(expenseAmount).toLocaleString() : ''}
                                                    onChange={(e) => setExpenseAmount(e.target.value.replace(/[^0-9]/g, ''))}
                                                    placeholder="금액 입력"
                                                    className="w-full p-4 pr-12 bg-white border-2 border-stone-200 rounded-2xl text-right font-black text-xl focus:outline-none focus:border-red-500 transition-all"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold">원</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setIsExpenseFormOpen(false)}
                                                className="flex-1 py-3 bg-stone-200 text-stone-500 rounded-xl font-bold text-sm"
                                            >
                                                취소
                                            </button>
                                            <button
                                                type="submit"
                                                className="flex-[2] py-3 bg-red-500 text-white rounded-xl font-bold text-sm"
                                            >
                                                저장
                                            </button>
                                        </div>
                                    </form>
                                )}

                                <div className="space-y-2">
                                    {activeDateTransactions.length === 0 ? (
                                        <div className="text-center py-4 text-stone-300 text-xs">
                                            지출 내역이 없습니다.
                                        </div>
                                    ) : (
                                        activeDateTransactions.map(t => (
                                            <div key={t.id} className="flex justify-between items-center bg-stone-50 p-3 rounded-xl">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs bg-white border border-stone-200 px-1.5 py-0.5 rounded text-stone-500">
                                                        {t.category === 'food' ? '식대' : t.category === 'transport' ? '교통' : t.category === 'gear' ? '용품' : '기타'}
                                                    </span>
                                                    <span className="text-sm font-bold text-stone-700">{t.memo}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-red-500">-{Number(t.amount).toLocaleString()}</span>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm('삭제하시겠습니까?')) deleteTransaction(t.id)
                                                        }}
                                                        className="text-stone-300 hover:text-red-500"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* CONFIRM / CLOSE BUTTON */}
                            <button
                                onClick={handleClose}
                                className="w-full py-4 bg-stone-900 text-white text-lg font-bold rounded-2xl shadow-md hover:bg-stone-700 transition mt-6"
                            >
                                확인 (닫기)
                            </button>

                            {/* Bulk Delete for the Day */}
                            {activeDateSchedules.length > 0 && (
                                <div className="mt-8 pt-6 border-t border-stone-100/50 text-center">
                                    <button
                                        onClick={() => {
                                            if (confirm(`${date.split('-')[1]}월 ${date.split('-')[2]}일의 모든 일정을 삭제하시겠습니까?\n\n(❗️ 이 작업은 되돌릴 수 없습니다!)`)) {
                                                deleteSchedulesByDate(date);
                                            }
                                        }}
                                        className="text-stone-400 text-sm font-medium underline hover:text-red-500 hover:no-underline transition py-2 px-4 rounded-lg hover:bg-red-50"
                                    >
                                        ⛔️  이 날짜의 일정 전체 삭제
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* FORM VIEW (Add or Edit) */}
                    {viewMode === 'form' && (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Type Toggle */}
                            <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-2xl">
                                <button
                                    type="button"
                                    onClick={() => setType('work')}
                                    className={`py-3 rounded-xl text-base font-bold transition ${type === 'work' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                                >
                                    ⛳️ 근무
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setType('personal')}
                                    className={`py-3 rounded-xl text-base font-bold transition ${type === 'personal' ? 'bg-white text-orange-500 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                                >
                                    📅 개인 약속
                                </button>
                            </div>

                            {/* Date Logic for UI */}
                            {(() => {
                                const todayStr = new Date().toISOString().split('T')[0];
                                const isFuture = date > todayStr;

                                return (
                                    <>
                                        {/* Shift Select (Only for Work) - Dropdown */}
                                        {type === 'work' && (
                                            <div>
                                                <label className="block text-sm font-bold text-stone-500 mb-1.5 ml-1">근무 구분</label>
                                                <div className="relative">
                                                    <select
                                                        value={shift}
                                                        onChange={(e) => setShift(e.target.value as '1' | '2' | '3')}
                                                        className="w-full p-4 text-lg font-bold bg-white border-2 border-emerald-500 text-emerald-700 rounded-2xl appearance-none focus:outline-none focus:ring-4 focus:ring-emerald-100"
                                                        style={{ backgroundImage: 'none' }}
                                                    >
                                                        <option value="1">🔴 1부 (오전)</option>
                                                        <option value="2">🔵 2부 (오후)</option>
                                                        {feeSettings?.useShift3 && <option value="3">🟢 3부 (야간)</option>}
                                                    </select>
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-600 font-bold">
                                                        ▼
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}

                            {/* Custom Time Selector */}
                            <div>
                                <label className="block text-sm font-bold text-stone-500 mb-1.5 ml-1">
                                    {type === 'work' ? '티오프 시간' : '약속 시간'}
                                </label>
                                <div className="flex gap-2 items-center">
                                    <select
                                        value={hour}
                                        onChange={(e) => setHour(e.target.value)}
                                        className="flex-1 py-4 text-center text-2xl font-black bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                                    >
                                        {hours.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                    <span className="text-xl font-bold text-stone-300">:</span>
                                    <select
                                        value={minute}
                                        onChange={(e) => setMinute(e.target.value)}
                                        className="flex-1 py-4 text-center text-2xl font-black bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                                    >
                                        {minutes.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-stone-500 mb-1.5 ml-1">내용 / 메모</label>
                                <textarea
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={type === 'work' ? "코스, 특이사항 등 (선택)" : "일정 내용 입력"}
                                    rows={1}
                                    className="w-full p-4 bg-stone-50 border-none rounded-2xl text-lg font-medium focus:ring-2 focus:ring-emerald-500 placeholder:text-stone-300 transition resize-none"
                                />
                            </div>

                            {/* Hole Selection (Only for Work) - Simplified: Only show toggle if not 18 holes */}
                            {type === 'work' && (
                                <div className="space-y-4 pt-2">
                                    {(() => {
                                        const todayStr = new Date().toISOString().split('T')[0];
                                        const isFuture = date > todayStr;

                                        return (
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-sm font-bold text-stone-500">라운딩 홀수 입력</label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newIsRain = !isRain;
                                                        setIsRain(newIsRain);
                                                        if (!newIsRain) {
                                                            setHoles(18); // Reset to default 18 holes when OFF
                                                            setCustomHoles('');
                                                        } else {
                                                            setCustomHoles(String(holes));
                                                        }
                                                    }}
                                                    className={`text-[11px] px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 ${isRain ? 'bg-blue-50 border-blue-200 text-blue-600 font-bold' : 'bg-white border-stone-200 text-stone-400'}`}
                                                >
                                                    <span className="text-sm">⛳️</span>
                                                    {!isFuture && <span className="text-sm">☔️❄️</span>}
                                                    {isFuture ? '홀수 직접 입력 (9, 27홀 등)' : '홀수/우천 정산'} {isRain ? 'ON' : 'OFF'}
                                                </button>
                                            </div>
                                        );
                                    })()}

                                    {isRain ? (
                                        <div className="animate-in slide-in-from-top-2">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={customHoles}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                                        if (val.length <= 2) { // Max 99 holes
                                                            setCustomHoles(val);
                                                        }
                                                    }}
                                                    placeholder="직접 입력 (예: 9, 27, 4)"
                                                    className="w-full p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl text-lg font-bold focus:outline-none focus:border-blue-500 text-blue-700"
                                                    maxLength={2}
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400 font-bold">홀</span>
                                            </div>
                                            <p className="mt-2 text-[10px] text-stone-400 ml-1 italic">* 18홀이 아닌 경우(9, 27홀 등)에만 켜주세요.</p>
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-stone-50 border border-dashed border-stone-200 rounded-2xl text-center">
                                            <span className="text-stone-400 font-bold text-sm flex items-center justify-center gap-2">
                                                <span className="text-stone-300">⛳️</span> 기본 18홀 라운딩 설정됨
                                            </span>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-bold text-stone-500 mb-1.5 ml-1">
                                                {isRain ? '받은 캐디피' : '캐디피 (원)'}
                                            </label>
                                            <input
                                                type="text"
                                                value={caddyFee ? Number(caddyFee).toLocaleString() : ''}
                                                onChange={(e) => setCaddyFee(e.target.value.replace(/[^0-9]/g, ''))}
                                                placeholder="0"
                                                className={`w-full p-4 bg-white border-2 rounded-2xl text-lg font-bold text-right focus:outline-none transition ${isRain ? 'border-blue-300 focus:border-blue-500 text-blue-600' : 'border-stone-200 focus:border-emerald-500'}`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-stone-500 mb-1.5 ml-1">오버피 (원)</label>
                                            <input
                                                type="text"
                                                value={overFee ? Number(overFee).toLocaleString() : ''}
                                                onChange={(e) => setOverFee(e.target.value.replace(/[^0-9]/g, ''))}
                                                placeholder="0"
                                                className="w-full p-4 bg-white border-2 border-stone-200 rounded-2xl text-lg font-bold text-right text-emerald-600 focus:border-emerald-500 focus:outline-none transition"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="px-6 bg-stone-200 text-stone-500 text-lg font-bold rounded-2xl hover:bg-stone-300 transition"
                                >
                                    취소
                                </button>

                                {editingId && (
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(editingId)}
                                        className="px-4 flex items-center justify-center bg-red-100 text-red-600 font-bold rounded-2xl hover:bg-red-200 transition"
                                    >
                                        <Trash2 size={20} className="mr-1" /> 삭제
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className="flex-1 bg-stone-900 text-white text-lg font-bold py-4 rounded-2xl shadow-xl hover:bg-stone-800 transition active:scale-[0.98]"
                                >
                                    {editingId ? '수정 완료' : '등록하기'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )
            }

        </div >
    );
}

export default function SchedulePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ScheduleContent />
        </Suspense>
    );
}
