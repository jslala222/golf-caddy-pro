import { create } from 'zustand';

// ----------------------
// Types
// ----------------------

export type ScheduleType = 'work' | 'personal' | 'holiday';
export type TransactionType = 'income' | 'expense';
export type ExpenseCategory = 'transport' | 'gear' | 'meal' | 'etc_expense' | 'personal' | 'caddy_fee' | 'tip' | 'over_fee' | 'swap_thanks';
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
    swapWith?: string;
    swapMemo?: string;
    swapThanks?: string;
    swapThanksAmount?: number;
    swapThanksDate?: string;
    swapThanksAddedToLedger?: boolean;
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

export interface Diary {
    id?: string;
    license_code?: string;
    date: string;           // YYYY-MM-DD
    caddy_fee_1: number;
    caddy_fee_2: number;
    caddy_fee_3: number;
    tip_1: number;
    tip_2: number;
    tip_3: number;
    extra_reason: string;
    extra_amount: number;
    memo: string;
    updated_at?: string;
}

export type CaddyRank = 'leader' | 'normal' | 'standby';

export interface Caddy {
    id: string;
    name: string;
    caddy_no?: number;     // 캐디번호
    group_no?: number;    // 조번호
    rank: CaddyRank;      // 조장/일반/대기
    contact?: string;
    memo?: string;
    is_active: boolean;
    createdAt: string;
}

export interface Transaction {
    id: string;
    date: string;
    type: TransactionType;
    amount: number;
    category?: ExpenseCategory;
    memo?: string;
    receiptUrl?: string;
    createdAt?: string;
}

interface AppState {
    schedules: Schedule[];
    clients: Client[];
    transactions: Transaction[];
    diaries: Diary[];
    caddies: Caddy[];
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

    upsertDiary: (diary: Omit<Diary, 'id' | 'license_code' | 'updated_at'>) => Promise<void>;
    getDiaryByDate: (date: string) => Diary | undefined;

    addCaddy: (caddy: Omit<Caddy, 'id' | 'createdAt'>) => void;
    updateCaddy: (id: string, updates: Partial<Caddy>) => void;
    deleteCaddy: (id: string) => void;

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
    fetch(url, options)
        .then(res => { if (!res.ok) console.warn('[store] failed:', options.method, url, res.status); })
        .catch(e => console.warn('[store]', url, e));
}

// ─────────────────────────────────────────────────────────
// 이용코드별 로컬 캐시 (localStorage에 코드별로 격리 저장)
// ─────────────────────────────────────────────────────────
const LOCAL_KEY = (code: string) => `caddy-data-${code.toUpperCase()}`;

function saveLocalCache(code: string, state: Pick<AppState, 'schedules' | 'clients' | 'transactions' | 'feeSettings'>) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(LOCAL_KEY(code), JSON.stringify({
            schedules: state.schedules,
            clients: state.clients,
            transactions: state.transactions,
            feeSettings: state.feeSettings,
        }));
    } catch { /* 스토리지 가득 참 등 무시 */ }
}

function loadLocalCache(code: string) {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(LOCAL_KEY(code));
        if (!raw) return null;
        return JSON.parse(raw) as {
            schedules: AppState['schedules'];
            clients: AppState['clients'];
            transactions: AppState['transactions'];
            feeSettings: AppState['feeSettings'];
        };
    } catch { return null; }
}

export const useAppStore = create<AppState>()((set, get) => ({
    schedules: [],
    clients: [],
    transactions: [],
    diaries: [],
    caddies: [],
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
        const prev = get().schedules;
        set(s => ({ schedules: s.schedules.map(sc => sc.id === id ? { ...sc, ...updates } : sc) }));
        fetch(`/api/db/schedules/${id}`, { method: 'PUT', headers: apiHeaders(), body: JSON.stringify(updates) })
            .then(res => {
                if (!res.ok) {
                    set(() => ({ schedules: prev }));
                    if (typeof window !== 'undefined') alert('수정 실패! 다시 시도해주세요.');
                }
            })
            .catch(() => {
                set(() => ({ schedules: prev }));
                if (typeof window !== 'undefined') alert('수정 실패! 네트워크를 확인해주세요.');
            });
    },

    deleteSchedule: (id) => {
        const prev = get().schedules;
        set(s => ({ schedules: s.schedules.filter(sc => sc.id !== id) }));
        fetch(`/api/db/schedules/${id}`, { method: 'DELETE', headers: apiHeaders() })
            .then(res => {
                if (!res.ok) {
                    set(() => ({ schedules: prev }));
                    if (typeof window !== 'undefined') alert('삭제 실패! 다시 시도해주세요.');
                }
            })
            .catch(() => {
                set(() => ({ schedules: prev }));
                if (typeof window !== 'undefined') alert('삭제 실패! 네트워크를 확인해주세요.');
            });
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
        const prev = get().transactions;
        set(s => ({ transactions: s.transactions.filter(t => t.id !== id) }));
        fetch(`/api/db/transactions/${id}`, { method: 'DELETE', headers: apiHeaders() })
            .then(res => {
                if (!res.ok) {
                    set(() => ({ transactions: prev }));
                    if (typeof window !== 'undefined') alert('삭제 실패! 다시 시도해주세요.');
                }
            })
            .catch(() => {
                set(() => ({ transactions: prev }));
                if (typeof window !== 'undefined') alert('삭제 실패! 네트워크를 확인해주세요.');
            });
    },

    updateFeeSettings: (newSettings) => {
        set(() => ({ feeSettings: newSettings }));
        bgFetch('/api/db/fee-settings', { method: 'PUT', headers: apiHeaders(), body: JSON.stringify(newSettings) });
    },

    exportData: () => {
        const state = get();
        const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('Z', '+09:00');
        const ownerName = typeof window !== 'undefined'
            ? (localStorage.getItem(`caddy_user_name_${getCode()}`) || localStorage.getItem('caddy_user_name') || '')
            : '';
        return JSON.stringify({
            schedules: state.schedules,
            clients: state.clients,
            transactions: state.transactions,
            feeSettings: state.feeSettings,
            licenseCode: typeof window !== 'undefined' ? (localStorage.getItem('caddy_license_key')?.trim().toUpperCase() ?? undefined) : undefined,
            ownerName: ownerName || undefined,
            version: 2,
            exportedAt: kstNow,
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
            const schedules = (data.schedules || []).map((s: any) => ({ ...s, holes: s.holes || 18 }));
            const transactions = data.transactions || [];
            const feeSettings = data.feeSettings || get().feeSettings;
            set(() => ({ schedules, clients, transactions, feeSettings }));

            // Supabase에도 동기화 (복원 데이터가 새로고침 후에도 유지되도록)
            const code = getCode();
            if (code) {
                const headers = { 'Content-Type': 'application/json', 'x-license-code': code };
                schedules.forEach((s: any) =>
                    bgFetch('/api/db/schedules', { method: 'POST', headers, body: JSON.stringify(s) })
                );
                transactions.forEach((t: any) =>
                    bgFetch('/api/db/transactions', { method: 'POST', headers, body: JSON.stringify(t) })
                );
                clients.forEach((c: any) =>
                    bgFetch('/api/db/clients', { method: 'POST', headers, body: JSON.stringify(c) })
                );
                bgFetch('/api/db/fee-settings', { method: 'PUT', headers, body: JSON.stringify(feeSettings) });
            }
            return true;
        } catch (e) {
            console.error('Import failed:', e);
            return false;
        }
    },

    upsertDiary: async (diary) => {
        const code = getCode();
        if (!code) return;
        const entry: Diary = { ...diary, license_code: code };
        set(s => {
            const others = s.diaries.filter(d => d.date !== diary.date);
            return { diaries: [...others, entry] };
        });
        await fetch('/api/db/diary', {
            method: 'POST',
            headers: apiHeaders(),
            body: JSON.stringify(entry),
        });
    },

    getDiaryByDate: (date) => {
        return get().diaries.find(d => d.date === date);
    },

    addCaddy: (caddy) => {
        const newCaddy: Caddy = { ...caddy, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
        set(s => ({ caddies: [...s.caddies, newCaddy] }));
        bgFetch('/api/db/caddies', { method: 'POST', headers: apiHeaders(), body: JSON.stringify(newCaddy) });
    },
    updateCaddy: (id, updates) => {
        set(s => ({ caddies: s.caddies.map(c => c.id === id ? { ...c, ...updates } : c) }));
        bgFetch(`/api/db/caddies/${id}`, { method: 'PUT', headers: apiHeaders(), body: JSON.stringify(updates) });
    },
    deleteCaddy: (id) => {
        set(s => ({ caddies: s.caddies.filter(c => c.id !== id) }));
        bgFetch(`/api/db/caddies/${id}`, { method: 'DELETE', headers: apiHeaders() });
    },

    resetData: () => set({ schedules: [], clients: [], transactions: [], diaries: [], caddies: [] }),

    deleteDataBefore: (date: string) => {
        set(s => ({
            schedules: s.schedules.filter(sc => sc.createdAt && sc.createdAt >= date),
            clients: s.clients.filter(c => c.createdAt && c.createdAt >= date),
            transactions: s.transactions.filter(t => t.createdAt && t.createdAt >= date),
        }));
    },
}));

// 자동 저장: 상태 변경 시 해당 코드의 localStorage 캐시 업데이트 (디바운스 300ms)
if (typeof window !== 'undefined') {
    let _saveTimer: ReturnType<typeof setTimeout> | null = null;
    useAppStore.subscribe((state) => {
        if (!state._initialized) return;
        const code = getCode();
        if (!code) return;
        if (_saveTimer) clearTimeout(_saveTimer);
        _saveTimer = setTimeout(() => saveLocalCache(code, state), 300);
    });
}

// ─────────────────────────────────────────────────────────
// 앱 초기화: LicenseGuard 인증 후 호출
// Supabase에서 전체 데이터를 로드해 store에 세팅
// ─────────────────────────────────────────────────────────
export async function initializeStore(licenseCode: string): Promise<void> {
    const code = licenseCode.trim().toUpperCase();

    // 0단계: 이전 유저 데이터 즉시 제거 + autoSave 차단
    // (_initialized: false → subscriber의 if (!state._initialized) return; 로 autoSave 막힘)
    useAppStore.setState({
        schedules: [],
        clients: [],
        transactions: [],
        feeSettings: { shift1: 150000, shift2: 150000, shift3: 160000, useShift3: true },
        _initialized: false,
    });

    // 1단계: 캐시 사용 안 함 — Supabase가 항상 진실 (source of truth)
    // 로컬 캐시로 먼저 뜨면 다른 이용권 데이터가 화면에 노출될 수 있음

    // 2단계: Supabase에서 최신 데이터 동기화 (신뢰할 수 있는 원본)
    const headers = { 'x-license-code': code };
    try {
        // 각 API를 개별적으로 처리 — 하나가 실패해도 나머지는 정상 로드
        const safeJson = async (res: Response, fallback: any) => {
            if (!res.ok) return fallback;
            try { return await res.json(); } catch { return fallback; }
        };
        const [schedRes, clientRes, txRes, feeRes, diaryRes, caddyRes] = await Promise.all([
            fetch('/api/db/schedules', { headers }),
            fetch('/api/db/clients', { headers }),
            fetch('/api/db/transactions', { headers }),
            fetch('/api/db/fee-settings', { headers }),
            fetch('/api/db/diary', { headers }),
            fetch('/api/db/caddies', { headers }),
        ]);
        const [schedData, clientData, txData, feeData, diaryData, caddyData] = await Promise.all([
            safeJson(schedRes, { schedules: [] }),
            safeJson(clientRes, { clients: [] }),
            safeJson(txRes, { transactions: [] }),
            safeJson(feeRes, { feeSettings: null }),
            safeJson(diaryRes, { diaries: [] }),
            safeJson(caddyRes, { caddies: [] }),
        ]);
        const freshState = {
            schedules: schedData.schedules ?? [],
            clients: clientData.clients ?? [],
            transactions: txData.transactions ?? [],
            diaries: diaryData.diaries ?? [],
            caddies: caddyData.caddies ?? [],
            feeSettings: feeData.feeSettings ?? { shift1: 150000, shift2: 150000, shift3: 160000, useShift3: true },
        };

        // 구버전 caddy-manager-storage에 데이터가 있고 Supabase가 비어있으면 자동 이전
        const oldRaw = typeof window !== 'undefined' ? localStorage.getItem('caddy-manager-storage') : null;
        if (oldRaw && freshState.schedules.length === 0 && freshState.transactions.length === 0) {
            try {
                const oldParsed = JSON.parse(oldRaw);
                const oldData = oldParsed.state ?? oldParsed;
                if (oldData.schedules?.length || oldData.transactions?.length || oldData.clients?.length) {
                    // 백그라운드에서 자동 마이그레이션
                    import('@/lib/supabaseDB').then(({ migrateLocalDataToSupabase }) => {
                        migrateLocalDataToSupabase(oldData).then(() => {
                            localStorage.removeItem('caddy-manager-storage');
                        }).catch(() => {});
                    });
                    // 로컬 데이터를 즉시 store에 반영
                    const merged = {
                        schedules: (oldData.schedules ?? []).map((s: any) => ({ ...s, holes: s.holes || 18 })),
                        clients: oldData.clients ?? [],
                        transactions: oldData.transactions ?? [],
                        feeSettings: oldData.feeSettings ?? freshState.feeSettings,
                    };
                    useAppStore.setState({ ...merged, _initialized: true });
                    saveLocalCache(code, merged);
                    return;
                }
            } catch { /* 파싱 실패 무시 */ }
        }

        useAppStore.setState({ ...freshState, _initialized: true });
        // Supabase 데이터로 로컬 캐시 갱신
        saveLocalCache(code, freshState);
    } catch (e) {
        console.error('[initializeStore] 서버 동기화 실패, 로컬 캐시 사용:', e);
        // 로컬 캐시로 동작 지속
        useAppStore.setState({ _initialized: true });
    }
}
