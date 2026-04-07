'use client';
import { useState, useEffect } from 'react';

type LogItem = { step: string; status: 'ok' | 'fail' | 'info' | 'wait'; detail?: string };

export default function PushDebugPage() {
    const [logs, setLogs] = useState<LogItem[]>([]);
    const [running, setRunning] = useState(false);
    const [vapidKey, setVapidKey] = useState('');

    const addLog = (step: string, status: LogItem['status'], detail?: string) => {
        setLogs(prev => [...prev, { step, status, detail }]);
    };

    useEffect(() => {
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
        setVapidKey(key);
    }, []);

    const runDiag = async () => {
        setLogs([]);
        setRunning(true);

        // 1. HTTPS 여부
        addLog('1. HTTPS 환경', location.protocol === 'https:' ? 'ok' : 'fail',
            location.protocol === 'https:' ? location.origin : '❌ HTTP에서는 Push 불가');

        // 2. iOS 버전 감지
        const ua = navigator.userAgent;
        const iosMatch = ua.match(/OS (\d+)_(\d+)/);
        const iosMajor = iosMatch ? parseInt(iosMatch[1]) : null;
        if (iosMajor !== null) {
            if (iosMajor >= 16) {
                addLog('2. iOS 버전', 'ok', `iOS ${iosMajor} — Push 지원 가능`);
            } else {
                addLog('2. iOS 버전', 'fail', `iOS ${iosMajor} — iOS 16.4 이상 필요`);
            }
        } else {
            addLog('2. iOS 버전', 'info', 'iOS가 아닌 기기 (Android 또는 PC)');
        }

        // 3. PWA 모드 (standalone)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            || ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true);
        addLog('3. 홈화면 앱 모드', isStandalone ? 'ok' : 'fail',
            isStandalone ? '✅ 홈화면 아이콘으로 열린 상태' : '❌ 브라우저에서 열린 상태 — 홈화면 추가 필요');

        // 4. Notification API
        if (!('Notification' in window)) {
            addLog('4. Notification API', 'fail', '이 브라우저는 Notification 자체를 지원 안 함');
            setRunning(false); return;
        }
        addLog('4. Notification API', 'ok', `현재 권한: ${Notification.permission}`);

        // 5. ServiceWorker API
        if (!('serviceWorker' in navigator)) {
            addLog('5. ServiceWorker API', 'fail', 'ServiceWorker 미지원 브라우저');
            setRunning(false); return;
        }
        addLog('5. ServiceWorker API', 'ok', '지원됨');

        // 6. ServiceWorker 등록 상태
        try {
            const reg = await navigator.serviceWorker.getRegistration('/');
            if (reg) {
                addLog('6. SW 등록', 'ok', `scope: ${reg.scope}, state: ${reg.active?.state ?? '없음'}`);
            } else {
                addLog('6. SW 등록', 'fail', '등록된 SW 없음 — 홈화면 추가 후 다시 시도');
                setRunning(false); return;
            }
        } catch (e) {
            addLog('6. SW 등록', 'fail', String(e));
            setRunning(false); return;
        }

        // 7. pushManager 지원
        try {
            const reg = await navigator.serviceWorker.getRegistration('/');
            if (!reg?.pushManager) {
                addLog('7. pushManager', 'fail', 'pushManager 없음 — iOS 16.4+ 홈화면 앱에서만 지원');
                setRunning(false); return;
            }
            addLog('7. pushManager', 'ok', '지원됨');

            // 8. 기존 구독 확인
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
                addLog('8. 기존 구독', 'ok', `endpoint: ...${sub.endpoint.slice(-30)}`);
            } else {
                addLog('8. 기존 구독', 'info', '구독 없음 (새로 등록 필요)');
            }
        } catch (e) {
            addLog('7. pushManager', 'fail', String(e));
        }

        // 9. VAPID 키 확인
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
        if (!key) {
            addLog('9. VAPID 키', 'fail', '환경변수 NEXT_PUBLIC_VAPID_PUBLIC_KEY 없음');
        } else {
            addLog('9. VAPID 키', 'ok', `앞 20자: ${key.slice(0, 20)}...`);
        }

        setRunning(false);
    };

    const colorMap = { ok: 'text-emerald-600 bg-emerald-50', fail: 'text-red-600 bg-red-50', info: 'text-blue-600 bg-blue-50', wait: 'text-stone-400 bg-stone-50' };
    const iconMap = { ok: '✅', fail: '❌', info: 'ℹ️', wait: '⏳' };

    return (
        <div className="min-h-screen bg-stone-50 p-4">
            <div className="max-w-sm mx-auto space-y-4">
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <h1 className="font-bold text-stone-800 text-lg mb-1">알림 진단</h1>
                    <p className="text-xs text-stone-400">어느 단계에서 막혔는지 확인합니다</p>
                    {vapidKey ? (
                        <p className="text-xs text-emerald-600 mt-1">VAPID 키 로드됨 ✅</p>
                    ) : (
                        <p className="text-xs text-red-500 mt-1">VAPID 키 없음 ❌</p>
                    )}
                </div>

                <button
                    onClick={runDiag}
                    disabled={running}
                    className="w-full py-3 bg-orange-500 text-white font-bold rounded-2xl text-sm disabled:opacity-50"
                >
                    {running ? '진단 중...' : '🔍 진단 시작'}
                </button>

                {logs.length > 0 && (
                    <div className="space-y-2">
                        {logs.map((log, i) => (
                            <div key={i} className={`rounded-xl px-4 py-3 ${colorMap[log.status]}`}>
                                <p className="font-bold text-sm">{iconMap[log.status]} {log.step}</p>
                                {log.detail && <p className="text-xs mt-1 break-all">{log.detail}</p>}
                            </div>
                        ))}
                    </div>
                )}

                {logs.length > 0 && !running && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm">
                        <p className="text-xs text-stone-500">
                            이 화면을 캡처해서 공유해주시면 정확한 원인을 파악할 수 있습니다.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
