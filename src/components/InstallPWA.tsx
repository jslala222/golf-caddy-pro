
'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, Download, ExternalLink, HelpCircle } from 'lucide-react';

export function InstallPWA() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // 이미 앱으로 실행 중인지 확인
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
            setIsStandalone(true);
        }

        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsInstallable(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setIsInstallable(false);
        }
    };

    if (isStandalone) {
        return (
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center gap-3">
                <div className="bg-emerald-500 text-white p-2 rounded-lg">
                    <Smartphone size={20} />
                </div>
                <div>
                    <p className="text-emerald-900 font-bold text-sm">현재 앱으로 사용 중입니다</p>
                    <p className="text-emerald-700 text-xs">안전하고 빠르게 데이터를 관리하세요.</p>
                </div>
            </div>
        );
    }

    return (
        <section className="space-y-4">
            <h2 className="text-lg font-bold text-stone-800 flex items-center">
                <div className="w-1 h-6 bg-emerald-500 rounded-full mr-2"></div> 홈 화면에 앱 설치
            </h2>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-4">
                {isInstallable ? (
                    <div className="space-y-4">
                        <p className="text-sm text-stone-600 leading-relaxed">
                            <strong>[홈 화면 추가]</strong> 버튼을 누르면 스마트폰에 바로 설치되어 <br />
                            바탕화면에서 터치 한 번으로 실행할 수 있습니다.
                        </p>
                        <button
                            onClick={handleInstallClick}
                            className="w-full py-4 bg-emerald-600 text-white font-black rounded-xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 active:scale-95 transition"
                        >
                            <Download size={20} /> 지금 홈 화면에 추가하기
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-stone-50 p-4 rounded-xl border border-stone-100 flex gap-3">
                            <HelpCircle className="text-stone-400 mt-0.5" size={18} />
                            <div className="text-sm text-stone-600 space-y-2">
                                <p>앱 설치 버튼이 안 보이시나요? 아래를 확인해 보세요.</p>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                    <li><strong>시크릿 모드:</strong> 보안상 설치가 불가능합니다. 일반 탭에서 열어주세요.</li>
                                    <li><strong>삼성 인터넷:</strong> 하단 메뉴 [≡] → <strong>[현재 웹페이지 추가]</strong> → <strong>[홈 화면]</strong>을 순서대로 눌러주세요.</li>
                                    <li><strong>크롬 브라우저:</strong> 우측 상단 [⋮] → [홈 화면에 추가]를 눌러주세요.</li>
                                    <li><strong>카카오톡:</strong> 우측 상단 [⋮] → [다른 브라우저로 열기] 후 위 과정을 반복해 주세요.</li>
                                </ul>
                            </div>
                        </div>
                        <button
                            onClick={() => window.open(window.location.origin + '?v=' + Date.now(), '_blank')}
                            className="w-full py-3 bg-stone-100 text-stone-600 font-bold rounded-xl flex items-center justify-center gap-2"
                        >
                            <ExternalLink size={18} /> 일반 브라우저로 새로고침
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
