/**
 * POST /api/dealer/credit/charge
 * PortOne V2 결제 검증 → 딜러 크레딧 자동 충전
 *
 * Body: { paymentId, dealerToken, plan, tier, qty }
 * Response: { success } | { error }
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import type { PlanType } from '@/lib/licenseUtils';

// 딜러 공급가 (결제 금액 검증용)
const SUPPLY_PRICE: Record<'standard' | 'premium', Record<PlanType, number>> = {
  standard: { month: 7_000, '6month': 40_000, year: 70_000 },
  premium:  { month: 10_000, '6month': 50_000, year: 100_000 },
};

const CREDIT_COL: Record<'standard' | 'premium', Record<PlanType, string>> = {
  standard: { month: 'credits_month', '6month': 'credits_6month', year: 'credits_year' },
  premium:  { month: 'credits_month_premium', '6month': 'credits_6month_premium', year: 'credits_year_premium' },
};

export async function POST(request: NextRequest) {
  let body: { paymentId?: string; dealerToken?: string; plan?: string; tier?: string; qty?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '요청 형식이 잘못되었습니다.' }, { status: 400 });
  }

  const { paymentId, dealerToken, plan, tier, qty } = body;
  const resolvedTier = tier === 'premium' ? 'premium' : 'standard';
  const resolvedPlan = plan as PlanType;
  const resolvedQty = Number(qty);

  if (!paymentId || !dealerToken || !plan || !resolvedQty || resolvedQty < 1) {
    return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
  }

  if (!['month', '6month', 'year'].includes(resolvedPlan)) {
    return NextResponse.json({ error: '잘못된 요금제입니다.' }, { status: 400 });
  }

  // ── 딜러 조회 ──
  const { data: dealer } = await supabase
    .from('aone_pro_caddypro_dealers')
    .select('id, credits_month, credits_6month, credits_year, credits_month_premium, credits_6month_premium, credits_year_premium')
    .eq('token', dealerToken)
    .eq('is_active', true)
    .maybeSingle();

  if (!dealer) {
    return NextResponse.json({ error: '유효하지 않은 딜러입니다.' }, { status: 404 });
  }

  // ── 중복 처리 방지 ──
  const { data: dupCheck } = await supabase
    .from('aone_pro_caddypro_dealer_credit_history')
    .select('id')
    .eq('dealer_id', dealer.id)
    .ilike('memo', `%${paymentId}%`)
    .maybeSingle();

  if (dupCheck) {
    return NextResponse.json({ success: true, alreadyProcessed: true });
  }

  // ── PortOne V2 서버사이드 결제 검증 ──
  const expectedAmount = SUPPLY_PRICE[resolvedTier][resolvedPlan] * resolvedQty;
  const portoneSecret = process.env.PORTONE_SECRET;

  if (portoneSecret && !portoneSecret.startsWith('여기에')) {
    try {
      const verifyRes = await fetch(`https://api.portone.io/payments/${paymentId}`, {
        headers: { Authorization: `PortOne ${portoneSecret}` },
      });

      if (!verifyRes.ok) {
        return NextResponse.json({ error: '결제 검증에 실패했습니다.' }, { status: 400 });
      }

      const payment = await verifyRes.json();

      if (payment.status !== 'PAID') {
        return NextResponse.json({ error: '결제가 완료되지 않았습니다.' }, { status: 400 });
      }

      if (payment.amount?.total !== expectedAmount) {
        console.error('[dealer/credit/charge] 금액 불일치:', payment.amount?.total, '≠', expectedAmount);
        return NextResponse.json({ error: '결제 금액이 일치하지 않습니다.' }, { status: 400 });
      }
    } catch (e) {
      console.error('[dealer/credit/charge] 검증 오류:', e);
      return NextResponse.json({ error: '결제 검증 중 오류가 발생했습니다.' }, { status: 500 });
    }
  } else {
    console.warn('[dealer/credit/charge] PORTONE_SECRET 미설정 — 검증 생략 (개발 환경)');
  }

  // ── 크레딧 충전 ──
  const col = CREDIT_COL[resolvedTier][resolvedPlan];
  const currentVal = (dealer[col as keyof typeof dealer] as number) ?? 0;

  const { error: updateErr } = await supabase
    .from('aone_pro_caddypro_dealers')
    .update({ [col]: currentVal + resolvedQty })
    .eq('id', dealer.id);

  if (updateErr) {
    return NextResponse.json({ error: '크레딧 충전 중 오류가 발생했습니다.' }, { status: 500 });
  }

  // ── 충전 이력 기록 ──
  await supabase.from('aone_pro_caddypro_dealer_credit_history').insert({
    dealer_id: dealer.id,
    type: 'charge',
    plan: resolvedPlan,
    tier: resolvedTier,
    qty: resolvedQty,
    memo: `PortOne 결제:${paymentId} / ${resolvedQty}장 / ₩${expectedAmount.toLocaleString()}`,
  });

  return NextResponse.json({ success: true });
}
