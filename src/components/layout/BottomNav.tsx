
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Users, Wallet, Settings, Home, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

export function BottomNav() {
    const pathname = usePathname();

    // 로그인 전/별도 UI 페이지에서는 하단 네비게이션 숨김
    const hideNav = ['/dealer', '/landing', '/admin', '/subscribe', '/dealer-login'];
    if (pathname === '/') return null;
    if (hideNav.some(p => pathname?.startsWith(p))) return null;

    const navItems = [
        { href: '/home', label: '홈', icon: Home, exact: true },
        { href: '/schedule', label: '근무', icon: Calendar },
        { href: '/change', label: '대기바꿈', icon: RefreshCw },
        { href: '/clients', label: '인원관리', icon: Users },
        { href: '/money', label: '가계부', icon: Wallet },
        { href: '/settings', label: '설정', icon: Settings },
    ];

    return (
        <nav className="fixed bottom-0 w-full max-w-[480px] bg-white border-t border-stone-200 z-50">
            <div className="grid grid-cols-6 h-16">
                {navItems.map((item) => {
                    const isActive = item.exact
                        ? pathname === item.href
                        : pathname.startsWith(item.href);
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={clsx(
                                "flex flex-col items-center justify-center space-y-1 transition-colors",
                                isActive
                                    ? "text-emerald-600 border-t-2 border-emerald-600"
                                    : "text-stone-400 hover:text-stone-600 hover:bg-stone-50 border-t-2 border-transparent"
                            )}
                        >
                            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
