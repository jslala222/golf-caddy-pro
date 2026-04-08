/**
 * GET /api/cron/alarm
 * Vercel Cron → 오늘 일정 조회 → 알리고 SMS 발송
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { sendSMS, buildScheduleMsg, buildPersonalEventMsg } from '@/lib/aligo';

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
      .select('date, title, shift, start_time, time, type')
      .eq('license_code', lic.code)
      .eq('date', todayKST)
      .neq('type', 'holiday')
      .order('start_time', { ascending: true });

    if (!schedules || schedules.length === 0) continue;

    // 템플릿 2: 오늘 전체 일정 오전 브리핑 (근무 + 개인 통합)
    const msg = buildScheduleMsg({ date: todayKST, schedules });
    const result = await sendSMS({ receiver: lic.phone, msg, msg_type: 'LMS', title: '오늘의 일정' });
    if (result.ok) sentCount++;

    // 템플릿 3: 개인일정 전용 별도 SMS (시간이 있는 개인 일정만)
    const personalEvents = schedules.filter(
      (s) => s.type === 'personal' && s.title && (s.time || s.start_time)
    );
    for (const ev of personalEvents) {
      const evTime = (ev.time && ev.time !== '00:00') ? ev.time : (ev.start_time?.slice(0, 5) ?? '');
      if (!evTime) continue;
      const pmsg = buildPersonalEventMsg({ title: ev.title ?? '일정', time: evTime, date: todayKST });
      await sendSMS({ receiver: lic.phone, msg: pmsg, title: '개인일정 알림' });
    }
  }

  return NextResponse.json({ sent: sentCount, total: licenses.length, date: todayKST, hour: targetHour });
}
