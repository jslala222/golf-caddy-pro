'use client';

import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface GridSheetProps {
    title: string;
    days: number; // 해당 월의 일수 (예: 30, 31)
    slots: number; // 세로 슬롯 수 (이미지상 약 31개)
    data: Record<number, string[]>; // { day: ["이름1", "이름2"] }
    onCellChange: (day: number, slotIndex: number, value: string) => void;
}

/**
 * 이미지 속 종이 문서를 그대로 디지털로 옮긴 그리드 컴포넌트입니다.
 * 가로로 날짜가 나열되고, 세로로 슬롯 번호가 표시됩니다.
 */
const GridSheet: React.FC<GridSheetProps> = ({ title, days, slots, data, onCellChange }) => {
    const dayArray = Array.from({ length: days }, (_, i) => i + 1);
    const slotArray = Array.from({ length: slots }, (_, i) => i + 1);

    return (
        <div className="flex flex-col w-full h-full bg-white overflow-hidden border-t border-l border-gray-300">
            {/* 제목 헤더 */}
            <div className="bg-stone-500 text-white py-2 px-4 text-center font-bold text-lg sticky top-0 z-20">
                {title}
            </div>

            <div className="flex overflow-auto">
                {/* 날짜 행 (Sticky Top) */}
                <div className="flex flex-col min-w-max">
                    <div className="flex sticky top-0 z-10 bg-gray-100">
                        {/* 왼쪽 상단 구석 빈칸 */}
                        <div className="w-10 h-10 border-r border-b border-gray-300 bg-gray-200 sticky left-0 z-30"></div>
                        {dayArray.map((day) => (
                            <div
                                key={day}
                                className="w-20 h-10 border-r border-b border-gray-300 flex items-center justify-center font-bold text-sm"
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* 슬롯 데이터 영역 */}
                    {slotArray.map((slotIdx) => (
                        <div key={slotIdx} className="flex">
                            {/* 왼쪽 슬롯 번호 (Sticky Left) */}
                            <div className="w-10 h-10 bg-gray-100 border-r border-b border-gray-300 flex items-center justify-center font-bold text-xs sticky left-0 z-10">
                                {slotIdx}
                            </div>

                            {/* 날짜별 입력 칸 */}
                            {dayArray.map((day) => {
                                const names = data[day] || [];
                                const value = names[slotIdx - 1] || '';

                                return (
                                    <div key={`${day}-${slotIdx}`} className="w-20 h-10 border-r border-b border-gray-300 relative">
                                        <input
                                            type="text"
                                            value={value}
                                            onChange={(e) => onCellChange(day, slotIdx - 1, e.target.value)}
                                            className="w-full h-full px-1 text-xs text-center outline-none focus:bg-emerald-50 transition-colors"
                                            placeholder=""
                                        />
                                        {/* 종이 느낌의 사선 처리 (내용이 없을 때) - 옵션 */}
                                        {!value && slotIdx > 25 && (
                                            <div className="absolute inset-0 pointer-events-none opacity-10">
                                                <div className="w-full h-px bg-gray-900 absolute top-0 left-0 origin-top-left rotate-[26deg] scale-x-[2.3]"></div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GridSheet;
