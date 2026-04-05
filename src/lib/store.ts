import { create } from 'zustand';

// ----------------------
// Types
// ----------------------

export type ScheduleType = 'work' | 'personal' | 'holiday';
export type TransactionType = 'income' | 'expense';
export type ExpenseCategory = 'food' | 'transport' | 'gear' | 'other' | 'caddy_fee' | 'tip' | 'over_fee';
export type ClientGrade = 'vip' | 'gn' | 'normal';

export interface Schedule {
    id: string;
    date: string;
    time: string;
    title: string;
    type: ScheduleType;
    shift?: '1' | '2' | '3';
    memo?: string;
    caddyFee?: number;
    overFee?: number;
    isRain?: boolean;
    holes?: 18 | 9 | number;
    createdAt?: string;
}

export interface Client {
    id: string;
    name: string;
    contact?: string;
    carInfo?: string;
    birthDate?: string;
    memo?: string;
    grade: ClientGrade;
    visitCount: number;
    lastVisit?: string;
    createdAt: string;
}

export interface Transaction {
    id: string;
    date: string;
    type: TransactionType;
    amount: number;
    category?: ExpenseCategory;
    memo?: string;
    createdAt?: string;
}

interface AppState {
    schedules: Schedule[];
    clients: Client[];
    transactions: Transaction[];
    feeSettings: {
        shift1: number;
        shift2: number;
        shift3: number;
        useShift3: boolean;
    };
    _initialized: boolean;

    addSchedule: (schedule: Omit<Schedule, 'id' | 'createdAt'>) => void;
    updateSchedule: (id: string, updates: Partial<Schedule>) => void;
    deleteSchedule: (id: string) => void;
    deleteSchedulesByDate: (date: string) => void;

    addClient: (client: Omit<Client, 'id' | 'createdAt' | 'visitCount'>) => void;
    updateClient: (id: string, updates: Partial<Client>) => void;
    deleteClient: (id: string) => void;

    addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
    deleteTransaction: (id: string) => void;

    updateFeeSettings: (settings: { shift1: number; shift2: number; shift3: number; useShift3: boolean }) => void;

    exportData: () => string;
    importData: (data: string) => boolean;
    resetData: () => void;
    deleteDataBefore: (date: string) => void;
}

function getCode(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('caddy_license_key')?.trim().toUpperCase() ?? null;
}

function apiHeaders(): HeadersInit {
    const code = getCode();
    return {
        'Content-Type': 'application/json',
        ...(code ? { 'x-license-code': code } : {}),
    };
}

function bgFetch(url: string, options: RequestInit) {
    fetch(url, options).catch(e => console.warn('[store]', url, e));
}

export const useAppStore = create<AppState>()((set, get) => ({
    schedules: [],
    clients: [],
    transactions: [],
    feeSettings: { shift1: 150000, shift2: 150000, shift3: 160000, useShift3: true },
    _initialized: false,

    addSchedule: (schedule) => {
        const state = get();
        if (schedule.type === 'work' && schedule.shift) {
            const dup = state.schedules.find(s =>
                s.date === schedule.date && s.type === 'work' && s.shift === schedule.shift
            );
            if (dup) {
                if (typeof window !== 'undefined') alert(`이미 ${schedule.shift}부 근무가 등록되어 있습니다!`);
                return;
            }
        }
        const dateWork = state.schedules.filter(s => s.date === schedule.date && s.type === 'work');
        if (schedule.type === 'work' && dateWork.length >= 3) {
            if (typeof window !== 'undefined') alert('하루에 최대 3번까지만 근무를 등록할 수 있습니다!');
            return;
        }
        const newSchedule: Schedule = { ...schedule, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
        set(s => ({ schedules: [...s.schedules, newSchedule] }));
        bgFetch('/api/db/schedules', { method: 'POST', headers: apiHeaders(), body: JSON.stringify(newSchedule) });
    },

    updateSchedule: (id, updates) => {
        set(s => ({ schedules: s.schedules.map(sc => sc.id === id ? { ...sc, ...updates } : sc) }));
        bgFetch(`/api/db/schedules/${id}`, { method: 'PUT', headers: apiHeaders(), body: JSON.stringify(updates) });
    },

    deleteSchedule: (id) => {
        set(s => ({ schedules: s.schedules.filter(sc => sc.id !== id) }));
        bgFetch(`/api/db/schedules/${id}`, { method: 'DELETE', headers: apiHeaders() });
    },

    deleteSchedulesByDate: (date) => {
        const ids = get().schedules.filter(s => s.date === date).map(s => s.id);
        set(s => ({ schedules: s.schedules.filter(sc => sc.date !== date) }));
        ids.forEach(id => bgFetch(`/api/db/schedules/${id}`, { method: 'DELETE', headers: apiHeaders() }));
    },

    addClient: (client) => {
        const newClient: Client = { ...client, id: crypto.randomUUID(), createdAt: new Date().toISOString(), visitCount: 0 };
        set(s => ({ clients: [...s.clients, newClient] }));
        bgFetch('/api/db/clients', { method: 'POST', headers: apiHeaders(), body: JSON.stringify(newClient) });
    },

    updateClient: (id, updates) => {
        set(s => ({ clients: s.clients.map(c => c.id === id ? { ...c, ...updates } : c) }));
        bgFetch(`/api/db/clients/${id}`, { method: 'PUT', headers: apiHeaders(), body: JSON.stringify(updates) });
    },

    deleteClient: (id) => {
        set(s => ({ clients: s.clients.filter(c => c.id !== id) }));
        bgFetch(`/api/db/clients/${id}`, { method: 'DELETE', headers: apiHeaders() });
    },

    addTransaction: (transaction) => {
        const newTx: Transaction = { ...transaction, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
        set(s => ({ transactions: [...s.transactions, newTx] }));
        bgFetch('/api/db/transactions', { method: 'POST', headers: apiHeaders(), body: JSON.stringify(newTx) });
    },

    deleteTransaction: (id) => {
        set(s => ({ transactions: s.transactions.filter(t => t.id !== id) }));
        bgFetch(`/api/db/transactions/${id}`, { method: 'DELETE', headers: apiHeaders() });
    },

    updateFeeSettings: (newSettings) => {
        set(() => ({ feeSettings: newSettings }));
        bgFetch('/api/db/fee-settings', { method: 'PUT', headers: apiHeaders(), body: JSON.stringify(newSettings) });
    },

    exportData: () => {
        const state = get();
        return JSON.stringify({
            schedules: state.schedules,
            clients: state.clients,
            transactions: state.transactions,
            feeSettings: state.feeSettings,
            version: 2,
            exportedAt: new Date().toISOString(),
        }, null, 2);
    },

    importData: (jsonString) => {
        try {
            const data = JSON.parse(jsonString);
            const importedCustomers = (data.customers || []).map((c: any) => ({
                ...c,
                grade: c.type === 'good' ? 'vip' : c.type === 'bad' ? 'gn' : 'normal',
                visitCount: 0,
            }));
            const clients = [...(data.clients || []), ...importedCustomers];
            if (!Array.isArray(data.schedules) || !Array.isArray(clients)) throw new Error('Invalid data format');
            set(() => ({
                schedules: (data.schedules || []).map((s: any) => ({ ...s, holes: s.holes || 18 })),
                clients,
                transactions: data.transactions || [],
                feeSettings: data.feeSettings || get().feeSettings,
            }));
            return true;
        } catch (e) {
            console.error('Import failed:', e);
            return false;
        }
    },

    resetData: () => set({ schedules: [], clients: [], transactions: [] }),

    deleteDataBefore: (date: string) => {
        set(s => ({
            schedules: s.schedules.filter(sc => sc.createdAt && sc.createdAt >= date),
            clients: s.clients.filter(c => c.createdAt && c.createdAt >= date),
            transactions: s.transactions.filter(t => t.createdAt && t.createdAt >= date),
        }));
    },
}));

// ─────────────────────────────────────────────────────────
// 앱 초기화: LicenseGuard 인증 후 호출
// Supabase에서 전체 데이터를 로드해 store에 세팅
// ─────────────────────────────────────────────────────────
export async function initializeStore(licenseCode: string): Promise<void> {
    const code = licenseCode.trim().toUpperCase();
    const headers = { 'x-license-code': code };
    try {
        const [schedRes, clientRes, txRes, feeRes] = await Promise.all([
            fetch('/api/db/schedules', { headers }),
            fetch('/api/db/clients', { headers }),
            fetch('/api/db/transactions', { headers }),
            fetch('/api/db/fee-settings', { headers }),
        ]);
        const [schedData, clientData, txData, feeData] = await Promise.all([
            schedRes.json(),
            clientRes.json(),
            txRes.json(),
            feeRes.json(),
        ]);
        useAppStore.setState({
            schedules: schedData.schedules ?? [],
            clients: clientData.clients ?? [],
            transactions: txData.transactions ?? [],
            feeSettings: feeData.feeSettings ?? { shift1: 150000, shift2: 150000, shift3: 160000, useShift3: true },
            _initialized: true,
        });
    } catch (e) {
        console.error('[initializeStore] 서버 초기화 실패:', e);
        useAppStore.setState({ _initialized: true });
    }
}
