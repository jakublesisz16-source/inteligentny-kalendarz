import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const expectedParserHash = 'f477e6b53cc483f86cad8b8aada3cf69f6332146a7edaf2cf995e0ac5ba97ac2';
const parserPath = join(root, 'src/shopping/receipt-ocr/receipt-parser.ts');

function fail(message) {
  console.error(`[production-audit] FAIL: ${message}`);
  process.exitCode = 1;
}

function walk(dir) {
  const result = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) result.push(...walk(full));
    else result.push(full);
  }
  return result;
}

if (!existsSync(dist)) fail('dist/ does not exist after Vite build.');

if (existsSync(dist)) {
  for (const file of walk(dist)) {
    if (file.toLocaleLowerCase('en-US').endsWith('.map')) fail(`production source map must not be published: ${relative(root, file)}`);
  }
}

const parserHash = createHash('sha256').update(readFileSync(parserPath)).digest('hex');
if (parserHash !== expectedParserHash) fail(`receipt-parser.ts changed: ${parserHash}`);

const textFiles = existsSync(dist)
  ? walk(dist).filter((file) => /\.(?:html|js|mjs|css|json|webmanifest)$/u.test(file))
  : [];
const productionText = textFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
for (const forbidden of ['Diagnostyka FIX1J', 'Kopiuj tekst OCR', 'Kopiuj geom. JSON', 'Surowy tekst OCR do ręcznego skopiowania', '_PRIVATE_HISTORY/benchmarks/b029a', 'B029A-CORPUS-v1', '_PRIVATE_HISTORY/benchmarks/dev4a', 'DEV4A-GEOMETRY-v1', 'DEV4A-GATE1-VALUE-RECONCILIATION-v1', 'DEV4A-GATE1-FIX2-CANDIDATE-SAFETY-v1', '__IK_PRIVATE_RECEIPT_GEOMETRY__']) {
  if (productionText.includes(forbidden)) fail(`developer OCR diagnostic leaked into production bundle: ${forbidden}`);
}

const swPath = join(dist, 'service-worker.js');
if (!existsSync(swPath)) fail('service-worker.js missing from production dist.');
else {
  const sw = readFileSync(swPath, 'utf8');
  if (!sw.includes("const CACHE_PREFIX = 'inteligentny-kalendarz-shell-'")) fail('Release Service Worker cache prefix missing.');
  if (!sw.includes("const CACHE_NAME = `${CACHE_PREFIX}v1.1.2`")) fail('Release Service Worker revision missing.');
  if (!sw.includes('await caches.delete(CACHE_NAME)')) fail('Release Service Worker must clear a partial current-version cache before/after failed install.');
  if (/\bcaches\.match\s*\(/u.test(sw)) fail('Service Worker must not read arbitrary caches from the origin.');
  if (!sw.includes('key.startsWith(CACHE_PREFIX)')) fail('Service Worker must scope old-cache cleanup to Inteligentny Kalendarz caches.');
  if (!sw.includes("const PRIVATE_FILE_EXTENSIONS = ['.pdf', '.xlsx', '.xls', '.json'];")) fail('Private document cache bypass list missing.');
  if (!sw.includes('isPrivateUserFile(url)')) fail('Private document cache bypass is not wired into fetch handling.');
  if (/indexedDB|deleteDatabase/iu.test(sw)) fail('Service Worker must not access/delete IndexedDB.');
}

const mandatory = [
  'manifest.webmanifest',
  'favicon.svg',
  'icon-192-v111.png',
  'icon-512-v111.png',
  'apple-touch-icon-v111.png',
  'ocr/tesseract/tesseract.min.js',
  'ocr/tesseract/worker.min.js',
  'ocr/tesseract/core/tesseract-core-lstm.wasm.js',
  'ocr/tesseract/core/tesseract-core-simd-lstm.wasm.js',
  'ocr/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'ocr/tesseract/lang/pol.traineddata.gz',
];
for (const rel of mandatory) {
  if (!existsSync(join(dist, rel))) fail(`mandatory offline asset missing: ${rel}`);
}

const pdfWorkers = existsSync(join(dist, 'assets'))
  ? readdirSync(join(dist, 'assets')).filter((name) => /^pdf\.worker\.min-.*\.mjs$/u.test(name))
  : [];
if (!pdfWorkers.length) fail('bundled local PDF.js worker missing from dist/assets.');

const receiptSourceDir = join(root, 'src/shopping/receipt-ocr');
const receiptSources = walk(receiptSourceDir).filter((file) => /\.(?:ts|tsx)$/u.test(file));
for (const file of receiptSources) {
  const text = readFileSync(file, 'utf8');
  if (/https?:\/\//iu.test(text)) fail(`external URL found in receipt OCR source: ${relative(root, file)}`);
}

if (!process.exitCode) console.log('[production-audit] PASS');
