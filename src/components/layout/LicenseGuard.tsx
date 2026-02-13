
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getDeviceId, verifyLicense } from '@/lib/licenseUtils';
import { Lock, Key, CheckCircle, Smartphone, HelpCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function LicenseGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [isActivated, setIsActivated] = useState<boolean | null>(null);
    const tapCountRef = useRef(0);
    const lastTapRef = useRef(0);
    const [deviceId, setDeviceId] = useState('');
    const [inputKey, setInputKey] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        // 클라이언트 사이드에서만 안전하게 실행
        const init = () => {
            try {
                const id = getDeviceId();
                setDeviceId(id);

                const storedKey = localStorage.getItem('caddy_license_key');
                if (storedKey && verifyLicense(storedKey)) {
                    setIsActivated(true);
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

    const handleActivate = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (verifyLicense(inputKey)) {
            try {
                localStorage.setItem('caddy_license_key', inputKey);
                setIsActivated(true);
            } catch (e) {
                setError('라이선스 저장에 실패했습니다. (브라우저 설정을 확인해주세요)');
            }
        } else {
            setError('유효하지 않은 라이선스 키입니다.');
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
        return <>{children}</>;
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
                        이 앱은 유료 라이선스가 필요한 프리미엄 서비스입니다.<br />
                        앱을 사용하시려면 라이선스 키를 입력해 주세요.
                    </p>
                </div>

                <div className="bg-stone-800/50 border border-stone-700 p-5 rounded-3xl space-y-4 shadow-xl">
                    <div className="flex items-center justify-between text-xs text-stone-500 font-bold px-1">
                        <span className="flex items-center gap-1.5"><Smartphone size={14} /> 내 기기 고유 번호</span>
                        <HelpCircle size={14} className="opacity-50" />
                    </div>
                    <div className="bg-stone-900 p-4 rounded-2xl text-center border border-white/5 shadow-inner">
                        <code style={{
                            fontFamily: '"Cascadia Code", "Source Code Pro", "Courier New", monospace',
                            letterSpacing: '0.15em',
                            fontSize: '1.5rem',
                            color: '#4ade80',
                            fontWeight: '900'
                        }} className="select-all">
                            {deviceId}
                        </code>
                        <p className="text-[10px] text-stone-600 mt-2 font-medium">※ 0(숫자)과 O(영어) 구분을 위해 전용 폰트를 적용했습니다.</p>
                    </div>
                </div>

                <form onSubmit={handleActivate} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-stone-500 ml-1">라이선스 키 입력</label>
                        <div className="relative">
                            <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" />
                            <input
                                type="text"
                                value={inputKey}
                                onChange={(e) => setInputKey(e.target.value.toUpperCase())}
                                placeholder="XXXX-XXXX"
                                className="w-full bg-stone-800 border-none rounded-2xl py-4 pl-12 pr-4 text-lg font-mono tracking-widest focus:ring-2 focus:ring-emerald-500 placeholder:text-stone-600"
                                required
                            />
                        </div>
                        {error && <p className="text-red-400 text-xs font-bold text-center animate-bounce mt-2">{error}</p>}
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-900/20 text-lg flex items-center justify-center gap-2"
                    >
                        <CheckCircle size={24} /> 활성화하기
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
