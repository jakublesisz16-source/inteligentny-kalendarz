import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseReceiptText } = require('../.benchmark-dist/src/shopping/receipt-ocr/receipt-parser.js');
const {
  aggregateReceiptBenchmark,
  detectedReceiptFromParsed,
  evaluateReceiptBenchmarkCase,
  validateReceiptBenchmarkManifest,
  validateReceiptGroundTruth,
} = require('../.benchmark-dist/src/benchmarks/receipt-benchmark.js');

const root = process.cwd();
const benchmarkRoot = path.join(root, '_PRIVATE_HISTORY', 'benchmarks', 'b029a');
const manifestPath = path.join(benchmarkRoot, 'manifest.json');
const outputDir = path.join(benchmarkRoot, 'results');
const reportsDir = path.join(benchmarkRoot, 'reports');

function percent(value) {
  return value === undefined ? 'N/A' : `${(value * 100).toFixed(1)}%`;
}

function money(value) {
  return value === undefined ? 'N/A' : `${(value / 100).toFixed(2)} PLN`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

function renderMetrics(metrics) {
  return [
    `- cases: ${metrics.cases}`,
    `- merchant identity accuracy: ${percent(metrics.merchantIdentityAccuracy)}`,
    `- merchant display accuracy: ${percent(metrics.merchantDisplayAccuracy)}`,
    `- wrong confident merchant rate: ${percent(metrics.wrongConfidentMerchantRate)}`,
    `- date accuracy: ${percent(metrics.dateAccuracy)}`,
    `- wrong confident date rate: ${percent(metrics.wrongConfidentDateRate)}`,
    `- item recall: ${percent(metrics.itemRecall)}`,
    `- item precision: ${percent(metrics.itemPrecision)}`,
    `- item F1: ${percent(metrics.itemF1)}`,
    `- item amount accuracy: ${percent(metrics.itemAmountAccuracy)}`,
    `- quantity accuracy: ${percent(metrics.quantityAccuracy)}`,
    `- unit price accuracy: ${percent(metrics.unitPriceAccuracy)}`,
    `- goods total accuracy: ${percent(metrics.goodsAccuracy)}`,
    `- discount total accuracy: ${percent(metrics.discountAccuracy)}`,
    `- deposit total accuracy: ${percent(metrics.depositAccuracy)}`,
    `- final total accuracy: ${percent(metrics.finalTotalAccuracy)}`,
    `- payment accuracy: ${percent(metrics.paymentAccuracy)}`,
    `- category accuracy: ${percent(metrics.categoryAccuracy)}`,
    `- category coverage: ${percent(metrics.categoryCoverage)}`,
    `- false Zgodne rate: ${percent(metrics.falseReconciledRate)}`,
    `- receipt no-edit rate: ${percent(metrics.receiptNoEditRate)}`,
    `- receipt light-review rate: ${percent(metrics.receiptLightReviewRate)}`,
  ];
}

function perCaseMarkdown(result, expected) {
  const lines = [
    `# ${result.caseId}`,
    '',
    'PRIVATE - DO NOT PUBLISH',
    '',
    `Source type: ${result.sourceType}`,
    `Layout: ${result.layoutType}`,
    '',
    '## Expected',
    `- merchant: ${expected.merchant?.displayName ?? expected.merchant?.legalName ?? 'N/A'}`,
    `- date: ${expected.date ?? 'N/A'}`,
    `- items: ${expected.items.length}`,
    `- goods: ${money(expected.goodsTotalMinor)}`,
    `- final: ${money(expected.finalTotalMinor)}`,
    `- payment: ${money(expected.paymentTotalMinor)}`,
    '',
    '## Detected',
    `- merchant: ${result.detected.merchant ?? 'unresolved'}`,
    `- merchant confidence: ${result.detected.merchantConfidence ?? 'N/A'}`,
    `- date: ${result.detected.date ?? 'unresolved'}`,
    `- date confidence: ${result.detected.dateConfidence ?? 'N/A'}`,
    `- items: ${result.detected.items.length}`,
    `- goods: ${money(result.detected.goodsTotalMinor)}`,
    `- discounts: ${money(result.detected.discountsTotalMinor)}`,
    `- deposits: ${money(result.detected.depositsTotalMinor)}`,
    `- final: ${money(result.detected.finalTotalMinor)}`,
    `- payment: ${money(result.detected.paymentTotalMinor)}`,
    `- review reconciled: ${result.detected.reviewReconciled ? 'YES' : 'NO'}`,
    '',
    '## Metrics',
    `- item recall: ${percent(result.metrics.itemRecall)}`,
    `- item precision: ${percent(result.metrics.itemPrecision)}`,
    `- item F1: ${percent(result.metrics.itemF1)}`,
    `- item amount accuracy: ${percent(result.metrics.itemAmountAccuracy)}`,
    `- no-edit: ${result.metrics.receiptNoEdit ? 'YES' : 'NO'}`,
    `- light-review: ${result.metrics.receiptLightReview ? 'YES' : 'NO'}`,
    `- false Zgodne: ${result.metrics.falseReconciled ? 'YES' : 'NO'}`,
    '',
    '## Errors',
    ...(result.errors.length ? result.errors.map((error) => `- ${error}`) : ['- none']),
    '',
    '## Detected items',
    ...(result.detected.items.length
      ? result.detected.items.map((item, index) => `- ${index + 1}. ${item.name} | ${money(item.finalAmountMinor)}`)
      : ['- none']),
    '',
  ];
  return lines.join('\n');
}

async function main() {
  const manifest = await readJson(manifestPath);
  const manifestErrors = validateReceiptBenchmarkManifest(manifest.cases);
  if (manifest.private !== true) manifestErrors.push('manifest private must be true');
  if (manifestErrors.length) throw new Error(`Invalid benchmark manifest:\n${manifestErrors.join('\n')}`);

  await mkdir(outputDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  const results = [];

  for (const benchmarkCase of manifest.cases) {
    const groundTruthPath = path.join(benchmarkRoot, benchmarkCase.groundTruthFile);
    const rawOcrPath = path.join(benchmarkRoot, benchmarkCase.rawOcrFile);
    const groundTruth = await readJson(groundTruthPath);
    const groundTruthErrors = validateReceiptGroundTruth(groundTruth);
    if (groundTruthErrors.length) throw new Error(`${benchmarkCase.id}: invalid ground truth: ${groundTruthErrors.join('; ')}`);
    await readFile(path.join(benchmarkRoot, benchmarkCase.sourceFile));
    const rawText = await readFile(rawOcrPath, 'utf8');
    const parsed = parseReceiptText(rawText);
    const detected = detectedReceiptFromParsed(parsed);
    const result = evaluateReceiptBenchmarkCase(benchmarkCase, groundTruth, detected);
    results.push(result);
    await writeFile(path.join(reportsDir, `${benchmarkCase.id}.md`), perCaseMarkdown(result, groundTruth), 'utf8');
  }

  const aggregate = aggregateReceiptBenchmark(results);
  const parserPath = path.join(root, 'src', 'shopping', 'receipt-ocr', 'receipt-parser.ts');
  const runnerPath = path.join(root, 'scripts', 'receipt-benchmark-runner.mjs');
  const generatedAt = new Date().toISOString();
  const metricsFingerprint = createHash('sha256').update(JSON.stringify({ results, aggregate })).digest('hex');
  const output = {
    private: true,
    doNotPublish: true,
    benchmarkMode: 'snapshot-production-parser',
    corpusVersion: manifest.corpusVersion,
    generatedAt,
    metricsFingerprint,
    environment: {
      node: process.version,
      appVersion: '1.1.0-dev.3',
      parserSha256: await sha256(parserPath),
      benchmarkRunnerSha256: await sha256(runnerPath),
      geometryCapture: {
        available: true,
        reason: 'DEV4-A OcrRecognitionResult can carry word/token bounding boxes from the same Tesseract.js recognition pass. Snapshot baseline parsing remains plain-text only.',
      },
    },
    results,
    aggregate,
  };
  await writeFile(path.join(outputDir, 'benchmark-results.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  const summary = [
    '# B029A private OCR benchmark baseline',
    '',
    'PRIVATE - DO NOT PUBLISH',
    '',
    `Generated: ${generatedAt}`,
    `Corpus: ${manifest.corpusVersion}`,
    `Cases: ${results.length}`,
    '',
    '## Overall',
    ...renderMetrics(aggregate.overall),
    '',
    '## By source type',
    ...Object.entries(aggregate.bySourceType).flatMap(([key, metrics]) => ['', `### ${key}`, ...renderMetrics(metrics)]),
    '',
    '## By layout type',
    ...Object.entries(aggregate.byLayoutType).flatMap(([key, metrics]) => ['', `### ${key}`, ...renderMetrics(metrics)]),
    '',
    '## Top failure classes',
    ...(aggregate.failureClasses.length ? aggregate.failureClasses.map((entry, index) => `${index + 1}. ${entry.error} - ${entry.count}`) : ['none']),
    '',
    '## Benchmark interpretation',
    `- best source class by item F1: ${Object.entries(aggregate.bySourceType).sort((a, b) => b[1].itemF1 - a[1].itemF1)[0]?.[0] ?? 'N/A'}`,
    `- worst source class by item F1: ${Object.entries(aggregate.bySourceType).sort((a, b) => a[1].itemF1 - b[1].itemF1)[0]?.[0] ?? 'N/A'}`,
    `- best layout class by item F1: ${Object.entries(aggregate.byLayoutType).sort((a, b) => b[1].itemF1 - a[1].itemF1)[0]?.[0] ?? 'N/A'}`,
    `- worst layout class by item F1: ${Object.entries(aggregate.byLayoutType).sort((a, b) => a[1].itemF1 - b[1].itemF1)[0]?.[0] ?? 'N/A'}`,
    `- columnar item recall: ${percent(aggregate.byLayoutType.columnar?.itemRecall)}`,
    `- marketing-tail item recall: ${percent(aggregate.byLayoutType['marketing-tail']?.itemRecall)}`,
    '- OCR engine decision: KEEP CURRENT ENGINE FOR DEV4-A geometry calibration; benchmark a second local engine later if good-source item recall remains <85% after geometry-aware reconstruction.',
    '',
    '## Geometry readiness',
    '- Geometry capture: AVAILABLE in DEV4-A result contract; B029A snapshot parsing remains plain-text only.',
    '- OcrRecognitionResult now optionally carries token bounding boxes from Tesseract.js blocks output without a second OCR pass.',
    '- Browser/live Tesseract.js geometry snapshots are still required before production geometry selection can be enabled.',
    '',
    '## Decision gate targets (future, not CI blocking)',
    '- merchant identity >= 95%',
    '- date >= 97%',
    '- final total >= 98%',
    '- payment >= 98%',
    '- item recall >= 90%',
    '- item amount accuracy >= 93%',
    '- false Zgodne = 0%',
    '',
    'This B029A baseline is descriptive. Low accuracy does not fail the benchmark harness.',
    '',
  ].join('\n');
  await writeFile(path.join(reportsDir, 'benchmark-summary.md'), summary, 'utf8');
  process.stdout.write(`${summary}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
