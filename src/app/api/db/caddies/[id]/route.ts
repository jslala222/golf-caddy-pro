import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getCode(req: NextRequest) {
    return req.headers.get('x-license-code')?.trim().toUpperCase() ?? null;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const code = getCode(req);
    if (!code) return NextResponse.json({ error: 'no code' }, { status: 401 });
    const body = await req.json();
    const { error } = await supabase
        .from('aone_pro_caddypro_caddies')
        .update(body)
        .eq('id', params.id)
        .eq('license_code', code);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const code = getCode(req);
    if (!code) return NextResponse.json({ error: 'no code' }, { status: 401 });
    const { error } = await supabase
        .from('aone_pro_caddypro_caddies')
        .delete()
        .eq('id', params.id)
        .eq('license_code', code);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
