const CACHE_NAME = 'inteligentny-kalendarz-shell-v1.0.1';

async function cacheApplicationShell() {
  const cache = await caches.open(CACHE_NAME);
  const scope = self.registration.scope;
  const shellResponse = await fetch(scope, { cache: 'reload' });
  if (!shellResponse.ok) throw new Error('Nie udało się pobrać powłoki aplikacji.');
  await cache.put(scope, shellResponse.clone());
  const html = await shellResponse.text();
  const discovered = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((value) => value && !value.startsWith('data:') && !value.startsWith('http'))
    .map((value) => new URL(value, scope).href);
  const essential = [
    new URL('manifest.webmanifest', scope).href,
    new URL('favicon.svg', scope).href,
    new URL('icon-192.png', scope).href,
    new URL('icon-512.png', scope).href,
    new URL('apple-touch-icon.png', scope).href,
    ...discovered,
  ];
  await Promise.all([...new Set(essential)].map(async (url) => {
    try {
      const response = await fetch(url, { cache: 'reload' });
      if (response.ok) await cache.put(url, response);
    } catch {
      // Pojedynczy opcjonalny zasób nie blokuje instalacji Service Workera.
    }
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await cacheApplicationShell();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Prywatne pliki użytkownika nigdy nie trafiają do Cache Storage.
  const privateFileExtensions = ['.pdf', '.xlsx', '.xls', '.json'];
  if (privateFileExtensions.some((extension) => url.pathname.toLowerCase().endsWith(extension))) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(self.registration.scope, response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match(self.registration.scope);
        return cached || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
