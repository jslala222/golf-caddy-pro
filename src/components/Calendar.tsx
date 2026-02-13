
'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type Schedule } from '@/lib/store';
import { getHolidayName } from '@/lib/holidays';
import { clsx } from 'clsx';
import Link from 'next/link';

interface CalendarProps {
    schedules: Schedule[];
    selectedDate?: string;
    viewDate?: Date;
    onMonthChange?: (date: Date) => void;
}

export function Calendar({ schedules, selectedDate, viewDate, onMonthChange }: CalendarProps) {
    const [internalDate, setInternalDate] = useState(new Date());

    // Use controlled viewDate if provided, otherwise internal state
    const currentDate = viewDate || internalDate;

    // Sync calendar view when selectedDate changes (e.g. from URL)
    useEffect(() => {
        if (selectedDate && !viewDate) { // Only force updates if viewDate is not controlled
            const newDate = new Date(selectedDate);
            setInternalDate(newDate);
        }
    }, [selectedDate, viewDate]);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

    const prevMonth = () => {
        const newDate = new Date(year, month - 1, 1);
        if (onMonthChange) onMonthChange(newDate);
        else setInternalDate(newDate);
    };

    const nextMonth = () => {
        const newDate = new Date(year, month + 1, 1);
        if (onMonthChange) onMonthChange(newDate);
        else setInternalDate(newDate);
    };

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: startDayOfWeek }, (_, i) => i);

    const getSchedulesForDate = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return schedules.filter(s => s.date === dateStr);
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-4">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-stone-800">
                    {year}년 {month + 1}월
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={prevMonth}
                        className="p-3 hover:bg-stone-100 rounded-full active:bg-stone-200 transition"
                        aria-label="이전 달"
                    >
                        <ChevronLeft size={32} className="text-stone-600" />
                    </button>
                    <button
                        onClick={nextMonth}
                        className="p-3 hover:bg-stone-100 rounded-full active:bg-stone-200 transition"
                        aria-label="다음 달"
                    >
                        <ChevronRight size={32} className="text-stone-600" />
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 mb-2 text-center">
                {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                    <div key={day} className={clsx(
                        "text-xs font-bold py-1",
                        i === 0 ? "text-red-500" :
                            i === 6 ? "text-blue-500" : "text-stone-400"
                    )}>
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {blanks.map((_, i) => (
                    <div key={`blank-${i}`} className="h-14 bg-transparent" />
                ))}

                {days.map((day) => {
                    const dateSchedules = getSchedulesForDate(day);

                    // Work schedules for dots
                    const workSchedules = dateSchedules
                        .filter(s => s.type === 'work')
                        .sort((a, b) => a.time.localeCompare(b.time));

                    const hasPersonal = dateSchedules.some(s => s.type === 'personal');
                    const dateObj = new Date(year, month, day);
                    const isToday = new Date().toDateString() === dateObj.toDateString();
                    const dayOfWeek = dateObj.getDay(); // 0: Sun, 6: Sat
                    const holidayName = getHolidayName(dateObj);
                    const isHoliday = !!holidayName;
                    const isSunday = dayOfWeek === 0;
                    const isSaturday = dayOfWeek === 6;

                    // Text Color Logic
                    let textColorClass = "text-stone-700";
                    if (isToday) textColorClass = "text-white";
                    else if (isSunday || isHoliday) textColorClass = "text-red-500";
                    else if (isSaturday) textColorClass = "text-blue-500";

                    return (
                        <Link
                            href={`/schedule?date=${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`}
                            key={day}
                            className={clsx(
                                "h-16 rounded-lg flex flex-col items-center pt-1 relative hover:bg-emerald-50 transition border-2 border-transparent",
                                isToday && "bg-emerald-600 border-emerald-600 shadow-md",
                                !isToday && hasPersonal && "bg-orange-50 border-stone-100", // Personal appointment background
                                !isToday && !hasPersonal && isHoliday && "bg-red-50/30", // Light background for holidays
                                dateSchedules.some(s => s.type === 'holiday') && "!border-4 !border-blue-500 z-10" // Holiday thick blue border forced
                            )}
                        >
                            <span className={clsx(
                                "text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full mb-0.5",
                                isToday ? "text-white" :
                                    hasPersonal ? "text-orange-600" :
                                        textColorClass
                            )}>
                                {day}
                            </span>

                            {/* Holiday Name (Small) */}
                            {holidayName && (
                                <span className={clsx("text-[10px] whitespace-nowrap overflow-hidden text-ellipsis max-w-full px-1", isToday ? "text-emerald-100" : "text-red-400")}>
                                    {holidayName}
                                </span>
                            )}

                            {/* Dots (Only Work Schedules) */}
                            <div className="flex gap-0.5 mt-1">
                                {workSchedules.map((s, index) => (
                                    <div
                                        key={index}
                                        className={clsx(
                                            "w-1.5 h-1.5 rounded-full",
                                            s.shift === '1' ? "bg-red-500" :
                                                s.shift === '2' ? "bg-blue-500" :
                                                    s.shift === '3' ? "bg-emerald-500" : "bg-stone-300"
                                        )}
                                    />
                                ))}
                                {hasPersonal && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-sm" />
                                )}
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
