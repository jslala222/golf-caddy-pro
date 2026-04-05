'use client';

import React, { useState, useEffect } from 'react';
import { verifyLicense, verifyLicenseAsync } from '@/lib/licenseUtils';
import { supabase } from '@/lib/supabaseClient';
import { initializeStore } from '@/lib/store';
import { AlertTriangle, X, RefreshCcw, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function LicenseGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [isActivated, setIsActivated] = useState<boolean | null>(null);

    // 만료 경고 상태
    const [daysLeft, setDaysLeft] = useState<number | null>(null);
    const [showExpireBanner, setShowExpireBanner] = useState(false);

    // 만료 모달 상태
    const [expiredCode, setExpiredCode] = useState<string | null>(null);
    const [expiredAt, setExpiredAt] = useState<string | null>(null);

    // 프리미엄 자동 복구 모달
    const [showRestoreModal, setShowRestoreModal] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                const storedKey = localStorage.getItem('caddy_license_key');
                if (storedKey && verifyLicense(storedKey)) {
                    // 계정 전환 감지 — Supabase 방식에서는 단순히 activeKey만 기록
                    localStorage.setItem('caddy_active_key', storedKey);

                    const expiresAt = localStorage.getItem('caddy_expires_at');
                    if (expiresAt && new Date(expiresAt) < new Date()) {
                        setExpiredCode(storedKey);
                        setExpiredAt(expiresAt);
                        setIsActivated(false);
                        return;
                    }

                    // 백그라운드: DB에서 최신 만료일 + tier 갱신
                    (async () => {
                        try {
                            const { data } = await supabase
                                .from('aone_pro_caddypro_licenses')
                                .select('expires_at, tier, plan')
                                .ilike('code', storedKey.trim())
                                .maybeSingle();
                            if (data?.expires_at) localStorage.setItem('caddy_expires_at', data.expires_at);
                            if (data?.tier) localStorage.setItem('caddy_tier', data.tier);
                            if (data?.plan) localStorage.setItem('caddy_plan', data.plan);
                        } catch { /* 오프라인 무시 */ }
                    })();

                    if (expiresAt) {
                        const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
                        if (days <= 7 && days > 0) {
                            setDaysLeft(days);
                            // 오늘 이미 닫은 경우 배너 미표시
                            const dismissed = localStorage.getItem('caddy_expire_banner_dismissed');
                            if (dismissed !== new Date().toDateString()) {
                                setShowExpireBanner(true);
                            }
                        }
                    }

                    // Supabase에서 데이터 초기화
                    await initializeStore(storedKey);
                    setIsActivated(true);
                } else {
                    router.replace('/landing');
                    return;
                }
            } catch {
                router.replace('/landing');
                return;
            }
        };
        init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // pending_code 처리
    useEffect(() => {
        const pendingCode = localStorage.getItem('caddy_pending_code');
        if (!pendingCode) return;
        localStorage.removeItem('caddy_pending_code');
        const activate = async () => {
            try {
                const result = await verifyLicenseAsync(pendingCode.trim().toUpperCase());
                if (result.valid) {
                    localStorage.setItem('caddy_license_key', pendingCode.trim().toUpperCase());
                    if (result.expiresAt) localStorage.setItem('caddy_expires_at', result.expiresAt);
                    if (result.tier) localStorage.setItem('caddy_tier', result.tier);
                    if (result.plan) localStorage.setItem('caddy_plan', result.plan);
                    setIsActivated(true);
                } else {
                    router.replace('/landing');
                }
            } catch {
                localStorage.setItem('caddy_license_key', pendingCode.trim().toUpperCase());
                setIsActivated(true);
            }
        };
        activate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (isActivated === null) {
        return (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
                <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <p style={{ marginTop: '1rem', color: '#444', fontWeight: 'bold' }}>데이터 불러오는 중...</p>
                <p style={{ fontSize: '10px', color: '#888', marginTop: '0.5rem' }}>서버에서 안전하게 로딩 중입니다</p>
            </div>
        );
    }

    if (!isActivated && expiredCode) {
        const expDate = expiredAt ? new Date(expiredAt) : null;
        const expStr = expDate ? `${expDate.getFullYear()}년 ${expDate.getMonth()+1}월 ${expDate.getDate()}일` : '알 수 없음';
        return (
            <div className="fixed inset-0 bg-stone-900 z-[9999] flex items-center justify-center p-6 text-white">
                <div className="w-full max-w-sm space-y-6 animate-in fade-in zoom-in duration-300">
                    <div className="text-center space-y-3">
                        <div className="inline-flex p-4 bg-amber-500/20 rounded-full text-amber-400 mb-2">
                            <AlertTriangle size={48} />
                        </div>
                        <h1 className="text-2xl font-black">이용권이 만료되었습니다</h1>
                        <p className="text-stone-400 text-sm">갱신하시면 기존 데이터를 그대로 이어 쓸 수 있습니다.</p>
                    </div>
                    <div className="bg-stone-800 rounded-2xl p-4 space-y-2 text-center">
                        <p className="text-stone-500 text-xs font-bold">이용권 코드</p>
                        <p className="font-mono font-black text-xl tracking-widest text-white">{expiredCode}</p>
                        <div className="pt-2 border-t border-stone-700">
                            <p className="text-stone-500 text-xs">만료일</p>
                            <p className="text-amber-400 font-bold text-sm mt-0.5">{expStr}</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <Link href="/subscribe?plan=6month"
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition active:scale-95">
                            <RefreshCcw size={20} /> 온라인으로 바로 갱신
                        </Link>
                        <div className="bg-stone-800 rounded-2xl p-4 text-sm text-stone-400 text-center space-y-1">
                            <p className="font-bold text-stone-300 text-xs">딜러 통해 갱신하시려면?</p>
                            <p className="text-[11px] leading-relaxed">담당 딜러에게 연락하시거나,<br />딜러 대시보드에서 전화번호 검색 후 기간 연장 가능합니다.</p>
                        </div>
                        <button
                            onClick={() => {
                                localStorage.removeItem('caddy_license_key');
                                localStorage.removeItem('caddy_expires_at');
                                router.replace('/landing');
                            }}
                            className="w-full py-3 text-stone-500 text-sm hover:text-stone-300 transition"
                        >
                            랜딩 페이지로 돌아가기
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (isActivated) {
        return (
            <>
                {showExpireBanner && daysLeft !== null && (
                    <div className="sticky top-0 left-0 right-0 bg-amber-500 text-white px-4 py-3 z-[9998] shadow-lg">
                        <div className="flex items-center gap-3">
                            <AlertTriangle size={18} className="shrink-0" />
                            <p className="text-sm font-bold flex-1">
                                이용권이 <span className="underline">{daysLeft}일 후</span> 만료됩니다.
                            </p>
                            <Link href="/subscribe?plan=6month"
                                className="shrink-0 bg-white text-amber-600 text-xs font-black px-3 py-1.5 rounded-full hover:bg-amber-50 active:scale-95 transition">
                                갱신하기
                            </Link>
                            <button onClick={() => {
                                setShowExpireBanner(false);
                                localStorage.setItem('caddy_expire_banner_dismissed', new Date().toDateString());
                            }} className="shrink-0 hover:opacity-70 ml-1">
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                )}
                {showRestoreModal && (
                    <div className="fixed inset-0 z-[99999] flex items-end justify-center pb-12 pointer-events-none">
                        <div className="bg-stone-900 text-white rounded-2xl px-6 py-4 flex items-center gap-3 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                            <CheckCircle2 size={22} className="text-emerald-400 shrink-0" />
                            <div>
                                <p className="font-black text-sm">클라우드 데이터가 복구되었습니다 ✅</p>
                                <p className="text-stone-400 text-xs">프리미엄 자동 복구 완료</p>
                            </div>
                        </div>
                    </div>
                )}
                {children}
            </>
        );
    }

    return null;
}
