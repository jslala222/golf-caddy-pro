/**
 * POST /api/dealer/cash-receipt
 * 딜러가 고객에게 현금영수증을 직접 발행 (PortOne V2 standalone)
 *
 * Body: { dealerToken, amount, type, identifier, orderName? }
 *   type: 'PERSONAL' (소득공제용, 전화번호) | 'CORPORATE' (지출증빙용, 사업자등록번호)
 *   identifier: 전화번호(01012345678) or 사업자번호(1234567890)
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  let body: {
    dealerToken?: string;
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

  const { dealerToken, amount, type, identifier, orderName } = body;

  if (!dealerToken || !amount || !type || !identifier) {
    return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 });
  }

  if (amount <= 0 || amount > 10_000_000) {
    return NextResponse.json({ error: '금액이 올바르지 않습니다.' }, { status: 400 });
  }

  // 딜러 검증
  const { data: dealer } = await supabase
    .from('aone_pro_caddypro_dealers')
    .select('id, name, is_active')
    .eq('token', dealerToken)
    .maybeSingle();

  if (!dealer || !dealer.is_active) {
    return NextResponse.json({ error: '유효하지 않은 딜러입니다.' }, { status: 403 });
  }

  const portoneSecret = process.env.PORTONE_SECRET;
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;

  if (!portoneSecret || portoneSecret.startsWith('여기에') || !storeId) {
    return NextResponse.json({ error: 'PortOne 설정이 없습니다. 관리자에게 문의하세요.' }, { status: 500 });
  }

  const cleanIdentifier = identifier.replace(/[^0-9]/g, '');

  // 식별번호 형식 검증
  if (type === 'PERSONAL' && (cleanIdentifier.length < 10 || cleanIdentifier.length > 11)) {
    return NextResponse.json({ error: '전화번호 형식이 올바르지 않습니다.' }, { status: 400 });
  }
  if (type === 'CORPORATE' && cleanIdentifier.length !== 10) {
    return NextResponse.json({ error: '사업자등록번호는 10자리여야 합니다.' }, { status: 400 });
  }

  const issueId = `dealer-${dealerToken.slice(0, 8)}-${Date.now()}`;

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
        customer: {
          identityNumber: cleanIdentifier,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[cash-receipt] PortOne 오류:', res.status, errText);
      return NextResponse.json(
        { error: '현금영수증 발행에 실패했습니다. 번호를 다시 확인해주세요.' },
        { status: 400 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ success: true, issueId, receiptUrl: data.receiptUrl ?? null });
  } catch (e) {
    console.error('[cash-receipt] 서버 오류:', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
