const CACHE_PREFIX = 'smartclass-plicker-';
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const APP_ROOT = new URL('./', self.registration.scope).pathname;
const OFFLINE_PAGE = `${APP_ROOT}offline.html`;
const APP_SHELL = [
  APP_ROOT,
  `${APP_ROOT}?app=plicker&role=scanner&source=installed`,
  `${APP_ROOT}plicker.webmanifest`,
  `${APP_ROOT}icons/plicker-192.png`,
  `${APP_ROOT}icons/plicker-512.png`,
  `${APP_ROOT}icons/plicker-maskable-512.png`,
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
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ||
      (await cache.match(APP_ROOT)) ||
      (await cache.match(OFFLINE_PAGE)) ||
      new Response('Không có kết nối Internet.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
  }
}

async function handleStaticAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const saved = await cache.match(request);
  if (saved) return saved;

  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_ROOT)) return;
  if (url.pathname.includes('/api/') || url.pathname.includes('/__/auth/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (['style', 'script', 'worker', 'font', 'image'].includes(request.destination) ||
      url.pathname.endsWith('.webmanifest')) {
    event.respondWith(handleStaticAsset(request));
  }
});
