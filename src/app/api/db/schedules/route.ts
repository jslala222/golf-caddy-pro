/**
 * GET  /api/db/schedules → 이용권 코드의 전체 일정 반환
 * POST /api/db/schedules → 새 일정 추가
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
    .from('aone_pro_caddypro_schedules')
    .select('*')
    .eq('license_code', code)
    .order('date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const schedules = (data ?? []).map((r: any) => ({
    id: r.id,
    date: r.date,
    time: r.time ?? '00:00',
    type: r.type,
    shift: r.shift ?? undefined,
    holes: r.holes ?? 18,
    caddyFee: r.caddy_fee ?? 0,
    overFee: r.over_fee ?? 0,
    isRain: r.is_rain ?? false,
    swapWith: r.swap_with ?? undefined,
    title: r.title ?? '',
    memo: r.memo ?? '',
    createdAt: r.created_at,
  }));

  return NextResponse.json({ schedules });
}

export async function POST(req: NextRequest) {
  const code = getCode(req);
  if (!code) return NextResponse.json({ error: '코드 없음' }, { status: 401 });

  const s = await req.json();
  const db = createServerClient();

  // work 타입이고 shift가 있으면 같은 날 같은 부 중복 체크
  if (s.type === 'work' && s.shift) {
    const { data: existing } = await db
      .from('aone_pro_caddypro_schedules')
      .select('id')
      .eq('license_code', code)
      .eq('date', s.date)
      .eq('type', 'work')
      .eq('shift', s.shift)
      .neq('id', s.id) // 본인 id는 제외 (수정 허용)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: `이미 ${s.shift}부 근무가 등록되어 있습니다.` }, { status: 409 });
    }
  }

  const { error } = await db.from('aone_pro_caddypro_schedules').upsert({
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
    swap_with: s.swapWith ?? null,
    title: s.title ?? null,
    memo: s.memo ?? null,
    created_at: s.createdAt ?? new Date().toISOString(),
  }, { onConflict: 'id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
