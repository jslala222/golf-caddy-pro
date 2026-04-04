/**
 * supabaseDB.ts
 * localStorage(Zustand) + Supabase 하이브리드 저장 유틸
 * - localStorage가 주 저장소, Supabase는 동기화 대상
 * - Supabase 저장 실패해도 앱은 정상 동작 (fire-and-forget)
 */

import { supabase } from './supabaseClient';
import type { Schedule, Transaction, Client } from './store';

const getLicenseCode = (): string | null =>
  typeof window !== 'undefined' ? localStorage.getItem('caddy_license_key') : null;

// ─── 공통 헬퍼 ───
function silent(fn: () => PromiseLike<unknown>): void {
  (async () => { try { await fn(); } catch (e) { console.warn('[supabaseDB]', e); } })();
}

// ─────────────────────────────────────
// SCHEDULES
// ─────────────────────────────────────

export function syncAddSchedule(s: Schedule) {
  const code = getLicenseCode();
  if (!code) return;
  silent(() =>
    supabase.from('aone_pro_caddypro_schedules').upsert({
      id:           s.id,
      license_code: code.toUpperCase(),
      date:         s.date,
      type:         s.type,
      shift:        s.shift ?? null,
      holes:        s.holes ?? 18,
      caddy_fee:    s.caddyFee ?? 0,
      over_fee:     s.overFee ?? 0,
      is_rain:      s.isRain ?? false,
      title:        s.title ?? null,
      memo:         s.memo ?? null,
      created_at:   s.createdAt ?? new Date().toISOString(),
    }, { onConflict: 'id' })
  );
}

export function syncUpdateSchedule(id: string, updates: Partial<Schedule>) {
  const code = getLicenseCode();
  if (!code) return;
  const patch: Record<string, unknown> = {};
  if (updates.date     !== undefined) patch.date      = updates.date;
  if (updates.type     !== undefined) patch.type      = updates.type;
  if (updates.shift    !== undefined) patch.shift     = updates.shift;
  if (updates.holes    !== undefined) patch.holes     = updates.holes;
  if (updates.caddyFee !== undefined) patch.caddy_fee = updates.caddyFee;
  if (updates.overFee  !== undefined) patch.over_fee  = updates.overFee;
  if (updates.isRain   !== undefined) patch.is_rain   = updates.isRain;
  if (updates.title    !== undefined) patch.title     = updates.title;
  if (updates.memo     !== undefined) patch.memo      = updates.memo;
  if (Object.keys(patch).length === 0) return;
  silent(() =>
    supabase.from('aone_pro_caddypro_schedules')
      .update(patch)
      .eq('id', id)
      .eq('license_code', code.toUpperCase())
  );
}

export function syncDeleteSchedule(id: string) {
  const code = getLicenseCode();
  if (!code) return;
  silent(() =>
    supabase.from('aone_pro_caddypro_schedules')
      .delete()
      .eq('id', id)
      .eq('license_code', code.toUpperCase())
  );
}

// ─────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────

export function syncAddTransaction(t: Transaction) {
  const code = getLicenseCode();
  if (!code) return;
  silent(() =>
    supabase.from('aone_pro_caddypro_transactions').upsert({
      id:           t.id,
      license_code: code.toUpperCase(),
      schedule_id:  null,
      date:         t.date,
      type:         t.type,
      amount:       t.amount,
      category:     t.category ?? null,
      memo:         t.memo ?? null,
      created_at:   t.createdAt ?? new Date().toISOString(),
    }, { onConflict: 'id' })
  );
}

export function syncDeleteTransaction(id: string) {
  const code = getLicenseCode();
  if (!code) return;
  silent(() =>
    supabase.from('aone_pro_caddypro_transactions')
      .delete()
      .eq('id', id)
      .eq('license_code', code.toUpperCase())
  );
}

// ─────────────────────────────────────
// CLIENTS
// ─────────────────────────────────────

export function syncAddClient(c: Client) {
  const code = getLicenseCode();
  if (!code) return;
  silent(() =>
    supabase.from('aone_pro_caddypro_clients').upsert({
      id:           c.id,
      license_code: code.toUpperCase(),
      name:         c.name,
      phone:        c.contact ?? null,
      car_info:     c.carInfo ?? null,
      birth_date:   c.birthDate ?? null,
      grade:        c.grade,
      visit_count:  c.visitCount ?? 0,
      last_visit:   c.lastVisit ?? null,
      memo:         c.memo ?? null,
      created_at:   c.createdAt ?? new Date().toISOString(),
    }, { onConflict: 'id' })
  );
}

export function syncUpdateClient(id: string, updates: Partial<Client>) {
  const code = getLicenseCode();
  if (!code) return;
  const patch: Record<string, unknown> = {};
  if (updates.name       !== undefined) patch.name        = updates.name;
  if (updates.contact    !== undefined) patch.phone       = updates.contact;
  if (updates.carInfo    !== undefined) patch.car_info    = updates.carInfo;
  if (updates.birthDate  !== undefined) patch.birth_date  = updates.birthDate;
  if (updates.grade      !== undefined) patch.grade       = updates.grade;
  if (updates.visitCount !== undefined) patch.visit_count = updates.visitCount;
  if (updates.lastVisit  !== undefined) patch.last_visit  = updates.lastVisit;
  if (updates.memo       !== undefined) patch.memo        = updates.memo;
  if (Object.keys(patch).length === 0) return;
  silent(() =>
    supabase.from('aone_pro_caddypro_clients')
      .update(patch)
      .eq('id', id)
      .eq('license_code', code.toUpperCase())
  );
}

export function syncDeleteClient(id: string) {
  const code = getLicenseCode();
  if (!code) return;
  silent(() =>
    supabase.from('aone_pro_caddypro_clients')
      .delete()
      .eq('id', id)
      .eq('license_code', code.toUpperCase())
  );
}

// ─────────────────────────────────────
// FEE SETTINGS
// ─────────────────────────────────────

export function syncFeeSettings(settings: { shift1: number; shift2: number; shift3: number; useShift3: boolean }) {
  const code = getLicenseCode();
  if (!code) return;
  silent(() =>
    supabase.from('aone_pro_caddypro_fee_settings').upsert({
      license_code: code.toUpperCase(),
      shift1:       settings.shift1,
      shift2:       settings.shift2,
      shift3:       settings.shift3,
      use_shift3:   settings.useShift3,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'license_code' })
  );
}

// ─────────────────────────────────────
// 마이그레이션: localStorage JSON → Supabase 일괄 업로드
// ─────────────────────────────────────

export async function migrateLocalDataToSupabase(data: {
  schedules: Schedule[];
  transactions: Transaction[];
  clients: Client[];
  feeSettings?: { shift1: number; shift2: number; shift3: number; useShift3: boolean };
}): Promise<{ ok: boolean; message: string }> {
  const code = getLicenseCode();
  if (!code) return { ok: false, message: '이용코드 없음' };
  const upperCode = code.toUpperCase();

  try {
    // 일정
    if (data.schedules.length > 0) {
      const rows = data.schedules.map(s => ({
        id: s.id, license_code: upperCode, date: s.date, type: s.type,
        shift: s.shift ?? null, holes: s.holes ?? 18,
        caddy_fee: s.caddyFee ?? 0, over_fee: s.overFee ?? 0,
        is_rain: s.isRain ?? false, title: s.title ?? null, memo: s.memo ?? null,
        created_at: s.createdAt ?? new Date().toISOString(),
      }));
      await supabase.from('aone_pro_caddypro_schedules').upsert(rows, { onConflict: 'id' });
    }

    // 수입/지출
    if (data.transactions.length > 0) {
      const rows = data.transactions.map(t => ({
        id: t.id, license_code: upperCode, schedule_id: null,
        date: t.date, type: t.type, amount: t.amount,
        category: t.category ?? null, memo: t.memo ?? null,
        created_at: t.createdAt ?? new Date().toISOString(),
      }));
      await supabase.from('aone_pro_caddypro_transactions').upsert(rows, { onConflict: 'id' });
    }

    // 고객
    if (data.clients.length > 0) {
      const rows = data.clients.map(c => ({
        id: c.id, license_code: upperCode, name: c.name,
        phone: c.contact ?? null, car_info: c.carInfo ?? null,
        birth_date: c.birthDate ?? null, grade: c.grade,
        visit_count: c.visitCount ?? 0, last_visit: c.lastVisit ?? null,
        memo: c.memo ?? null, created_at: c.createdAt ?? new Date().toISOString(),
      }));
      await supabase.from('aone_pro_caddypro_clients').upsert(rows, { onConflict: 'id' });
    }

    // 캐디피 설정
    if (data.feeSettings) {
      await supabase.from('aone_pro_caddypro_fee_settings').upsert({
        license_code: upperCode, shift1: data.feeSettings.shift1,
        shift2: data.feeSettings.shift2, shift3: data.feeSettings.shift3,
        use_shift3: data.feeSettings.useShift3, updated_at: new Date().toISOString(),
      }, { onConflict: 'license_code' });
    }

    return { ok: true, message: `마이그레이션 완료 (일정 ${data.schedules.length}건, 수입/지출 ${data.transactions.length}건, 고객 ${data.clients.length}건)` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}
