import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * 캐디 자율 관리 시스템의 상태를 관리하는 Store입니다.
 * 모든 데이터는 로컬 스토리지에 저장되어 서버 없이 작동합니다.
 */

interface CaddyState {
    // 휴무 데이터: { "YYYY-MM-DD": ["캐디명1", "캐디명2", ...] }
    holidays: Record<string, string[]>;
    reserves: Record<string, string[]>;
    // 전체 캐디 명단 (순번순)
    caddyMembers: string[];

    // 액션
    setHolidays: (date: string, names: string[]) => void;
    setReserves: (date: string, names: string[]) => void;
    setCaddyMembers: (names: string[]) => void;
    clearAll: () => void;
}

export const useCaddyStore = create<CaddyState>()(
    persist(
        (set) => ({
            holidays: {},
            reserves: {},
            caddyMembers: [],

            setHolidays: (date, names) =>
                set((state) => ({
                    holidays: { ...state.holidays, [date]: names }
                })),

            setReserves: (date, names) =>
                set((state) => ({
                    reserves: { ...state.reserves, [date]: names }
                })),

            setCaddyMembers: (names) => set({ caddyMembers: names }),

            clearAll: () => set({ holidays: {}, reserves: {}, caddyMembers: [] }),
        }),
        {
            name: 'caddy-management-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
