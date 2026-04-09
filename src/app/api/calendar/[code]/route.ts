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

function shouldReturnHtml(req: NextRequest): boolean {
  const accept = req.headers.get('accept') ?? '';
  const fetchDest = req.headers.get('sec-fetch-dest') ?? '';
  return accept.includes('text/html') || fetchDest === 'document';
}

function escHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function browserErrorPage(req: NextRequest, status: number, title: string, message: string) {
  const settingsUrl = `${req.nextUrl.origin}/settings#calendar-sync`;
  const safeTitle = escHtml(title);
  const safeMessage = escHtml(message);
  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f7fb; color: #111827; }
    .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { width: 100%; max-width: 520px; background: #fff; border-radius: 20px; box-shadow: 0 10px 30px rgba(17,24,39,0.08); border: 1px solid #e5e7eb; padding: 24px; }
    .badge { display: inline-block; font-size: 12px; font-weight: 700; color: #92400e; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 999px; padding: 4px 10px; margin-bottom: 12px; }
    h1 { margin: 0 0 10px; font-size: 20px; line-height: 1.3; }
    p { margin: 0 0 8px; line-height: 1.55; color: #374151; }
    .btn { margin-top: 14px; display: inline-block; text-decoration: none; font-weight: 800; font-size: 14px; color: #fff; background: #059669; padding: 11px 14px; border-radius: 12px; }
    .note { margin-top: 12px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="card">
      <div class="badge">캘린더 동기화 안내</div>
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
      <p>같은 휴대폰에서 설정할 때는 링크를 따로 공유하지 말고, 앱의 '등록 시작' 버튼으로 진행해 주세요.</p>
      <a class="btn" href="${settingsUrl}">설정으로 이동</a>
      <p class="note">상태 코드: ${status}</p>
    </section>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

function errorResponse(req: NextRequest, status: number, message: string, title: string) {
  if (shouldReturnHtml(req)) {
    return browserErrorPage(req, status, title, message);
  }
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const code = normalizeCode(params.code);
  if (!code) {
    return errorResponse(req, 400, '유효하지 않은 코드입니다.', '잘못된 캘린더 주소입니다.');
  }

  const db = createServerClient();
  const { data: license, error: licErr } = await db
    .from('aone_pro_caddypro_licenses')
    .select('code, tier, expires_at')
    .ilike('code', code)
    .maybeSingle();

  if (licErr || !license) {
    return errorResponse(req, 404, '이용권을 찾을 수 없습니다.', '등록 정보를 찾지 못했습니다.');
  }

  const expired = !!license.expires_at && new Date(license.expires_at).getTime() < Date.now();
  if (expired) {
    return errorResponse(req, 403, '만료된 이용권입니다.', '이용권이 만료되었습니다. 연장 후 다시 시도해 주세요.');
  }

  const tier: 'standard' | 'premium' = license.tier === 'premium' ? 'premium' : 'standard';
  if (tier !== 'premium') {
    return errorResponse(req, 403, '캘린더 동기화는 프리미엄 전용 기능입니다.', '프리미엄 전환 후 사용할 수 있습니다.');
  }

  let query = db
    .from('aone_pro_caddypro_schedules')
    .select('id, date, time, type, shift, title, memo')
    .eq('license_code', code)
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  const { data: rows, error: schErr } = await query;
  if (schErr) {
    return errorResponse(req, 500, '일정 데이터를 불러오는 중 문제가 발생했습니다.', '잠시 후 다시 시도해 주세요.');
  }

  const ics = buildCalendarIcs({ tier, rows: (rows ?? []) as ScheduleRow[] });
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="caddy-${code}.ics"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
