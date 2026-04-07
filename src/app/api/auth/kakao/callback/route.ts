/**
 * GET /api/auth/kakao/callback
 * 카카오 OAuth 인가코드 → 액세스 토큰 교환 → Supabase 저장
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // license_code 전달용
  const error = searchParams.get('error');

  // 환경변수 의존 없이 실제 요청 origin 사용 → redirect_uri 불일치 방지
  const baseUrl = 'https://caddy-pink.vercel.app';
  const redirectUri = `${baseUrl}/api/auth/kakao/callback`;

  if (error || !code) {
    console.error('[kakao/callback] 인가코드 오류:', error);
    return NextResponse.redirect(`${baseUrl}/settings?kakao=error`);
  }

  const restApiKey = process.env.KAKAO_REST_API_KEY?.trim();

  if (!restApiKey) {
    return NextResponse.redirect(`${baseUrl}/settings?kakao=error&reason=no_key`);
  }

  const clientSecret = process.env.KAKAO_CLIENT_SECRET?.trim();

  try {
    // 1) 인가코드 → 액세스 토큰 교환
    const tokenParams: Record<string, string> = {
      grant_type: 'authorization_code',
      client_id: restApiKey,
      redirect_uri: redirectUri,
      code: code!,
    };
    if (clientSecret) tokenParams.client_secret = clientSecret;

    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(tokenParams),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      const detail = JSON.stringify(tokenData);
      const reason = encodeURIComponent(detail.slice(0, 200));
      console.error('[kakao/callback] 토큰 오류 상세:', detail);
      console.error('[kakao/callback] 사용된 restApiKey 길이:', restApiKey.length, '값앞10:', restApiKey.slice(0,10));
      return NextResponse.redirect(`${baseUrl}/settings?kakao=error&reason=${reason}`);
    }

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // 2) Supabase에 저장 (license_code = state 파라미터)
    const licenseCode = state ?? 'unknown';
    const { error: dbError } = await supabase
      .from('aone_pro_caddypro_kakao_tokens')
      .upsert(
        {
          license_code: licenseCode,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token ?? null,
          expires_at: expiresAt,
        },
        { onConflict: 'license_code' }
      );

    if (dbError) {
      const reason = encodeURIComponent(dbError.code ?? 'db_fail');
      console.error('[kakao/callback] DB 저장 오류:', JSON.stringify(dbError));
      return NextResponse.redirect(`${baseUrl}/settings?kakao=error&reason=${reason}`);
    }

    return NextResponse.redirect(`${baseUrl}/settings?kakao=success`);
  } catch (e) {
    const reason = encodeURIComponent(String(e).slice(0, 50));
    console.error('[kakao/callback] 예외:', e);
    return NextResponse.redirect(`${baseUrl}/settings?kakao=error&reason=${reason}`);
  }
}
