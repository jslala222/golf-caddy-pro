/**
 * GET  /api/db/transactions → 전체 거래 내역
 * POST /api/db/transactions → 거래 추가
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
    .from('aone_pro_caddypro_transactions')
    .select('*')
    .eq('license_code', code)
    .order('date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const transactions = (data ?? []).map((r: any) => ({
    id: r.id,
    date: r.date,
    type: r.type,
    amount: r.amount,
    category: r.category ?? undefined,
    memo: r.memo ?? '',
    receiptUrl: r.receipt_url ?? undefined,
    createdAt: r.created_at,
  }));

  return NextResponse.json({ transactions });
}

export async function POST(req: NextRequest) {
  const code = getCode(req);
  if (!code) return NextResponse.json({ error: '코드 없음' }, { status: 401 });

  const t = await req.json();
  const db = createServerClient();

  const { error } = await db.from('aone_pro_caddypro_transactions').upsert({
    id: t.id,
    license_code: code,
    schedule_id: null,
    date: t.date,
    type: t.type,
    amount: t.amount,
    category: t.category ?? null,
    memo: t.memo ?? null,
    receipt_url: t.receiptUrl ?? null,
    created_at: t.createdAt ?? new Date().toISOString(),
  }, { onConflict: 'id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
