/**
 * POST /api/receipt/ocr
 * FormData: file (image)
 * R2 저장 없이 Gemini Vision OCR만 수행 — 금액/상호명/카테고리 추출
 */
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: '요청 형식이 잘못되었습니다.' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: '파일이 필요합니다.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '파일이 너무 큽니다. (최대 10MB)' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: '이미지 파일만 업로드 가능합니다.' }, { status: 400 });
  }

  let ocrAmount: number | null = null;
  let ocrMemo: string | null = null;
  let ocrCategory: string | null = null;

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.length < 4 * 1024 * 1024) {
        const base64 = buffer.toString('base64');
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: `이 영수증 이미지를 분석해주세요. JSON 형식만 출력하세요. 다른 텍스트는 절대 포함하지 마세요.
- amount: 최종 결제 금액 (쉼표 없는 순수 숫자, 없으면 null). 예: 5450
- merchant: 상호명 (문자열, 없으면 null)
- category: 아래 중 하나 선택
  * "transport" — 버스/지하철/택시/주유 등 교통비
  * "meal" — 식당/카페/편의점 식품 등 식비
  * "gear" — 골프용품/스포츠용품/업무 장비/의류
  * "etc_expense" — 통신비/의료비/교육비/소모품
  * "personal" — 마트 생활용품/개인 쇼핑 등 개인지출

출력 예시: {"amount": 5450, "merchant": "진로식자재마트", "category": "personal"}` },
                  { inline_data: { mime_type: file.type, data: base64 } }
                ]
              }]
            })
          }
        );
        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          const match = text.match(/\{[\s\S]*?\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (typeof parsed.amount === 'number') {
              ocrAmount = parsed.amount;
            } else if (typeof parsed.amount === 'string') {
              const n = parseInt(parsed.amount.replace(/[^0-9]/g, ''), 10);
              ocrAmount = isNaN(n) ? null : n;
            }
            ocrMemo = typeof parsed.merchant === 'string' ? parsed.merchant : null;
            const validCategories = ['transport', 'meal', 'gear', 'etc_expense', 'personal'];
            ocrCategory = validCategories.includes(parsed.category) ? parsed.category : null;
          }
        } else {
          const errText = await res.text();
          console.warn('[receipt/ocr] Gemini API 오류:', res.status, errText.substring(0, 300));
        }
      }
    } catch (err) {
      console.warn('[receipt/ocr] OCR 실패 (무시):', err);
    }
  }

  return NextResponse.json({ success: true, ocrAmount, ocrMemo, ocrCategory });
}
