import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = process.cwd();
const args = process.argv.slice(2);
function argValue(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const manifestArg = argValue('--manifest') ?? process.env.IK_RECEIPT_CORPUS_MANIFEST;
if (!manifestArg) {
  console.error('RECEIPT_CORPUS_QA_USAGE: node scripts/receipt-private-corpus-qa.mjs --manifest <private-manifest.json>');
  process.exit(2);
}

const manifestPath = resolve(manifestArg);
if (!existsSync(manifestPath)) {
  console.error(`RECEIPT_CORPUS_QA_FAIL: manifest not found: ${manifestPath}`);
  process.exit(2);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.version !== 1 || !Array.isArray(manifest.cases) || !manifest.cases.length) {
  console.error('RECEIPT_CORPUS_QA_FAIL: manifest must have version=1 and a non-empty cases array');
  process.exit(2);
}

function commandExists(command, versionArgs = ['--version']) {
  const result = spawnSync(command, versionArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return result.status === 0;
}

const localTsc = process.platform === 'win32'
  ? join(root, 'node_modules', '.bin', 'tsc.cmd')
  : join(root, 'node_modules', '.bin', 'tsc');
const tscCommand = existsSync(localTsc) ? localTsc : 'tsc';
if (!commandExists(tscCommand, ['--version'])) {
  console.error('RECEIPT_CORPUS_QA_INCOMPLETE: TypeScript compiler not available (node_modules/.bin/tsc or PATH tsc required).');
  process.exit(3);
}
const hasOcrSources = manifest.cases.some((entry) => !String(entry.source ?? '').toLowerCase().endsWith('.json'));
if (hasOcrSources && !commandExists('tesseract', ['--version'])) {
  console.error('RECEIPT_CORPUS_QA_INCOMPLETE: tesseract CLI is not available.');
  process.exit(3);
}
if (manifest.cases.some((entry) => String(entry.source ?? '').toLowerCase().endsWith('.pdf')) && !commandExists('pdftoppm', ['-v'])) {
  console.error('RECEIPT_CORPUS_QA_INCOMPLETE: pdftoppm is required for PDF corpus inputs.');
  process.exit(3);
}

const tempRoot = mkdtempSync(join(tmpdir(), 'ik-receipt-corpus-qa-'));
const parserOut = join(tempRoot, 'parser');
const renderDir = join(tempRoot, 'rendered');
mkdirSync(renderDir, { recursive: true });

function fail(message) {
  console.error(`RECEIPT_CORPUS_QA_FAIL: ${message}`);
  rmSync(tempRoot, { recursive: true, force: true });
  process.exit(1);
}

function compileParser() {
  const sources = [
    'src/shopping/receipt-ocr/receipt-parser.ts',
    'src/shopping/receipt-ocr/receipt-ocr-recovery.ts',
    'src/shopping/receipt-ocr/receipt-ocr-quality.ts',
    'src/shopping/receipt-ocr/receipt-financial-reconciliation.ts',
    'src/shopping/receipt-ocr/receipt-columnar-reconstruction.ts',
    'src/shopping/receipt-ocr/receipt-ocr.types.ts',
    'src/shopping/receipt-ocr/receipt-json.ts',
    'src/shopping/expenses.utils.ts',
    'src/shopping/expenses.types.ts',
  ];
  const result = spawnSync(tscCommand, [
    ...sources,
    '--target', 'ES2022',
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--esModuleInterop',
    '--skipLibCheck',
    '--outDir', parserOut,
    '--rootDir', 'src',
    '--noEmitOnError', 'false',
  ], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    fail('parser compile failed');
  }
  writeFileSync(join(parserOut, 'package.json'), '{"type":"commonjs"}\n');
}

function sourceInsideProject(source) {
  const rel = relative(root, source);
  return rel && !rel.startsWith('..') && !isAbsolute(rel);
}

function renderSource(entry) {
  const source = resolve(dirname(manifestPath), String(entry.source));
  if (!existsSync(source)) fail(`${entry.id}: source missing: ${source}`);
  if (sourceInsideProject(source)) fail(`${entry.id}: private corpus source must stay outside the project checkpoint: ${source}`);
  if (!source.toLowerCase().endsWith('.pdf')) return source;
  const outputBase = join(renderDir, String(entry.id).replace(/[^a-z0-9_.-]+/giu, '_'));
  const result = spawnSync('pdftoppm', ['-f', '1', '-singlefile', '-r', String(entry.pdfDpi ?? 220), '-png', source, outputBase], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stderr);
    fail(`${entry.id}: PDF render failed`);
  }
  return `${outputBase}.png`;
}

function runOcr(imagePath, psm) {
  const result = spawnSync('tesseract', [imagePath, 'stdout', '-l', 'pol', '--psm', String(psm)], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `tesseract exit ${result.status}`);
  }
  return result.stdout;
}

function normalize(value) {
  return String(value ?? '').trim().toLocaleLowerCase('pl-PL');
}

function compareExpected(parsed, entry) {
  const expected = entry.expected ?? {};
  const mismatches = [];
  const tolerance = Number.isFinite(entry.toleranceMinor) ? Number(entry.toleranceMinor) : 1;
  const exactNumber = (key, actual) => {
    if (expected[key] === undefined) return;
    if (actual !== expected[key]) mismatches.push(`${key}: expected ${expected[key]}, got ${String(actual)}`);
  };
  const money = (key, actual) => {
    if (expected[key] === undefined) return;
    if (actual === undefined || Math.abs(Number(actual) - Number(expected[key])) > tolerance) {
      mismatches.push(`${key}: expected ${expected[key]}±${tolerance}, got ${String(actual)}`);
    }
  };

  exactNumber('items', parsed.items.length);
  money('goodsTotalMinor', parsed.detectedItemsTotalMinor);
  money('depositTotalMinor', parsed.depositTotalMinor ?? 0);
  money('finalPayableMinor', parsed.finalPayableMinor ?? parsed.declaredTotalMinor);
  if (expected.unexplainedDifferenceMinor !== undefined) money('unexplainedDifferenceMinor', parsed.unexplainedDifferenceMinor ?? 0);
  if (entry.date && parsed.date !== entry.date) mismatches.push(`date: expected ${entry.date}, got ${parsed.date ?? 'missing'}`);
  if (entry.merchantIncludes && !normalize(parsed.merchant).includes(normalize(entry.merchantIncludes))) {
    mismatches.push(`merchant: expected to include ${entry.merchantIncludes}, got ${parsed.merchant ?? 'missing'}`);
  }
  return mismatches;
}

try {
  compileParser();
  const require = createRequire(import.meta.url);
  const { parseReceiptText } = require(join(parserOut, 'shopping', 'receipt-ocr', 'receipt-parser.js'));
  const { parseStructuredReceiptJsonText } = require(join(parserOut, 'shopping', 'receipt-ocr', 'receipt-json.js'));
  const {
    assessReceiptOcrCandidate,
    chooseReceiptOcrCandidate,
    shouldRetryReceiptOcr,
    shouldRetryReceiptPdfOcr,
  } = require(join(parserOut, 'shopping', 'receipt-ocr', 'receipt-ocr-recovery.js'));
  const summary = [];
  let failures = 0;

  for (const entry of manifest.cases) {
    if (!entry?.id || !entry?.source) fail('every case requires id and source');
    const sourcePath = resolve(dirname(manifestPath), String(entry.source));
    if (!existsSync(sourcePath)) fail(`${entry.id}: source missing: ${sourcePath}`);
    if (sourceInsideProject(sourcePath)) fail(`${entry.id}: private corpus source must stay outside the project checkpoint: ${sourcePath}`);
    const sourceIsJson = String(entry.source).toLowerCase().endsWith('.json');
    const sourceIsPdf = String(entry.source).toLowerCase().endsWith('.pdf');
    const mode = entry.mode ?? manifest.mode ?? 'app';

    if (sourceIsJson) {
      try {
        const structured = parseStructuredReceiptJsonText(readFileSync(sourcePath, 'utf8'));
        const parsed = structured.parsed;
        const mismatches = compareExpected(parsed, entry);
        if (entry.currency && structured.currency !== entry.currency) mismatches.push(`currency: expected ${entry.currency}, got ${structured.currency}`);
        const pass = mismatches.length === 0;
        if (!pass) failures += 1;
        summary.push({
          id: entry.id,
          mode: 'json',
          pass,
          selectedProfile: 'structured-json',
          items: parsed.items.length,
          goodsTotalMinor: parsed.detectedItemsTotalMinor,
          depositTotalMinor: parsed.depositTotalMinor ?? 0,
          finalPayableMinor: parsed.finalPayableMinor ?? parsed.declaredTotalMinor,
          unexplainedDifferenceMinor: parsed.unexplainedDifferenceMinor ?? 0,
          ...(mismatches.length ? { mismatches } : {}),
        });
      } catch (error) {
        failures += 1;
        summary.push({ id: entry.id, mode: 'json', pass: false, reason: error instanceof Error ? error.message : String(error) });
      }
      continue;
    }

    const imagePath = renderSource(entry);

    if (mode === 'matrix') {
      const psms = Array.isArray(entry.psm) && entry.psm.length ? entry.psm : [3, 6];
      for (const psm of psms) {
        let parsed;
        try {
          const text = runOcr(imagePath, psm);
          parsed = parseReceiptText(text);
        } catch (error) {
          failures += 1;
          summary.push({ id: entry.id, mode, psm, pass: false, reason: error instanceof Error ? error.message : String(error) });
          continue;
        }
        const mismatches = compareExpected(parsed, entry);
        const pass = mismatches.length === 0;
        if (!pass) failures += 1;
        summary.push({
          id: entry.id,
          mode,
          psm,
          pass,
          items: parsed.items.length,
          goodsTotalMinor: parsed.detectedItemsTotalMinor,
          depositTotalMinor: parsed.depositTotalMinor ?? 0,
          finalPayableMinor: parsed.finalPayableMinor ?? parsed.declaredTotalMinor,
          unexplainedDifferenceMinor: parsed.unexplainedDifferenceMinor ?? 0,
          ...(mismatches.length ? { mismatches } : {}),
        });
      }
      continue;
    }

    if (mode !== 'app') fail(`${entry.id}: unsupported mode ${String(mode)} (expected app or matrix)`);
    try {
      const primaryText = runOcr(imagePath, 3);
      const sourceType = sourceIsPdf ? 'pdf' : 'photo';
      const primary = assessReceiptOcrCandidate('primary', primaryText, sourceType);
      const retry = sourceIsPdf ? shouldRetryReceiptPdfOcr(primary) : shouldRetryReceiptOcr(primary);
      let selected = primary;
      let recoveryRan = false;
      if (retry) {
        const recoveryText = runOcr(imagePath, 6);
        const recovery = assessReceiptOcrCandidate('single-block-recovery', recoveryText, sourceType);
        selected = chooseReceiptOcrCandidate(primary, recovery);
        recoveryRan = true;
      }
      const parsed = selected.parsed;
      const mismatches = compareExpected(parsed, entry);
      const pass = mismatches.length === 0;
      if (!pass) failures += 1;
      summary.push({
        id: entry.id,
        mode,
        psm: selected.profile === 'single-block-recovery' ? 6 : 3,
        pass,
        recoveryRan,
        selectedProfile: selected.profile,
        items: parsed.items.length,
        goodsTotalMinor: parsed.detectedItemsTotalMinor,
        depositTotalMinor: parsed.depositTotalMinor ?? 0,
        finalPayableMinor: parsed.finalPayableMinor ?? parsed.declaredTotalMinor,
        unexplainedDifferenceMinor: parsed.unexplainedDifferenceMinor ?? 0,
        ...(mismatches.length ? { mismatches } : {}),
      });
    } catch (error) {
      failures += 1;
      summary.push({ id: entry.id, mode, pass: false, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  for (const row of summary) {
    const metrics = row.reason
      ? row.reason
      : `items=${row.items} goods=${row.goodsTotalMinor} deposit=${row.depositTotalMinor} final=${row.finalPayableMinor} diff=${row.unexplainedDifferenceMinor}`;
    const modeLabel = row.mode === 'app'
      ? `app selected=${row.selectedProfile ?? 'n/a'}${row.recoveryRan ? ' recovery=ran' : ' recovery=skipped'}`
      : row.mode === 'json'
        ? 'json structured'
        : `matrix psm=${row.psm}`;
    console.log(`${row.pass ? 'PASS' : 'FAIL'} ${row.id} ${modeLabel} ${metrics}${row.mismatches ? ` :: ${row.mismatches.join('; ')}` : ''}`);
  }
  console.log(`RECEIPT_CORPUS_QA_SUMMARY pass=${summary.length - failures}/${summary.length} cases=${manifest.cases.length} failures=${failures}`);
  rmSync(tempRoot, { recursive: true, force: true });
  process.exit(failures ? 1 : 0);
} catch (error) {
  rmSync(tempRoot, { recursive: true, force: true });
  throw error;
}
