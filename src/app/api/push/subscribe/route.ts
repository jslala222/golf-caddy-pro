/**
 * POST /api/push/subscribe
 * Web Push 구독 정보를 Supabase에 저장
 * Body: { subscription: PushSubscription, licenseCode: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  let body: { subscription?: unknown; licenseCode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 });
  }

  const { subscription, licenseCode } = body;
  if (!subscription || !licenseCode) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }

  const sub = subscription as { endpoint: string; keys: { p256dh: string; auth: string } };

  // upsert: 동일 endpoint면 업데이트
  const { error } = await supabase
    .from('aone_pro_caddypro_push_subscriptions')
    .upsert({
      license_code: licenseCode,
      endpoint: sub.endpoint,
      p256dh: sub.keys?.p256dh,
      auth: sub.keys?.auth,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });

  if (error) {
    console.error('[push/subscribe]', error);
    return NextResponse.json({ error: '저장 실패' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
