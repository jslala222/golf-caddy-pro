/**
 * GET /api/cron/alarm
 * Vercel Cron (매일 아침 6:30 KST) → 오늘 일정 조회 → 카카오 "나에게 보내기" 발송
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/** 카카오 액세스 토큰 갱신 */
async function refreshKakaoToken(refreshToken: string, restApiKey: string): Promise<string | null> {
  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: restApiKey,
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  return data.access_token ?? null;
}

/** 카카오 나에게 보내기 */
async function sendKakaoMessage(accessToken: string, text: string): Promise<boolean> {
  const res = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      template_object: JSON.stringify({
        object_type: 'text',
        text,
        link: { mobile_web_url: 'https://caddy-pink.vercel.app', web_url: 'https://caddy-pink.vercel.app' },
        button_title: '앱 열기',
      }),
    }),
  });
  return res.ok;
}

export async function GET(request: NextRequest) {
  // Vercel Cron 인증
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const restApiKey = process.env.KAKAO_REST_API_KEY;
  if (!restApiKey) {
    return NextResponse.json({ error: 'KAKAO_REST_API_KEY 미설정' }, { status: 500 });
  }

  // 오늘 날짜 (KST)
  const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // 카카오 연동된 모든 사용자 토큰 조회
  const { data: tokens, error: tokenErr } = await supabase
    .from('aone_pro_caddypro_kakao_tokens')
    .select('license_code, access_token, refresh_token, expires_at');

  if (tokenErr || !tokens || tokens.length === 0) {
    return NextResponse.json({ sent: 0, reason: '연동 사용자 없음' });
  }

  let sentCount = 0;

  for (const tokenRow of tokens) {
    // 토큰 만료 여부 확인 → 갱신
    let accessToken = tokenRow.access_token;
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      if (tokenRow.refresh_token) {
        const newToken = await refreshKakaoToken(tokenRow.refresh_token, restApiKey);
        if (newToken) {
          accessToken = newToken;
          const expiresAt = new Date(Date.now() + 21600 * 1000).toISOString(); // 6시간
          await supabase
            .from('aone_pro_caddypro_kakao_tokens')
            .update({ access_token: newToken, expires_at: expiresAt })
            .eq('license_code', tokenRow.license_code);
        } else {
          continue; // 갱신 실패 → 스킵
        }
      } else {
        continue;
      }
    }

    // 해당 사용자의 오늘 일정 조회
    const { data: schedules } = await supabase
      .from('aone_pro_caddypro_schedules')
      .select('date, title, shift, start_time')
      .eq('license_code', tokenRow.license_code)
      .eq('date', todayKST)
      .order('start_time', { ascending: true });

    if (!schedules || schedules.length === 0) continue;

    // 메시지 구성
    const lines = schedules.map((s: { title?: string; shift?: string | number; start_time?: string }) => {
      const time = s.start_time ? s.start_time.slice(0, 5) : '';
      const shift = s.shift ? `${s.shift}부` : '';
      return `• ${time ? time + ' ' : ''}${shift ? '[' + shift + '] ' : ''}${s.title ?? '일정'}`;
    });

    const message = `[캐디 매니저 알림] 오늘 일정 (${todayKST})\n\n${lines.join('\n')}\n\n총 ${schedules.length}건의 일정이 있습니다.`;

    const ok = await sendKakaoMessage(accessToken, message);
    if (ok) sentCount++;
  }

  return NextResponse.json({ sent: sentCount, total: tokens.length, date: todayKST });
}

