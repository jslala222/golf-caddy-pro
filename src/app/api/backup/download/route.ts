/**
 * POST /api/backup/download
 * Body: { licenseCode: string }
 * Response: { data } | { error }
 */
import { NextRequest, NextResponse } from 'next/server';
import { downloadBackup } from '@/lib/r2Client';

export async function POST(request: NextRequest) {
  let body: { licenseCode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '요청 형식이 잘못되었습니다.' }, { status: 400 });
  }

  const { licenseCode } = body;
  if (!licenseCode || typeof licenseCode !== 'string') {
    return NextResponse.json({ error: '이용권 코드가 필요합니다.' }, { status: 400 });
  }

  try {
    const data = await downloadBackup(licenseCode.trim().toUpperCase());
    if (data === null) {
      return NextResponse.json({ error: '저장된 클라우드 백업이 없습니다.' }, { status: 404 });
    }
    return NextResponse.json({ data });
  } catch (e) {
    console.error('[backup/download] R2 다운로드 오류:', e);
    return NextResponse.json({ error: '백업 불러오기에 실패했습니다.' }, { status: 500 });
  }
}
