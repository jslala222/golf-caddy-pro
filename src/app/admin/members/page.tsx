'use client';

import React, { useState } from 'react';
import { useCaddyStore } from '@/store/useCaddyStore';
import { ChevronLeft, Plus, Trash2, GripVertical, Save } from 'lucide-react';

/**
 * 전체 캐디 명단(순번)을 관리하는 페이지입니다.
 * 이 순서대로 7분 간격 배정이 이루어집니다.
 */
export default function CaddyMembersPage() {
    const { caddyMembers, setCaddyMembers } = useCaddyStore();
    const [newName, setNewName] = useState('');

    const addMember = () => {
        if (!newName.trim()) return;
        setCaddyMembers([...caddyMembers, newName.trim()]);
        setNewName('');
    };

    const removeMember = (index: number) => {
        if (confirm('이 캐디를 명단에서 삭제하시겠습니까?')) {
            const newList = [...caddyMembers];
            newList.splice(index, 1);
            setCaddyMembers(newList);
        }
    };

    const moveMember = (index: number, direction: 'up' | 'down') => {
        const newList = [...caddyMembers];
        const targetIdx = direction === 'up' ? index - 1 : index + 1;
        if (targetIdx < 0 || targetIdx >= newList.length) return;

        [newList[index], newList[targetIdx]] = [newList[targetIdx], newList[index]];
        setCaddyMembers(newList);
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 sticky top-0 z-30">
                <button onClick={() => window.history.back()} className="p-2 -ml-2">
                    <ChevronLeft className="w-6 h-6 text-gray-600" />
                </button>
                <h1 className="text-lg font-bold">캐디 전체 명단 (순번제)</h1>
            </header>

            <div className="p-4 space-y-4 flex-1 overflow-auto">
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-xs text-emerald-800 leading-relaxed">
                    💡 **고정 순번 시스템**: 여기에 등록된 순서가 곧 '기본 순번'이 됩니다.<br />
                    위아래 화살표로 순서를 조정하면 일정표에 즉시 반영됩니다.
                </div>

                {/* 신규 등록 */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addMember()}
                        placeholder="기본 순번에 추가할 캐디 이름"
                        className="flex-1 p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <button
                        onClick={addMember}
                        className="px-6 bg-emerald-600 text-white rounded-2xl font-bold"
                    >
                        추가
                    </button>
                </div>

                {/* 명단 리스트 */}
                <div className="space-y-2 pb-10">
                    {caddyMembers.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-sm">
                            등록된 캐디가 없습니다.
                        </div>
                    ) : (
                        caddyMembers.map((name, idx) => (
                            <div
                                key={`${name}-${idx}`}
                                className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm"
                            >
                                <span className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-xs font-bold text-gray-500">
                                    {idx + 1}
                                </span>
                                <span className="flex-1 font-bold text-gray-800">{name}</span>

                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => moveMember(idx, 'up')}
                                        disabled={idx === 0}
                                        className="p-2 text-gray-400 disabled:opacity-20"
                                    >
                                        ▲
                                    </button>
                                    <button
                                        onClick={() => moveMember(idx, 'down')}
                                        disabled={idx === caddyMembers.length - 1}
                                        className="p-2 text-gray-400 disabled:opacity-20"
                                    >
                                        ▼
                                    </button>
                                    <button
                                        onClick={() => removeMember(idx)}
                                        className="p-2 text-red-300 hover:text-red-500"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
