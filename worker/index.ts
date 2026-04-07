/**
 * Custom Service Worker — Push 알람 수신 처리
 * next-pwa v5가 이 파일을 자동으로 sw.js에 번들링(합침)
 */

// push 이벤트 수신 → 알림 표시
self.addEventListener('push', (event: PushEvent) => {
  let data: { title?: string; body?: string; icon?: string; badge?: string } = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() ?? '새 알림이 있습니다.' };
  }

  const title = data.title ?? '📅 약속 알림';
  const options: NotificationOptions = {
    body: data.body ?? '약속 시간이 다가왔습니다!',
    icon: data.icon ?? '/icon-192.png',
    badge: data.badge ?? '/icon-192.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };

  event.waitUntil(
    (self as unknown as ServiceWorkerGlobalScope).registration.showNotification(title, options),
  );
});

// notificationclick 이벤트 → 클릭 시 앱 열기
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  event.waitUntil(
    (self as unknown as ServiceWorkerGlobalScope).clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url && 'focus' in client) {
            return (client as WindowClient).focus();
          }
        }
        if ((self as unknown as ServiceWorkerGlobalScope).clients.openWindow) {
          return (self as unknown as ServiceWorkerGlobalScope).clients.openWindow('/');
        }
      }),
  );
});
