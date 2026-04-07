/**
 * GET /api/cron/alarm
 * Vercel Cron이 5분마다 호출 → 알람 시간 도달한 일정 조회 → Web Push 발송
 * vercel.json의 crons 설정과 연동
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import webpush from 'web-push';

export async function GET(request: NextRequest) {
  // VAPID 설정 (런타임에만 실행 — 빌드 시 환경변수 없음 방지)
  const vapidPublic  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail   = process.env.VAPID_EMAIL ?? 'mailto:admin@caddypro.kr';

  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: 'VAPID 키 미설정' }, { status: 500 });
  }

  webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);
  // Vercel Cron 인증 헤더 확인
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const from = new Date(now.getTime() - 5 * 60 * 1000).toISOString(); // 5분 전
  const to = now.toISOString();

  // alarm_at이 [5분전 ~ 지금] 범위이고 아직 발송 안 된 일정 조회
  const { data: schedules, error } = await supabase
    .from('aone_pro_caddypro_schedules')
    .select('id, license_code, date, title')
    .gte('alarm_at', from)
    .lte('alarm_at', to)
    .eq('alarm_sent', false);

  if (error) {
    console.error('[cron/alarm] 조회 오류:', error);
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }

  if (!schedules || schedules.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  let sentCount = 0;

  for (const schedule of schedules) {
    // 해당 license_code의 구독 정보 조회
    const { data: subs } = await supabase
      .from('aone_pro_caddypro_push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('license_code', schedule.license_code);

    if (!subs || subs.length === 0) continue;

    const payload = JSON.stringify({
      title: '📅 약속 알림',
      body: schedule.title || '곧 약속이 있습니다!',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sentCount++;
      } catch (e) {
        console.error('[cron/alarm] 발송 오류:', e);
        // 구독 만료된 경우 삭제
        if ((e as { statusCode?: number }).statusCode === 410) {
          await supabase
            .from('aone_pro_caddypro_push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        }
      }
    }

    // alarm_sent 플래그 업데이트
    await supabase
      .from('aone_pro_caddypro_schedules')
      .update({ alarm_sent: true })
      .eq('id', schedule.id);
  }

  return NextResponse.json({ sent: sentCount, processed: schedules.length });
}
