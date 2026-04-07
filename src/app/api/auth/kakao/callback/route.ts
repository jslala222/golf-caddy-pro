/**
 * GET /api/auth/kakao/callback
 * 카카오 OAuth 인가코드 → 액세스 토큰 교환 → Supabase 저장
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // license_code 전달용
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://caddy-pink.vercel.app';

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/settings?kakao=error`);
  }

  const restApiKey = process.env.KAKAO_REST_API_KEY;
  const redirectUri = `${baseUrl}/api/auth/kakao/callback`;

  if (!restApiKey) {
    return NextResponse.redirect(`${baseUrl}/settings?kakao=error`);
  }

  try {
    // 1) 인가코드 → 액세스 토큰 교환
    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: restApiKey,
        redirect_uri: redirectUri,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('[kakao/callback] 토큰 오류:', tokenData);
      return NextResponse.redirect(`${baseUrl}/settings?kakao=error`);
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
      console.error('[kakao/callback] DB 저장 오류:', dbError);
      return NextResponse.redirect(`${baseUrl}/settings?kakao=error`);
    }

    return NextResponse.redirect(`${baseUrl}/settings?kakao=success`);
  } catch (e) {
    console.error('[kakao/callback] 예외:', e);
    return NextResponse.redirect(`${baseUrl}/settings?kakao=error`);
  }
}
