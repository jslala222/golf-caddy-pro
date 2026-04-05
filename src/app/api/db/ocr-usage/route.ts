import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

const TABLE = 'aone_pro_caddypro_ocr_usage';

// GET: 현재 월 사용 횟수 조회
export async function GET(req: NextRequest) {
    const licenseCode = req.headers.get('x-license-code')?.trim().toUpperCase();
    if (!licenseCode) return NextResponse.json({ error: 'no license' }, { status: 401 });

    const yearMonth = req.nextUrl.searchParams.get('ym') || getCurrentYM();

    const supabase = createServerClient();
    const { data, error } = await supabase
        .from(TABLE)
        .select('count')
        .eq('license_code', licenseCode)
        .eq('year_month', yearMonth)
        .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ count: data?.count ?? 0, year_month: yearMonth });
}

// POST: 현재 월 사용 횟수 +1 (upsert)
export async function POST(req: NextRequest) {
    const licenseCode = req.headers.get('x-license-code')?.trim().toUpperCase();
    if (!licenseCode) return NextResponse.json({ error: 'no license' }, { status: 401 });

    const yearMonth = getCurrentYM();
    const supabase = createServerClient();

    // 현재 count 조회 후 +1
    const { data: existing } = await supabase
        .from(TABLE)
        .select('count')
        .eq('license_code', licenseCode)
        .eq('year_month', yearMonth)
        .maybeSingle();

    const newCount = (existing?.count ?? 0) + 1;

    const { error } = await supabase
        .from(TABLE)
        .upsert(
            { license_code: licenseCode, year_month: yearMonth, count: newCount },
            { onConflict: 'license_code,year_month' }
        );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ count: newCount });
}

function getCurrentYM(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
