const CACHE_PREFIX = 'inteligentny-kalendarz-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v1.1.2`;

const MANDATORY_SHELL_ASSET_PATHS = [
  'manifest.webmanifest',
  'favicon.svg',
  'icon-192-v111.png',
  'icon-512-v111.png',
  'apple-touch-icon-v111.png',
];

const PRIVATE_FILE_EXTENSIONS = ['.pdf', '.xlsx', '.xls', '.json'];

const MANDATORY_OCR_ASSET_PATHS = [
  'ocr/tesseract/tesseract.min.js',
  'ocr/tesseract/worker.min.js',
  'ocr/tesseract/core/tesseract-core-lstm.wasm.js',
  'ocr/tesseract/core/tesseract-core-simd-lstm.wasm.js',
  'ocr/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'ocr/tesseract/lang/pol.traineddata.gz',
];

function sameOriginUrl(value, base, origin) {
  try {
    const url = new URL(value, base);
    return url.origin === origin ? url.href : undefined;
  } catch {
    return undefined;
  }
}

async function fetchMandatoryAsset(url) {
  const response = await fetch(url, { cache: 'reload' });
  if (!response.ok) throw new Error(`Brak obowiązkowego zasobu offline: ${url}`);
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html')) {
    throw new Error(`Nieprawidłowy zasób offline (HTML zamiast pliku): ${url}`);
  }
  return response;
}

function discoverHtmlShellAssets(html, scope) {
  const origin = new URL(scope).origin;
  const scripts = new Set();
  const styles = new Set();

  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/giu)) {
    const url = sameOriginUrl(match[1], scope, origin);
    if (url) scripts.add(url);
  }
  for (const match of html.matchAll(/<link\b[^>]*>/giu)) {
    const tag = match[0];
    if (!/\brel=["'][^"']*stylesheet[^"']*["']/iu.test(tag)) continue;
    const href = /\bhref=["']([^"']+)["']/iu.exec(tag)?.[1];
    if (!href) continue;
    const url = sameOriginUrl(href, scope, origin);
    if (url) styles.add(url);
  }
  return { scripts: [...scripts], styles: [...styles] };
}

function discoverBundledAssetUrls(text, sourceUrl, scope) {
  const origin = new URL(scope).origin;
  const urls = new Set();
  const patterns = [
    /["']([^"'?#\s]*assets\/[^"'?#\s]+)["']/g,
    /["']([^"'?#\s]*pdf\.worker\.min-[^"'?#\s]+\.mjs)["']/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = match[1];
      const base = raw.includes('assets/') && raw.startsWith('/') ? scope : sourceUrl;
      const url = sameOriginUrl(raw, base, origin);
      if (url) urls.add(url);
    }
  }
  return [...urls];
}

function isPdfWorkerUrl(url) {
  return /(?:^|\/)pdf\.worker\.min-[^/]+\.mjs$/iu.test(new URL(url).pathname);
}

async function cacheApplicationShell() {
  await caches.delete(CACHE_NAME);
  const cache = await caches.open(CACHE_NAME);
  const scope = self.registration.scope;

  try {
    const shellResponse = await fetch(scope, { cache: 'reload' });
    if (!shellResponse.ok) throw new Error('Nie udało się pobrać powłoki aplikacji.');
    await cache.put(scope, shellResponse.clone());
    const html = await shellResponse.text();
    const shellAssets = discoverHtmlShellAssets(html, scope);
    if (!shellAssets.scripts.length) throw new Error('Build nie zawiera obowiązkowego głównego pliku JavaScript.');
    if (!shellAssets.styles.length) throw new Error('Build nie zawiera obowiązkowego głównego pliku CSS.');

    const mandatoryUrls = new Set([
      ...MANDATORY_SHELL_ASSET_PATHS.map((path) => new URL(path, scope).href),
      ...shellAssets.scripts,
      ...shellAssets.styles,
      ...MANDATORY_OCR_ASSET_PATHS.map((path) => new URL(path, scope).href),
    ]);
    const javascriptBodies = [];

    for (const url of mandatoryUrls) {
      const response = await fetchMandatoryAsset(url);
      await cache.put(url, response.clone());
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('javascript') || /\.(?:m?js)$/iu.test(new URL(url).pathname)) {
        javascriptBodies.push({ url, text: await response.text() });
      }
    }

    const nestedAssets = new Set();
    for (const source of javascriptBodies) {
      discoverBundledAssetUrls(source.text, source.url, scope).forEach((url) => nestedAssets.add(url));
    }
    const pdfWorkers = [...nestedAssets].filter(isPdfWorkerUrl);
    if (!pdfWorkers.length) throw new Error('Build nie zawiera obowiązkowego workera PDF do pracy offline.');

    for (const url of nestedAssets) {
      const response = await fetchMandatoryAsset(url);
      await cache.put(url, response);
    }
  } catch (error) {
    await caches.delete(CACHE_NAME);
    throw error;
  }
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
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

function isPrivateUserFile(url) {
  return PRIVATE_FILE_EXTENSIONS.some((extension) => url.pathname.toLowerCase().endsWith(extension));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isPrivateUserFile(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(self.registration.scope, response.clone());
        return response;
      } catch {
        return (await cache.match(self.registration.scope)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});
