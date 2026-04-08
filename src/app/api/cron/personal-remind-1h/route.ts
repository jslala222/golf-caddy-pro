/**
 * GET /api/cron/personal-remind-1h
 * 5분 간격 Cron → 개인일정 1시간 전 알림 발송
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { sendSMS, buildPersonalEvent1hMsg } from '@/lib/aligo';

function getKSTNow() {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000);
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function toHM(d: Date) {
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const kstNow = getKSTNow();
  const todayKST = toDateStr(kstNow);

  // 전화번호 + remind_before_min 설정된 사용자 전체 조회
  const { data: licenses, error: licErr } = await supabase
    .from('aone_pro_caddypro_licenses')
    .select('code, phone, remind_before_min')
    .not('phone', 'is', null)
    .not('remind_before_min', 'is', null)
    .neq('remind_before_min', 0); // 0 = 안받기

  if (licErr || !licenses || licenses.length === 0) {
    return NextResponse.json({ sent: 0, reason: '알림 대상 없음' });
  }

  let sentCount = 0;
  let checkedCount = 0;

  for (const lic of licenses as Array<{ code: string; phone: string; remind_before_min: number }>) {
    const remindMin = lic.remind_before_min ?? 60;
    // 지금으로부터 remind_before_min 분 후가 일정 시작 시각
    const targetTime = new Date(kstNow.getTime() + remindMin * 60 * 1000);
    const targetDate = toDateStr(targetTime);
    const targetHM = toHM(targetTime);

    // 오늘이 아닌 날짜 건너뜀 (내일 일정은 오전 브리핑에서 처리)
    if (targetDate !== todayKST) continue;

    const { data: schedules } = await supabase
      .from('aone_pro_caddypro_schedules')
      .select('id, date, title, time, start_time, type')
      .eq('license_code', lic.code)
      .eq('type', 'personal')
      .eq('date', targetDate)
      .or(`time.eq.${targetHM},start_time.eq.${targetHM}:00`);

    if (!schedules || schedules.length === 0) continue;
    checkedCount += schedules.length;

    for (const s of schedules as Array<any>) {
      const evTime = (s.time && s.time !== '00:00') ? s.time : (s.start_time?.slice(0, 5) ?? targetHM);
      const remindLabel = remindMin < 60 ? `${remindMin}분` : `${remindMin / 60}시간`;
      const msg = buildPersonalEvent1hMsg({
        title: s.title ?? '개인 일정',
        time: evTime,
        date: s.date,
        remindLabel,
      });

      const result = await sendSMS({
        receiver: lic.phone,
        msg,
        msg_type: 'LMS',
        title: `개인일정 ${remindLabel} 전 알림`,
      });

      if (result.ok) sentCount++;
    }
  }

  return NextResponse.json({ sent: sentCount, checked: checkedCount, date: todayKST });
}
