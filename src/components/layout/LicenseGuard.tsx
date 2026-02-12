
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
        const storedKey = localStorage.getItem('caddy_license_key');
        const id = getDeviceId();
        setDeviceId(id);

        if (storedKey && verifyLicense(storedKey)) {
            setIsActivated(true);
        } else {
            setIsActivated(false);
        }
    }, []);

    const handleActivate = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (verifyLicense(inputKey)) {
            localStorage.setItem('caddy_license_key', inputKey);
            setIsActivated(true);
        } else {
            setError('유효하지 않은 라이선스 키입니다. 다시 확인해 주세요.');
        }
    };

    if (isActivated === null) return null;

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
                    <div className="bg-black/30 p-3 rounded-2xl text-center border border-white/5 select-all">
                        <code className="text-xl font-mono text-emerald-400 tracking-wider">
                            {deviceId}
                        </code>
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
                        Privacy First • No Server • Only Local
                    </p>
                </div>
            </div>
        </div>
    );
}
