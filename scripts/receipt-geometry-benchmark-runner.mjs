import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseReceiptText } = require('../.benchmark-dist/src/shopping/receipt-ocr/receipt-parser.js');
const { assessReceiptGeometryStructuredCandidate, reconstructReceiptTextFromGeometry } = require('../.benchmark-dist/src/shopping/receipt-ocr/receipt-geometry-reconstruction.js');
const { mergeReceiptOcrGeometryEvidence, compareReceiptValueColumnRecovery, countUsableReceiptValueRecoveryTokens, planReceiptValueColumnRecovery } = require('../.benchmark-dist/src/shopping/receipt-ocr/receipt-value-column-recovery.js');
const { detectedReceiptFromParsed, evaluateReceiptBenchmarkCase } = require('../.benchmark-dist/src/benchmarks/receipt-benchmark.js');

const root = process.cwd();
const b029aRoot = path.join(root, '_PRIVATE_HISTORY', 'benchmarks', 'b029a');
const dev4aRoot = path.join(root, '_PRIVATE_HISTORY', 'benchmarks', 'dev4a');
const calibrationPath = path.join(dev4aRoot, 'geometry', 'biedronka-clean-columnar.calibration-tesseract5.json');
const livePath = path.join(dev4aRoot, 'live', 'biedronka-clean-columnar', 'browser-tesseractjs7.json');
const browserRecoveryPath = path.join(dev4aRoot, 'live', 'biedronka-clean-columnar', 'browser-tesseractjs7-value-recovery.json');
const cliRecoveryPath = path.join(dev4aRoot, 'recovery1', 'value-column-psm6-cli-reference.json');
const manifestPath = path.join(b029aRoot, 'manifest.json');
const groundTruthPath = path.join(b029aRoot, 'ground-truth', 'biedronka-clean-columnar.json');
const baselineResultsPath = path.join(b029aRoot, 'results', 'benchmark-results.json');
const outputDir = path.join(dev4aRoot, 'results');
const reportsDir = path.join(dev4aRoot, 'reports');

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));
const percent = (value) => value === undefined ? 'N/A' : `${(value * 100).toFixed(1)}%`;
const money = (minor) => `${minor < 0 ? '-' : ''}${Math.floor(Math.abs(minor) / 100)},${String(Math.abs(minor) % 100).padStart(2, '0')} PLN`;

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

function evaluateGeometry(geometry, provenance, productionEngineSnapshot, benchmarkCase, groundTruth) {
  const reconstruction = reconstructReceiptTextFromGeometry(geometry);
  const rowMajorParsed = parseReceiptText(reconstruction.rowMajorText);
  const structuredParsed = parseReceiptText(reconstruction.text);
  const structuredAssessment = assessReceiptGeometryStructuredCandidate(reconstruction, structuredParsed);
  const rowMajorResult = evaluateReceiptBenchmarkCase(benchmarkCase, groundTruth, detectedReceiptFromParsed(rowMajorParsed));
  const structuredResult = evaluateReceiptBenchmarkCase(benchmarkCase, groundTruth, detectedReceiptFromParsed(structuredParsed));
  return {
    provenance,
    productionEngineSnapshot,
    reconstruction: {
      applied: reconstruction.applied,
      structuredTextGenerated: reconstruction.structuredTextGenerated,
      structuredCandidateAccepted: structuredAssessment.accepted,
      structuredCandidateRejectionReasons: structuredAssessment.rejectionReasons,
      completenessRatio: structuredAssessment.completenessRatio,
      validTokenCount: reconstruction.validTokenCount,
      invalidTokenCount: reconstruction.invalidTokenCount,
      rowCount: reconstruction.rows.length,
      columnSource: reconstruction.columns?.source,
      columnConfidence: reconstruction.columns?.confidence,
      reconstructedGeometryItems: reconstruction.items,
      completeGeometryItems: reconstruction.completeItemCount,
      grossItemsTotalMinor: reconstruction.grossItemsTotalMinor,
      discountsTotalMinor: reconstruction.discountsTotalMinor,
      itemsTotalMinor: reconstruction.itemsTotalMinor,
      rejectedRows: reconstruction.rejectedRows,
      rowMajorText: reconstruction.rowMajorText,
      reconstructedText: reconstruction.text,
    },
    rowMajorParser: {
      detectedItems: rowMajorParsed.items.length,
      itemsTotalMinor: rowMajorParsed.detectedItemsTotalMinor,
      result: rowMajorResult,
    },
    structuredParser: {
      detectedItems: structuredParsed.items.length,
      itemsTotalMinor: structuredParsed.detectedItemsTotalMinor,
      result: structuredResult,
    },
  };
}

function evaluateGeometrySnapshot(snapshot, benchmarkCase, groundTruth) {
  return evaluateGeometry(snapshot.geometry, snapshot.provenance, snapshot.productionEngineSnapshot === true, benchmarkCase, groundTruth);
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  const calibration = await readJson(calibrationPath);
  const manifest = await readJson(manifestPath);
  const groundTruth = await readJson(groundTruthPath);
  const baseline = await readJson(baselineResultsPath);
  if (calibration.private !== true || calibration.calibrationOnly !== true) throw new Error('DEV4-A geometry fixture must remain private calibration-only data.');
  if (calibration.productionEngineSnapshot !== false) throw new Error('Calibration fixture must not masquerade as a production Tesseract.js snapshot.');
  const benchmarkCase = manifest.cases.find((entry) => entry.id === 'biedronka-clean-columnar');
  if (!benchmarkCase) throw new Error('Missing B029A clean columnar benchmark case.');
  const baselineCase = baseline.results.find((entry) => entry.caseId === benchmarkCase.id);
  if (!baselineCase) throw new Error('Missing baseline result for clean columnar case.');

  const calibrationResult = evaluateGeometrySnapshot(calibration, benchmarkCase, groundTruth);
  let liveSnapshot;
  let liveResult;
  let livePlan;
  if (existsSync(livePath)) {
    liveSnapshot = await readJson(livePath);
    if (liveSnapshot.private !== true || liveSnapshot.doNotPublish !== true) throw new Error('Live geometry fixture must be private.');
    if (liveSnapshot.productionEngineSnapshot !== true) throw new Error('Live fixture must explicitly identify itself as a production engine snapshot.');
    if (liveSnapshot.provenance?.engine !== 'Tesseract.js' || liveSnapshot.provenance?.source !== 'browser-live') throw new Error('Live fixture provenance must identify browser Tesseract.js.');
    liveResult = evaluateGeometrySnapshot(liveSnapshot, benchmarkCase, groundTruth);
    const primaryReconstruction = reconstructReceiptTextFromGeometry(liveSnapshot.geometry);
    livePlan = planReceiptValueColumnRecovery(liveSnapshot.geometry, primaryReconstruction);
  }

  let cliRecoveryReference;
  if (liveSnapshot && existsSync(cliRecoveryPath)) {
    const recovery = await readJson(cliRecoveryPath);
    if (recovery.private !== true || recovery.calibrationOnly !== true || recovery.productionEngineSnapshot !== false) throw new Error('CLI value recovery must remain a non-production private reference.');
    const before = reconstructReceiptTextFromGeometry(liveSnapshot.geometry);
    const mergedGeometry = mergeReceiptOcrGeometryEvidence(liveSnapshot.geometry, recovery.geometry);
    const after = reconstructReceiptTextFromGeometry(mergedGeometry);
    cliRecoveryReference = {
      provenance: recovery.provenance,
      usableRecoveredTokens: countUsableReceiptValueRecoveryTokens(recovery.geometry),
      delta: compareReceiptValueColumnRecovery(before, after),
      result: evaluateGeometry(mergedGeometry, recovery.provenance, false, benchmarkCase, groundTruth),
    };
  }

  let browserRecoveryResult;
  if (existsSync(browserRecoveryPath)) {
    const browserRecovery = await readJson(browserRecoveryPath);
    if (browserRecovery.private !== true || browserRecovery.doNotPublish !== true || browserRecovery.productionEngineSnapshot !== true) throw new Error('Browser recovery fixture must remain a private production-engine snapshot.');
    browserRecoveryResult = evaluateGeometrySnapshot(browserRecovery, benchmarkCase, groundTruth);
  }

  const output = {
    private: true,
    doNotPublish: true,
    experimentVersion: 'DEV4A-GATE1-RECOVERY1-NARROW-VALUE-COLUMN-v1',
    corpusVersion: manifest.corpusVersion,
    generatedAt: new Date().toISOString(),
    coverage: {
      corpusCases: manifest.cases.length,
      productionTesseractJsGeometryCases: liveResult ? 1 : 0,
      productionTesseractJsRecoveryCases: browserRecoveryResult ? 1 : 0,
      calibrationGeometryCases: 1,
    },
    baselineCase,
    calibration: calibrationResult,
    ...(liveResult ? { livePrimary: liveResult, liveRecoveryPlan: livePlan } : {}),
    ...(cliRecoveryReference ? { cliRecoveryReference } : {}),
    ...(browserRecoveryResult ? { liveValueRecovery: browserRecoveryResult } : {}),
    productionIntegration: {
      allowed: false,
      decision: browserRecoveryResult
        ? 'DO NOT INTEGRATE - MULTI-RECEIPT GATE2 REQUIRED'
        : 'DO NOT INTEGRATE - LIVE BROWSER VALUE-RECOVERY SNAPSHOT REQUIRED',
      reason: browserRecoveryResult
        ? 'A live recovery result exists, but geometry selection remains experimental until multi-receipt A/B validation.'
        : 'The bounded crop is architecture-ready and a non-production CLI PSM6 reference can demonstrate recoverability, but only browser Tesseract.js 7 can close RECOVERY1.',
    },
    hashes: {
      geometryReconstructorSha256: await sha256(path.join(root, 'src', 'shopping', 'receipt-ocr', 'receipt-geometry-reconstruction.ts')),
      valueRecoverySha256: await sha256(path.join(root, 'src', 'shopping', 'receipt-ocr', 'receipt-value-column-recovery.ts')),
      calibrationFixtureSha256: await sha256(calibrationPath),
      ...(liveResult ? { liveFixtureSha256: await sha256(livePath) } : {}),
      ...(cliRecoveryReference ? { cliRecoveryReferenceSha256: await sha256(cliRecoveryPath) } : {}),
      ...(browserRecoveryResult ? { browserRecoveryFixtureSha256: await sha256(browserRecoveryPath) } : {}),
      parserSha256: await sha256(path.join(root, 'src', 'shopping', 'receipt-ocr', 'receipt-parser.ts')),
    },
  };

  await writeFile(path.join(outputDir, 'dev4a-gate1-recovery1-results.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  const c = calibrationResult;
  const l = liveResult;
  const r = cliRecoveryReference;
  const br = browserRecoveryResult;
  const summary = [
    '# DEV4-A-GATE1-RECOVERY1 narrow value-column OCR recovery experiment',
    '',
    'PRIVATE - DO NOT PUBLISH',
    '',
    `Experiment: ${output.experimentVersion}`,
    `Corpus: ${manifest.corpusVersion}`,
    `Production Tesseract.js geometry coverage: ${output.coverage.productionTesseractJsGeometryCases}/${output.coverage.corpusCases}`,
    `Production Tesseract.js value-recovery coverage: ${output.coverage.productionTesseractJsRecoveryCases}/${output.coverage.corpusCases}`,
    '',
    '## Architecture',
    '- Recovery is conditional on a high-confidence geometry table with a missing value-column evidence pattern.',
    '- At most one PSM6 narrow value-column OCR pass is performed per eligible page; no extra full-image OCR is added.',
    '- The crop is derived from inferred column anchors and item-section rows, not merchant identity or fixed receipt coordinates.',
    '- Recovered token coordinates are mapped back to page space and merged as local evidence. Receipt totals remain validation-only.',
    '',
    '## Browser Tesseract.js primary fixture',
    ...(l ? [
      `- valid tokens: ${l.reconstruction.validTokenCount}`,
      `- rows: ${l.reconstruction.rowCount}`,
      `- safe complete items: ${l.reconstruction.completeGeometryItems}/${l.reconstruction.reconstructedGeometryItems.length}`,
      `- structured candidate accepted: ${l.reconstruction.structuredCandidateAccepted ? 'YES' : 'NO'}`,
      `- planned recovery eligible: ${livePlan?.eligible ? 'YES' : 'NO'}`,
      ...(livePlan?.crop ? [`- planned crop: ${livePlan.crop.x0},${livePlan.crop.y0} -> ${livePlan.crop.x1},${livePlan.crop.y1} (${livePlan.pixelCount} px)`] : []),
    ] : ['- primary live fixture missing']),
    '',
    '## CLI PSM6 narrow-crop reference - NON-PRODUCTION',
    ...(r ? [
      `- engine: ${r.provenance?.engine ?? 'unknown'} ${r.provenance?.engineVersion ?? ''}`.trim(),
      `- usable recovered numeric tokens: ${r.usableRecoveredTokens}`,
      `- complete items: ${r.delta.completeBefore} -> ${r.delta.completeAfter}`,
      `- recovered gross cells: ${r.delta.recoveredGrossCells}`,
      `- recovered discount cells: ${r.delta.recoveredDiscountCells}`,
      `- recovered net cells: ${r.delta.recoveredNetCells}`,
      `- recovered complete groups: ${r.delta.recoveredCompleteGroups}`,
      `- gross after merge: ${money(r.result.reconstruction.grossItemsTotalMinor)}`,
      `- discounts after merge: ${money(r.result.reconstruction.discountsTotalMinor)}`,
      `- net after merge: ${money(r.result.reconstruction.itemsTotalMinor)}`,
      `- structured candidate accepted: ${r.result.reconstruction.structuredCandidateAccepted ? 'YES' : 'NO'}`,
      `- structured item recall: ${percent(r.result.structuredParser.result.metrics.itemRecall)}`,
      `- structured item precision: ${percent(r.result.structuredParser.result.metrics.itemPrecision)}`,
      `- structured item amount accuracy: ${percent(r.result.structuredParser.result.metrics.itemAmountAccuracy)}`,
      '- This reference proves that the physical crop contains the missing values. It does NOT prove browser Tesseract.js 7 recovery performance.',
    ] : ['- not available']),
    '',
    '## Browser Tesseract.js value recovery',
    ...(br ? [
      `- valid merged tokens: ${br.reconstruction.validTokenCount}`,
      `- complete items: ${br.reconstruction.completeGeometryItems}/${br.reconstruction.reconstructedGeometryItems.length}`,
      `- gross: ${money(br.reconstruction.grossItemsTotalMinor)}`,
      `- discounts: ${money(br.reconstruction.discountsTotalMinor)}`,
      `- net: ${money(br.reconstruction.itemsTotalMinor)}`,
      `- candidate accepted: ${br.reconstruction.structuredCandidateAccepted ? 'YES' : 'NO'}`,
    ] : [
      '- NOT CAPTURED YET.',
      '- Run the application in DEV, rescan the clean columnar PDF, and use "Kopiuj geom. JSON" after the value recovery pass.',
    ]),
    '',
    '## Integration decision',
    `- ${output.productionIntegration.decision}`,
    `- ${output.productionIntegration.reason}`,
    '',
    '## CLI calibration fixture - previous non-production reference',
    `- complete: ${c.reconstruction.completeGeometryItems}/${c.reconstruction.reconstructedGeometryItems.length}`,
    `- net: ${money(c.reconstruction.itemsTotalMinor)}`,
    '',
  ].join('\n');
  await writeFile(path.join(reportsDir, 'dev4a-gate1-recovery1-summary.md'), `${summary}\n`, 'utf8');
  process.stdout.write(`${summary}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
