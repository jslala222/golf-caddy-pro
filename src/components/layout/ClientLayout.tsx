
'use client';

import { usePathname } from 'next/navigation';
import { LicenseGuard } from '@/components/layout/LicenseGuard';
import { PortGuard } from '@/components/PortGuard';

export function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAdminPage = pathname?.startsWith('/admin');

    return (
        <PortGuard>
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
