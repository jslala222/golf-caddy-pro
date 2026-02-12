
'use client';

import React, { useState, useEffect } from 'react';
import { generateLicenseKey } from '@/lib/licenseUtils';
import { ShieldCheck, Key, RefreshCcw, Copy, Check, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
    const [password, setPassword] = useState('');
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [deviceId, setDeviceId] = useState('');
    const [generatedKey, setGeneratedKey] = useState('');
    const [copied, setCopied] = useState(false);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [lockoutExpiry, setLockoutExpiry] = useState<number | null>(null);

    // 컴포넌트 마운트 시 차단 상태 확인
    useEffect(() => {
        const storedExpiry = localStorage.getItem('caddy_admin_lockout');
        if (storedExpiry) {
            const expiry = parseInt(storedExpiry, 10);
            if (expiry > Date.now()) {
                setLockoutExpiry(expiry);
            } else {
                localStorage.removeItem('caddy_admin_lockout');
            }
        }
    }, []);

    const handleAuth = (e: React.FormEvent) => {
        e.preventDefault();

        // 차단 중인지 확인
        if (lockoutExpiry && lockoutExpiry > Date.now()) {
            const remainingMinutes = Math.ceil((lockoutExpiry - Date.now()) / 60000);
            alert(`보안을 위해 접속이 차단되었습니다. ${remainingMinutes}분 후 다시 시도해 주세요.`);
            return;
        }

        // 비밀번호 확인 (8자 이상의 복잡한 문자열로 변경)
        if (password === 'CaddyAdmin@2026') {
            setIsAuthorized(true);
            setFailedAttempts(0);
            localStorage.removeItem('caddy_admin_lockout');
        } else {
            const newAttempts = failedAttempts + 1;
            setFailedAttempts(newAttempts);

            if (newAttempts >= 5) {
                // 30분 차단 설정
                const expiry = Date.now() + (30 * 60000);
                setLockoutExpiry(expiry);
                localStorage.setItem('caddy_admin_lockout', expiry.toString());
                alert('비밀번호를 5회 연속 틀려 30분간 접속이 차단됩니다.');
            } else {
                alert(`비밀번호가 틀렸습니다. (남은 기회: ${5 - newAttempts}회)`);
            }
        }
    };

    const handleGenerate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!deviceId) return;

        const key = generateLicenseKey(deviceId.trim().toUpperCase());
        setGeneratedKey(key);
        setCopied(false);
    };

    const handleCopy = () => {
        if (!generatedKey) return;
        navigator.clipboard.writeText(generatedKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isAuthorized) {
        const isLocked = lockoutExpiry && lockoutExpiry > Date.now();
        const remainingMinutes = isLocked ? Math.ceil((lockoutExpiry! - Date.now()) / 60000) : 0;

        return (
            <div className="fixed inset-0 bg-stone-900 flex items-center justify-center p-6 text-white z-[10000]">
                <form onSubmit={handleAuth} className="w-full max-w-xs space-y-6 text-center">
                    <ShieldCheck size={64} className={`mx-auto mb-2 ${isLocked ? 'text-red-500' : 'text-emerald-500'}`} />
                    <h1 className="text-xl font-black">관리자 인증</h1>
                    <p className="text-stone-400 text-sm">대표님 전용 관리 페이지입니다.</p>

                    {isLocked ? (
                        <div className="bg-red-500/20 border border-red-500/50 p-4 rounded-2xl text-red-400 text-sm font-bold leading-relaxed">
                            보안상 {remainingMinutes}분간 접속이<br />금지되었습니다.
                        </div>
                    ) : (
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="관리자 암호 입력"
                            className="w-full p-4 bg-stone-800 border-none rounded-2xl text-center text-xl tracking-wider font-mono focus:ring-2 focus:ring-emerald-500"
                            autoFocus
                        />
                    )}

                    {!isLocked && (
                        <button type="submit" className="w-full bg-emerald-600 py-4 rounded-2xl font-bold text-lg">로그인</button>
                    )}
                    <Link href="/" className="block text-stone-500 text-sm font-bold mt-4">나가기</Link>
                </form>
            </div>
        );
    }

    return (
        <div className="p-6 bg-stone-50 min-h-screen pb-24">
            <header className="mb-8">
                <Link href="/settings" className="inline-flex items-center text-stone-400 hover:text-stone-600 mb-4 text-sm font-bold gap-1">
                    <ChevronLeft size={16} /> 설정으로 돌아가기
                </Link>
                <h1 className="text-2xl font-black text-stone-900 flex items-center gap-2">
                    <ShieldCheck className="text-emerald-600" /> 관리자 도구
                </h1>
                <p className="text-stone-400 text-xs mt-1">라이선스 키 발급 및 관리 (대표 전용)</p>
            </header>

            <div className="space-y-6">
                <section className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                        <Key size={18} /> 라이선스 키 생성기
                    </div>

                    <form onSubmit={handleGenerate} className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-stone-400 uppercase tracking-wider mb-1.5 ml-1">
                                기기 고유 번호 (사용자에게 받은 번호)
                            </label>
                            <input
                                type="text"
                                value={deviceId}
                                onChange={(e) => setDeviceId(e.target.value.toUpperCase())}
                                placeholder="예: ABCD-1234"
                                className="w-full p-4 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 font-mono text-lg"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-stone-900 text-white font-bold py-4 rounded-2xl hover:bg-stone-800 transition shadow-lg flex items-center justify-center gap-2"
                        >
                            <RefreshCcw size={20} /> 키 발급하기
                        </button>
                    </form>
                </section>

                {generatedKey && (
                    <section className="bg-emerald-600 p-6 rounded-3xl text-white shadow-xl animate-in fade-in slide-in-from-top-4">
                        <div className="text-[10px] font-black text-emerald-200 uppercase tracking-widest mb-4">
                            발급된 라이선스 키
                        </div>

                        <div className="flex flex-col items-center gap-4">
                            <div className="text-4xl font-black tracking-[0.2em] font-mono">
                                {generatedKey}
                            </div>

                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-6 py-2 rounded-full text-xs font-bold transition backdrop-blur-md"
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                {copied ? '복사 완료!' : '키 복사하기'}
                            </button>
                        </div>

                        <div className="mt-6 pt-6 border-t border-white/10 text-[10px] text-emerald-100/70 leading-relaxed text-center font-medium">
                            위 키를 복사해서 해당 기기 사용자에게 보내주세요.<br />
                            이 키는 입력한 '{deviceId}' 기기에서만 작동합니다.
                        </div>
                    </section>
                )}

                <section className="bg-orange-50 p-5 rounded-2xl border border-orange-100">
                    <h3 className="text-xs font-bold text-orange-800 mb-2 flex items-center gap-1.5">
                        ⚠️ 주의사항
                    </h3>
                    <ul className="text-[10px] text-orange-700 space-y-1.5 leading-relaxed font-medium">
                        <li>• 이 페이지 주소는 본인만 알고 있어야 합니다.</li>
                        <li>• 오타가 나면 키가 작동하지 않으므로 정확히 입력해 주세요.</li>
                        <li>• 나중에 이 페이지를 완전히 숨기거나 비밀번호를 걸 수 있습니다.</li>
                    </ul>
                </section>
            </div>
        </div>
    );
}
