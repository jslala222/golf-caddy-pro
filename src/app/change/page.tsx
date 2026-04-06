'use client';

import { useState, useMemo, Suspense } from 'react';
import { useAppStore } from '@/lib/store';
import { ArrowLeft, RefreshCw, Plus, Pencil, Trash2, Check } from 'lucide-react';
import Link from 'next/link';

function ChangeContent() {
    const { schedules, updateSchedule, addSchedule } = useAppStore();

    // 연도/월 필터
    const [filterYear, setFilterYear] = useState<string>('all');
    const [filterMonth, setFilterMonth] = useState<string>('all');

    // 인라인 수정 상태
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editMemo, setEditMemo] = useState('');

    // 감사 메모 편집
    const [editingThanks, setEditingThanks] = useState<string | null>(null);
    const [thanksInput, setThanksInput] = useState('');

    // 신규 추가 폼
    const [showAddForm, setShowAddForm] = useState(false);
    const [addDate, setAddDate] = useState('');
    const [addShift, setAddShift] = useState<'1' | '2' | '3'>('1');
    const [addName, setAddName] = useState('');
    const [addMemo, setAddMemo] = useState('');

    // 전체 swap 기록
    const allSwapRecords = useMemo(() =>
        schedules
            .filter(s => s.type === 'work' && s.swapWith)
            .sort((a, b) => b.date.localeCompare(a.date)),
        [schedules]
    );

    // 연도 목록 (기록 없어도 현재 연도 포함)
    const years = useMemo(() => {
        const set = new Set(allSwapRecords.map(s => s.date.slice(0, 4)));
        set.add(new Date().getFullYear().toString());
        return Array.from(set).sort((a, b) => b.localeCompare(a));
    }, [allSwapRecords]);

    // 선택된 연도의 월 목록
    const months = useMemo(() => {
        const base = filterYear === 'all' ? allSwapRecords : allSwapRecords.filter(s => s.date.startsWith(filterYear));
        const set = new Set(base.map(s => s.date.slice(5, 7)));
        return Array.from(set).sort((a, b) => b.localeCompare(a));
    }, [allSwapRecords, filterYear]);

    // 필터 최종 적용
    const swapRecords = useMemo(() => {
        let r = allSwapRecords;
        if (filterYear !== 'all') r = r.filter(s => s.date.startsWith(filterYear));
        if (filterMonth !== 'all') r = r.filter(s => s.date.slice(5, 7) === filterMonth);
        return r;
    }, [allSwapRecords, filterYear, filterMonth]);

    // 이름별 집계 (현재 필터 기준)
    const countByName = useMemo(() => {
        const map: Record<string, number> = {};
        swapRecords.forEach(s => { map[s.swapWith!] = (map[s.swapWith!] || 0) + 1; });
        return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [swapRecords]);

    const handleSaveThanks = (id: string) => {
        updateSchedule(id, { swapThanks: thanksInput.trim() || undefined });
        setEditingThanks(null);
        setThanksInput('');
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
        if (!confirm('이 대기바꿈 기록을 삭제하시겠습니까?\n(근무 기록은 유지되고, 대기바꿈 정보만 삭제됩니다)')) return;
        updateSchedule(id, { swapWith: '', swapMemo: undefined, swapThanks: undefined });
    };

    const handleAdd = () => {
        if (!addDate || !addName.trim()) return;
        const existing = schedules.find(s => s.date === addDate && s.type === 'work' && s.shift === addShift);
        if (existing) {
            updateSchedule(existing.id, { swapWith: addName.trim(), swapMemo: addMemo.trim() || undefined });
        } else {
            addSchedule({
                date: addDate,
                time: '00:00',
                title: '',
                type: 'work',
                shift: addShift,
                swapWith: addName.trim(),
                swapMemo: addMemo.trim() || undefined,
            });
        }
        setShowAddForm(false);
        setAddDate(''); setAddShift('1'); setAddName(''); setAddMemo('');
    };

    const filterLabel = filterYear === 'all' ? '전체' : `${filterYear}년${filterMonth !== 'all' ? ` ${parseInt(filterMonth)}월` : ''}`;

    return (
        <div className="p-6 pb-24 min-h-screen">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-6">
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
                    onClick={() => setShowAddForm(!showAddForm)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm transition ${showAddForm ? 'bg-stone-200 text-stone-600' : 'bg-purple-600 text-white shadow-md'}`}
                >
                    <Plus size={16} /> 추가
                </button>
            </div>

            {/* 신규 추가 폼 */}
            {showAddForm && (
                <div className="bg-purple-50 border-2 border-purple-200 rounded-3xl p-5 mb-5 animate-in slide-in-from-top-2">
                    <p className="text-sm font-black text-purple-700 mb-4">🔄 새 대기바꿈 기록 추가</p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                            <label className="text-xs font-bold text-stone-500 mb-1 block">날짜</label>
                            <input
                                type="date"
                                value={addDate}
                                onChange={e => setAddDate(e.target.value)}
                                className="w-full p-3 bg-white border-2 border-purple-200 rounded-xl text-sm font-bold focus:outline-none focus:border-purple-400"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-stone-500 mb-1 block">부</label>
                            <select
                                value={addShift}
                                onChange={e => setAddShift(e.target.value as '1' | '2' | '3')}
                                className="w-full p-3 bg-white border-2 border-purple-200 rounded-xl text-sm font-bold focus:outline-none focus:border-purple-400"
                            >
                                <option value="1">1부</option>
                                <option value="2">2부</option>
                                <option value="3">3부</option>
                            </select>
                        </div>
                    </div>
                    <div className="space-y-2 mb-4">
                        <input
                            type="text"
                            value={addName}
                            onChange={e => setAddName(e.target.value)}
                            placeholder="누구와 바꿨나요? (이름) *"
                            maxLength={15}
                            className="w-full p-3 bg-white border-2 border-purple-200 rounded-xl text-sm font-bold focus:outline-none focus:border-purple-500 text-purple-700 placeholder:text-purple-200"
                        />
                        <input
                            type="text"
                            value={addMemo}
                            onChange={e => setAddMemo(e.target.value)}
                            placeholder="메모 (예: 1시로 바꿈) — 선택"
                            maxLength={30}
                            className="w-full p-3 bg-white border-2 border-stone-200 rounded-xl text-sm font-medium focus:outline-none focus:border-purple-300 text-stone-600 placeholder:text-stone-300"
                        />
                    </div>
                    <p className="text-[10px] text-stone-400 mb-3">* 해당 날짜+부에 이미 근무가 있으면 그 근무에 추가됩니다. 없으면 새로 생성됩니다.</p>
                    <div className="flex gap-2">
                        <button
                            onClick={handleAdd}
                            disabled={!addDate || !addName.trim()}
                            className="flex-1 py-3 bg-purple-600 text-white font-black rounded-2xl text-sm disabled:opacity-40"
                        >
                            등록하기
                        </button>
                        <button onClick={() => setShowAddForm(false)} className="px-5 py-3 bg-white text-stone-500 font-bold rounded-2xl text-sm border border-stone-200">
                            취소
                        </button>
                    </div>
                </div>
            )}

            {allSwapRecords.length === 0 && !showAddForm ? (
                <div className="text-center py-24 text-stone-300">
                    <RefreshCw size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="font-bold">대기바꿈 기록이 없습니다.</p>
                    <p className="text-sm mt-1">위 + 추가 버튼으로 기록할 수 있습니다.</p>
                </div>
            ) : allSwapRecords.length > 0 && (
                <>
                    {/* 이름별 통계 */}
                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-purple-100 mb-5">
                        <p className="text-xs font-bold text-stone-400 mb-3">{filterLabel} — 누구와 자주?</p>
                        {countByName.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {countByName.map(([name, count]) => (
                                    <div key={name} className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-full">
                                        <span className="font-black text-purple-700 text-sm">{name}</span>
                                        <span className="text-xs font-bold text-purple-400 bg-white px-1.5 py-0.5 rounded-full">{count}회</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-stone-300 text-sm">해당 기간 기록 없음</p>
                        )}
                    </div>

                    {/* 연도 필터 */}
                    <div className="flex gap-2 overflow-x-auto pb-1 mb-2 scrollbar-hide">
                        <button
                            onClick={() => { setFilterYear('all'); setFilterMonth('all'); }}
                            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition ${filterYear === 'all' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500'}`}
                        >
                            전체
                        </button>
                        {years.map(y => (
                            <button
                                key={y}
                                onClick={() => { setFilterYear(y); setFilterMonth('all'); }}
                                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition ${filterYear === y ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500'}`}
                            >
                                {y}년
                            </button>
                        ))}
                    </div>

                    {/* 월별 필터 (연도 선택 시) */}
                    {filterYear !== 'all' && months.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-hide">
                            <button
                                onClick={() => setFilterMonth('all')}
                                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition ${filterMonth === 'all' ? 'bg-purple-600 text-white' : 'bg-stone-100 text-stone-500'}`}
                            >
                                전체
                            </button>
                            {months.map(m => (
                                <button
                                    key={m}
                                    onClick={() => setFilterMonth(m)}
                                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition ${filterMonth === m ? 'bg-purple-600 text-white' : 'bg-stone-100 text-stone-500'}`}
                                >
                                    {parseInt(m)}월
                                </button>
                            ))}
                        </div>
                    )}
                    {(filterYear === 'all' || months.length === 0) && <div className="mb-5" />}

                    {/* 목록 */}
                    <div className="space-y-3">
                        {swapRecords.length === 0 ? (
                            <div className="text-center py-10 text-stone-300 text-sm">해당 기간 기록 없음</div>
                        ) : swapRecords.map(s => (
                            <div key={s.id} className={`bg-white rounded-3xl p-5 shadow-sm border transition ${editingId === s.id ? 'border-purple-300 shadow-purple-100' : 'border-stone-100'}`}>

                                {editingId === s.id ? (
                                    /* 인라인 수정 모드 */
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-stone-500 font-mono">{s.date.slice(5).replace('-', '/')}</span>
                                            <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{s.shift}부</span>
                                            <span className="text-xs text-purple-400 font-bold">수정 중</span>
                                        </div>
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            placeholder="이름 *"
                                            maxLength={15}
                                            autoFocus
                                            className="w-full p-3 bg-purple-50 border-2 border-purple-300 rounded-xl text-sm font-bold focus:outline-none text-purple-700"
                                        />
                                        <input
                                            type="text"
                                            value={editMemo}
                                            onChange={e => setEditMemo(e.target.value)}
                                            placeholder="메모 (선택)"
                                            maxLength={30}
                                            className="w-full p-3 bg-stone-50 border-2 border-stone-200 rounded-xl text-sm font-medium focus:outline-none text-stone-600"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleSaveEdit(s.id)}
                                                disabled={!editName.trim()}
                                                className="flex-1 py-3 bg-purple-600 text-white font-black rounded-2xl text-sm flex items-center justify-center gap-1 disabled:opacity-40"
                                            >
                                                <Check size={16} /> 저장
                                            </button>
                                            <button onClick={() => setEditingId(null)} className="px-5 py-3 bg-stone-100 text-stone-500 font-bold rounded-2xl text-sm">취소</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* 날짜 행 */}
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
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
                                                <button
                                                    onClick={() => handleEdit(s)}
                                                    className="p-1.5 bg-stone-100 rounded-lg text-stone-400 hover:text-purple-600 hover:bg-purple-50 transition"
                                                    title="수정"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(s.id)}
                                                    className="p-1.5 bg-stone-100 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition"
                                                    title="삭제"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* 바꾼 내용 메모 */}
                                        {s.swapMemo && (
                                            <div className="flex items-start gap-2 bg-purple-50 rounded-xl p-3 mb-3">
                                                <span className="text-sm">📝</span>
                                                <span className="text-sm text-stone-600 font-medium">{s.swapMemo}</span>
                                            </div>
                                        )}

                                        {/* 감사 표시 */}
                                        <div className="mt-2">
                                            {editingThanks === s.id ? (
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={thanksInput}
                                                        onChange={e => setThanksInput(e.target.value)}
                                                        placeholder="예: 커피, 밥 한 끼, 아직 못함"
                                                        maxLength={30}
                                                        autoFocus
                                                        className="flex-1 p-3 bg-amber-50 border-2 border-amber-200 rounded-xl text-sm font-medium focus:outline-none focus:border-amber-400 text-stone-700"
                                                        onKeyDown={e => { if (e.key === 'Enter') handleSaveThanks(s.id); }}
                                                    />
                                                    <button onClick={() => handleSaveThanks(s.id)} className="px-4 py-2 bg-amber-400 text-white font-bold rounded-xl text-sm">저장</button>
                                                    <button onClick={() => setEditingThanks(null)} className="px-3 py-2 bg-stone-100 text-stone-500 font-bold rounded-xl text-sm">취소</button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => { setEditingThanks(s.id); setThanksInput(s.swapThanks || ''); }}
                                                    className={`w-full text-left p-3 rounded-xl border-2 border-dashed text-sm font-medium transition ${s.swapThanks ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-stone-50 border-stone-200 text-stone-400 hover:border-amber-200 hover:bg-amber-50'}`}
                                                >
                                                    {s.swapThanks ? <span>🙏 {s.swapThanks}</span> : <span>+ 감사 표시 기록</span>}
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
