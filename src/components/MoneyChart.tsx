'use client';

import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useAppStore } from '@/lib/store';
import { useMemo } from 'react';

ChartJS.register(ArcElement, Tooltip, Legend);

interface MoneyChartProps {
    monthlyTransactions?: any[]; // Allow optional props if strictly typed parents are difficult
    year?: number;
    month?: number;
}

export function MoneyChart({ year, month }: MoneyChartProps) {
    const { transactions } = useAppStore();

    // Workaround: If year/month not passed, use current date
    const targetDate = new Date();
    const targetYear = year ?? targetDate.getFullYear();
    const targetMonth = month ?? targetDate.getMonth();

    const chartData = useMemo(() => {
        const categories = {
            'food': { label: '식대', amount: 0, color: '#10b981' }, // Emerald 500
            'transport': { label: '교통', amount: 0, color: '#3b82f6' }, // Blue 500
            'gear': { label: '용품', amount: 0, color: '#f59e0b' }, // Amber 500
            'other': { label: '기타', amount: 0, color: '#64748b' } // Slate 500
        };

        const filtered = (transactions || []).filter(t => {
            if (!t || !t.date) return false; // Safety check
            const d = new Date(t.date);
            return t.type === 'expense' && d.getFullYear() === targetYear && d.getMonth() === targetMonth;
        });

        if (filtered.length === 0) return null;

        filtered.forEach(t => {
            if (t.category && categories[t.category]) {
                categories[t.category].amount += t.amount;
            } else {
                categories['other'].amount += t.amount;
            }
        });

        return {
            labels: Object.values(categories).map(c => c.label),
            datasets: [{
                data: Object.values(categories).map(c => c.amount),
                backgroundColor: Object.values(categories).map(c => c.color),
                borderWidth: 0,
            }]
        };
    }, [transactions, targetYear, targetMonth]);

    if (!chartData) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-stone-300">
                <p className="text-xs">지출 내역이 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[200px] mx-auto">
            <Doughnut data={chartData} options={{ maintainAspectRatio: true, plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }} />
        </div>
    );
}
