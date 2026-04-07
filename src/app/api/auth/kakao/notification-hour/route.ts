/**
 * PUT /api/auth/kakao/notification-hour
 * 사용자가 설정한 알림 시각(KST)을 Supabase에 저장
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function PUT(request: NextRequest) {
  const { licenseCode, hour } = await request.json();

  if (!licenseCode || hour === undefined || hour < 5 || hour > 9) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  }

  const { error } = await supabase
    .from('aone_pro_caddypro_kakao_tokens')
    .update({ notification_hour: hour })
    .eq('license_code', licenseCode);

  if (error) {
    return NextResponse.json({ error: 'DB 저장 실패' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
