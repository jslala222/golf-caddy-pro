/**
 * POST /api/test/issue
 * 결제 없이 테스트용 이용권 코드 직접 발급
 * ⚠️ 마스터 비번(0827) 필요 — 테스트 전용
 */
import { NextRequest, NextResponse } from 'next/server';
import { issueVoucher } from '@/lib/licenseUtils';
import type { PlanType } from '@/lib/licenseUtils';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { masterPin, name, phone, plan, tier } = body;

  if (masterPin !== '0827') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 });
  }

  const planMap: Record<string, number> = { month: 30, '6month': 180, year: 365 };
  const days = planMap[plan] ?? 30;
  const resolvedTier = tier === 'premium' ? 'premium' : 'standard';

  const result = await issueVoucher({
    channel: 'direct',
    plan: plan as PlanType,
    days,
    tier: resolvedTier,
    memo: `TEST:${Date.now()}`,
    userName: name || '테스트',
    userPhone: phone || '010-0000-0000',
    issuedBy: 'test',
  });

  if (!result.success || !result.code) {
    return NextResponse.json({ error: result.error ?? '발급 실패' }, { status: 500 });
  }

  return NextResponse.json({ code: result.code });
}
