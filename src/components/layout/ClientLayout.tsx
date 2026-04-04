'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { LicenseGuard } from '@/components/layout/LicenseGuard';
import { PortGuard } from '@/components/PortGuard';
import { ExternalLink, X } from 'lucide-react';

/** 티어별 R2 자동 백업 - 프리미엄: 매일, 스탠다드: 7일마다 */
async function runAutoBackupIfNeeded() {
    try {
        const licenseCode = localStorage.getItem('caddy_license_key');
        if (!licenseCode) return;

        const tier = localStorage.getItem('caddy_tier') ?? 'standard';
        const today = new Date().toISOString().slice(0, 10);
        const lastBackup = localStorage.getItem('caddy_last_auto_backup');

        if (lastBackup) {
            const daysSince = Math.floor(
                (new Date(today).getTime() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24)
            );
            const interval = tier === 'premium' ? 1 : 7; // 프리미엄: 1일 / 스탠다드: 7일
            if (daysSince < interval) return;
        }

        const raw = localStorage.getItem('caddy-manager-storage');
        if (!raw) return;

        const res = await fetch('/api/backup/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseCode, data: JSON.parse(raw) }),
        });
        const result = await res.json();
        if (result.success) {
            localStorage.setItem('caddy_last_auto_backup', today);
        }
    } catch {
        // 자동 백업 실패는 조용히 무시
    }
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAdminPage = pathname?.startsWith('/admin');
    const isDealerPage = pathname?.startsWith('/dealer');
    const isSubscribePage = pathname?.startsWith('/subscribe');
    const isLandingPage = pathname?.startsWith('/landing');
    const isDealerLoginPage = pathname?.startsWith('/dealer-login');
    const [isKakaotalk, setIsKakaotalk] = useState(false);
    const [showBanner, setShowBanner] = useState(true);

    useEffect(() => {
        const ua = navigator.userAgent.toLowerCase();
        // PWA 서비스 워커 등록 (로딩 즉시 실행되도록 보강)
        if ('serviceWorker' in navigator) {
            const register = () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('SW Registered'))
                    .catch(err => console.log('SW Registration Failed', err));
            };

            if (document.readyState === 'complete') {
                register();
            } else {
                window.addEventListener('load', register);
            }
        }

        // 하루 1회 R2 자동 백업 (앱 열릴 때 백그라운드 실행)
        runAutoBackupIfNeeded();
    }, [pathname]);

    return (
        <PortGuard>
            {isKakaotalk && showBanner && (
                <div className="sticky top-0 left-0 right-0 bg-emerald-600 text-white p-4 z-[10001] shadow-lg animate-in slide-in-from-top duration-500">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                            <p className="font-bold text-sm mb-1 flex items-center gap-2">
                                <ExternalLink size={16} />
                                카톡 전용 안내
                            </p>
                            <p className="text-xs text-emerald-50 leading-relaxed">
                                카톡 안에서는 '앱 설치'가 안 됩니다!<br />
                                <strong>우측 상단 [⋮]</strong> 버튼을 누르고 <br />
                                <strong>"다른 브라우저로 열기"</strong>를 선택해 주세요. ⛳️
                            </p>
                        </div>
                        <button
                            onClick={() => setShowBanner(false)}
                            className="p-1 hover:bg-white/10 rounded-full"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}
            {isAdminPage || isDealerPage || isSubscribePage || isLandingPage || isDealerLoginPage ? (
                children
            ) : (
                <LicenseGuard>
                    {children}
                </LicenseGuard>
            )}
        </PortGuard>
    );
}
