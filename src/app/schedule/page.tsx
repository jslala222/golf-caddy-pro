
'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppStore, type ScheduleType, type Schedule } from '@/lib/store';
import { Calendar } from '@/components/Calendar';
import { Calendar as CalendarIcon, Clock, Plus, Trash2, X, Edit, ArrowLeft, MoreHorizontal, Search, User } from 'lucide-react';
import { useCaddyStore } from '@/store/useCaddyStore';
import { findCaddyTurn } from '@/lib/caddyLogic';
import { clsx } from 'clsx';
import { todayKST } from '@/lib/utils';

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
    const [date, setDate] = useState(dateParam || todayKST());
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
    const [isSwap, setIsSwap] = useState(false);
    const [swapWith, setSwapWith] = useState('');

    // Transaction State
    const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseMemo, setExpenseMemo] = useState('');
    const [expenseCategory, setExpenseCategory] = useState<'food' | 'transport' | 'gear' | 'other'>('food');

    // Caddy Logic State
    const { holidays, reserves, caddyMembers } = useCaddyStore();
    const [searchName, setSearchName] = useState('');
    const [startTime, setStartTime] = useState('06:00');
    const [myResult, setMyResult] = useState<any>(null);
    const [isSearching, setIsSearching] = useState(false);

    // 이전 날짜 휴무 차단 알림 모달
    const [showPastDateAlert, setShowPastDateAlert] = useState(false);

    // Helpers
    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')); // 00 ~ 23
    const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')); // 00 ~ 59

    // dateParam(URL) 변경 시 date 상태 동기화 (소프트 네비게이션 대응)
    // dateParam 없으면 오늘 날짜로 URL 자동 설정 (내부IP/localhost 공통 동작)
    useEffect(() => {
        if (dateParam) {
            setDate(dateParam);
        } else {
            const today = todayKST();
            router.replace(`/schedule?date=${today}`);
        }
    }, [dateParam]);

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
        setIsSwap(false);
        setSwapWith('');
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
            setIsSwap(!!schedule.swapWith);
            setSwapWith(schedule.swapWith || '');
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
            swapWith: type === 'work' && isSwap && swapWith.trim() ? swapWith.trim() : undefined,
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

            {/* 이전 날짜 휴무 차단 모달 */}
            {showPastDateAlert && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-6">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl">
                        <div className="text-center mb-4">
                            <div className="text-5xl mb-3">🗓️</div>
                            <p className="font-black text-stone-800 text-lg">날짜 확인</p>
                        </div>
                        <p className="text-stone-500 text-center text-sm leading-relaxed mb-6">
                            휴무는 현재날짜 이전은<br />활성되지 않습니다.
                        </p>
                        <button
                            onClick={() => setShowPastDateAlert(false)}
                            className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-base active:scale-95 transition"
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}

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

            {/* My Turn Checker - 미구현으로 임시 숨김 */}
            {false && (
            <div className="mb-6 bg-emerald-600 text-white rounded-3xl p-5 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                    <Search className="w-5 h-5 text-emerald-200" />
                    <h3 className="font-bold">오늘의 내 순번 확인</h3>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="block text-[10px] text-emerald-200 mb-1 ml-1 font-bold">내 이름</label>
                            <input
                                type="text"
                                value={searchName}
                                onChange={(e) => setSearchName(e.target.value)}
                                placeholder="이름 입력"
                                className="w-full p-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder:text-white/50 font-bold outline-none focus:bg-white/30"
                            />
                        </div>
                        <div className="w-24">
                            <label className="block text-[10px] text-emerald-200 mb-1 ml-1 font-bold">첫 팀 시간</label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full p-3 rounded-xl bg-white/20 border border-white/30 text-white font-bold outline-none focus:bg-white/30"
                            />
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            const dateStr = date;
                            const res = findCaddyTurn(
                                searchName,
                                caddyMembers,
                                holidays[dateStr] || [],
                                reserves[dateStr] || [],
                                startTime
                            );
                            setMyResult(res);
                            setIsSearching(true);
                        }}
                        className="w-full py-4 bg-white text-emerald-600 rounded-2xl font-black shadow-md active:scale-95 transition"
                    >
                        실시간 순번/시간 계산하기
                    </button>
                </div>

                {isSearching && (
                    <div className="mt-4 p-4 bg-white/10 rounded-2xl animate-in fade-in slide-in-from-top-2">
                        {myResult ? (
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xs text-emerald-200 mb-1">예상 순번 & 시간</p>
                                    <p className="text-xl font-black">
                                        {myResult.sequence}번 <span className="text-sm font-normal text-white/70 ml-1">({myResult.course}코스)</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-emerald-200 mb-1">티오프</p>
                                    <p className="text-3xl font-black font-mono">{myResult.time}</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-sm font-bold py-2">
                                😅 명단에 없거나 오늘은 휴무이신 것 같네요.
                            </p>
                        )}
                    </div>
                )}
            </div>
            )}

            {/* Inline Detail / Edit Section */}
            {/* Always show this section if a date is selected, or maybe just show placeholder if not? */}
            {/* User said "When clicking date, show info below". */}
            {/* So I will conditionally render this only if `dateParam` exists (or `date` is set via interaction). */}
            {/* To preserve the "clean calendar" look, I'll only show it when selected. */}

            {(date || viewMode === 'form') && (
                <div id="daily-schedule-section" className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 animate-in slide-in-from-top-4">

                    {/* Header */}
                    <div className="flex justify-between items-center mb-6 border-b border-stone-100 pb-4">
                        {viewMode === 'form' ? (
                            <div className="flex items-center gap-3">
                                <button onClick={() => setViewMode('list')} className="text-stone-500 flex items-center font-bold">
                                    <ArrowLeft size={24} className="mr-1" /> 목록으로
                                </button>
                                <span className="text-lg font-black text-stone-800">
                                    {date.split('-')[1]}월 {date.split('-')[2]}일
                                </span>
                            </div>
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
                            {/* Holiday Toggle Card */}
                            <div className={clsx(
                                "p-5 rounded-2xl border-2 transition-all flex justify-between items-center mb-6",
                                activeDateSchedules.some(s => s.type === 'holiday')
                                    ? "bg-blue-50 border-blue-500 shadow-md"
                                    : "bg-stone-50 border-stone-100"
                            )}>
                                <div className="flex items-center gap-3">
                                    <div className={clsx(
                                        "w-12 h-12 rounded-full flex items-center justify-center text-2xl",
                                        activeDateSchedules.some(s => s.type === 'holiday') ? "bg-blue-500 text-white" : "bg-stone-200 text-stone-400"
                                    )}>
                                        🌴
                                    </div>
                                    <div>
                                        <p className={clsx("font-black", activeDateSchedules.some(s => s.type === 'holiday') ? "text-blue-700" : "text-stone-500")}>
                                            오늘 휴무하기
                                        </p>
                                        <p className="text-xs text-stone-400">체크하면 달력에 파란 테두리가 생겨요</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const today = todayKST();
                                        if (date < today) {
                                            setShowPastDateAlert(true);
                                            return;
                                        }
                                        const holidayEntry = activeDateSchedules.find(s => s.type === 'holiday');
                                        if (holidayEntry) {
                                            deleteSchedule(holidayEntry.id);
                                        } else {
                                            // Delete all WORK entries first as requested "근무는 못하지만"
                                            const workEntries = activeDateSchedules.filter(s => s.type === 'work');
                                            workEntries.forEach(w => deleteSchedule(w.id));

                                            // Add holiday entry
                                            addSchedule({
                                                date,
                                                time: "00:00",
                                                title: "휴무",
                                                type: "holiday"
                                            });
                                        }
                                    }}
                                    className={clsx(
                                        "w-14 h-8 rounded-full relative transition-colors duration-300",
                                        activeDateSchedules.some(s => s.type === 'holiday') ? "bg-blue-500" : "bg-stone-300"
                                    )}
                                >
                                    <div className={clsx(
                                        "absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-sm",
                                        activeDateSchedules.some(s => s.type === 'holiday') ? "translate-x-7" : "translate-x-1"
                                    )}></div>
                                </button>
                            </div>
                            {/* Schedule List */}
                            {activeDateSchedules.filter(s => s.type !== 'holiday').length === 0 ? (
                                <div className="py-6 text-center text-stone-400 border-b border-dashed border-stone-100 pb-6">
                                    <p className="mb-2">📅 약속이 없습니다.</p>
                                    <p className="text-sm">개인 일정이나 메모를 등록해보세요!</p>
                                </div>
                            ) : (
                                activeDateSchedules.filter(s => s.type !== 'holiday').map(schedule => (
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
                                         ${schedule.type === 'work' ? 'bg-stone-100 text-stone-600' :
                                                        schedule.type === 'holiday' ? 'bg-orange-100 text-orange-700' : 'bg-orange-50 text-orange-600'}`}>
                                                    {schedule.type === 'work' ? `${schedule.shift || '?'}부 · ${schedule.holes || 18}홀` :
                                                        schedule.type === 'holiday' ? '휴무' : '개인'}
                                                </span>
                                                {/* 쌈(9홀) 뱃지 */}
                                                {schedule.type === 'work' && (schedule.holes || 18) <= 9 && (
                                                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0 bg-green-100 text-green-700">
                                                        🟢 쌈
                                                    </span>
                                                )}
                                                {/* 36홀/54홀 뱃지 */}
                                                {schedule.type === 'work' && (schedule.holes || 18) >= 36 && (
                                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0 ${(schedule.holes || 18) >= 54 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                                                        {(schedule.holes || 18) >= 54 ? '🔴 54H' : '🟡 36H'}
                                                    </span>
                                                )}
                                                {/* 대기바꿈 뱃지 */}
                                                {schedule.swapWith && (
                                                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0 bg-purple-100 text-purple-700">
                                                        🔄 {schedule.swapWith}
                                                    </span>
                                                )}
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

                            {/* Add New Schedule Button - Hide Work if Holiday ON */}
                            {(!activeDateSchedules.some(s => s.type === 'holiday') && activeDateSchedules.filter(s => s.type === 'work').length < 3) && (
                                <button
                                    onClick={handleAddNewClick}
                                    className="w-full py-4 border-2 border-dashed border-emerald-300 text-emerald-600 rounded-2xl font-bold flex items-center justify-center hover:bg-emerald-50 transition"
                                >
                                    <Plus size={24} className="mr-2" /> 일정 추가
                                </button>
                            )}

                            {/* Allow Personal entry even if Holiday is ON */}
                            {(activeDateSchedules.some(s => s.type === 'holiday')) && (
                                <button
                                    onClick={() => {
                                        resetForm();
                                        setType('personal');
                                        setViewMode('form');
                                    }}
                                    className="w-full py-4 border-2 border-dashed border-orange-300 text-orange-600 rounded-2xl font-bold flex items-center justify-center hover:bg-orange-50 transition"
                                >
                                    <Plus size={24} className="mr-2" /> 개인 약속/메모 추가
                                </button>
                            )}

                            {/* Daily Expense Section */}
                            <div className="mt-8 pt-6 border-t border-stone-100">
                                <h3 className="text-sm font-bold text-stone-500 mb-3 flex items-center justify-between">
                                    <span>💸 오늘의 지출</span>
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
                                                className="flex-1 p-4 bg-white border-2 border-stone-200 rounded-2xl font-bold focus:outline-none focus:border-stone-400 transition-all"
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
                            {/* Type Toggle — 편집 시 type 변경 불가 */}
                            {editingId ? (
                                <div className="flex items-center justify-center gap-2 bg-stone-50 border border-stone-200 p-3 rounded-2xl">
                                    <span className="text-sm font-bold text-stone-500">
                                        {type === 'work' ? '⛳️ 근무' : type === 'personal' ? '📅 개인' : '🏖️ 휴무'}
                                    </span>
                                    <span className="text-[10px] bg-stone-200 text-stone-500 px-2 py-0.5 rounded-full">편집 중 (유형 변경 불가)</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-2xl">
                                    <button
                                        type="button"
                                        onClick={() => setType('work')}
                                        disabled={activeDateSchedules.some(s => s.type === 'holiday')}
                                        className={`py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-1 ${type === 'work' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-400'} ${activeDateSchedules.some(s => s.type === 'holiday') ? 'opacity-50 grayscale' : ''}`}
                                    >
                                        ⛳️ 근무
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setType('personal')}
                                        className={`py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-1 ${type === 'personal' ? 'bg-white text-orange-500 shadow-sm' : 'text-stone-400'}`}
                                    >
                                        📅 개인
                                    </button>
                                </div>
                            )}
                            {!editingId && activeDateSchedules.some(s => s.type === 'holiday') && (
                                <p className="text-[10px] text-blue-600 text-center font-bold">💡 휴무일에는 개인 일정만 추가할 수 있습니다.</p>
                            )}

                            {/* Date Logic for UI */}
                            {(() => {
                                const todayStr = todayKST();
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

                            {/* Custom Time Selector - Hide for Holiday */}
                            {type !== 'holiday' && (
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
                            )}

                            <div>
                                <label className="block text-sm font-bold text-stone-500 mb-1.5 ml-1">내용 / 메모</label>
                                <textarea
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={type === 'work' ? "코스, 특이사항 등 (선택)" : type === 'holiday' ? "휴무 사유 (선택)" : "일정 내용 입력"}
                                    rows={1}
                                    className="w-full p-4 bg-stone-50 border-none rounded-2xl text-lg font-medium focus:ring-2 focus:ring-emerald-500 placeholder:text-stone-300 transition resize-none"
                                />
                            </div>

                            {/* Hole Selection (Only for Work) - Simplified: Only show toggle if not 18 holes */}
                            {type === 'work' && (
                                <div className="space-y-4 pt-2">
                                    {(() => {
                                        const todayStr = todayKST();
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
                                                    홀수/우천 정산 {isRain ? 'ON' : 'OFF'}
                                                </button>
                                            </div>
                                        );
                                    })()}

                                    {isRain && (
                                        <div className="animate-in slide-in-from-top-2">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={customHoles}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                                        if (val.length <= 2) {
                                                            setCustomHoles(val);
                                                        }
                                                    }}
                                                    placeholder="직접 입력 (예: 9, 27)"
                                                    className="w-full p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl text-lg font-bold focus:outline-none focus:border-blue-500 text-blue-700"
                                                    maxLength={2}
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400 font-bold">홀</span>
                                            </div>
                                            <p className="mt-2 text-[10px] text-stone-400 ml-1 italic">* 18홀이 아닌 경우(9, 27홀 등)에만 켜주세요.</p>
                                        </div>
                                    )}

                                    {/* 대기바꿈 입력 */}
                                    <div className="flex justify-between items-center px-1">
                                        <label className="text-sm font-bold text-stone-500">대기바꿈</label>
                                        <button
                                            type="button"
                                            onClick={() => { setIsSwap(!isSwap); if (isSwap) setSwapWith(''); }}
                                            className={`text-[11px] px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 ${isSwap ? 'bg-purple-50 border-purple-200 text-purple-600 font-bold' : 'bg-white border-stone-200 text-stone-400'}`}
                                        >
                                            🔄 대기바꿈 {isSwap ? 'ON' : 'OFF'}
                                        </button>
                                    </div>
                                    {isSwap && (
                                        <div className="animate-in slide-in-from-top-2">
                                            <input
                                                type="text"
                                                value={swapWith}
                                                onChange={(e) => setSwapWith(e.target.value)}
                                                placeholder="누구와 바꿨나요? (이름)"
                                                className="w-full p-4 bg-purple-50 border-2 border-purple-200 rounded-2xl text-lg font-bold focus:outline-none focus:border-purple-400 text-purple-700 placeholder:text-purple-300"
                                            />
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
