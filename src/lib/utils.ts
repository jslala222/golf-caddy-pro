
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
    return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
    }).format(amount);
}

export function formatDate(dateString: string) {
    if (!dateString) return '';
    try {
        // Safely parse YYYY-MM-DD to avoid timezone shifts
        const parts = dateString.split('-').map(Number);
        if (parts.length !== 3) return dateString; // Fallback if format is weird

        const [y, m, d] = parts;
        const date = new Date(y, m - 1, d);

        // Check if date is valid
        if (isNaN(date.getTime())) return dateString;

        return new Intl.DateTimeFormat('ko-KR', {
            month: 'long',
            day: 'numeric',
            weekday: 'short',
        }).format(date);
    } catch (e) {
        return dateString;
    }
}

export function formatNumber(value: number | string) {
    if (!value) return '';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    return isNaN(num) ? '' : num.toLocaleString();
}
