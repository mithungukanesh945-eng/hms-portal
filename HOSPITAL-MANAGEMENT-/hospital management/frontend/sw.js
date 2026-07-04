const CACHE_NAME = 'hms-v2-cache';
const ASSETS = [
  'index.html',
  'css/luxury.css',
  'js/app.js',
  'js/api.js',
  'assets/admin_banner.png',
  'assets/doctor_banner.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
