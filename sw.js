const CACHE_NAME = 'nz-roadtrip-v33';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=33',
  './data.js?v=33',
  './app.js?v=33',
  './manifest.json',
  './icon.png?v=33',
  // 快取 Leaflet 的 CDN 資源，這樣離線時地圖 JS/CSS 也能載入
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// 安裝 Service Worker 並快取資源
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 啟用並清理舊快取
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 攔截請求，優先使用快取 (Cache First)，若無快取則發送網路請求並動態快取（例如地圖圖磚）
self.addEventListener('fetch', (e) => {
  // 只攔截 GET 請求
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // 為了讓使用者在有網路時能獲取最新內容，我們在背景更新快取 (Stale-While-Revalidate)
        fetch(e.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
          }
        }).catch(() => {/* 忽略離線時的 fetch 失敗 */});
        
        return cachedResponse;
      }

      // 若快取無此資源，則去網路下載並快取它（這會自動把瀏覽過的地圖圖磚存下來）
      return fetch(e.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || 
            networkResponse.type !== 'basic' && 
            !e.request.url.includes('tile') && 
            !e.request.url.includes('openstreetmap') && 
            !e.request.url.includes('arcgisonline') &&
            !e.request.url.includes('google')) {
          return networkResponse;
        }
        
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseToCache);
        });
        
        return networkResponse;
      }).catch(() => {
        // 如果地圖圖磚讀取失敗且無快取，回傳一個友好的離線提示或空回應
        if (e.request.url.includes('tile') || e.request.url.includes('google')) {
          return new Response('', { status: 404, statusText: 'Offline' });
        }
      });
    })
  );
});

// 監聽來自前台的更新控制訊息
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

