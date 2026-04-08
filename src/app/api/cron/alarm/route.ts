/**
 * GET /api/cron/alarm
 * Vercel Cron → 오늘 일정 조회 → 알리고 SMS 발송
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { sendSMS, buildScheduleMsg } from '@/lib/aligo';

export async function GET(request: NextRequest) {
  // Vercel Cron 인증
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hourParam = request.nextUrl.searchParams.get('hour');
  const targetHour = hourParam ? parseInt(hourParam, 10) : 6;

  // 오늘 날짜 (KST)
  const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // 해당 시각으로 알림 설정한 사용자 조회
  const { data: licenses, error: licErr } = await supabase
    .from('aone_pro_caddypro_licenses')
    .select('code, phone, notification_hour')
    .eq('notification_hour', targetHour)
    .not('phone', 'is', null);

  if (licErr || !licenses || licenses.length === 0) {
    return NextResponse.json({ sent: 0, reason: '알림 대상 없음', hour: targetHour });
  }

  let sentCount = 0;

  for (const lic of licenses) {
    if (!lic.phone) continue;

    const { data: schedules } = await supabase
      .from('aone_pro_caddypro_schedules')
      .select('date, title, shift, start_time, type')
      .eq('license_code', lic.code)
      .eq('date', todayKST)
      .neq('type', 'holiday')
      .order('start_time', { ascending: true });

    if (!schedules || schedules.length === 0) continue;

    const msg = buildScheduleMsg({ date: todayKST, schedules });
    const result = await sendSMS({ receiver: lic.phone, msg, msg_type: 'LMS', title: '오늘의 일정' });
    if (result.ok) sentCount++;
  }

  return NextResponse.json({ sent: sentCount, total: licenses.length, date: todayKST, hour: targetHour });
}
