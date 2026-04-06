'use client';

import { useState, useMemo, Suspense } from 'react';
import { useAppStore } from '@/lib/store';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

function ChangeContent() {
    const { schedules, updateSchedule } = useAppStore();

    // 월 필터 — 기본 전체
    const [filterMonth, setFilterMonth] = useState<string>('all');
    // 감사 메모 편집 중인 id
    const [editingThanks, setEditingThanks] = useState<string | null>(null);
    const [thanksInput, setThanksInput] = useState('');

    // swap 기록 전체
    const allSwapRecords = useMemo(() =>
        schedules
            .filter(s => s.type === 'work' && s.swapWith)
            .sort((a, b) => b.date.localeCompare(a.date)),
        [schedules]
    );

    // 월 목록 추출
    const months = useMemo(() => {
        const set = new Set(allSwapRecords.map(s => s.date.slice(0, 7)));
        return Array.from(set).sort((a, b) => b.localeCompare(a));
    }, [allSwapRecords]);

    // 필터 적용
    const swapRecords = useMemo(() =>
        filterMonth === 'all'
            ? allSwapRecords
            : allSwapRecords.filter(s => s.date.startsWith(filterMonth)),
        [allSwapRecords, filterMonth]
    );

    // 이름별 집계 (필터 적용 기록 기준)
    const countByName = useMemo(() => {
        const map: Record<string, number> = {};
        swapRecords.forEach(s => {
            const name = s.swapWith!;
            map[name] = (map[name] || 0) + 1;
        });
        return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [swapRecords]);

    const handleSaveThanks = (id: string) => {
        updateSchedule(id, { swapThanks: thanksInput.trim() || undefined });
        setEditingThanks(null);
        setThanksInput('');
    };

    return (
        <div className="p-6 pb-24 min-h-screen">
            {/* 헤더 */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/schedule" className="p-2 bg-stone-100 rounded-full text-stone-500 hover:text-stone-700">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-black text-stone-900 flex items-center gap-2">
                        <RefreshCw size={22} className="text-purple-500" /> 대기바꿈 전체 기록
                    </h1>
                    <p className="text-xs text-stone-400 mt-0.5">전체 {allSwapRecords.length}건</p>
                </div>
            </div>

            {allSwapRecords.length === 0 ? (
                <div className="text-center py-24 text-stone-300">
                    <RefreshCw size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="font-bold">대기바꿈 기록이 없습니다.</p>
                    <p className="text-sm mt-1">근무 등록 시 대기바꿈을 ON 하면 기록됩니다.</p>
                </div>
            ) : (
                <>
                    {/* 이름별 통계 */}
                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-purple-100 mb-5">
                        <p className="text-xs font-bold text-stone-400 mb-3">누구와 자주 바꿨나요?</p>
                        <div className="flex flex-wrap gap-2">
                            {countByName.map(([name, count]) => (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => {
                                        // 해당 이름으로 필터 (이미 필터 중이면 해제)
                                        const monthOfFirst = allSwapRecords.find(s => s.swapWith === name)?.date.slice(0, 7);
                                        setFilterMonth('all');
                                    }}
                                    className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-full"
                                >
                                    <span className="font-black text-purple-700 text-sm">{name}</span>
                                    <span className="text-xs font-bold text-purple-400 bg-white px-1.5 py-0.5 rounded-full">{count}회</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 월별 필터 탭 */}
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
                                {m.slice(5)}월
                            </button>
                        ))}
                    </div>

                    {/* 목록 */}
                    <div className="space-y-3">
                        {swapRecords.map(s => (
                            <div key={s.id} className="bg-white rounded-3xl p-5 shadow-sm border border-stone-100">
                                {/* 날짜 + 부 + 이름 */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-base font-black text-stone-700 font-mono">
                                            {s.date.slice(5).replace('-', '/')}
                                        </span>
                                        <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{s.shift}부</span>
                                        {s.holes && s.holes >= 36 && (
                                            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">{s.holes}H</span>
                                        )}
                                    </div>
                                    <span className="text-sm font-black text-purple-600 bg-purple-50 border border-purple-200 px-3 py-1 rounded-full">
                                        🔄 {s.swapWith}
                                    </span>
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
                                            onClick={() => {
                                                setEditingThanks(s.id);
                                                setThanksInput(s.swapThanks || '');
                                            }}
                                            className={`w-full text-left p-3 rounded-xl border-2 border-dashed text-sm font-medium transition ${s.swapThanks ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-stone-50 border-stone-200 text-stone-400 hover:border-amber-200 hover:bg-amber-50'}`}
                                        >
                                            {s.swapThanks ? (
                                                <span>🙏 {s.swapThanks}</span>
                                            ) : (
                                                <span>+ 감사 표시 기록</span>
                                            )}
                                        </button>
                                    )}
                                </div>
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
