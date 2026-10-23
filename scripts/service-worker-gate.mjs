import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const SOURCE = await fs.readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8');
const SCOPE = 'https://calendar.test/app/';
const versionSource = await fs.readFile(new URL('../src/core/version.ts', import.meta.url), 'utf8');
const appVersion = /APP_VERSION\s*=\s*'([^']+)'/u.exec(versionSource)?.[1];
assert.ok(appVersion, 'APP_VERSION missing');
const CURRENT_CACHE = `inteligentny-kalendarz-shell-v${appVersion}`;

function requestKey(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

class CacheMock {
  constructor() {
    this.items = new Map();
  }
  async put(input, response) {
    this.items.set(requestKey(input), response.clone());
  }
  async match(input) {
    const response = this.items.get(requestKey(input));
    return response ? response.clone() : undefined;
  }
}

class CacheStorageMock {
  constructor() {
    this.stores = new Map();
    this.deleted = [];
  }
  async open(name) {
    if (!this.stores.has(name)) this.stores.set(name, new CacheMock());
    return this.stores.get(name);
  }
  async delete(name) {
    this.deleted.push(name);
    return this.stores.delete(name);
  }
  async keys() {
    return [...this.stores.keys()];
  }
}

function response(body, contentType, status = 200) {
  return new Response(body, { status, headers: { 'content-type': contentType } });
}

function baseResponses() {
  const html = `<!doctype html><html><head><link rel="stylesheet" href="/app/assets/index-abc.css"></head><body><script type="module" src="/app/assets/index-abc.js"></script></body></html>`;
  const js = `const finance = () => import("./finance-1.js"); console.log(finance);`;
  const financeJs = `const work = () => import("./work-2.js"); const unresolvedRuntimeAsset = "assets/\${t}"; console.log(work, unresolvedRuntimeAsset);`;
  const workJs = `const pdf = () => import("./pdfjs-3.js"); console.log(pdf);`;
  const pdfJs = `const pdfWorker = "./pdf.worker.min-xyz.mjs"; console.log(pdfWorker);`;
  const map = new Map([
    [SCOPE, response(html, 'text/html')],
    ['https://calendar.test/app/assets/index-abc.js', response(js, 'text/javascript')],
    ['https://calendar.test/app/assets/finance-1.js', response(financeJs, 'text/javascript')],
    ['https://calendar.test/app/assets/work-2.js', response(workJs, 'text/javascript')],
    ['https://calendar.test/app/assets/pdfjs-3.js', response(pdfJs, 'text/javascript')],
    ['https://calendar.test/app/assets/index-abc.css', response('body{}', 'text/css')],
    ['https://calendar.test/app/assets/pdf.worker.min-xyz.mjs', response('export {};', 'text/javascript')],
    ['https://calendar.test/app/manifest.webmanifest', response('{"name":"IK"}', 'application/manifest+json')],
    ['https://calendar.test/app/favicon.svg', response('<svg/>', 'image/svg+xml')],
    ['https://calendar.test/app/icon-192-v1203.png', response('PNG192', 'image/png')],
    ['https://calendar.test/app/icon-512-v1203.png', response('PNG512', 'image/png')],
    ['https://calendar.test/app/apple-touch-icon-v1203.png', response('PNG180', 'image/png')],
  ]);
  for (const path of [
    'ocr/tesseract/tesseract.min.js',
    'ocr/tesseract/worker.min.js',
    'ocr/tesseract/core/tesseract-core-lstm.wasm.js',
    'ocr/tesseract/core/tesseract-core-simd-lstm.wasm.js',
    'ocr/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js',
    'ocr/tesseract/lang/pol.traineddata.gz',
  ]) {
    map.set(new URL(path, SCOPE).href, response(path, path.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'));
  }
  return map;
}

function createHarness(overrides = new Map(), { networkDelayMs = 0 } = {}) {
  const listeners = new Map();
  const caches = new CacheStorageMock();
  const responses = baseResponses();
  for (const [key, value] of overrides) responses.set(key, value);
  let skipWaitingCalls = 0;
  let claimCalls = 0;
  let networkFallback = undefined;
  let activeFetches = 0;
  let maxConcurrentFetches = 0;

  const self = {
    registration: { scope: SCOPE },
    location: { origin: new URL(SCOPE).origin },
    clients: { claim: async () => { claimCalls += 1; } },
    skipWaiting: async () => { skipWaitingCalls += 1; },
    addEventListener(type, handler) { listeners.set(type, handler); },
  };

  const fetchMock = async (input) => {
    activeFetches += 1;
    maxConcurrentFetches = Math.max(maxConcurrentFetches, activeFetches);
    try {
      if (networkDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, networkDelayMs));
      const key = requestKey(input);
      if (responses.has(key)) return responses.get(key).clone();
      if (networkFallback) return networkFallback(input);
      throw new Error(`NETWORK_MISS:${key}`);
    } finally {
      activeFetches -= 1;
    }
  };

  const context = vm.createContext({
    self,
    caches,
    fetch: fetchMock,
    URL,
    Response,
    Request,
    console,
    Set,
    Map,
    Promise,
    Error,
    setTimeout,
  });
  vm.runInContext(SOURCE, context, { filename: 'service-worker.js' });

  async function triggerLifecycle(type) {
    let task;
    listeners.get(type)({ waitUntil(promise) { task = promise; } });
    assert.ok(task, `${type} must call waitUntil`);
    await task;
  }

  async function triggerFetch(request) {
    let task;
    listeners.get('fetch')({ request, respondWith(promise) { task = promise; } });
    return task ? await task : undefined;
  }

  return {
    caches,
    responses,
    registration: self.registration,
    triggerLifecycle,
    triggerFetch,
    setNetworkFallback(fn) { networkFallback = fn; },
    counters() { return { skipWaitingCalls, claimCalls }; },
    fetchConcurrency() { return { activeFetches, maxConcurrentFetches }; },
  };
}

// Successful install must create a complete current-version cache.
{
  const h = createHarness();
  await h.triggerLifecycle('install');
  assert.equal(h.counters().skipWaitingCalls, 0, 'successful upgrade must not force activation over open old-version tabs');
  const cache = await h.caches.open(CURRENT_CACHE);
  for (const required of [
    SCOPE,
    'https://calendar.test/app/assets/index-abc.js',
    'https://calendar.test/app/assets/index-abc.css',
    'https://calendar.test/app/assets/finance-1.js',
    'https://calendar.test/app/assets/work-2.js',
    'https://calendar.test/app/assets/pdfjs-3.js',
    'https://calendar.test/app/assets/pdf.worker.min-xyz.mjs',
    'https://calendar.test/app/manifest.webmanifest',
    'https://calendar.test/app/favicon.svg',
    'https://calendar.test/app/icon-192-v1203.png',
    'https://calendar.test/app/icon-512-v1203.png',
    'https://calendar.test/app/apple-touch-icon-v1203.png',
    'https://calendar.test/app/ocr/tesseract/tesseract.min.js',
    'https://calendar.test/app/ocr/tesseract/lang/pol.traineddata.gz',
  ]) assert.ok(await cache.match(required), `missing required cache entry: ${required}`);
  assert.equal(
    await cache.match('https://calendar.test/app/assets/$%7Bt%7D'),
    undefined,
    'unresolved runtime asset template was incorrectly precached',
  );
}

// The development worker must still leave the origin immediately, so it
// cannot interfere with Vite and accidental old PWA registrations on localhost.
{
  const h = createHarness();
  h.registration.scope = 'http://localhost:5173/';
  await h.triggerLifecycle('install');
  assert.equal(h.counters().skipWaitingCalls, 1,
    'development cleanup must retain immediate activation');
  assert.equal(h.caches.stores.has(CURRENT_CACHE), false,
    'development must not precache production assets');
}

// Install performs bounded parallel mandatory fetches while preserving offline completeness.
// Synthetic delay is deterministic test-network latency, NOT a mobile performance benchmark.
{
  const h = createHarness(new Map(), { networkDelayMs: 5 });
  await h.triggerLifecycle('install');
  const { activeFetches, maxConcurrentFetches } = h.fetchConcurrency();
  assert.equal(activeFetches, 0, 'install left network requests in flight');
  assert.ok(maxConcurrentFetches >= 2, 'mandatory resources were fetched sequentially');
  assert.ok(maxConcurrentFetches <= 4, 'service worker exceeded bounded concurrency');
}

// A failed batch must finish its other in-flight writes before the cache is removed.
{
  const failingUrl = 'https://calendar.test/app/ocr/tesseract/core/tesseract-core-simd-lstm.wasm.js';
  const h = createHarness(new Map([[failingUrl, response('missing', 'text/plain', 404)]]), { networkDelayMs: 5 });
  await assert.rejects(() => h.triggerLifecycle('install'));
  assert.equal(h.fetchConcurrency().activeFetches, 0, 'failed install abandoned active downloads');
  assert.equal(h.caches.stores.has(CURRENT_CACHE), false, 'failed install retained partial cache');
}

// A failed mandatory fetch must remove the partial current cache and not activate it.
{
  const failingUrl = 'https://calendar.test/app/ocr/tesseract/lang/pol.traineddata.gz';
  const h = createHarness(new Map([[failingUrl, response('missing', 'text/plain', 404)]]));
  await assert.rejects(() => h.triggerLifecycle('install'));
  assert.equal(h.counters().skipWaitingCalls, 0);
  assert.equal(h.caches.stores.has(CURRENT_CACHE), false, 'partial cache survived failed install');
}

// A failed attempted SW upgrade must leave the previously installed offline shell
// intact. The browser will keep controlling clients with the old service worker.
{
  const missingUrl = 'https://calendar.test/app/ocr/tesseract/lang/pol.traineddata.gz';
  const h = createHarness(new Map([[missingUrl, response('missing', 'text/plain', 404)]]));
  const previousCacheName = 'inteligentny-kalendarz-shell-previous-version';
  const oldCache = await h.caches.open(previousCacheName);
  await oldCache.put(SCOPE, response('PREVIOUS COMPLETE SHELL', 'text/html'));
  await assert.rejects(() => h.triggerLifecycle('install'));
  assert.equal((await (await oldCache.match(SCOPE)).text()), 'PREVIOUS COMPLETE SHELL',
    'failed update damaged the previous offline shell');
  assert.equal(h.caches.stores.has(CURRENT_CACHE), false,
    'failed update left a partially installed replacement shell');
  assert.equal(h.counters().skipWaitingCalls, 0,
    'failed update requested activation');
}

// Updating an installed PWA must not take over a still-open older tab.
// That tab can request a previously precached lazy JS chunk after the new
// deployment removes old hashed assets from the server. Standard SW lifecycle
// keeps the old worker controlling old tabs until they are all closed.
{
  const h = createHarness();
  const previousCache = await h.caches.open('inteligentny-kalendarz-shell-v1.2.526');
  const oldLazyChunkUrl = 'https://calendar.test/app/assets/StudyView-old-build.js';
  await previousCache.put(SCOPE, response('OLD SHELL', 'text/html'));
  await previousCache.put(oldLazyChunkUrl, response('OLD LAZY MODULE', 'text/javascript'));
  await h.triggerLifecycle('install');
  assert.equal(h.counters().skipWaitingCalls, 0,
    'new SW cannot skip the waiting phase while previous clients might still need old lazy modules');
  assert.equal(await (await previousCache.match(oldLazyChunkUrl)).text(), 'OLD LAZY MODULE',
    'install must retain old offline resources while the previous worker controls open clients');
}

// Activation may remove only old caches owned by this application.
{
  const h = createHarness();
  await h.triggerLifecycle('install');
  await h.caches.open('inteligentny-kalendarz-shell-old');
  await h.caches.open('other-app-cache');
  await h.triggerLifecycle('activate');
  const keys = await h.caches.keys();
  assert.ok(keys.includes(CURRENT_CACHE));
  assert.ok(!keys.includes('inteligentny-kalendarz-shell-old'));
  assert.ok(keys.includes('other-app-cache'), 'service worker deleted an unrelated cache');
  assert.equal(h.counters().claimCalls, 1);
}

// An old installed SW must not replace its offline HTML with HTML from a newer
// deployment until the newer SW has atomically installed the matching asset set.
// Otherwise a subsequent offline restart can reference uncached JS/CSS.
{
  const h = createHarness();
  await h.triggerLifecycle('install');
  const cache = await h.caches.open(CURRENT_CACHE);
  const oldShellHtml = await (await cache.match(SCOPE)).text();
  const nextHtml = `<!doctype html><link rel="stylesheet" href="/app/assets/index-next.css"><script src="/app/assets/index-next.js"></script>`;
  h.responses.set(SCOPE, response(nextHtml, 'text/html'));

  const live = await h.triggerFetch({ url: SCOPE, method: 'GET', mode: 'navigate' });
  assert.equal(await live.text(), nextHtml, 'online navigation must serve fresh HTML');
  assert.equal(await (await cache.match(SCOPE)).text(), oldShellHtml,
    'online navigation must not overwrite the atomic offline shell before SW update');

  h.responses.delete(SCOPE);
  h.setNetworkFallback(async () => { throw new Error('offline'); });
  const offline = await h.triggerFetch({ url: SCOPE, method: 'GET', mode: 'navigate' });
  assert.equal(await offline.text(), oldShellHtml,
    'offline fallback must serve the original complete shell');
  assert.ok(await cache.match('https://calendar.test/app/assets/index-abc.js'),
    'offline fallback must retain the original JS matched by cached HTML');
}

// Runtime lookup must never fall through to a foreign cache on the same origin.
{
  const h = createHarness();
  await h.triggerLifecycle('install');
  const foreign = await h.caches.open('other-app-cache');
  const url = 'https://calendar.test/app/foreign-only.dat';
  await foreign.put(url, response('FOREIGN', 'text/plain'));
  h.setNetworkFallback(async () => { throw new Error('offline'); });
  const result = await h.triggerFetch(new Request(url));
  assert.equal(result.status, 0, 'foreign cache response leaked into current app');
}

// Private user files must be network-only and never written to Cache Storage.
{
  const h = createHarness();
  await h.triggerLifecycle('install');
  const url = 'https://calendar.test/app/private-plan.xlsx';
  h.responses.set(url, response('PRIVATE', 'application/octet-stream'));
  const result = await h.triggerFetch(new Request(url));
  assert.equal(await result.text(), 'PRIVATE');
  const cache = await h.caches.open(CURRENT_CACHE);
  assert.equal(await cache.match(url), undefined);
}

console.log('SERVICE_WORKER_GATE_OK');
