/**
 * GET /api/cron/expire-notify
 * Vercel Cron (매일 KST 10시 = UTC 01:00) → 만료 D-7/D-3/D-1 사용자에게 SMS 발송
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { sendSMS, buildExpireMsg } from '@/lib/aligo';

export async function GET(request: NextRequest) {
  // Vercel Cron 인증
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  // 오늘 ~ 7일 후 만료 예정인 사용자 조회
  const sevenDaysLater = new Date(now.getTime() + 7 * 86_400_000);

  const { data: licenses, error } = await supabase
    .from('aone_pro_caddypro_licenses')
    .select('code, tier, expires_at, phone')
    .gte('expires_at', now.toISOString())
    .lte('expires_at', sevenDaysLater.toISOString())
    .not('phone', 'is', null);

  if (error || !licenses || licenses.length === 0) {
    return NextResponse.json({ sent: 0, reason: '만료 예정 대상 없음' });
  }

  let sentCount = 0;

  for (const lic of licenses) {
    if (!lic.phone) continue;

    const daysLeft = Math.ceil((new Date(lic.expires_at).getTime() - now.getTime()) / 86_400_000);

    // D-7, D-3, D-1 에만 발송
    if (![7, 3, 1].includes(daysLeft)) continue;

    const msg = buildExpireMsg({
      licenseCode: lic.code,
      tier: lic.tier || 'standard',
      expiresAt: lic.expires_at,
      daysLeft,
    });

    const result = await sendSMS({
      receiver: lic.phone,
      msg,
      msg_type: 'LMS',
      title: `이용권 만료 ${daysLeft}일 전 안내`,
    });

    if (result.ok) sentCount++;
  }

  return NextResponse.json({ sent: sentCount, total: licenses.length });
}
