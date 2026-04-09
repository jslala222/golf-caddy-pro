export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

function normalizeCode(raw: string): string {
  return raw.trim().replace(/\.ics$/i, '').toUpperCase();
}

export async function GET(_: NextRequest, { params }: { params: { code: string } }) {
  const code = normalizeCode(params.code || '');
  if (!code) {
    return NextResponse.json(
      {
        code: '',
        exists: false,
        isActive: false,
        isExpired: false,
        tier: 'standard',
        canSync: false,
        expectedApiStatus: 400,
        reason: '유효하지 않은 코드입니다.',
        expiresAt: null,
        checkedAt: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  const db = createServerClient();
  const { data: license, error } = await db
    .from('aone_pro_caddypro_licenses')
    .select('code, tier, expires_at')
    .ilike('code', code)
    .maybeSingle();

  if (error || !license) {
    return NextResponse.json(
      {
        code,
        exists: false,
        isActive: false,
        isExpired: false,
        tier: 'standard',
        canSync: false,
        expectedApiStatus: 404,
        reason: '이용권을 찾을 수 없습니다.',
        expiresAt: null,
        checkedAt: new Date().toISOString(),
      },
      { status: 404 }
    );
  }

  const tier: 'standard' | 'premium' = license.tier === 'premium' ? 'premium' : 'standard';
  const isExpired = !!license.expires_at && new Date(license.expires_at).getTime() < Date.now();

  if (isExpired) {
    return NextResponse.json(
      {
        code,
        exists: true,
        isActive: true,
        isExpired: true,
        tier,
        canSync: false,
        expectedApiStatus: 403,
        reason: '만료된 이용권입니다.',
        expiresAt: license.expires_at ?? null,
        checkedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  if (tier !== 'premium') {
    return NextResponse.json(
      {
        code,
        exists: true,
        isActive: true,
        isExpired: false,
        tier,
        canSync: false,
        expectedApiStatus: 403,
        reason: '프리미엄 요금제에서만 캘린더 자동 동기화를 사용할 수 있습니다.',
        expiresAt: license.expires_at ?? null,
        checkedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  const { count } = await db
    .from('aone_pro_caddypro_schedules')
    .select('id', { head: true, count: 'exact' })
    .eq('license_code', code);

  return NextResponse.json(
    {
      code,
      exists: true,
      isActive: true,
      isExpired: false,
      tier,
      canSync: true,
      expectedApiStatus: 200,
      reason: '정상 상태입니다. Google 캘린더에서 자동 동기화를 기다리거나 재구독하면 됩니다.',
      expiresAt: license.expires_at ?? null,
      scheduleCount: count ?? 0,
      checkedAt: new Date().toISOString(),
    },
    { status: 200 }
  );
}
