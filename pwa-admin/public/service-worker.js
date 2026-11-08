const CACHE_PREFIX = 'smart-museum-admin-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const SCOPE_URL = self.registration.scope;
const APP_SHELL_PATHS = [
  'manifest.webmanifest',
  'offline.html',
  'icons/museum-mark.svg',
  'icons/museum-mark-192.png',
  'icons/museum-mark-512.png',
].map((path) => new URL(path, SCOPE_URL));

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  const indexUrl = new URL('index.html', SCOPE_URL);
  const response = await fetch(indexUrl);
  if (!response.ok) throw new Error(`Could not cache admin shell (${response.status}).`);

  await cache.put(indexUrl, response.clone());
  const html = await response.text();
  const assets = Array.from(
    html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g),
    (match) => new URL(match[1], indexUrl),
  );
  await cache.addAll([...APP_SHELL_PATHS, ...assets]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((names) => Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);
  const scopePath = new URL(SCOPE_URL).pathname;
  if (
    request.method !== 'GET'
    || requestUrl.origin !== self.location.origin
    || !requestUrl.pathname.startsWith(scopePath)
  ) return;

  if (request.mode === 'navigate') {
    if (requestUrl.pathname !== scopePath) return;
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(new URL('index.html', SCOPE_URL))
        ?? await cache.match(new URL('offline.html', SCOPE_URL));
    }));
    return;
  }

  if (['script', 'style', 'image'].includes(request.destination)) {
    event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request, { ignoreVary: true });
      if (cached) return cached;
      return fetch(request);
    }));
  }
});
