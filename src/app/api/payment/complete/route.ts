/**
 * POST /api/payment/complete
 * PortOne V2 결제 검증 → 이용권 코드 자동 발급
 *
 * Body: { paymentId, name, phone, planKey }
 * Response: { code } | { error }
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { issueVoucher } from '@/lib/licenseUtils';
import type { PlanType } from '@/lib/licenseUtils';

// ⚠️ 테스트 모드 — 확인 후 원복 필요
const VALID_PLANS: Record<string, { days: number; amount: number; premiumAmount: number }> = {
  month:    { days: 30,  amount: 150, premiumAmount: 150 },
  '6month': { days: 180, amount: 150, premiumAmount: 150 },
  year:     { days: 365, amount: 150, premiumAmount: 150 },
};

export async function POST(request: NextRequest) {
  let body: { paymentId?: string; name?: string; phone?: string; planKey?: string; tier?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '요청 형식이 잘못되었습니다.' }, { status: 400 });
  }

  const { paymentId, name, phone, planKey, tier } = body;
  const resolvedTier = tier === 'premium' ? 'premium' : 'standard';

  if (!paymentId || !name || !phone || !planKey) {
    return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
  }

  const planInfo = VALID_PLANS[planKey];
  if (!planInfo) {
    return NextResponse.json({ error: '잘못된 요금제입니다.' }, { status: 400 });
  }

  // ── 중복 발급 방지: 같은 paymentId로 이미 발급된 코드가 있으면 재반환 ──
  const { data: existing } = await supabase
    .from('aone_pro_caddypro_licenses')
    .select('code')
    .ilike('memo', `%${paymentId}%`)
    .maybeSingle();

  if (existing?.code) {
    return NextResponse.json({ code: existing.code });
  }

  // ── PortOne V2 서버사이드 결제 검증 ──────────────────────────
  const portoneSecret = process.env.PORTONE_SECRET;
  if (portoneSecret && !portoneSecret.startsWith('여기에')) {
    try {
      const verifyRes = await fetch(`https://api.portone.io/payments/${paymentId}`, {
        headers: { Authorization: `PortOne ${portoneSecret}` },
      });

      if (!verifyRes.ok) {
        console.error('[payment/complete] PortOne API 오류:', verifyRes.status);
        return NextResponse.json({ error: '결제 검증에 실패했습니다.' }, { status: 400 });
      }

      const payment = await verifyRes.json();

      if (payment.status !== 'PAID') {
        return NextResponse.json({ error: '결제가 완료되지 않았습니다.' }, { status: 400 });
      }

      // 금액 위변조 방지
      const expectedAmount = resolvedTier === 'premium' ? planInfo.premiumAmount : planInfo.amount;
      if (payment.amount?.total !== expectedAmount) {
        console.error('[payment/complete] 금액 불일치:', payment.amount?.total, '≠', expectedAmount);
        return NextResponse.json({ error: '결제 금액이 일치하지 않습니다.' }, { status: 400 });
      }
    } catch (e) {
      console.error('[payment/complete] 검증 오류:', e);
      return NextResponse.json({ error: '결제 검증 중 오류가 발생했습니다.' }, { status: 500 });
    }
  } else {
    // PORTONE_SECRET 미설정 시 경고 (개발 환경)
    console.warn('[payment/complete] PORTONE_SECRET 미설정 — 검증 생략 (개발 환경)');
  }

  // ── 이용권 코드 발급 ────────────────────────────────────────
  const result = await issueVoucher({
    channel: 'direct',
    plan: planKey as PlanType,
    days: planInfo.days,
    tier: resolvedTier,
    memo: `PortOne:${paymentId}`,
    userName: name,
    userPhone: phone,
    issuedBy: 'portone',
  });

  if (!result.success || !result.code) {
    console.error('[payment/complete] 코드 발급 실패:', result.error);
    return NextResponse.json({ error: '이용권 발급 중 오류가 발생했습니다. 고객센터로 문의해주세요.' }, { status: 500 });
  }

  return NextResponse.json({ code: result.code });
}
