'use client';
import { useState, useRef } from 'react';

interface OcrResult {
  raw: unknown;
  parsed: {
    ocrAmount: number | null;
    ocrMemo: string | null;
    ocrCategory: string | null;
  } | null;
  error: string | null;
}

export default function TestOcrPage() {
  const [result, setResult] = useState<OcrResult | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      // Canvas로 압축 (money/page.tsx와 동일 로직)
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = URL.createObjectURL(file);
      });

      const canvas = document.createElement('canvas');
      const MAX_SIZE = 1200;
      const ratio = Math.min(MAX_SIZE / img.width, MAX_SIZE / img.height, 1);
      const MIN_W = 400;
      canvas.width = Math.max(img.width * ratio, MIN_W);
      canvas.height = img.height * (canvas.width / img.width);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>(resolve =>
        canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.75)
      );
      const compressed = new File([blob], 'receipt.jpg', { type: 'image/jpeg' });

      const fd = new FormData();
      fd.append('file', compressed);
      fd.append('licenseCode', 'TEST-OCR-000');

      const res = await fetch('/api/receipt/upload', { method: 'POST', body: fd });
      const data = await res.json();

      setResult({
        raw: data,
        parsed: data.success
          ? {
              ocrAmount: data.ocrAmount ?? null,
              ocrMemo: data.ocrMemo ?? null,
              ocrCategory: data.ocrCategory ?? null,
            }
          : null,
        error: data.error ?? null,
      });
    } catch (err) {
      setResult({ raw: null, parsed: null, error: String(err) });
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-2">🧪 OCR 테스트</h1>
      <p className="text-gray-400 text-sm mb-6">영수증 사진을 선택하면 API 응답을 그대로 보여줍니다.</p>

      <label className="block w-full cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-center py-3 rounded-xl mb-6 font-semibold">
        {loading ? '분석 중...' : '📷 영수증 이미지 선택'}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
          disabled={loading}
        />
      </label>

      {loading && (
        <div className="text-center text-gray-400 animate-pulse">Gemini API 호출 중...</div>
      )}

      {result && (
        <div className="space-y-4">
          {/* 파싱 결과 */}
          <div className="bg-gray-900 rounded-xl p-4 space-y-2">
            <h2 className="font-semibold text-green-400 mb-3">✅ 파싱 결과</h2>
            {result.parsed ? (
              <>
                <Row
                  label="금액"
                  value={
                    result.parsed.ocrAmount != null
                      ? `${result.parsed.ocrAmount.toLocaleString()}원 ✅`
                      : 'null ❌ (인식 실패)'
                  }
                  ok={result.parsed.ocrAmount != null}
                />
                <Row
                  label="카테고리"
                  value={result.parsed.ocrCategory ?? 'null ❌'}
                  ok={result.parsed.ocrCategory != null}
                />
                <Row
                  label="상호명"
                  value={result.parsed.ocrMemo ?? 'null'}
                  ok={result.parsed.ocrMemo != null}
                />
              </>
            ) : (
              <p className="text-red-400">API 실패 — 아래 RAW 응답 확인</p>
            )}
          </div>

          {/* RAW 응답 */}
          <div className="bg-gray-900 rounded-xl p-4">
            <h2 className="font-semibold text-yellow-400 mb-3">📦 서버 RAW 응답</h2>
            <pre className="text-xs text-gray-300 overflow-auto whitespace-pre-wrap break-all">
              {JSON.stringify(result.raw, null, 2)}
            </pre>
          </div>

          {result.error && (
            <div className="bg-red-900 rounded-xl p-4">
              <h2 className="font-semibold text-red-300 mb-1">❌ 오류</h2>
              <p className="text-sm text-red-200">{result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-gray-400 text-sm shrink-0">{label}</span>
      <span className={`text-sm text-right font-mono ${ok ? 'text-green-300' : 'text-red-400'}`}>
        {value}
      </span>
    </div>
  );
}
