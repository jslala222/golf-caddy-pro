'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export default function ClearCachePage() {
  const [status, setStatus] = useState('준비 중...');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const clearEverything = async () => {
      try {
        // 1. Service Worker 삭제
        setStatus('Service Worker 삭제 중...');
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            await registration.unregister();
          }
        }

        // 2. Cache Storage 삭제
        setStatus('Cache Storage 삭제 중...');
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          for (const cacheName of cacheNames) {
            await caches.delete(cacheName);
          }
        }

        // 3. Local Storage 삭제
        setStatus('Local Storage 삭제 중...');
        localStorage.clear();

        // 4. Session Storage 삭제
        setStatus('Session Storage 삭제 중...');
        sessionStorage.clear();

        // 5. IndexedDB 삭제
        setStatus('IndexedDB 삭제 중...');
        const dbs = await (window.indexedDB as any).databases?.();
        if (dbs) {
          for (const db of dbs) {
            window.indexedDB.deleteDatabase(db.name);
          }
        }

        setStatus('✅ 모든 캐시가 삭제되었습니다!');
        setIsComplete(true);

        // 3초 후 홈으로 이동
        setTimeout(() => {
          window.location.href = '/home/';
        }, 3000);
      } catch (error) {
        setStatus(`❌ 오류: ${error}`);
      }
    };

    clearEverything();
  }, []);

  return (
    <div className="flex justify-center min-h-screen bg-stone-100">
      <div className="w-full max-w-[480px] bg-white flex flex-col items-center justify-center space-y-6 p-6">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
          <X size={32} className="text-blue-600" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-stone-800">캐시 정리</h1>
          <p className="text-sm text-stone-500">{status}</p>
        </div>
        {isComplete && (
          <div className="w-full text-center">
            <p className="text-xs text-stone-400">3초 후 홈으로 이동합니다...</p>
          </div>
        )}
      </div>
    </div>
  );
}
