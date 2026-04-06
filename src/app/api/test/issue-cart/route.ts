/**
 * POST /api/test/issue-cart
 * 결제 없이 테스트용 이용권 코드 다중 발급 (장바구니)
 * ⚠️ 마스터 비번(0827) 필요 — 테스트 전용
 *
 * Body: {
 *   masterPin: string,
 *   name: string,
 *   phone: string,
 *   items: Array<{ tier: 'standard'|'premium', plan: 'month'|'6month'|'year', qty: number }>
 * }
 * Response: { results: Array<{ tier, plan, code }> } | { error }
 */
import { NextRequest, NextResponse } from 'next/server';
import { issueVoucher } from '@/lib/licenseUtils';
import type { PlanType } from '@/lib/licenseUtils';

const PLAN_DAYS: Record<string, number> = { month: 30, '6month': 180, year: 365 };
const VALID_PLANS = ['month', '6month', 'year'];
const VALID_TIERS = ['standard', 'premium'];

export async function POST(request: NextRequest) {
  let body: {
    masterPin?: string;
    name?: string;
    phone?: string;
    items?: Array<{ tier: string; plan: string; qty: number }>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '요청 형식이 잘못되었습니다.' }, { status: 400 });
  }

  const { masterPin, name, phone, items } = body;

  // 인증
  if (masterPin !== '0827') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 });
  }

  // 유효성 검사
  if (!name || !phone) {
    return NextResponse.json({ error: '이름과 연락처는 필수입니다.' }, { status: 400 });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: '장바구니가 비어 있습니다.' }, { status: 400 });
  }

  // 총 수량 제한 (최대 50장)
  const totalQty = items.reduce((s, it) => s + (it.qty ?? 0), 0);
  if (totalQty > 50) {
    return NextResponse.json({ error: '총 수량은 50장을 초과할 수 없습니다.' }, { status: 400 });
  }

  const results: { tier: string; plan: string; code: string }[] = [];
  const ts = Date.now();

  for (const item of items) {
    if (!VALID_PLANS.includes(item.plan) || !VALID_TIERS.includes(item.tier)) continue;
    const qty = Math.min(Math.max(1, Math.floor(item.qty ?? 1)), 20);
    const days = PLAN_DAYS[item.plan];
    const tier = item.tier === 'premium' ? 'premium' : 'standard';

    for (let i = 0; i < qty; i++) {
      const result = await issueVoucher({
        channel: 'direct',
        plan: item.plan as PlanType,
        days,
        tier,
        memo: `TEST-CART:${ts}-${i}`,
        userName: name,
        userPhone: phone,
        issuedBy: 'test-cart',
      });

      if (!result.success || !result.code) {
        return NextResponse.json(
          { error: `코드 발급 실패 (${item.tier} ${item.plan} ${i+1}번째): ${result.error ?? '알 수 없는 오류'}` },
          { status: 500 },
        );
      }

      results.push({ tier: item.tier, plan: item.plan, code: result.code });
    }
  }

  return NextResponse.json({ results });
}
