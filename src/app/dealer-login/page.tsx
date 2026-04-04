'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Phone, Lock, LogIn } from 'lucide-react';

export default function DealerLoginPage() {
    const router = useRouter();
    const [phone, setPhone] = useState('');
    const [pin, setPin] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
        const formatted = raw.length <= 3 ? raw : raw.length <= 7
            ? `${raw.slice(0, 3)}-${raw.slice(3)}`
            : `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
        setPhone(formatted);
    };

    const handleLogin = async () => {
        if (!phone.trim()) { setErrorMsg('전화번호를 입력해주세요.'); setStatus('error'); return; }
        setStatus('loading');
        setErrorMsg('');

        const { data, error } = await supabase
            .from('aone_pro_caddypro_dealers')
            .select('token, pin, is_active, name')
            .eq('phone', phone.trim())
            .single();

        if (error || !data) {
            setErrorMsg('등록된 딜러 정보가 없습니다.');
            setStatus('error');
            return;
        }
        if (!data.is_active) {
            setErrorMsg('비활성화된 딜러 계정입니다. 관리자에게 문의하세요.');
            setStatus('error');
            return;
        }
        if (data.pin && data.pin !== pin.trim()) {
            setErrorMsg('PIN 번호가 올바르지 않습니다.');
            setStatus('error');
            return;
        }

        // 로그인 성공 → 대시보드 이동
        router.push(`/dealer/${data.token}/dashboard`);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleLogin();
    };

    return (
        <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
            <div className="w-full max-w-sm">
                {/* 헤더 */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
                        <span className="text-2xl">⛳</span>
                    </div>
                    <h1 className="text-xl font-bold text-white">딜러 로그인</h1>
                    <p className="text-stone-400 text-sm mt-1">등록된 전화번호와 PIN으로 접속하세요</p>
                </div>

                {/* 폼 */}
                <div className="bg-stone-900 rounded-3xl p-6 space-y-4">
                    {/* 전화번호 */}
                    <div>
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">
                            전화번호
                        </label>
                        <div className="relative">
                            <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" />
                            <input
                                value={phone}
                                onChange={handlePhoneChange}
                                onKeyDown={handleKeyDown}
                                placeholder="010-0000-0000"
                                inputMode="tel"
                                className="w-full pl-10 pr-4 py-4 bg-stone-800 border border-stone-700 rounded-2xl text-white placeholder-stone-500 focus:ring-2 focus:ring-blue-500 focus:outline-none text-base"
                            />
                        </div>
                    </div>

                    {/* PIN */}
                    <div>
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">
                            PIN <span className="text-stone-600 normal-case font-normal">(없으면 비워두세요)</span>
                        </label>
                        <div className="relative">
                            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" />
                            <input
                                value={pin}
                                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                onKeyDown={handleKeyDown}
                                placeholder="4~8자리 숫자"
                                inputMode="numeric"
                                type="password"
                                className="w-full pl-10 pr-4 py-4 bg-stone-800 border border-stone-700 rounded-2xl text-white placeholder-stone-500 focus:ring-2 focus:ring-blue-500 focus:outline-none text-base"
                            />
                        </div>
                    </div>

                    {/* 오류 메시지 */}
                    {status === 'error' && (
                        <div className="bg-red-950 border border-red-800 rounded-2xl px-4 py-3 text-red-400 text-sm">
                            {errorMsg}
                        </div>
                    )}

                    {/* 로그인 버튼 */}
                    <button
                        onClick={handleLogin}
                        disabled={status === 'loading'}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-stone-700 disabled:text-stone-500 text-white font-bold rounded-2xl transition-colors text-base"
                    >
                        <LogIn size={18} />
                        {status === 'loading' ? '확인 중...' : '대시보드 접속'}
                    </button>
                </div>

                <p className="text-center text-stone-600 text-xs mt-6">
                    딜러 등록은 관리자에게 문의하세요
                </p>
            </div>
        </div>
    );
}
