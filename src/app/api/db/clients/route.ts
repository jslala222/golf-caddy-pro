/**
 * GET  /api/db/clients → 전체 고객 목록
 * POST /api/db/clients → 고객 추가
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

function getCode(req: NextRequest) {
  return req.headers.get('x-license-code')?.trim().toUpperCase() ?? null;
}

export async function GET(req: NextRequest) {
  const code = getCode(req);
  if (!code) return NextResponse.json({ error: '코드 없음' }, { status: 401 });

  const db = createServerClient();
  const { data, error } = await db
    .from('aone_pro_caddypro_clients')
    .select('*')
    .eq('license_code', code)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const clients = (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    contact: r.phone ?? undefined,
    carInfo: r.car_info ?? undefined,
    birthDate: r.birth_date ?? undefined,
    memo: r.memo ?? '',
    grade: r.grade ?? 'normal',
    visitCount: r.visit_count ?? 0,
    lastVisit: r.last_visit ?? undefined,
    createdAt: r.created_at,
  }));

  return NextResponse.json({ clients });
}

export async function POST(req: NextRequest) {
  const code = getCode(req);
  if (!code) return NextResponse.json({ error: '코드 없음' }, { status: 401 });

  const c = await req.json();
  const db = createServerClient();

  const { error } = await db.from('aone_pro_caddypro_clients').upsert({
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
  }, { onConflict: 'id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
