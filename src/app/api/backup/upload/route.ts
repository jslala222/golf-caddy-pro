/**
 * POST /api/backup/upload
 * Body: { licenseCode: string, data: unknown }
 */
import { NextRequest, NextResponse } from 'next/server';
import { uploadBackup } from '@/lib/r2Client';

export async function POST(request: NextRequest) {
  let body: { licenseCode?: string; data?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '요청 형식이 잘못되었습니다.' }, { status: 400 });
  }

  const { licenseCode, data } = body;
  if (!licenseCode || typeof licenseCode !== 'string') {
    return NextResponse.json({ error: '이용권 코드가 필요합니다.' }, { status: 400 });
  }
  if (data === undefined || data === null) {
    return NextResponse.json({ error: '백업 데이터가 없습니다.' }, { status: 400 });
  }

  try {
    await uploadBackup(licenseCode.trim().toUpperCase(), data);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[backup/upload] R2 업로드 오류:', e);
    return NextResponse.json({ error: '백업 저장에 실패했습니다.' }, { status: 500 });
  }
}
