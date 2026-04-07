/**
 * POST /api/push/test
 * 설정 페이지 "테스트 알림" 버튼 → 해당 기기로 즉시 Push 발송
 * Body: { subscription: PushSubscriptionJSON }
 */
import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const vapidPublic  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail   = process.env.VAPID_EMAIL ?? 'mailto:admin@caddypro.kr';

  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: 'VAPID 키 미설정' }, { status: 500 });
  }

  webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);

  let body: { subscription?: PushSubscriptionJSON };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 });
  }

  const { subscription } = body;
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ error: '구독 정보 없음' }, { status: 400 });
  }

  const payload = JSON.stringify({
    title: '📅 테스트 알림',
    body: '알림이 정상적으로 작동합니다! 🎉',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  });

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      payload,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[push/test]', e);
    return NextResponse.json({ error: '발송 실패', detail: String(e) }, { status: 500 });
  }
}
