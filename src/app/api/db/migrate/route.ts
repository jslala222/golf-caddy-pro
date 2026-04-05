/**
 * POST /api/db/migrate
 * Body: { licenseCode, data: { schedules, clients, transactions, feeSettings } }
 * 로컬 데이터를 Supabase로 일괄 이전
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { licenseCode, data } = body;

  if (!licenseCode || typeof licenseCode !== 'string') {
    return NextResponse.json({ error: '이용권 코드가 필요합니다.' }, { status: 400 });
  }
  const code = licenseCode.trim().toUpperCase();
  const db = createServerClient();

  let schedulesOk = 0, clientsOk = 0, transactionsOk = 0;
  const errors: string[] = [];

  // ── schedules ──
  const schedules: any[] = data?.schedules ?? [];
  if (schedules.length > 0) {
    const rows = schedules.map((s: any) => ({
      id: s.id,
      license_code: code,
      date: s.date,
      time: s.time ?? '00:00',
      type: s.type,
      shift: s.shift ?? null,
      holes: s.holes ?? 18,
      caddy_fee: s.caddyFee ?? 0,
      over_fee: s.overFee ?? 0,
      is_rain: s.isRain ?? false,
      title: s.title ?? null,
      memo: s.memo ?? null,
      created_at: s.createdAt ?? new Date().toISOString(),
    }));
    const { error } = await db
      .from('aone_pro_caddypro_schedules')
      .upsert(rows, { onConflict: 'id' });
    if (error) errors.push('schedules: ' + error.message);
    else schedulesOk = rows.length;
  }

  // ── clients ──
  const clients: any[] = data?.clients ?? [];
  if (clients.length > 0) {
    const rows = clients.map((c: any) => ({
      id: c.id,
      license_code: code,
      name: c.name,
      phone: c.contact ?? null,
      car_info: c.carInfo ?? null,
      birth_date: c.birthDate ?? null,
      memo: c.memo ?? null,
      grade: c.grade ?? 'normal',
      visit_count: c.visitCount ?? 0,
      last_visit: c.lastVisit ?? null,
      created_at: c.createdAt ?? new Date().toISOString(),
    }));
    const { error } = await db
      .from('aone_pro_caddypro_clients')
      .upsert(rows, { onConflict: 'id' });
    if (error) errors.push('clients: ' + error.message);
    else clientsOk = rows.length;
  }

  // ── transactions ──
  const transactions: any[] = data?.transactions ?? [];
  if (transactions.length > 0) {
    const rows = transactions.map((t: any) => ({
      id: t.id,
      license_code: code,
      schedule_id: null,
      date: t.date,
      type: t.type,
      amount: t.amount,
      category: t.category ?? null,
      memo: t.memo ?? null,
      created_at: t.createdAt ?? new Date().toISOString(),
    }));
    const { error } = await db
      .from('aone_pro_caddypro_transactions')
      .upsert(rows, { onConflict: 'id' });
    if (error) errors.push('transactions: ' + error.message);
    else transactionsOk = rows.length;
  }

  // ── fee_settings ──
  if (data?.feeSettings) {
    const fs = data.feeSettings;
    const { error } = await db.from('aone_pro_caddypro_fee_settings').upsert({
      license_code: code,
      shift1: fs.shift1 ?? 150000,
      shift2: fs.shift2 ?? 150000,
      shift3: fs.shift3 ?? 160000,
      use_shift3: fs.useShift3 ?? true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'license_code' });
    if (error) errors.push('fee_settings: ' + error.message);
  }

  if (errors.length > 0) {
    return NextResponse.json({ success: false, errors }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    migrated: { schedules: schedulesOk, clients: clientsOk, transactions: transactionsOk },
  });
}
