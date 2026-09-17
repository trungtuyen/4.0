const CACHE_PREFIX = 'smartclass-platform-';
const LEGACY_CACHE_PREFIX = 'smartclass-plicker-';
const CACHE_NAME = `${CACHE_PREFIX}v22`;
const APP_ROOT = new URL('./', self.registration.scope).pathname;
const OFFLINE_PAGE = `${APP_ROOT}offline.html`;
const PUBLIC_METRICS = `${APP_ROOT}platform-stats.json`;
const APP_SHELL = [
  APP_ROOT,
  `${APP_ROOT}?source=installed`,
  `${APP_ROOT}?app=plicker&role=scanner&source=installed`,
  `${APP_ROOT}smartclass.webmanifest`,
  `${APP_ROOT}plicker.webmanifest`,
  `${APP_ROOT}icons/plicker-192.png`,
  `${APP_ROOT}icons/plicker-512.png`,
  `${APP_ROOT}icons/plicker-maskable-512.png`,
  `${APP_ROOT}gestureclass/?v=projector-readable-v1`,
  `${APP_ROOT}gestureclass/styles.css?v=projector-readable-v1`,
  `${APP_ROOT}gestureclass/app.js?v=projector-readable-v1`,
  PUBLIC_METRICS,
  OFFLINE_PAGE,
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => (key.startsWith(CACHE_PREFIX) || key.startsWith(LEGACY_CACHE_PREFIX)) && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});
