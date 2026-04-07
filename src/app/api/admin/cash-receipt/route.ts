/**
 * POST /api/admin/cash-receipt
 * 관리자가 본사 명의로 현금영수증 발행 (PortOne V2)
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  let body: {
    adminPassword?: string;
    amount?: number;
    type?: string;
    identifier?: string;
    orderName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 });
  }

  const { adminPassword, amount, type, identifier, orderName } = body;

  if (adminPassword !== '0827') {
    return NextResponse.json({ error: '관리자 인증 실패' }, { status: 403 });
  }

  if (!amount || !type || !identifier) {
    return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 });
  }

  if (amount <= 0 || amount > 10_000_000) {
    return NextResponse.json({ error: '금액이 올바르지 않습니다.' }, { status: 400 });
  }

  const portoneSecret = process.env.PORTONE_SECRET;
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;

  if (!portoneSecret || portoneSecret.startsWith('여기에') || !storeId) {
    return NextResponse.json({ error: 'PortOne 설정이 없습니다.' }, { status: 500 });
  }

  const cleanIdentifier = identifier.replace(/[^0-9]/g, '');

  if (type === 'PERSONAL' && (cleanIdentifier.length < 10 || cleanIdentifier.length > 11)) {
    return NextResponse.json({ error: '전화번호 형식이 올바르지 않습니다.' }, { status: 400 });
  }
  if (type === 'CORPORATE' && cleanIdentifier.length !== 10) {
    return NextResponse.json({ error: '사업자등록번호는 10자리여야 합니다.' }, { status: 400 });
  }

  const issueId = `admin-${Date.now()}`;

  try {
    const res = await fetch('https://api.portone.io/cash-receipts', {
      method: 'POST',
      headers: {
        Authorization: `PortOne ${portoneSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId,
        type,
        taxationType: 'INCLUDE_TAX',
        amount,
        currency: 'KRW',
        orderName: orderName || 'Caddy Manager Pro 이용권',
        issueId,
        customer: { identityNumber: cleanIdentifier },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[admin/cash-receipt] PortOne 오류:', res.status, errText);
      return NextResponse.json(
        { error: '현금영수증 발행에 실패했습니다. 번호를 다시 확인해주세요.' },
        { status: 400 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ success: true, receiptUrl: data.receiptUrl ?? null });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
