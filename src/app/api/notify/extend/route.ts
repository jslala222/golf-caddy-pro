/**
 * POST /api/notify/extend
 * 이용권 연장 완료 시 SMS 발송 (템플릿 5)
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sendSMS, buildExtendMsg } from '@/lib/aligo';

export async function POST(request: NextRequest) {
  const { phone, licenseCode, tier, newExpiresAt } = await request.json();

  if (!phone || !licenseCode || !newExpiresAt) {
    return NextResponse.json({ ok: false, message: '필수 파라미터 없음' }, { status: 400 });
  }

  const msg = buildExtendMsg({ licenseCode, tier: tier ?? 'standard', newExpiresAt });
  const result = await sendSMS({ receiver: phone, msg, msg_type: 'LMS', title: '이용권 연장 완료' });

  return NextResponse.json(result);
}
