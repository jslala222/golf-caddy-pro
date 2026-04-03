
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { verifyLicense, verifyLicenseAsync } from '@/lib/licenseUtils';
import { Lock, Key, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function LicenseGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [isActivated, setIsActivated] = useState<boolean | null>(null);
    const tapCountRef = useRef(0);
    const lastTapRef = useRef(0);
    const [inputKey, setInputKey] = useState('');
    const [error, setError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    // 만료 경고 상태
    const [daysLeft, setDaysLeft] = useState<number | null>(null);
    const [showExpireBanner, setShowExpireBanner] = useState(false);

    useEffect(() => {
        const init = () => {
            try {
                // 랜딩 페이지에서 전달된 pending_code 자동 적용
                const pendingCode = localStorage.getItem('caddy_pending_code');
                if (pendingCode) {
                    localStorage.removeItem('caddy_pending_code');
                    setInputKey(pendingCode);
                }

                const storedKey = localStorage.getItem('caddy_license_key');
                if (storedKey && verifyLicense(storedKey)) {
                    setIsActivated(true);
                    // 저장된 만료일 확인
                    const expiresAt = localStorage.getItem('caddy_expires_at');
                    if (expiresAt) {
                        const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
                        if (days <= 7 && days > 0) {
                            setDaysLeft(days);
                            setShowExpireBanner(true);
                        }
                    }
                } else {
                    setIsActivated(false);
                }
            } catch (e) {
                console.error('라이선스 확인 실패:', e);
                setIsActivated(false);
            }
        };
        init();
    }, []);

    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // 1단계: 로컬 체크섬 빠른 검증
        if (!verifyLicense(inputKey)) {
            setError('유효하지 않은 이용권 코드입니다. 다시 확인해 주세요.');
            return;
        }

        // 2단계: Supabase 서버 검증 (만료일 확인 + 첫 사용 처리)
        setIsVerifying(true);
        try {
            const result = await verifyLicenseAsync(inputKey);
            if (!result.valid) {
                const msg = result.reason === 'expired'
                    ? '이용 기간이 만료된 코드입니다. 새 이용권을 구매해 주세요.'
                    : result.reason === 'not_found'
                        ? '등록되지 않은 코드입니다. 관리자에게 문의해 주세요.'
                        : '코드 인증에 실패했습니다. 다시 시도해 주세요.';
                setError(msg);
                setIsVerifying(false);
                return;
            }

            // 성공 — 로컬 저장
            localStorage.setItem('caddy_license_key', inputKey.trim().toUpperCase());
            if (result.expiresAt) {
                localStorage.setItem('caddy_expires_at', result.expiresAt);
            }
            setIsActivated(true);
        } catch {
            // 오프라인 등 Supabase 불가 시 로컬 검증만으로 통과
            localStorage.setItem('caddy_license_key', inputKey.trim().toUpperCase());
            setIsActivated(true);
        } finally {
            setIsVerifying(false);
        }
    };

    if (isActivated === null) {
        return (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
                <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <p style={{ marginTop: '1rem', color: '#444', fontWeight: 'bold' }}>안전하게 진입 중입니다...</p>
                <p style={{ fontSize: '10px', color: '#888', marginTop: '0.5rem' }}>Ver 1.5.21 • Stability Mode</p>
            </div>
        );
    }

    if (isActivated) {
        return (
            <>
                {/* 만료 임박 경고 배너 (7일 이하) */}
                {showExpireBanner && daysLeft !== null && (
                    <div className="sticky top-0 left-0 right-0 bg-amber-500 text-white px-4 py-3 z-[9998] flex items-center gap-3 shadow-lg">
                        <AlertTriangle size={18} className="shrink-0" />
                        <p className="text-sm font-bold flex-1">
                            이용권이 <span className="underline">{daysLeft}일 후</span> 만료됩니다. 미리 갱신해 주세요.
                        </p>
                        <button onClick={() => setShowExpireBanner(false)} className="shrink-0 hover:opacity-70">
                            <X size={18} />
                        </button>
                    </div>
                )}
                {children}
            </>
        );
    }

    return (
        <div className="fixed inset-0 bg-stone-900 z-[9999] flex items-center justify-center p-6 text-white overflow-y-auto">
            <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in duration-300">
                <div className="text-center space-y-4">
                    <div className="inline-flex p-4 bg-emerald-500/20 rounded-full text-emerald-500 mb-2">
                        <Lock size={48} />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight select-none">
                        Caddy Manager<br />
                        <span
                            className="text-emerald-500 text-2xl font-bold cursor-default"
                            onClick={() => {
                                const now = Date.now();
                                if (now - lastTapRef.current > 2000) {
                                    tapCountRef.current = 0;
                                }
                                lastTapRef.current = now;
                                tapCountRef.current += 1;
                                if (tapCountRef.current >= 5) {
                                    tapCountRef.current = 0;
                                    router.push('/admin');
                                }
                            }}
                        >
                            PRO
                        </span>
                    </h1>
                    <p className="text-stone-400 text-sm leading-relaxed">
                        이 앱은 유료 이용권이 필요한 프리미엄 서비스입니다.<br />
                        구매 후 발급받은 이용권 코드를 입력해 주세요.
                    </p>
                </div>

                <form onSubmit={handleActivate} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-stone-500 ml-1">이용권 코드 입력</label>
                        <div className="relative">
                            <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" />
                            <input
                                type="text"
                                value={inputKey}
                                onChange={(e) => setInputKey(e.target.value.toUpperCase())}
                                placeholder="sm-XXX-XXX"
                                className="w-full bg-stone-800 border-none rounded-2xl py-4 pl-12 pr-4 text-lg font-mono tracking-widest focus:ring-2 focus:ring-emerald-500 placeholder:text-stone-600"
                                required
                            />
                        </div>
                        {error && <p className="text-red-400 text-xs font-bold text-center animate-bounce mt-2">{error}</p>}
                    </div>

                    <button
                        type="submit"
                        disabled={isVerifying}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-900/20 text-lg flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {isVerifying
                            ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> 확인 중...</>
                            : <><CheckCircle size={24} /> 활성화하기</>
                        }
                    </button>
                </form>

                <div className="text-center pt-4">
                    <p className="text-[10px] text-stone-600 uppercase tracking-widest font-bold">
                        Privacy First • Ver 1.5.21 • Only Local
                    </p>
                </div>
            </div>
        </div>
    );
}
