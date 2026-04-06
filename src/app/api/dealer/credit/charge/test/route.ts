/**
 * POST /api/dealer/credit/charge/test
 * ⚠️ 개발/테스트 전용 — 결제 없이 딜러 크레딧 직접 충전
 * Body: { dealerToken, cartItems: [{plan, tier, qty}] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import type { PlanType } from '@/lib/licenseUtils';

const CREDIT_COL: Record<'standard' | 'premium', Record<PlanType, string>> = {
  standard: { month: 'credits_month', '6month': 'credits_6month', year: 'credits_year' },
  premium:  { month: 'credits_month_premium', '6month': 'credits_6month_premium', year: 'credits_year_premium' },
};

type CartItem = { plan: string; tier: string; qty: number };

export async function POST(request: NextRequest) {
  let body: { dealerToken?: string; cartItems?: CartItem[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const { dealerToken, cartItems } = body;
  if (!dealerToken || !cartItems?.length) {
    return NextResponse.json({ error: 'dealerToken, cartItems 필수' }, { status: 400 });
  }

  // 딜러 조회
  const { data: dealer, error: dealerErr } = await supabase
    .from('aone_pro_caddypro_dealers')
    .select('id, credits_month, credits_6month, credits_year, credits_month_premium, credits_6month_premium, credits_year_premium')
    .eq('token', dealerToken)
    .eq('is_active', true)
    .maybeSingle();

  if (dealerErr || !dealer) {
    return NextResponse.json({ error: '딜러를 찾을 수 없습니다.' }, { status: 404 });
  }

  // 크레딧 합산 업데이트
  const updates: Record<string, number> = {};
  for (const item of cartItems) {
    const tier = (item.tier === 'premium' ? 'premium' : 'standard') as 'standard' | 'premium';
    const plan = item.plan as PlanType;
    const col = CREDIT_COL[tier]?.[plan];
    if (!col) continue;
    updates[col] = (updates[col] ?? (dealer[col as keyof typeof dealer] as number ?? 0)) + item.qty;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '유효한 크레딧 항목 없음' }, { status: 400 });
  }

  const { error: updateErr } = await supabase
    .from('aone_pro_caddypro_dealers')
    .update(updates)
    .eq('id', dealer.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 이력 기록
  for (const item of cartItems) {
    await supabase.from('aone_pro_caddypro_dealer_credit_history').insert({
      dealer_id: dealer.id,
      type: 'charge',
      plan: item.plan,
      tier: item.tier,
      qty: item.qty,
      memo: '[테스트] 결제 없이 직접 충전',
    });
  }

  return NextResponse.json({ success: true });
}
