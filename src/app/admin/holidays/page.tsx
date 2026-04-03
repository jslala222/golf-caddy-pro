'use client';

import React, { useState, useEffect } from 'react';
import GridSheet from '@/components/GridSheet';
import { useCaddyStore } from '@/store/useCaddyStore';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';

/**
 * 이미지 속 '11월 휴무표'를 디지털로 재현한 페이지입니다.
 */
export default function HolidayPage() {
    const { holidays, setHolidays } = useCaddyStore();
    const [currentDate, setCurrentDate] = useState(new Date());

    // 현재 작업 중인 월의 데이터 가공 ({ day: ["이름1", "이름2"] })
    const [localData, setLocalData] = useState<Record<number, string[]>>({});

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-based
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 월이 변경될 때마다 로컬 데이터 초기화
    useEffect(() => {
        const newData: Record<number, string[]> = {};
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            newData[day] = holidays[dateStr] || [];
        }
        setLocalData(newData);
    }, [currentDate, holidays]);

    const handleCellChange = (day: number, slotIndex: number, value: string) => {
        setLocalData((prev) => {
            const currentNames = [...(prev[day] || [])];
            // 슬롯 인덱스까지 배열 크기 확장
            while (currentNames.length <= slotIndex) {
                currentNames.push('');
            }
            currentNames[slotIndex] = value;

            // 스토어에도 즉시 저장 (데이터 유실 방지)
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            setHolidays(dateStr, currentNames.filter(name => name.trim() !== ''));

            return { ...prev, [day]: currentNames };
        });
    };

    const changeMonth = (offset: number) => {
        const nextDate = new Date(currentDate);
        nextDate.setMonth(currentDate.getMonth() + offset);
        setCurrentDate(nextDate);
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* 상단 네비게이션 */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
                <button onClick={() => window.history.back()} className="p-2 -ml-2">
                    <ChevronLeft className="w-6 h-6 text-gray-600" />
                </button>

                <div className="flex items-center gap-4">
                    <button onClick={() => changeMonth(-1)} className="p-1">
                        <ChevronLeft className="w-5 h-5 text-gray-400" />
                    </button>
                    <h1 className="text-lg font-bold">
                        {year}년 {month + 1}월 휴무표
                    </h1>
                    <button onClick={() => changeMonth(1)} className="p-1">
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="w-10"></div> {/* 밸런스용 빈 공간 */}
            </div>

            {/* 그리드 안내 문구 */}
            <div className="bg-emerald-50 px-4 py-2 text-xs text-emerald-700 font-medium">
                💡 종이 문서와 동일한 형식입니다. 칸을 눌러 캐디 이름을 입력하세요.
            </div>

            {/* 메인 그리드 */}
            <div className="flex-1 overflow-hidden">
                <GridSheet
                    title={`${month + 1}월 휴무표(2)`}
                    days={daysInMonth}
                    slots={31}
                    data={localData}
                    onCellChange={handleCellChange}
                />
            </div>
        </div>
    );
}
