/**
 * PUT    /api/db/clients/[id] → 고객 수정
 * DELETE /api/db/clients/[id] → 고객 삭제
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
  if (updates.name       !== undefined) patch.name        = updates.name;
  if (updates.contact    !== undefined) patch.phone       = updates.contact;
  if (updates.carInfo    !== undefined) patch.car_info    = updates.carInfo;
  if (updates.birthDate  !== undefined) patch.birth_date  = updates.birthDate;
  if (updates.memo       !== undefined) patch.memo        = updates.memo;
  if (updates.grade      !== undefined) patch.grade       = updates.grade;
  if (updates.visitCount !== undefined) patch.visit_count = updates.visitCount;
  if (updates.lastVisit  !== undefined) patch.last_visit  = updates.lastVisit;

  const db = createServerClient();
  const { error } = await db
    .from('aone_pro_caddypro_clients')
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
    .from('aone_pro_caddypro_clients')
    .delete()
    .eq('id', params.id)
    .eq('license_code', code);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
