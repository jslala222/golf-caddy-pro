/**
 * POST /api/push/unsubscribe
 * Supabase에서 해당 기기의 push subscription 삭제
 * Body: { endpoint: string, licenseCode?: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  let body: { endpoint?: string; licenseCode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 });
  }

  const { endpoint } = body;
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint 누락' }, { status: 400 });
  }

  const { error } = await supabase
    .from('aone_pro_caddypro_push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  if (error) {
    console.error('[push/unsubscribe]', error);
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
