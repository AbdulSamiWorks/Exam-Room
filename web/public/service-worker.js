const SHELL_CACHE = 'exam-room-shell-v1';
const ASSET_CACHE = 'exam-room-assets-v1';
const KNOWN_CACHES = [SHELL_CACHE, ASSET_CACHE];
const APP_PAGE = '/';
const SHELL_FILES = [
  APP_PAGE,
  '/theme.js',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
];
const MAX_CACHED_ASSETS = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => !KNOWN_CACHES.includes(cacheName))
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(pageFromNetworkOrCache(request));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(assetFromCacheOrNetwork(request));
  } else if (SHELL_FILES.includes(url.pathname)) {
    event.respondWith(shellFileWithRefresh(request));
  }
});

async function pageFromNetworkOrCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(APP_PAGE, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(APP_PAGE)) ?? Response.error();
  }
}

async function assetFromCacheOrNetwork(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(ASSET_CACHE);
    await cache.put(request, response.clone());
    await removeOldestAssets(cache);
  }
  return response;
}

async function removeOldestAssets(cache) {
  const cachedRequests = await cache.keys();
  const extraCount = cachedRequests.length - MAX_CACHED_ASSETS;
  if (extraCount <= 0) return;
  await Promise.all(
    cachedRequests.slice(0, extraCount).map((cachedRequest) => cache.delete(cachedRequest)),
  );
}

async function shellFileWithRefresh(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cachedResponse = await cache.match(request);
  const freshResponse = fetch(request)
    .then(async (response) => {
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => cachedResponse ?? Response.error());
  return cachedResponse ?? freshResponse;
}
