const CACHE_NAME = 'smart-museum-shell-v3';
const SCOPE_URL = self.registration.scope;
const APP_SHELL_URLS = ['offline.html', 'manifest.webmanifest', 'icons/museum-mark.svg',
  'icons/museum-mark-192.png', 'icons/museum-mark-512.png'].map(
  (path) => new URL(path, SCOPE_URL).href,
);

function isCacheableAppResponse(request, response) {
  const url = new URL(request.url);
  const scopePath = new URL(SCOPE_URL).pathname;
  const hasPrivateCacheDirective = /(?:private|no-store)/i.test(
    response.headers.get('Cache-Control') ?? '',
  );
  return (
    response.ok &&
    url.origin === self.location.origin &&
    url.pathname.startsWith(scopePath) &&
    !url.pathname.includes('/api/') &&
    !request.headers.has('Authorization') &&
    !hasPrivateCacheDirective
  );
}

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const indexUrl = new URL('index.html', SCOPE_URL);
  const indexResponse = await fetch(indexUrl);
  if (!indexResponse.ok) {
    throw new Error(`Could not precache the application shell (${indexResponse.status}).`);
  }
  await cache.put(indexUrl, indexResponse.clone());

  const html = await indexResponse.text();
  const assetPaths = Array.from(
    html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g),
    (match) => new URL(match[1], indexUrl).href,
  );
  await cache.addAll([...new Set([...APP_SHELL_URLS, ...assetPaths])]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    precacheAppShell(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName.startsWith('smart-museum-shell-') &&
                cacheName !== CACHE_NAME,
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);
  const scopePath = new URL(SCOPE_URL).pathname;

  if (
    request.method !== 'GET' ||
    requestUrl.origin !== self.location.origin ||
    !requestUrl.pathname.startsWith(scopePath) ||
    requestUrl.pathname.includes('/api/') ||
    request.headers.has('Authorization')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheableAppResponse(request, response)) {
            const responseCopy = response.clone();
            event.waitUntil(
              caches
                .open(CACHE_NAME)
                .then((cache) =>
                  cache.put(new URL('index.html', SCOPE_URL), responseCopy),
                ),
            );
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (
            (await cache.match(new URL('index.html', SCOPE_URL))) ??
            (await cache.match(new URL('offline.html', SCOPE_URL)))
          );
        }),
    );
    return;
  }

  if (['script', 'style'].includes(request.destination)) {
    event.respondWith(
      caches
        .open(CACHE_NAME)
        .then((cache) => cache.match(request, { ignoreVary: true }))
        .then(
          (cachedResponse) =>
            cachedResponse ??
            fetch(request).then((response) => {
              if (isCacheableAppResponse(request, response)) {
                const responseCopy = response.clone();
                event.waitUntil(
                  caches
                    .open(CACHE_NAME)
                    .then((cache) => cache.put(request, responseCopy)),
                );
              }
              return response;
            }),
        ),
    );
  }
});
