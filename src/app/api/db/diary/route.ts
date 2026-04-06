/**
 * POST /api/db/diary — UPSERT 일일 일지 (날짜 기준)
 * GET  /api/db/diary — 해당 라이선스 전체 일지 조회
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

function getCode(req: NextRequest) {
    return req.headers.get('x-license-code')?.trim().toUpperCase() ?? null;
}

export async function GET(req: NextRequest) {
    const code = getCode(req);
    if (!code) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { data, error } = await supabase
        .from('aone_pro_caddypro_diary')
        .select('*')
        .eq('license_code', code)
        .order('date', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ diaries: data ?? [] });
}

export async function POST(req: NextRequest) {
    const code = getCode(req);
    if (!code) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const body = await req.json();
    const { date, caddy_fee_1, caddy_fee_2, caddy_fee_3,
            tip_1, tip_2, tip_3, extra_reason, extra_amount, memo } = body;

    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });

    const { data, error } = await supabase
        .from('aone_pro_caddypro_diary')
        .upsert({
            license_code: code,
            date,
            caddy_fee_1: caddy_fee_1 ?? 0,
            caddy_fee_2: caddy_fee_2 ?? 0,
            caddy_fee_3: caddy_fee_3 ?? 0,
            tip_1: tip_1 ?? 0,
            tip_2: tip_2 ?? 0,
            tip_3: tip_3 ?? 0,
            extra_reason: extra_reason ?? '',
            extra_amount: extra_amount ?? 0,
            memo: memo ?? '',
        }, { onConflict: 'license_code,date' })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ diary: data });
}
