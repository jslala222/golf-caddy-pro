/**
 * PUT    /api/db/schedules/[id] → 일정 수정
 * DELETE /api/db/schedules/[id] → 일정 삭제
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

function getCode(req: NextRequest) {
  return req.headers.get('x-license-code')?.trim().toUpperCase() ?? null;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const code = getCode(req);
  if (!code) return NextResponse.json({ error: '코드 없음' }, { status: 401 });

  const updates = await req.json();
  const patch: Record<string, unknown> = {};
  if (updates.date      !== undefined) patch.date      = updates.date;
  if (updates.time      !== undefined) patch.time      = updates.time;
  if (updates.type      !== undefined) patch.type      = updates.type;
  if (updates.shift     !== undefined) patch.shift     = updates.shift;
  if (updates.holes     !== undefined) patch.holes     = updates.holes;
  if (updates.caddyFee  !== undefined) patch.caddy_fee = updates.caddyFee;
  if (updates.overFee   !== undefined) patch.over_fee  = updates.overFee;
  if (updates.isRain    !== undefined) patch.is_rain   = updates.isRain;
  if (updates.swapWith  !== undefined) patch.swap_with  = updates.swapWith;
  if (updates.swapMemo  !== undefined) patch.swap_memo  = updates.swapMemo;
  if (updates.title     !== undefined) patch.title      = updates.title;
  if (updates.memo      !== undefined) patch.memo      = updates.memo;

  const db = createServerClient();
  const { error } = await db
    .from('aone_pro_caddypro_schedules')
    .update(patch)
    .eq('id', params.id)
    .eq('license_code', code);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const code = getCode(req);
  if (!code) return NextResponse.json({ error: '코드 없음' }, { status: 401 });

  const db = createServerClient();
  const { error } = await db
    .from('aone_pro_caddypro_schedules')
    .delete()
    .eq('id', params.id)
    .eq('license_code', code);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
