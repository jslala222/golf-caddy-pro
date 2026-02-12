'use client';

import { useEffect, useState } from 'react';

export function PortGuard({ children }: { children: React.ReactNode }) {
    const [isSafe, setIsSafe] = useState(true);
    const [currentPort, setCurrentPort] = useState('');

    useEffect(() => {
        // Run only on client
        if (typeof window !== 'undefined') {
            const port = window.location.port;
            setCurrentPort(port);

            // Allow 3000 or empty (production usually has no port or 80/443, but for this local app we enforce 3000)
            // We strictly enforce 3000 for local development as requested.
            if (port && port !== '3000') {
                setIsSafe(false);
            }
        }
    }, []);

    if (!isSafe) {
        return (
            <div className="fixed inset-0 z-50 bg-red-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full border-2 border-red-500">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
                        🚫
                    </div>
                    <h1 className="text-2xl font-black text-red-600 mb-2">잘못된 접속입니다!</h1>
                    <p className="text-stone-600 font-medium mb-6">
                        현재 <strong>{currentPort}번 포트</strong>로 접속하셨습니다.<br />
                        데이터 안전을 위해<br />
                        오직 <strong>3000번</strong>만 허용됩니다.
                    </p>
                    <a
                        href="http://localhost:3000"
                        className="block w-full py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-200"
                    >
                        안전한 3000번으로 이동하기 👉
                    </a>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
