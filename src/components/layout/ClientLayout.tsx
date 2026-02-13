'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { LicenseGuard } from '@/components/layout/LicenseGuard';
import { PortGuard } from '@/components/PortGuard';
import { ExternalLink, X } from 'lucide-react';

export function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAdminPage = pathname?.startsWith('/admin');
    const [isKakaotalk, setIsKakaotalk] = useState(false);
    const [showBanner, setShowBanner] = useState(true);

    useEffect(() => {
        const ua = navigator.userAgent.toLowerCase();
        if (ua.indexOf('kakaotalk') !== -1) {
            setIsKakaotalk(true);
        }

        // PWA 서비스 워커 등록
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(
                    (registration) => console.log('SW registered:', registration.scope),
                    (err) => console.log('SW registration failed:', err)
                );
            });
        }
    }, []);

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
            {isAdminPage ? (
                children
            ) : (
                <LicenseGuard>
                    {children}
                </LicenseGuard>
            )}
        </PortGuard>
    );
}
