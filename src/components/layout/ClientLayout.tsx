'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { LicenseGuard } from '@/components/layout/LicenseGuard';
import { BottomNav } from '@/components/layout/BottomNav';
import { PortGuard } from '@/components/PortGuard';
import { ExternalLink, X, Download, Share2 } from 'lucide-react';

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
    const isTestPayPage = pathname?.startsWith('/test-pay');
    const [isKakaotalk, setIsKakaotalk] = useState(false);
    const [showKakaoBanner, setShowKakaoBanner] = useState(true);
    const [isIOS, setIsIOS] = useState(false);
    const [showInstallBanner, setShowInstallBanner] = useState(false);
    const [showIOSGuide, setShowIOSGuide] = useState(false);
    const [isLocal, setIsLocal] = useState(false);
    const deferredPrompt = useRef<Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null>(null);

    useEffect(() => {
        const ua = navigator.userAgent;

        // ── 로컈 vs 배포 환경 감지 → theme-color 동적 변경 ────────
        const local =
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';
        setIsLocal(local);
        const themeColor = local ? '#3b82f6' : '#EC4899';
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) metaTheme.setAttribute('content', themeColor);
        document.documentElement.setAttribute('data-env', local ? 'local' : 'prod');

        // ── 카카오톡 / LINE 인앱브라우저 감지 ──────────────────
        const isKakao = /kakaotalk/i.test(ua);
        const isLine = /line\//i.test(ua);
        if (isKakao || isLine) {
            setIsKakaotalk(true);
        }

        // ── iOS 감지 ──────────────────────────────────────────
        const ios = /iphone|ipad|ipod/i.test(ua);
        setIsIOS(ios);

        // ── 이미 PWA 설치 여부 확인 ───────────────────────────
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as { standalone?: boolean }).standalone === true;

        // ── iOS Safari: 홈화면 추가 안내 (하루 1회 억제) ──────
        const dismissed = localStorage.getItem('pwa_install_dismissed');
        const isSafariiOS =
            ios &&
            /safari/i.test(ua) &&
            !/crios|fxios|opios|mercury/i.test(ua);
        if (!isStandalone && !isKakao && !dismissed && isSafariiOS) {
            setShowInstallBanner(true);
            setShowIOSGuide(true);
        }

        // ── Android beforeinstallprompt ───────────────────────
        const handleInstallPrompt = (e: Event) => {
            e.preventDefault();
            deferredPrompt.current = e as typeof deferredPrompt.current;
            if (!localStorage.getItem('pwa_install_dismissed')) {
                setShowInstallBanner(true);
            }
        };
        window.addEventListener('beforeinstallprompt', handleInstallPrompt);

        // ── PWA 서비스 워커 등록 ──────────────────────────────
        if ('serviceWorker' in navigator) {
            const register = () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(() => console.log('SW Registered'))
                    .catch(err => console.log('SW Registration Failed', err));
            };
            if (document.readyState === 'complete') {
                register();
            } else {
                window.addEventListener('load', register);
            }
        }

        // ── 하루 1회 R2 자동 백업 ─────────────────────────────
        runAutoBackupIfNeeded();

        return () => {
            window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAndroidInstall = async () => {
        if (!deferredPrompt.current) return;
        deferredPrompt.current.prompt();
        const { outcome } = await deferredPrompt.current.userChoice;
        deferredPrompt.current = null;
        if (outcome === 'accepted') {
            setShowInstallBanner(false);
            localStorage.setItem('pwa_install_dismissed', new Date().toDateString());
        }
    };

    const dismissInstallBanner = () => {
        setShowInstallBanner(false);
        localStorage.setItem('pwa_install_dismissed', new Date().toDateString());
    };

    return (
        <PortGuard>
            {/* ── 로컬 개발 환경 표시줄 (배포와 색 구분) ──────── */}
            {isLocal && (
                <div className="sticky top-0 left-0 right-0 z-[10002] bg-blue-600 text-white text-xs font-bold text-center py-1 tracking-widest select-none pointer-events-none">
                    🛠 LOCAL DEV — localhost:4455
                </div>
            )}

            {/* ── 카카오톡 인앱브라우저 경고 ─────────────────── */}
            {isKakaotalk && showKakaoBanner && (
                <div className="sticky top-0 left-0 right-0 bg-emerald-600 text-white p-4 z-[10001] shadow-lg">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                            <p className="font-bold text-sm mb-1 flex items-center gap-2">
                                <ExternalLink size={16} />
                                카카오톡 브라우저 안내
                            </p>
                            <p className="text-xs text-emerald-50 leading-relaxed">
                                카카오톡 안에서는 앱 설치·카메라 등 일부 기능이 제한됩니다.<br />
                                {isIOS
                                    ? <><strong>우측 상단 [···]</strong> → <strong>Safari로 열기</strong> 를 눌러주세요. ⛳️</>                                    : <><strong>우측 상단 [⋮]</strong> → <strong>다른 브라우저로 열기</strong> 를 눌러주세요. ⛳️</>                                }
                            </p>
                        </div>
                        <button onClick={() => setShowKakaoBanner(false)} className="p-1 hover:bg-white/10 rounded-full">
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── PWA 설치 배너 ───────────────────────────────── */}
            {!isKakaotalk && showInstallBanner && (
                <div className="sticky top-0 left-0 right-0 bg-pink-600 text-white px-4 py-3 z-[10001] shadow-lg">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                            <p className="font-bold text-sm mb-1 flex items-center gap-2">
                                {showIOSGuide ? <Share2 size={16} /> : <Download size={16} />}
                                홈화면에 추가하면 앱처럼 쓸 수 있어요!
                            </p>
                            {showIOSGuide ? (
                                <p className="text-xs text-pink-100 leading-relaxed">
                                    하단 <strong>[공유 🔗]</strong> 버튼 → <strong>[홈 화면에 추가]</strong> 탭하세요.
                                </p>
                            ) : (
                                <div className="flex gap-2 mt-1">
                                    <button
                                        onClick={handleAndroidInstall}
                                        className="text-xs bg-white text-pink-600 font-bold px-3 py-1 rounded-full"
                                    >
                                        설치하기
                                    </button>
                                </div>
                            )}
                        </div>
                        <button onClick={dismissInstallBanner} className="p-1 hover:bg-white/10 rounded-full">
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}
            {isAdminPage || isDealerPage || isSubscribePage || isLandingPage || isDealerLoginPage || isTestPayPage ? (
                children
            ) : (
                <div className="flex justify-center min-h-screen bg-stone-100">
                    <div className="w-full max-w-[480px] bg-white relative flex flex-col min-h-screen shadow-2xl">
                        <main className="flex-1 pb-20">
                            <LicenseGuard>
                                {children}
                            </LicenseGuard>
                        </main>
                        <BottomNav />
                    </div>
                </div>
            )}
        </PortGuard>
    );
}
