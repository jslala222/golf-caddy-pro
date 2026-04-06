import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

function getCode(req: NextRequest) {
    return req.headers.get('x-license-code')?.trim().toUpperCase() ?? null;
}

export async function GET(req: NextRequest) {
    const code = getCode(req);
    if (!code) return NextResponse.json({ caddies: [] });
    const supabase = createServerClient();
    const { data, error } = await supabase
        .from('aone_pro_caddypro_caddies')
        .select('*')
        .eq('license_code', code)
        .order('group_no', { ascending: true })
        .order('caddy_no', { ascending: true });
    if (error) return NextResponse.json({ caddies: [] });
    const caddies = (data ?? []).map(r => ({
        id: r.id,
        name: r.name,
        caddy_no: r.caddy_no,
        group_no: r.group_no,
        rank: r.rank,
        contact: r.contact ?? '',
        memo: r.memo ?? '',
        is_active: r.is_active,
        createdAt: r.created_at,
    }));
    return NextResponse.json({ caddies });
}

export async function POST(req: NextRequest) {
    const code = getCode(req);
    if (!code) return NextResponse.json({ error: 'no code' }, { status: 401 });
    const supabase = createServerClient();
    const body = await req.json();
    const { error } = await supabase.from('aone_pro_caddypro_caddies').insert({
        id: body.id,
        license_code: code,
        name: body.name,
        caddy_no: body.caddy_no ?? null,
        group_no: body.group_no ?? null,
        rank: body.rank ?? 'normal',
        contact: body.contact ?? '',
        memo: body.memo ?? '',
        is_active: body.is_active ?? true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
