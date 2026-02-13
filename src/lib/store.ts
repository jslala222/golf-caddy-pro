
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ----------------------
// Types
// ----------------------

export type ScheduleType = 'work' | 'personal' | 'holiday';
export type TransactionType = 'income' | 'expense';
export type ExpenseCategory = 'food' | 'transport' | 'gear' | 'other';
export type ClientGrade = 'vip' | 'gn' | 'normal';

export interface Schedule {
    id: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:MM
    title: string;
    type: ScheduleType;
    shift?: '1' | '2' | '3'; // 1st, 2nd, 3rd part
    memo?: string;
    caddyFee?: number; // 캐디피
    overFee?: number;  // 오버피
    isRain?: boolean;  // 우천/홀별 정산 여부
    holes?: 18 | 9 | number; // 라운딩 홀수 (18, 9, 또는 홀별 정산 시 직접 입력)
    createdAt?: string; // 생성일시 (타임머신 기능용)
}

export interface Client {
    id: string;
    name: string;
    contact?: string; // 000-0000-0000
    carInfo?: string; // 차량 정보
    birthDate?: string;
    memo?: string;
    grade: ClientGrade;
    visitCount: number;
    lastVisit?: string;
    createdAt: string;
}

export interface Transaction {
    id: string;
    date: string; // YYYY-MM-DD
    type: TransactionType;
    amount: number;
    category?: ExpenseCategory; // Only for expense
    memo?: string;
    createdAt?: string; // 생성일시
}

interface AppState {
    schedules: Schedule[];
    clients: Client[];
    transactions: Transaction[];

    // Actions
    addSchedule: (schedule: Omit<Schedule, 'id' | 'createdAt'>) => void;
    updateSchedule: (id: string, updates: Partial<Schedule>) => void;
    deleteSchedule: (id: string) => void;
    deleteSchedulesByDate: (date: string) => void;

    addClient: (client: Omit<Client, 'id' | 'createdAt' | 'visitCount'>) => void;
    updateClient: (id: string, updates: Partial<Client>) => void;
    deleteClient: (id: string) => void;

    addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
    deleteTransaction: (id: string) => void;

    // Fee Settings
    feeSettings: {
        shift1: number;
        shift2: number;
        shift3: number;
        useShift3: boolean; // 3부 사용 여부
    };
    updateFeeSettings: (settings: { shift1: number; shift2: number; shift3: number; useShift3: boolean }) => void;

    // Data management
    importData: (data: string) => boolean; // Returns success
    exportData: () => string; // Returns JSON string
    resetData: () => void;
    deleteDataBefore: (date: string) => void;
}

// ----------------------
// Store Implementation
// ----------------------

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            schedules: [],
            clients: [],
            transactions: [],
            feeSettings: {
                shift1: 150000,
                shift2: 150000,
                shift3: 160000,
                useShift3: true,
            },

            addSchedule: (schedule) =>
                set((state) => {
                    // Check if shift is already taken for that day
                    if (schedule.type === 'work' && schedule.shift) {
                        const existingShift = state.schedules.find(s =>
                            s.date === schedule.date &&
                            s.type === 'work' &&
                            s.shift === schedule.shift
                        );

                        if (existingShift) {
                            if (typeof window !== 'undefined') alert(`이미 ${schedule.shift}부 근무가 등록되어 있습니다!`);
                            return { schedules: state.schedules };
                        }
                    }

                    // Fallback limit check (just in case)
                    const dateSchedules = state.schedules.filter(s => s.date === schedule.date && s.type === 'work');
                    if (schedule.type === 'work' && dateSchedules.length >= 3) {
                        if (typeof window !== 'undefined') alert('하루에 최대 3번까지만 근무를 등록할 수 있습니다!');
                        return { schedules: state.schedules };
                    }

                    return {
                        schedules: [
                            ...state.schedules,
                            { ...schedule, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
                        ],
                    };
                }),

            updateSchedule: (id, updates) =>
                set((state) => ({
                    schedules: state.schedules.map((s) =>
                        s.id === id ? { ...s, ...updates } : s
                    ),
                })),

            deleteSchedule: (id) =>
                set((state) => ({
                    schedules: state.schedules.filter((s) => s.id !== id),
                })),

            deleteSchedulesByDate: (date) =>
                set((state) => ({
                    schedules: state.schedules.filter((s) => s.date !== date),
                })),

            addClient: (client) =>
                set((state) => ({
                    clients: [
                        ...state.clients,
                        { ...client, id: crypto.randomUUID(), createdAt: new Date().toISOString(), visitCount: 0 },
                    ],
                })),

            updateClient: (id, updates) =>
                set((state) => ({
                    clients: state.clients.map((c) =>
                        c.id === id ? { ...c, ...updates } : c
                    ),
                })),

            deleteClient: (id) =>
                set((state) => ({
                    clients: state.clients.filter((c) => c.id !== id),
                })),

            addTransaction: (transaction) =>
                set((state) => ({
                    transactions: [
                        ...state.transactions,
                        { ...transaction, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
                    ],
                })),

            deleteTransaction: (id) =>
                set((state) => ({
                    transactions: state.transactions.filter((t) => t.id !== id),
                })),

            updateFeeSettings: (newSettings) =>
                set(() => ({
                    feeSettings: newSettings,
                })),

            exportData: () => {
                const state = get();
                const data = {
                    schedules: state.schedules,
                    clients: state.clients,
                    transactions: state.transactions,
                    feeSettings: state.feeSettings,
                    version: 1,
                    exportedAt: new Date().toISOString(),
                };
                return JSON.stringify(data, null, 2);
            },

            importData: (jsonString) => {
                try {
                    const data = JSON.parse(jsonString);
                    // Handle legacy data (customers -> clients)
                    const importedCustomers = (data.customers || []).map((c: any) => ({
                        ...c,
                        id: c.id,
                        name: c.name,
                        contact: c.contact,
                        grade: c.type === 'good' ? 'vip' : c.type === 'bad' ? 'gn' : 'normal',
                        visitCount: 0,
                        createdAt: c.createdAt,
                    }));
                    const clients = [...(data.clients || []), ...importedCustomers];

                    if (!Array.isArray(data.schedules) || !Array.isArray(clients)) {
                        throw new Error('Invalid data format');
                    }

                    set((state) => {
                        const mergeArrays = <T extends { id: string }>(current: T[], incoming: T[]) => {
                            const currentIds = new Set(current.map(item => item.id));
                            const newItems = incoming.filter(item => !currentIds.has(item.id));
                            return [...current, ...newItems];
                        };

                        return {
                            schedules: mergeArrays(state.schedules, (data.schedules || []).map((s: any) => ({
                                ...s,
                                holes: s.holes || 18 // Default to 18 holes for legacy data
                            }))),
                            clients: mergeArrays(state.clients, clients),
                            transactions: mergeArrays(state.transactions, data.transactions || []),
                            feeSettings: data.feeSettings || state.feeSettings,
                        };
                    });
                    return true;
                } catch (error) {
                    console.error('Import failed:', error);
                    return false;
                }
            },

            resetData: () => set({ schedules: [], clients: [], transactions: [] }),

            deleteDataBefore: (date: string) => {
                set((state) => ({
                    schedules: state.schedules.filter(s => s.createdAt && s.createdAt >= date),
                    clients: state.clients.filter(c => c.createdAt && c.createdAt >= date),
                    transactions: state.transactions.filter(t => t.createdAt && t.createdAt >= date),
                }));
            },
        }),
        {
            name: 'caddy-manager-storage',
            storage: createJSONStorage(() => {
                // Server-side: return dummy storage
                if (typeof window === 'undefined') {
                    return {
                        getItem: () => null,
                        setItem: () => { },
                        removeItem: () => { },
                    };
                }
                // Client-side: use localStorage with safe-save guard
                const storage = localStorage;
                return {
                    getItem: (name) => storage.getItem(name),
                    setItem: (name, value) => {
                        try {
                            const existing = storage.getItem(name);
                            if (existing && existing.length > 100) {
                                const parsedNew = JSON.parse(value);
                                const parsedOld = JSON.parse(existing);

                                // CRITICAL: Prevent overwriting data with empty state
                                // If old state had schedules/clients/transactions but new state has NONE of them
                                const oldHasData = (parsedOld.state.schedules?.length > 0 || parsedOld.state.clients?.length > 0 || parsedOld.state.transactions?.length > 0);
                                const newIsEmpty = (parsedNew.state.schedules?.length === 0 && parsedNew.state.clients?.length === 0 && parsedNew.state.transactions?.length === 0);

                                if (oldHasData && newIsEmpty) {
                                    // Verify if it's an intentional reset (we need a way to flag this, or just block implicit overwrites)
                                    // For now, we block it to be safe. "Reset" button in settings will clear storage first correctly.
                                    console.error('[SafeGuard] Prevented empty state overwrite!');
                                    return;
                                }
                            }
                        } catch (e) {
                            console.error('[SafeGuard] Error checking data integrity', e);
                        }
                        storage.setItem(name, value);
                    },
                    removeItem: (name) => storage.removeItem(name),
                };
            }),
        }
    )
);
