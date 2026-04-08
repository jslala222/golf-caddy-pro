/**
 * POST /api/notify/welcome
 * 이용권 첫 등록 시 환영 SMS 발송
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sendSMS, buildWelcomeMsg } from '@/lib/aligo';

export async function POST(request: NextRequest) {
  const { phone, licenseCode, tier, expiresAt } = await request.json();

  if (!phone || !licenseCode || !expiresAt) {
    return NextResponse.json({ ok: false, message: '필수 파라미터 없음' }, { status: 400 });
  }

  const msg = buildWelcomeMsg({ licenseCode, tier: tier ?? 'standard', expiresAt });
  const result = await sendSMS({ receiver: phone, msg, msg_type: 'LMS', title: '캐디 매니저 Pro 가입 완료' });

  return NextResponse.json(result);
}
