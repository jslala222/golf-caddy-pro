
import React from 'react';
import { clsx } from 'clsx';

interface MobileFrameProps {
    children: React.ReactNode;
    className?: string;
}

export function MobileFrame({ children, className }: MobileFrameProps) {
    return (
        <div className="min-h-screen w-full bg-stone-100 flex justify-center">
            <div
                className={clsx(
                    "w-full max-w-[480px] min-h-screen bg-stone-50 shadow-2xl relative flex flex-col",
                    className
                )}
            >
                {children}
            </div>
        </div>
    );
}
