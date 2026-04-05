/**
 * paymentService.ts
 * PortOne V2 결제 연동 (QR 프로그램과 동일 계정 공유)
 * 클라이언트 사이드 전용 — 서버 API는 /api/payment/complete 참고
 */

declare global {
  interface Window {
    PortOne?: {
      requestPayment: (params: Record<string, unknown>) => Promise<{
        code?: string;
        message?: string;
        txId?: string;
        paymentId?: string;
      }>;
    };
  }
}

// ── 상품 정의 (golf-caddy 요금제) ─────────────────────────────
export const PORTONE_PRODUCTS = {
  month:    { name: 'Caddy Manager Pro 1개월', amount: 9_900,  days: 30  },
  '6month': { name: 'Caddy Manager Pro 6개월', amount: 55_000, days: 180 },
  year:     { name: 'Caddy Manager Pro 1년',   amount: 99_000, days: 365 },
} as const;

export const PORTONE_PRODUCTS_PREMIUM = {
  month:    { name: 'Caddy Manager Pro 1개월 (프리미엄)', amount: 12_900, days: 30  },
  '6month': { name: 'Caddy Manager Pro 6개월 (프리미엄)', amount: 69_000, days: 180 },
  year:     { name: 'Caddy Manager Pro 1년 (프리미엄)',   amount: 129_000, days: 365 },
} as const;

export type PortOneProductKey = keyof typeof PORTONE_PRODUCTS;

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  error?: string;
}

// ── 주문번호 생성 ──────────────────────────────────────────────
export function generateOrderId(): string {
  const date = new Date().toISOString().replace(/[^0-9]/g, '').substring(0, 8);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CADDY-${date}-${rand}`;
}

// ── PortOne V2 결제 요청 ──────────────────────────────────────
export async function requestCaddyPayment({
  name,
  phone,
  planKey,
  tier = 'standard',
  payMethod = 'CARD',
}: {
  name: string;
  phone: string;
  planKey: PortOneProductKey;
  tier?: 'standard' | 'premium';
  payMethod?: 'CARD' | 'TRANSFER';
}): Promise<PaymentResult> {
  if (typeof window === 'undefined' || !window.PortOne) {
    return { success: false, error: '결제 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.' };
  }

  const product = tier === 'premium' ? PORTONE_PRODUCTS_PREMIUM[planKey] : PORTONE_PRODUCTS[planKey];
  const paymentId = generateOrderId();

  // 모바일 리다이렉트 대비 — 구매자 정보 임시 저장
  sessionStorage.setItem(
    'caddy_payment_info',
    JSON.stringify({ name, phone, planKey, paymentId, tier, payMethod }),
  );

  try {
    const response = await window.PortOne.requestPayment({
      storeId:    process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? '',
      channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? '',
      paymentId,
      orderName:   product.name,
      totalAmount: product.amount,
      currency:    'CURRENCY_KRW',
      payMethod,
      customer: {
        fullName:    name,
        phoneNumber: phone,
        email:       'test@caddypro.kr', // 이니시스 V2 필수값
      },
      redirectUrl: `${window.location.origin}/subscribe?payment=done&paymentId=${paymentId}`,
    });

    if (response.code != null) {
      return { success: false, error: response.message || '결제가 취소되었습니다.' };
    }

    return { success: true, paymentId: response.paymentId ?? paymentId };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '결제 처리 중 오류가 발생했습니다.';
    return { success: false, error: msg };
  }
}
