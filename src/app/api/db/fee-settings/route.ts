/**
 * GET /api/db/fee-settings → 캐디피 설정 조회
 * PUT /api/db/fee-settings → 캐디피 설정 저장
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
    .from('aone_pro_caddypro_fee_settings')
    .select('*')
    .eq('license_code', code)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const feeSettings = data
    ? {
        shift1: data.shift1 ?? 150000,
        shift2: data.shift2 ?? 150000,
        shift3: data.shift3 ?? 160000,
        useShift3: data.use_shift3 ?? true,
      }
    : { shift1: 150000, shift2: 150000, shift3: 160000, useShift3: true };

  return NextResponse.json({ feeSettings });
}

export async function PUT(req: NextRequest) {
  const code = getCode(req);
  if (!code) return NextResponse.json({ error: '코드 없음' }, { status: 401 });

  const s = await req.json();
  const db = createServerClient();

  const { error } = await db.from('aone_pro_caddypro_fee_settings').upsert({
    license_code: code,
    shift1: s.shift1 ?? 150000,
    shift2: s.shift2 ?? 150000,
    shift3: s.shift3 ?? 160000,
    use_shift3: s.useShift3 ?? true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'license_code' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
