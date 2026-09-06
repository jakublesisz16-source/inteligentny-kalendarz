import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const SOURCE = await fs.readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8');
const SCOPE = 'https://calendar.test/app/';
const CURRENT_CACHE = 'inteligentny-kalendarz-shell-v1.1.0';

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
  const js = `const pdfWorker = "/app/assets/pdf.worker.min-xyz.mjs"; console.log(pdfWorker);`;
  const map = new Map([
    [SCOPE, response(html, 'text/html')],
    ['https://calendar.test/app/assets/index-abc.js', response(js, 'text/javascript')],
    ['https://calendar.test/app/assets/index-abc.css', response('body{}', 'text/css')],
    ['https://calendar.test/app/assets/pdf.worker.min-xyz.mjs', response('export {};', 'text/javascript')],
    ['https://calendar.test/app/manifest.webmanifest', response('{"name":"IK"}', 'application/manifest+json')],
    ['https://calendar.test/app/favicon.svg', response('<svg/>', 'image/svg+xml')],
    ['https://calendar.test/app/icon-192.png', response('PNG192', 'image/png')],
    ['https://calendar.test/app/icon-512.png', response('PNG512', 'image/png')],
    ['https://calendar.test/app/apple-touch-icon.png', response('PNG180', 'image/png')],
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

function createHarness(overrides = new Map()) {
  const listeners = new Map();
  const caches = new CacheStorageMock();
  const responses = baseResponses();
  for (const [key, value] of overrides) responses.set(key, value);
  let skipWaitingCalls = 0;
  let claimCalls = 0;
  let networkFallback = undefined;

  const self = {
    registration: { scope: SCOPE },
    location: { origin: new URL(SCOPE).origin },
    clients: { claim: async () => { claimCalls += 1; } },
    skipWaiting: async () => { skipWaitingCalls += 1; },
    addEventListener(type, handler) { listeners.set(type, handler); },
  };

  const fetchMock = async (input) => {
    const key = requestKey(input);
    if (responses.has(key)) return responses.get(key).clone();
    if (networkFallback) return networkFallback(input);
    throw new Error(`NETWORK_MISS:${key}`);
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
    triggerLifecycle,
    triggerFetch,
    setNetworkFallback(fn) { networkFallback = fn; },
    counters() { return { skipWaitingCalls, claimCalls }; },
  };
}

// Successful install must create a complete current-version cache.
{
  const h = createHarness();
  await h.triggerLifecycle('install');
  assert.equal(h.counters().skipWaitingCalls, 1);
  const cache = await h.caches.open(CURRENT_CACHE);
  for (const required of [
    SCOPE,
    'https://calendar.test/app/assets/index-abc.js',
    'https://calendar.test/app/assets/index-abc.css',
    'https://calendar.test/app/assets/pdf.worker.min-xyz.mjs',
    'https://calendar.test/app/manifest.webmanifest',
    'https://calendar.test/app/favicon.svg',
    'https://calendar.test/app/icon-192.png',
    'https://calendar.test/app/icon-512.png',
    'https://calendar.test/app/apple-touch-icon.png',
    'https://calendar.test/app/ocr/tesseract/tesseract.min.js',
    'https://calendar.test/app/ocr/tesseract/lang/pol.traineddata.gz',
  ]) assert.ok(await cache.match(required), `missing required cache entry: ${required}`);
}

// A failed mandatory fetch must remove the partial current cache and not activate it.
{
  const failingUrl = 'https://calendar.test/app/ocr/tesseract/lang/pol.traineddata.gz';
  const h = createHarness(new Map([[failingUrl, response('missing', 'text/plain', 404)]]));
  await assert.rejects(() => h.triggerLifecycle('install'));
  assert.equal(h.counters().skipWaitingCalls, 0);
  assert.equal(h.caches.stores.has(CURRENT_CACHE), false, 'partial cache survived failed install');
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
