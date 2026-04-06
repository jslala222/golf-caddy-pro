'use client';

import { useState, useMemo, Suspense } from 'react';
import { useAppStore } from '@/lib/store';
import { ArrowLeft, RefreshCw, Plus, Pencil, Trash2, Check, Search, X } from 'lucide-react';
import Link from 'next/link';
import { todayKST } from '@/lib/utils';

function formatKRW(raw: string): string {
    const num = raw.replace(/[^0-9]/g, '');
    return num ? parseInt(num).toLocaleString('ko-KR') : '';
}
function parseKRW(formatted: string): number {
    return parseInt(formatted.replace(/[^0-9]/g, '') || '0', 10);
}

function ChangeContent() {
    const { schedules, updateSchedule, addSchedule, addTransaction } = useAppStore();

    // 검색
    const [searchText, setSearchText] = useState('');

    // 연도/월 필터
    const [filterYear, setFilterYear] = useState<string>('all');
    const [filterMonth, setFilterMonth] = useState<string>('all');

    // 인라인 수정
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editMemo, setEditMemo] = useState('');

    // 감사 표시 편집
    const [editingThanks, setEditingThanks] = useState<string | null>(null);
    const [thanksText, setThanksText] = useState('');
    const [thanksAmountRaw, setThanksAmountRaw] = useState('');
    const [thanksDate, setThanksDate] = useState('');

    // 지출 확인 팝업
    const [expenseConfirm, setExpenseConfirm] = useState<{ id: string; name: string } | null>(null);

    // 가계부 추가 완료 토스트
    const [toast, setToast] = useState<string | null>(null);
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    // 신규 추가 폼
    const [showAddForm, setShowAddForm] = useState(false);
    const [addDate, setAddDate] = useState('');
    const [addShift, setAddShift] = useState<'1' | '2' | '3'>('1');
    const [addName, setAddName] = useState('');
    const [addMemo, setAddMemo] = useState('');

    const allSwapRecords = useMemo(() =>
        schedules.filter(s => s.type === 'work' && s.swapWith).sort((a, b) => b.date.localeCompare(a.date)),
        [schedules]
    );

    const years = useMemo(() => {
        const set = new Set(allSwapRecords.map(s => s.date.slice(0, 4)));
        set.add(new Date().getFullYear().toString());
        return Array.from(set).sort((a, b) => b.localeCompare(a));
    }, [allSwapRecords]);

    const months = useMemo(() => {
        const base = filterYear === 'all' ? allSwapRecords : allSwapRecords.filter(s => s.date.startsWith(filterYear));
        const set = new Set(base.map(s => s.date.slice(5, 7)));
        return Array.from(set).sort((a, b) => b.localeCompare(a));
    }, [allSwapRecords, filterYear]);

    const swapRecords = useMemo(() => {
        if (searchText.trim()) {
            const q = searchText.trim();
            return allSwapRecords.filter(s =>
                s.swapWith?.includes(q) || s.swapMemo?.includes(q) || s.swapThanks?.includes(q)
            );
        }
        let r = allSwapRecords;
        if (filterYear !== 'all') r = r.filter(s => s.date.startsWith(filterYear));
        if (filterMonth !== 'all') r = r.filter(s => s.date.slice(5, 7) === filterMonth);
        return r;
    }, [allSwapRecords, searchText, filterYear, filterMonth]);

    const countByName = useMemo(() => {
        const map: Record<string, number> = {};
        swapRecords.forEach(s => { map[s.swapWith!] = (map[s.swapWith!] || 0) + 1; });
        return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [swapRecords]);

    const filterLabel = searchText.trim()
        ? `"${searchText.trim()}" 검색`
        : filterYear === 'all' ? '전체' : `${filterYear}년${filterMonth !== 'all' ? ` ${parseInt(filterMonth)}월` : ''}`;

    const handleOpenThanks = (s: any) => {
        setEditingThanks(s.id);
        setThanksText(s.swapThanks || '');
        setThanksAmountRaw(s.swapThanksAmount ? s.swapThanksAmount.toLocaleString('ko-KR') : '');
        setThanksDate(s.swapThanksDate || todayKST());
        setEditingId(null);
    };

    const handleSaveThanks = (id: string, swapWithName: string) => {
        const amount = parseKRW(thanksAmountRaw);
        updateSchedule(id, {
            swapThanks: thanksText.trim() || undefined,
            swapThanksAmount: amount || undefined,
            swapThanksDate: thanksDate || undefined,
        });
        setEditingThanks(null);
        const cur = schedules.find(x => x.id === id);
        if (amount > 0 && !cur?.swapThanksAddedToLedger) setExpenseConfirm({ id, name: swapWithName });
    };

    const handleAddExpense = (scheduleId: string) => {
        const s = schedules.find(x => x.id === scheduleId);
        if (!s) return;
        addTransaction({
            date: s.swapThanksDate || todayKST(),
            type: 'expense',
            amount: s.swapThanksAmount || 0,
            category: 'swap_thanks',
            memo: `대기바꿈 감사 — ${s.swapWith}${s.swapThanks ? ` (${s.swapThanks})` : ''}`,
        });
        updateSchedule(scheduleId, { swapThanksAddedToLedger: true });
        setExpenseConfirm(null);
        showToast('✅ 가계부에 추가되었습니다');
    };

    const handleEdit = (s: any) => {
        setEditingId(s.id);
        setEditName(s.swapWith || '');
        setEditMemo(s.swapMemo || '');
        setEditingThanks(null);
    };

    const handleSaveEdit = (id: string) => {
        if (!editName.trim()) return;
        updateSchedule(id, { swapWith: editName.trim(), swapMemo: editMemo.trim() || undefined });
        setEditingId(null);
    };

    const handleDelete = (id: string) => {
        if (!confirm('대기바꿈 기록을 삭제하시겠습니까?\n(근무 기록은 유지됩니다)')) return;
        updateSchedule(id, { swapWith: '', swapMemo: undefined, swapThanks: undefined, swapThanksAmount: undefined, swapThanksDate: undefined });
    };

    const handleAdd = () => {
        if (!addDate || !addName.trim()) return;
        const existing = schedules.find(s => s.date === addDate && s.type === 'work' && s.shift === addShift);
        if (existing) {
            updateSchedule(existing.id, { swapWith: addName.trim(), swapMemo: addMemo.trim() || undefined });
        } else {
            addSchedule({ date: addDate, time: '00:00', title: '', type: 'work', shift: addShift, swapWith: addName.trim(), swapMemo: addMemo.trim() || undefined });
        }
        setShowAddForm(false);
        setAddDate(''); setAddShift('1'); setAddName(''); setAddMemo('');
    };

    // 대기바꿈 감사비용 요약 (filterYear/filterMonth 연동)
    const thisYear = new Date().getFullYear().toString();
    const thisMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const summaryYear = filterYear === 'all' ? thisYear : filterYear;
    const summaryMonth = filterMonth === 'all' ? thisMonth : filterMonth;
    const summaryMonthLabel = filterMonth === 'all' ? '이번 달' : `${parseInt(summaryMonth)}월`;
    const summaryYearLabel = `${summaryYear}년`;
    const totalSummaryMonth = allSwapRecords.filter(s => s.swapThanksDate?.startsWith(`${summaryYear}-${summaryMonth}`)).reduce((sum, s) => sum + (s.swapThanksAmount || 0), 0);
    const totalSummaryYear = allSwapRecords.filter(s => s.swapThanksDate?.startsWith(summaryYear)).reduce((sum, s) => sum + (s.swapThanksAmount || 0), 0);
    const totalAll = allSwapRecords.reduce((sum, s) => sum + (s.swapThanksAmount || 0), 0);

    return (
        <div className="p-6 pb-24 min-h-screen">
            {/* 토스트 */}
            {toast && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-stone-900 text-white px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl animate-in fade-in slide-in-from-top-2">
                    {toast}
                </div>
            )}
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <Link href="/schedule" className="p-2 bg-stone-100 rounded-full text-stone-500 hover:text-stone-700">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black text-stone-900 flex items-center gap-2">
                            <RefreshCw size={22} className="text-purple-500" /> 대기바꿈
                        </h1>
                        <p className="text-xs text-stone-400 mt-0.5">전체 {allSwapRecords.length}건</p>
                    </div>
                </div>
                <button
                    onClick={() => { setShowAddForm(!showAddForm); setSearchText(''); }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm transition ${showAddForm ? 'bg-stone-200 text-stone-600' : 'bg-purple-600 text-white shadow-md'}`}
                >
                    <Plus size={16} /> 추가
                </button>
            </div>

            {/* 검색창 */}
            {allSwapRecords.length > 0 && (
                <div className="relative mb-5">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                        type="text"
                        value={searchText}
                        onChange={e => { setSearchText(e.target.value); setShowAddForm(false); }}
                        placeholder="이름으로 검색 (예: 김경숙)"
                        className="w-full pl-10 pr-10 py-3 bg-white border-2 border-stone-200 rounded-2xl text-sm font-medium focus:outline-none focus:border-purple-400 text-stone-700 placeholder:text-stone-300"
                    />
                    {searchText && (
                        <button onClick={() => setSearchText('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                            <X size={16} />
                        </button>
                    )}
                </div>
            )}

            {/* 감사비용 요약카드 */}
            {totalAll > 0 && (
                <div className="bg-gradient-to-r from-purple-50 to-amber-50 border border-purple-100 rounded-3xl p-4 mb-5">
                    <p className="text-xs font-bold text-stone-400 mb-2">🔄 대기바꿈 감사비용 현황</p>
                    <div className="flex gap-4">
                        <div className="flex-1 text-center">
                            <p className="text-[10px] text-stone-400">{summaryMonthLabel}</p>
                            <p className="text-base font-black text-purple-700">{totalSummaryMonth > 0 ? totalSummaryMonth.toLocaleString('ko-KR') + '원' : '—'}</p>
                        </div>
                        <div className="w-px bg-stone-200" />
                        <div className="flex-1 text-center">
                            <p className="text-[10px] text-stone-400">{summaryYearLabel}</p>
                            <p className="text-base font-black text-purple-700">{totalSummaryYear > 0 ? totalSummaryYear.toLocaleString('ko-KR') + '원' : '—'}</p>
                        </div>
                        <div className="w-px bg-stone-200" />
                        <div className="flex-1 text-center">
                            <p className="text-[10px] text-stone-400">누적 전체</p>
                            <p className="text-base font-black text-amber-600">{totalAll.toLocaleString('ko-KR')}원</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 신규 추가 폼 */}
            {showAddForm && (
                <div className="bg-purple-50 border-2 border-purple-200 rounded-3xl p-5 mb-5">
                    <p className="text-sm font-black text-purple-700 mb-4">🔄 새 대기바꿈 기록 추가</p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                            <label className="text-xs font-bold text-stone-500 mb-1 block">날짜</label>
                            <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)}
                                className="w-full p-3 bg-white border-2 border-purple-200 rounded-xl text-sm font-bold focus:outline-none focus:border-purple-400" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-stone-500 mb-1 block">부</label>
                            <select value={addShift} onChange={e => setAddShift(e.target.value as '1' | '2' | '3')}
                                className="w-full p-3 bg-white border-2 border-purple-200 rounded-xl text-sm font-bold focus:outline-none focus:border-purple-400">
                                <option value="1">1부</option>
                                <option value="2">2부</option>
                                <option value="3">3부</option>
                            </select>
                        </div>
                    </div>
                    <div className="space-y-2 mb-3">
                        <input type="text" value={addName} onChange={e => setAddName(e.target.value)}
                            placeholder="누구와 바꿨나요? (이름) *" maxLength={15}
                            className="w-full p-3 bg-white border-2 border-purple-200 rounded-xl text-sm font-bold focus:outline-none focus:border-purple-500 text-purple-700 placeholder:text-purple-200" />
                        <input type="text" value={addMemo} onChange={e => setAddMemo(e.target.value)}
                            placeholder="메모 (예: 1시로 바꿈) — 선택" maxLength={30}
                            className="w-full p-3 bg-white border-2 border-stone-200 rounded-xl text-sm font-medium focus:outline-none focus:border-purple-300 text-stone-600 placeholder:text-stone-300" />
                    </div>
                    <p className="text-[10px] text-stone-400 mb-3">* 해당 날짜+부에 이미 근무가 있으면 그 근무에 추가됩니다.</p>
                    <div className="flex gap-2">
                        <button onClick={handleAdd} disabled={!addDate || !addName.trim()}
                            className="flex-1 py-3 bg-purple-600 text-white font-black rounded-2xl text-sm disabled:opacity-40">
                            등록하기
                        </button>
                        <button onClick={() => setShowAddForm(false)} className="px-5 py-3 bg-white text-stone-500 font-bold rounded-2xl text-sm border border-stone-200">취소</button>
                    </div>
                </div>
            )}

            {allSwapRecords.length === 0 && !showAddForm ? (
                <div className="text-center py-24 text-stone-300">
                    <RefreshCw size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="font-bold">대기바꿈 기록이 없습니다.</p>
                    <p className="text-sm mt-1">위 + 추가 버튼으로 기록할 수 있습니다.</p>
                </div>
            ) : allSwapRecords.length > 0 && !showAddForm && (
                <>
                    {/* 이름별 통계 — 터치 시 검색 */}
                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-purple-100 mb-5">
                        <p className="text-xs font-bold text-stone-400 mb-3">{filterLabel} — 총 {swapRecords.length}건</p>
                        {countByName.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {countByName.map(([name, count]) => (
                                    <button key={name} onClick={() => setSearchText(name)}
                                        className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-full hover:bg-purple-100 transition">
                                        <span className="font-black text-purple-700 text-sm">{name}</span>
                                        <span className="text-xs font-bold text-purple-400 bg-white px-1.5 py-0.5 rounded-full">{count}회</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-stone-300 text-sm">{searchText ? '검색 결과 없음' : '기록 없음'}</p>
                        )}
                    </div>

                    {/* 필터 (검색 중엔 숨김) */}
                    {!searchText && (
                        <>
                            <div className="flex gap-2 overflow-x-auto pb-1 mb-2 scrollbar-hide">
                                <button onClick={() => { setFilterYear('all'); setFilterMonth('all'); }}
                                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition ${filterYear === 'all' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500'}`}>
                                    전체
                                </button>
                                {years.map(y => (
                                    <button key={y} onClick={() => { setFilterYear(y); setFilterMonth('all'); }}
                                        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition ${filterYear === y ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500'}`}>
                                        {y}년
                                    </button>
                                ))}
                            </div>
                            {filterYear !== 'all' && months.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-hide">
                                    <button onClick={() => setFilterMonth('all')}
                                        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition ${filterMonth === 'all' ? 'bg-purple-600 text-white' : 'bg-stone-100 text-stone-500'}`}>
                                        전체
                                    </button>
                                    {months.map(m => (
                                        <button key={m} onClick={() => setFilterMonth(m)}
                                            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition ${filterMonth === m ? 'bg-purple-600 text-white' : 'bg-stone-100 text-stone-500'}`}>
                                            {parseInt(m)}월
                                        </button>
                                    ))}
                                </div>
                            )}
                            {(filterYear === 'all' || months.length === 0) && <div className="mb-5" />}
                        </>
                    )}
                    {searchText && <div className="mb-3" />}

                    {/* 목록 */}
                    <div className="space-y-3">
                        {swapRecords.length === 0 ? (
                            <div className="text-center py-10 text-stone-300 text-sm">
                                {searchText ? `"${searchText}"에 해당하는 기록이 없습니다.` : '해당 기간 기록 없음'}
                            </div>
                        ) : swapRecords.map(s => (
                            <div key={s.id} className={`bg-white rounded-3xl p-5 shadow-sm border transition ${editingId === s.id ? 'border-purple-300' : editingThanks === s.id ? 'border-amber-200' : 'border-stone-100'}`}>
                                {editingId === s.id ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-stone-500 font-mono">{s.date.slice(5).replace('-', '/')}</span>
                                            <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{s.shift}부</span>
                                            <span className="text-xs text-purple-400 font-bold">수정 중</span>
                                        </div>
                                        <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                                            placeholder="이름 *" maxLength={15} autoFocus
                                            className="w-full p-3 bg-purple-50 border-2 border-purple-300 rounded-xl text-sm font-bold focus:outline-none text-purple-700" />
                                        <input type="text" value={editMemo} onChange={e => setEditMemo(e.target.value)}
                                            placeholder="메모 (선택)" maxLength={30}
                                            className="w-full p-3 bg-stone-50 border-2 border-stone-200 rounded-xl text-sm font-medium focus:outline-none text-stone-600" />
                                        <div className="flex gap-2">
                                            <button onClick={() => handleSaveEdit(s.id)} disabled={!editName.trim()}
                                                className="flex-1 py-3 bg-purple-600 text-white font-black rounded-2xl text-sm flex items-center justify-center gap-1 disabled:opacity-40">
                                                <Check size={16} /> 저장
                                            </button>
                                            <button onClick={() => setEditingId(null)} className="px-5 py-3 bg-stone-100 text-stone-500 font-bold rounded-2xl text-sm">취소</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-base font-black text-stone-700 font-mono">
                                                    {s.date.slice(2, 4)}년 {s.date.slice(5).replace('-', '/')}
                                                </span>
                                                <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{s.shift}부</span>
                                                {s.holes && s.holes >= 36 && (
                                                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">{s.holes}H</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm font-black text-purple-600 bg-purple-50 border border-purple-200 px-3 py-1 rounded-full">
                                                    🔄 {s.swapWith}
                                                </span>
                                                <button onClick={() => handleEdit(s)} className="p-1.5 bg-stone-100 rounded-lg text-stone-400 hover:text-purple-600 hover:bg-purple-50 transition">
                                                    <Pencil size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(s.id)} className="p-1.5 bg-stone-100 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {s.swapMemo && (
                                            <div className="flex items-start gap-2 bg-purple-50 rounded-xl p-3 mb-3">
                                                <span className="text-sm">📝</span>
                                                <span className="text-sm text-stone-600 font-medium">{s.swapMemo}</span>
                                            </div>
                                        )}

                                        {/* 감사 표시 */}
                                        <div className="mt-2">
                                            {editingThanks === s.id ? (
                                                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 space-y-3">
                                                    <p className="text-xs font-black text-amber-700">🙏 감사 표시 기록</p>
                                                    <input type="text" value={thanksText} onChange={e => setThanksText(e.target.value)}
                                                        placeholder="예: 치킨쿠폰, 커피, 밥 한 끼" maxLength={30} autoFocus
                                                        className="w-full p-3 bg-white border-2 border-amber-200 rounded-xl text-sm font-medium focus:outline-none focus:border-amber-400 text-stone-700" />
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={thanksAmountRaw}
                                                            onChange={e => setThanksAmountRaw(formatKRW(e.target.value))}
                                                            placeholder="금액 (없으면 빈칸) — 선택"
                                                            className="w-full p-3 pr-10 bg-white border-2 border-amber-200 rounded-xl text-sm font-bold focus:outline-none focus:border-amber-400 text-stone-700"
                                                        />
                                                        {thanksAmountRaw && (
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-500">원</span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-stone-500 mb-1 block">감사한 날짜</label>
                                                        <input type="date" value={thanksDate} onChange={e => setThanksDate(e.target.value)}
                                                            className="w-full p-3 bg-white border-2 border-amber-200 rounded-xl text-sm font-bold focus:outline-none focus:border-amber-400" />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleSaveThanks(s.id, s.swapWith || '')}
                                                            className="flex-1 py-3 bg-amber-400 text-white font-black rounded-2xl text-sm flex items-center justify-center gap-1">
                                                            <Check size={16} /> 저장
                                                        </button>
                                                        <button onClick={() => setEditingThanks(null)} className="px-5 py-3 bg-white text-stone-500 font-bold rounded-2xl text-sm border border-stone-200">취소</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button type="button" onClick={() => handleOpenThanks(s)}
                                                    className={`w-full text-left p-3 rounded-xl border-2 border-dashed text-sm font-medium transition ${s.swapThanks ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-stone-50 border-stone-200 text-stone-400 hover:border-amber-200 hover:bg-amber-50'}`}>
                                                    {s.swapThanks ? (
                                                        <div className="flex items-center justify-between">
                                                            <span>🙏 {s.swapThanks}</span>
                                                            <div className="flex items-center gap-2 text-xs font-bold">
                                                                {s.swapThanksAmount ? <span className="text-amber-500">{s.swapThanksAmount.toLocaleString('ko-KR')}원</span> : null}
                                                                {s.swapThanksDate ? <span className="text-amber-400">{s.swapThanksDate.slice(5).replace('-', '/')}</span> : null}
                                                                {s.swapThanksAddedToLedger && <span className="bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full text-[10px]">가계부✓</span>}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span>+ 감사 표시 기록</span>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* 지출 저장 확인 팝업 */}
            {expenseConfirm && (() => {
                const s = schedules.find(x => x.id === expenseConfirm.id);
                if (!s) return null;
                return (
                    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
                            <p className="text-lg font-black text-stone-900 mb-2">💸 가계부에 지출 추가?</p>
                            <p className="text-sm text-stone-500 mb-1">
                                <span className="font-bold text-amber-600">{(s.swapThanksAmount || 0).toLocaleString('ko-KR')}원</span>
                                {' · '}{(s.swapThanksDate || todayKST()).slice(5).replace('-', '/')}{' · '}{expenseConfirm.name}
                            </p>
                            <p className="text-xs text-stone-400 mb-5">가계부 지출로 기록하면 월별/연간 통계에 반영됩니다.</p>
                            <div className="flex gap-2">
                                <button onClick={() => handleAddExpense(expenseConfirm.id)}
                                    className="flex-1 py-3 bg-emerald-600 text-white font-black rounded-2xl text-sm">
                                    가계부에 추가
                                </button>
                                <button onClick={() => setExpenseConfirm(null)}
                                    className="px-5 py-3 bg-stone-100 text-stone-500 font-bold rounded-2xl text-sm">
                                    메모만
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

export default function ChangePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ChangeContent />
        </Suspense>
    );
}

