'use client';

import React, { useState, useEffect } from 'react';
import GridSheet from '@/components/GridSheet';
import { useCaddyStore } from '@/store/useCaddyStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * 이미지 속 '11월 예비자' 명단을 디지털로 재현한 페이지입니다.
 */
export default function ReservePage() {
    const { reserves, setReserves } = useCaddyStore();
    const [currentDate, setCurrentDate] = useState(new Date());

    const [localData, setLocalData] = useState<Record<number, string[]>>({});

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    useEffect(() => {
        const newData: Record<number, string[]> = {};
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            newData[day] = reserves[dateStr] || [];
        }
        setLocalData(newData);
    }, [currentDate, reserves]);

    const handleCellChange = (day: number, slotIndex: number, value: string) => {
        setLocalData((prev) => {
            const currentNames = [...(prev[day] || [])];
            while (currentNames.length <= slotIndex) {
                currentNames.push('');
            }
            currentNames[slotIndex] = value;

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            setReserves(dateStr, currentNames.filter(name => name.trim() !== ''));

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
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
                <button onClick={() => window.history.back()} className="p-2 -ml-2">
                    <ChevronLeft className="w-6 h-6 text-gray-600" />
                </button>

                <div className="flex items-center gap-4">
                    <button onClick={() => changeMonth(-1)} className="p-1">
                        <ChevronLeft className="w-5 h-5 text-gray-400" />
                    </button>
                    <h1 className="text-lg font-bold">
                        {year}년 {month + 1}월 예비자 명단
                    </h1>
                    <button onClick={() => changeMonth(1)} className="p-1">
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
                <div className="w-10"></div>
            </div>

            <div className="bg-blue-50 px-4 py-2 text-xs text-blue-700 font-medium">
                💡 갑작스러운 펑크에 대비한 예비 인원 명단입니다. 종이 문서와 동일하게 관리하세요.
            </div>

            <div className="flex-1 overflow-hidden">
                <GridSheet
                    title={`${month + 1}월 예비자(1)`}
                    days={daysInMonth}
                    slots={31}
                    data={localData}
                    onCellChange={handleCellChange}
                />
            </div>
        </div>
    );
}
