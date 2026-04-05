/**
 * DELETE /api/db/transactions/[id] → 거래 삭제
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

function getCode(req: NextRequest) {
  return req.headers.get('x-license-code')?.trim().toUpperCase() ?? null;
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const code = getCode(req);
  if (!code) return NextResponse.json({ error: '코드 없음' }, { status: 401 });

  const db = createServerClient();
  const { error } = await db
    .from('aone_pro_caddypro_transactions')
    .delete()
    .eq('id', params.id)
    .eq('license_code', code);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
