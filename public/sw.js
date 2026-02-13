
// PWA 서비스 워커 - 앱 설치 버튼(홈 화면 추가)을 활성화하기 위한 최소 설정
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // 캐시 전략 없이 통과 (데이터가 계속 바뀌는 앱이므로 현재는 기본 동작 유지)
    event.respondWith(fetch(event.request));
});
