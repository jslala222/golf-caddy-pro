import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: 현재 phone, notification_hour 조회
export async function GET(req: NextRequest) {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const licenseCode = searchParams.get('licenseCode');
    if (!licenseCode) return NextResponse.json({ error: 'licenseCode required' }, { status: 400 });

    const { data, error } = await supabase
        .from('aone_pro_caddypro_licenses')
        .select('phone, notification_hour, remind_before_min')
        .eq('code', licenseCode)
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
        phone: data?.phone ?? '',
        notification_hour: data?.notification_hour ?? 6,
        remind_before_min: data?.remind_before_min ?? 60,
    });
}

// PUT: phone, notification_hour 저장
export async function PUT(req: NextRequest) {
    const supabase = getSupabase();
    const body = await req.json();
    const { licenseCode, phone, notificationHour, remindBeforeMin } = body;
    if (!licenseCode) return NextResponse.json({ error: 'licenseCode required' }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (phone !== undefined) updateData.phone = phone;
    if (notificationHour !== undefined) updateData.notification_hour = notificationHour;
    if (remindBeforeMin !== undefined) updateData.remind_before_min = remindBeforeMin;

    const { error } = await supabase
        .from('aone_pro_caddypro_licenses')
        .update(updateData)
        .eq('code', licenseCode);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
