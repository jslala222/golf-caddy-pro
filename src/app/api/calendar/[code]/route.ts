export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

type ScheduleRow = {
  id: string;
  date: string;
  time: string | null;
  type: 'work' | 'personal' | 'holiday' | string;
  shift: string | null;
  title: string | null;
  memo: string | null;
};

function normalizeCode(raw: string): string {
  return raw.trim().replace(/\.ics$/i, '').toUpperCase();
}

function escIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function yyyyMMdd(date: string): string {
  return date.replace(/-/g, '');
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function hhmmss(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = m[1].padStart(2, '0');
  const mm = m[2];
  return `${h}${mm}00`;
}

function addHour(time: string): string {
  const h = parseInt(time.slice(0, 2), 10);
  const m = parseInt(time.slice(2, 4), 10);
  const d = new Date(Date.UTC(2026, 0, 1, h, m, 0));
  d.setUTCHours(d.getUTCHours() + 1);
  return `${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}00`;
}

function buildSummary(s: ScheduleRow): string {
  if (s.type === 'work') {
    const shiftLabel = s.shift ? `${s.shift}부` : '근무';
    return `🏌️ ${shiftLabel} 근무`;
  }
  if (s.type === 'holiday') return '🌿 휴무';
  return `📌 ${s.title || '개인 일정'}`;
}

function buildCalendarIcs(params: {
  tier: 'standard' | 'premium';
  rows: ScheduleRow[];
}): string {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}Z`;
  const calName = params.tier === 'premium' ? '캐디 매니저 Pro (전체 일정)' : '캐디 매니저 Pro (근무 일정)';
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Caddy Manager Pro//Calendar Sync//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escIcs(calName)}`,
    'X-WR-TIMEZONE:Asia/Seoul',
  ];

  for (const s of params.rows) {
    const datePart = yyyyMMdd(s.date);
    const t = hhmmss(s.time);
    const timed = !!t && t !== '000000';
    const summary = escIcs(buildSummary(s));

    const descParts = [s.memo?.trim()].filter(Boolean) as string[];
    if (params.tier !== 'premium') {
      descParts.push('⭐ 프리미엄 전환 시 개인 일정/휴무까지 자동 동기화됩니다.');
    }
    const description = escIcs(descParts.join('\n'));

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${s.id}@caddy-pink.vercel.app`);
    lines.push(`DTSTAMP:${stamp}`);
    if (timed) {
      const end = addHour(t!);
      lines.push(`DTSTART;TZID=Asia/Seoul:${datePart}T${t}`);
      lines.push(`DTEND;TZID=Asia/Seoul:${datePart}T${end}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${datePart}`);
      lines.push(`DTEND;VALUE=DATE:${nextDay(s.date)}`);
    }
    lines.push(`SUMMARY:${summary}`);
    if (description) lines.push(`DESCRIPTION:${description}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

export async function GET(_: NextRequest, { params }: { params: { code: string } }) {
  const code = normalizeCode(params.code);
  if (!code) {
    return NextResponse.json({ error: '유효하지 않은 코드' }, { status: 400 });
  }

  const db = createServerClient();
  const { data: license, error: licErr } = await db
    .from('aone_pro_caddypro_licenses')
    .select('code, tier, is_active, expires_at')
    .ilike('code', code)
    .maybeSingle();

  if (licErr || !license) {
    return NextResponse.json({ error: '이용권을 찾을 수 없습니다.' }, { status: 404 });
  }

  const expired = !!license.expires_at && new Date(license.expires_at).getTime() < Date.now();
  if (!license.is_active || expired) {
    return NextResponse.json({ error: '만료 또는 비활성 이용권입니다.' }, { status: 403 });
  }

  const tier: 'standard' | 'premium' = license.tier === 'premium' ? 'premium' : 'standard';
  let query = db
    .from('aone_pro_caddypro_schedules')
    .select('id, date, time, type, shift, title, memo')
    .eq('license_code', code)
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (tier !== 'premium') {
    query = query.eq('type', 'work');
  }

  const { data: rows, error: schErr } = await query;
  if (schErr) {
    return NextResponse.json({ error: schErr.message }, { status: 500 });
  }

  const ics = buildCalendarIcs({ tier, rows: (rows ?? []) as ScheduleRow[] });
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="caddy-${code}.ics"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
