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

const VALID_PLANS: Record<string, { days: number; amount: number; premiumAmount: number }> = {
  month:    { days: 30,  amount: 9_900,  premiumAmount: 12_900  },
  '6month': { days: 180, amount: 55_000, premiumAmount: 69_000  },
  year:     { days: 365, amount: 99_000, premiumAmount: 129_000 },
};

export async function POST(request: NextRequest) {
  let body: { paymentId?: string; name?: string; phone?: string; planKey?: string; tier?: string; dealerRef?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '요청 형식이 잘못되었습니다.' }, { status: 400 });
  }

  const { paymentId, name, phone, planKey, tier, dealerRef } = body;
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

      // ── 실시간계좌이체 현금영수증 자동 자진발급 ────────────────
      // 고객이 현금영수증 선택 안 했을 때 + 10만원 이상 → 국세청 자진발급 번호로 자동 발급
      const isTransfer = payment.method?.type === 'Transfer';
      const hasReceipt = !!payment.cashReceipt;
      const totalAmount: number = payment.amount?.total ?? 0;

      if (isTransfer && !hasReceipt && totalAmount >= 100_000) {
        try {
          const receiptRes = await fetch(`https://api.portone.io/payments/${paymentId}/cash-receipts`, {
            method: 'POST',
            headers: {
              Authorization: `PortOne ${portoneSecret}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'PERSONAL',
              identifier: '0100001234',       // 국세청 지정 미제공 자진발급 번호
              identifierType: 'MOBILE_NUMBER',
            }),
          });
          if (!receiptRes.ok) {
            const errBody = await receiptRes.text();
            console.warn('[payment/complete] 현금영수증 자진발급 실패:', receiptRes.status, errBody);
          } else {
            console.log('[payment/complete] 현금영수증 자진발급 완료:', paymentId);
          }
        } catch (receiptErr) {
          // 현금영수증 실패해도 이용권 발급은 계속 진행
          console.warn('[payment/complete] 현금영수증 자진발급 오류:', receiptErr);
        }
      }
    } catch (e) {
      console.error('[payment/complete] 검증 오류:', e);
      return NextResponse.json({ error: '결제 검증 중 오류가 발생했습니다.' }, { status: 500 });
    }
  } else {
    // PORTONE_SECRET 미설정 시 경고 (개발 환경)
    console.warn('[payment/complete] PORTONE_SECRET 미설정 — 검증 생략 (개발 환경)');
  }

  // ── 딜러 연결 결정 ────────────────────────────────────────
  // 1순위: 결제 페이지 URL에 포함된 dealerRef (딜러 링크로 유입)
  // 2순위: 해당 전화번호로 기존에 발급된 이용권의 issued_by (재구독 시 원래 딜러 유지)
  let finalDealerToken: string | null = typeof dealerRef === 'string' && dealerRef.trim() ? dealerRef.trim() : null;

  if (!finalDealerToken) {
    const { data: prevLicense } = await supabase
      .from('aone_pro_caddypro_licenses')
      .select('issued_by')
      .eq('user_phone', phone)
      .ilike('issued_by', 'dealer_%')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prevLicense?.issued_by?.startsWith('dealer_')) {
      finalDealerToken = prevLicense.issued_by.slice(7); // 'dealer_' 제거
    }
  }

  // 딜러 정보 조회 (토큰 → id, commission_rate)
  let dealerRecord: { id: string; commission_rate?: number | null } | null = null;
  if (finalDealerToken) {
    const { data: dl } = await supabase
      .from('aone_pro_caddypro_dealers')
      .select('id, commission_rate')
      .eq('token', finalDealerToken)
      .eq('is_active', true)
      .maybeSingle();
    dealerRecord = dl ?? null;
  }

  const issuedBy = dealerRecord ? `dealer_${finalDealerToken}` : 'portone';

  // ── 이용권 코드 발급 ────────────────────────────────────────
  const result = await issueVoucher({
    channel: 'direct',
    plan: planKey as PlanType,
    days: planInfo.days,
    tier: resolvedTier,
    memo: `PortOne:${paymentId}`,
    userName: name,
    userPhone: phone,
    issuedBy,
  });

  if (!result.success || !result.code) {
    console.error('[payment/complete] 코드 발급 실패:', result.error);
    return NextResponse.json({ error: '이용권 발급 중 오류가 발생했습니다. 고객센터로 문의해주세요.' }, { status: 500 });
  }

  // ── 딜러 수당 정산 적립 ─────────────────────────────────────
  if (dealerRecord) {
    const saleAmount = resolvedTier === 'premium' ? planInfo.premiumAmount : planInfo.amount;
    const commissionRate = dealerRecord.commission_rate ?? 0.2;
    const commissionAmount = Math.round(saleAmount * commissionRate);
    // dealerRef 직접 전달됐으면 신규, 기존 issued_by에서 찾았으면 재구독
    const settlementType: 'first' | 'renewal' = typeof dealerRef === 'string' && dealerRef.trim() ? 'first' : 'renewal';

    try {
      await supabase.from('aone_pro_caddypro_settlements').insert({
        dealer_id: dealerRecord.id,
        license_code: result.code,
        type: settlementType,
        plan: planKey,
        sale_amount: saleAmount,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        settled: false,
      });
    } catch (settlementErr) {
      // 정산 기록 실패해도 이용권 발급은 이미 완료 — 로그만 남김
      console.error('[payment/complete] 정산 기록 실패:', settlementErr);
    }
  }

  return NextResponse.json({ code: result.code });
}
