/* sw.js — Service Worker：离线缓存 + 更新策略 */

var CACHE_NAME = 'study-watcher-v1';
var CACHE_FILES = [
  './',
  './index.html',
  './css/style.css',
  './js/storage.js',
  './js/courses.js',
  './js/evaluation.js',
  './js/tasks.js',
  './js/review.js',
  './js/reminders.js',
  './js/sleep.js',
  './js/ocr.js',
  './js/app.js',
  './manifest.json'
];

/* 安装：预缓存关键文件 */
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        CACHE_FILES.map(function (url) {
          return cache.add(url).catch(function () {
            /* 单个文件失败不阻塞整体安装 */
          });
        })
      );
    })
  );
  self.skipWaiting();
});

/* 激活：清理旧缓存 */
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

/* 请求：缓存优先，同时更新缓存 */
self.addEventListener('fetch', function (e) {
  /* 只处理 GET 请求 */
  if (e.request.method !== 'GET') return;
  /* 跳过 CDN 资源（Tesseract.js 等） */
  if (e.request.url.indexOf('cdn.jsdelivr.net') !== -1) return;
  /* 跳过 chrome-extension 等非 http(s) 请求 */
  if (!e.request.url.startsWith('http')) return;

  e.respondWith(
    caches.match(e.request).then(function (cached) {
      /* 后台更新缓存 */
      var fetched = fetch(e.request).then(function (response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function () {
        return cached || new Response('离线状态下不可用', { status: 503 });
      });
      return cached || fetched;
    })
  );
});
