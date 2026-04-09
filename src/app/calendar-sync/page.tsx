'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, ExternalLink, Share2, Smartphone, Sparkles } from 'lucide-react';

type DeviceType = 'ios' | 'android' | 'desktop';

function detectDevice(userAgent: string): DeviceType {
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  if (/android/i.test(userAgent)) return 'android';
  return 'desktop';
}

export default function CalendarSyncPage() {
  const [licenseCode, setLicenseCode] = useState<string | null>(null);
  const [licenseTier, setLicenseTier] = useState<'standard' | 'premium'>('standard');
  const [siteOrigin, setSiteOrigin] = useState('');
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [launched, setLaunched] = useState(false);

  useEffect(() => {
    setLicenseCode(localStorage.getItem('caddy_license_key'));
    setLicenseTier(localStorage.getItem('caddy_tier') === 'premium' ? 'premium' : 'standard');
    setSiteOrigin(window.location.origin);
    setDevice(detectDevice(navigator.userAgent));
  }, []);

  const subscribeUrl = licenseCode && siteOrigin ? `${siteOrigin}/api/calendar/${licenseCode}.ics` : '';
  const webcalUrl = subscribeUrl ? subscribeUrl.replace(/^https?/, 'webcal') : '';
  const googleAddUrl = subscribeUrl
    ? `https://calendar.google.com/calendar/u/0/r/settings/addbyurl?cid=${encodeURIComponent(subscribeUrl)}`
    : '';

  const handleCopy = async () => {
    if (!subscribeUrl) return;
    try {
      await navigator.clipboard.writeText(subscribeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('아래 주소를 복사해 주세요.', subscribeUrl);
    }
  };

  const handleShare = async () => {
    if (!subscribeUrl || !navigator.share) return;
    try {
      await navigator.share({
        title: '캐디 매니저 Pro 캘린더 등록',
        text: '이 링크를 열어 캘린더 자동 동기화를 등록하세요.',
        url: subscribeUrl,
      });
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      // 취소는 무시
    }
  };

  const handleLaunch = () => {
    if (!subscribeUrl) return;
    if (device === 'ios' && webcalUrl) {
      window.location.href = webcalUrl;
    } else if (googleAddUrl) {
      window.open(googleAddUrl, '_blank', 'noopener,noreferrer');
    }
    localStorage.setItem('caddy_calendar_sync_started', 'true');
    setLaunched(true);
  };

  const quickTitle = device === 'ios' ? '아이폰 캘린더 바로 열기' : device === 'android' ? 'Google 캘린더 등록 계속' : '휴대폰에서 등록 시작';
  const quickDesc = device === 'ios'
    ? 'Safari에서 누르면 구독 캘린더 추가 화면으로 바로 이어집니다.'
    : device === 'android'
      ? 'Google 캘린더의 URL 추가 화면을 바로 열어 등록 단계를 줄입니다.'
      : '스마트폰에서만 설정 가능합니다. 휴대폰으로 접속해 주세요.';

  return (
    <div className="px-4 py-5 pb-28 space-y-5 bg-white min-h-screen">
      <div className="flex items-center justify-between">
        <Link href="/settings#calendar-sync" className="inline-flex items-center gap-2 text-sm font-bold text-stone-600">
          <ArrowLeft size={18} /> 설정으로 돌아가기
        </Link>
        <span className={`px-3 py-1 rounded-full text-xs font-black ${licenseTier === 'premium' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
          {licenseTier === 'premium' ? '프리미엄' : '스탠다드'}
        </span>
      </div>

      <section className="rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-500 to-cyan-500 text-white p-5 shadow-xl shadow-emerald-100">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-black mb-3">
          <Sparkles size={14} /> C안 실행 흐름
        </div>
        <h1 className="text-2xl font-black leading-tight">캘린더 자동 동기화 등록</h1>
        <p className="text-sm text-emerald-50 mt-2">처음 1번만 연결하면 이후 일정 수정은 앱에서만 하고, 폰 캘린더는 자동으로 따라오게 만듭니다.</p>
      </section>

      {!licenseCode ? (
        <section className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
          이용권 코드가 없어 등록을 시작할 수 없습니다. 설정 또는 랜딩에서 먼저 이용권을 활성화해 주세요.
        </section>
      ) : licenseTier !== 'premium' ? (
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 space-y-2">
          <p className="font-bold">스탠다드 요금제는 캘린더 자동 동기화를 지원하지 않습니다.</p>
          <p className="text-xs">프리미엄으로 전환하면 버튼이 활성화되고, 스마트폰에서 바로 설정할 수 있습니다.</p>
          <Link
            href="/subscribe?plan=month&tier=premium"
            className="inline-flex h-10 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-sm font-extrabold items-center"
          >
            프리미엄 전환하기
          </Link>
        </section>
      ) : device === 'desktop' ? (
        <section className="bg-stone-100 border border-stone-200 rounded-2xl p-4 text-sm text-stone-700 space-y-2">
          <p className="font-bold">이 기능은 스마트폰에서만 설정합니다.</p>
          <p className="text-xs">휴대폰 브라우저에서 로그인 후 설정 화면의 캘린더 동기화에서 등록 시작을 눌러주세요.</p>
        </section>
      ) : (
        <>
          <section className="bg-stone-900 text-white rounded-3xl p-5 space-y-4 shadow-lg">
            <div>
              <p className="text-xs font-black text-emerald-300">빠른 실행</p>
              <h2 className="text-xl font-black mt-1">{quickTitle}</h2>
              <p className="text-sm text-stone-300 mt-1">{quickDesc}</p>
            </div>
            <button
              onClick={handleLaunch}
              className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-base flex items-center justify-center gap-2"
            >
              <ExternalLink size={18} /> {quickTitle}
            </button>
            {launched && (
              <div className="bg-emerald-500/15 border border-emerald-400/30 rounded-2xl p-3 text-sm text-emerald-100">
                등록 화면을 열었습니다. 캘린더 앱 또는 Google 캘린더 화면에서 구독 추가만 완료하면 끝입니다.
              </div>
            )}
          </section>

          <section className="bg-white border border-stone-200 rounded-3xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-stone-900 font-black">
              <Smartphone size={18} className="text-emerald-600" /> 휴대폰 등록 3단계
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl bg-stone-50 p-4 border border-stone-100">
                <p className="text-xs font-black text-emerald-600">STEP 1</p>
                <p className="text-sm font-bold text-stone-800 mt-1">등록 시작 버튼 누르기</p>
                <p className="text-xs text-stone-500 mt-1">아이폰은 캘린더 추가, 갤럭시는 Google 캘린더 URL 추가로 연결됩니다.</p>
              </div>
              <div className="rounded-2xl bg-stone-50 p-4 border border-stone-100">
                <p className="text-xs font-black text-emerald-600">STEP 2</p>
                <p className="text-sm font-bold text-stone-800 mt-1">한 번만 구독 추가 완료</p>
                <p className="text-xs text-stone-500 mt-1">이후 일정 수정은 캐디 매니저 Pro에서만 하면 됩니다.</p>
              </div>
              <div className="rounded-2xl bg-stone-50 p-4 border border-stone-100">
                <p className="text-xs font-black text-emerald-600">STEP 3</p>
                <p className="text-sm font-bold text-stone-800 mt-1">자동 반영 확인</p>
                <p className="text-xs text-stone-500 mt-1">아이폰은 비교적 빠르고, Google/삼성은 기기 정책에 따라 수시간 뒤 반영될 수 있습니다.</p>
              </div>
            </div>
          </section>

          <section className="bg-white border border-stone-200 rounded-3xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-stone-900 font-black">
              <Copy size={18} className="text-emerald-600" /> 보조 수단
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={handleCopy}
                className="h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center justify-center gap-2"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? '복사 완료' : 'URL 복사'}
              </button>
              {typeof navigator !== 'undefined' && navigator.share ? (
                <button
                  onClick={handleShare}
                  className="h-12 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-black flex items-center justify-center gap-2"
                >
                  {shared ? <Check size={16} /> : <Share2 size={16} />}
                  {shared ? '공유 완료' : '링크 공유'}
                </button>
              ) : (
                <a
                  href={googleAddUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-12 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-black flex items-center justify-center gap-2"
                >
                  <ExternalLink size={16} /> Google Calendar 열기
                </a>
              )}
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3">
              <p className="text-[11px] text-stone-400 mb-1">구독 URL</p>
              <p className="font-mono text-[11px] break-all text-stone-700">{subscribeUrl}</p>
            </div>
          </section>

          <section className="bg-amber-50 border border-amber-200 rounded-3xl p-5 space-y-3">
            <h2 className="text-base font-black text-amber-900">기기별 메모</h2>
            <div className="space-y-2 text-sm text-amber-900">
              <p><b>아이폰:</b> Safari에서 바로 열기 버튼을 누르면 구독 캘린더 추가로 이어질 가능성이 가장 높습니다.</p>
              <p><b>갤럭시:</b> 일부 삼성 캘린더는 직접 URL 구독 메뉴가 없어 Google 캘린더 경유가 가장 안정적입니다.</p>
              <p><b>요금제:</b> 캘린더 자동 동기화는 프리미엄에서만 사용할 수 있습니다.</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}