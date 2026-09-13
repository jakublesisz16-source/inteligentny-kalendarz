import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';

const require = createRequire(import.meta.url);
const { parseReceiptText } = require('../.benchmark-dist/src/shopping/receipt-ocr/receipt-parser.js');
const { reconstructReceiptTextFromGeometry, assessReceiptGeometryStructuredCandidate } = require('../.benchmark-dist/src/shopping/receipt-ocr/receipt-geometry-reconstruction.js');
const { planReceiptValueColumnRecovery, countUsableReceiptValueRecoveryTokens } = require('../.benchmark-dist/src/shopping/receipt-ocr/receipt-value-column-recovery.js');
const { evaluateReceiptBenchmarkCase, detectedReceiptFromParsed } = require('../.benchmark-dist/src/benchmarks/receipt-benchmark.js');
const { classifyGate2RecoveryTrigger, decideGate2LiveDecision, decideGate2ShadowSelection, evaluateGate2SelectedPathSafety } = require('../.benchmark-dist/src/benchmarks/receipt-gate2.js');

const root = process.cwd();
const gateRoot = path.join(root, '_PRIVATE_HISTORY', 'benchmarks', 'dev4a', 'gate2');
const b029aRoot = path.join(root, '_PRIVATE_HISTORY', 'benchmarks', 'b029a');
const outputDir = path.join(gateRoot, 'results');
const reportsDir = path.join(gateRoot, 'reports');
const manifestPath = path.join(gateRoot, 'manifest.json');
const b029aManifestPath = path.join(b029aRoot, 'manifest.json');
const acceptedB029aBaselinePath = path.join(b029aRoot, 'results', 'benchmark-results-before-gate1.json');

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));
const pct = (value) => value === undefined ? 'N/A' : `${(value * 100).toFixed(1)}%`;
const sha256 = async (filePath) => createHash('sha256').update(await readFile(filePath)).digest('hex');

function geometryEvaluation(geometry, benchmarkCase, groundTruth) {
  const reconstruction = reconstructReceiptTextFromGeometry(geometry);
  const parsed = parseReceiptText(reconstruction.text);
  const assessment = assessReceiptGeometryStructuredCandidate(reconstruction, parsed);
  const benchmark = evaluateReceiptBenchmarkCase(benchmarkCase, groundTruth, detectedReceiptFromParsed(parsed));
  const goods = parsed.declaredSubtotalMinor ?? parsed.detectedItemsTotalMinor;
  return { reconstruction, parsed, assessment, benchmark, goods };
}

function isCatastrophic(result, groundTruth) {
  const declared = groundTruth.goodsTotalMinor;
  if (!declared || declared <= 0) return false;
  return result.reconstruction.items.some((item) => {
    const amount = item.finalAmountMinor ?? item.grossBeforeDiscountMinor;
    return amount !== undefined && amount > declared * 4;
  });
}

function isCatastrophicDetected(benchmark, groundTruth) {
  const declared = groundTruth.goodsTotalMinor;
  if (!declared || declared <= 0) return false;
  return benchmark.detected.items.some((item) => item.finalAmountMinor !== undefined && item.finalAmountMinor > declared * 4);
}

function recoveredTokens(snapshot) {
  return snapshot.geometry?.tokens?.filter((token) => token.source === 'value-column-recovery') ?? [];
}

function localExpectedValues(groundTruth) {
  const values = [];
  let completeRoles = true;
  for (const item of groundTruth.items ?? []) {
    if (item.grossBeforeDiscountMinor !== undefined) {
      values.push(item.grossBeforeDiscountMinor);
      if (item.discountMinor !== undefined) values.push(-Math.abs(item.discountMinor));
      if (item.finalAmountMinor !== undefined) values.push(item.finalAmountMinor);
    } else if (item.finalAmountMinor !== undefined) {
      values.push(item.finalAmountMinor);
    } else {
      completeRoles = false;
    }
  }
  return { values, completeRoles };
}

function parseMoneyToken(text) {
  const normalized = String(text).replace(/[−–—]/gu, '-').replace(/\s+/gu, '').replace(',', '.');
  if (!/^-?\d{1,6}\.\d{2}$/u.test(normalized)) return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : undefined;
}

function recoveryCellPrecision(snapshot, groundTruth) {
  const { values, completeRoles } = localExpectedValues(groundTruth);
  if (!completeRoles) return undefined;
  const expected = new Map();
  for (const value of values) expected.set(value, (expected.get(value) ?? 0) + 1);
  const tokens = recoveredTokens(snapshot).map((token) => parseMoneyToken(token.text)).filter((value) => value !== undefined);
  if (!tokens.length) return undefined;
  let correct = 0;
  for (const value of tokens) {
    const left = expected.get(value) ?? 0;
    if (left > 0) {
      correct += 1;
      expected.set(value, left - 1);
    }
  }
  return { correct, total: tokens.length, precision: correct / tokens.length };
}

function setEquals(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function pageSetFromTokens(tokens) {
  return new Set((tokens ?? []).map((token) => Number(token.page ?? 1)));
}

function pageIsolationSafety(snapshot, primaryGeometry, mergedGeometry) {
  const primaryPages = pageSetFromTokens(primaryGeometry?.tokens);
  const mergedPrimaryPages = pageSetFromTokens((mergedGeometry?.tokens ?? []).filter((token) => token.source !== 'value-column-recovery'));
  const primaryCoverageComplete = setEquals(primaryPages, mergedPrimaryPages);
  const records = snapshot.valueRecovery?.pages ?? [];
  let mixedRecord = false;
  for (const record of records) {
    const expectedPage = Number(record.plan?.page ?? 1);
    for (const geometry of [record.primaryGeometry, record.geometry, record.usableGeometry, record.mergedGeometry]) {
      if (!geometry?.tokens?.length) continue;
      if (geometry.tokens.some((token) => Number(token.page ?? 1) !== expectedPage)) mixedRecord = true;
    }
  }
  const recoveryPages = pageSetFromTokens(recoveredTokens(snapshot));
  const usedPlanPages = new Set(records
    .filter((record) => Number(record.usableTokenCount ?? 0) > 0)
    .map((record) => Number(record.plan?.page ?? 1)));
  const recoveryPageCoverageConsistent = records.length === 0
    ? recoveryPages.size <= 1
    : setEquals(recoveryPages, usedPlanPages);
  return {
    primaryPages: [...primaryPages].sort((a, b) => a - b),
    mergedPrimaryPages: [...mergedPrimaryPages].sort((a, b) => a - b),
    recoveryPages: [...recoveryPages].sort((a, b) => a - b),
    usedPlanPages: [...usedPlanPages].sort((a, b) => a - b),
    primaryCoverageComplete,
    recoveryPageCoverageConsistent,
    pageMixing: mixedRecord || !recoveryPageCoverageConsistent,
    passed: primaryCoverageComplete && !mixedRecord && recoveryPageCoverageConsistent,
  };
}

function falseMonetaryItemCount(benchmark) {
  const matched = new Set(benchmark.matches.map((match) => match.detectedIndex));
  return benchmark.detected.items.filter((item, index) => item.finalAmountMinor !== undefined && !matched.has(index)).length;
}

function financialSafety(benchmark) {
  const metrics = benchmark.metrics;
  const checks = {
    goods: metrics.goodsCorrect,
    discounts: metrics.discountsCorrect,
    deposits: metrics.depositsCorrect,
    final: metrics.finalTotalCorrect,
    payment: metrics.paymentCorrect,
  };
  const known = Object.values(checks).filter((value) => value !== undefined);
  return { checks, passed: known.every(Boolean) };
}

function actualRecoveryPlans(snapshot, primaryGeometry, primaryReconstruction) {
  const plans = (snapshot.valueRecovery?.pages ?? [])
    .map((record) => record.plan)
    .filter(Boolean);
  if (plans.length) return plans;
  return [planReceiptValueColumnRecovery(primaryGeometry, primaryReconstruction)];
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  const manifest = await readJson(manifestPath);
  const b029aManifest = await readJson(b029aManifestPath);
  const acceptedB029aBaseline = await readJson(acceptedB029aBaselinePath);
  const cases = [];

  for (const entry of manifest.cases) {
    const snapshotPath = path.join(gateRoot, entry.snapshotFile);
    const groundTruthPath = path.join(gateRoot, entry.groundTruthFile);
    const groundTruth = await readJson(groundTruthPath);
    const benchmarkCase = b029aManifest.cases.find((candidate) => candidate.id === entry.id);
    if (!benchmarkCase) throw new Error(`Missing B029A case: ${entry.id}`);
    if (!existsSync(snapshotPath)) {
      cases.push({ id: entry.id, title: entry.title, layoutType: entry.layoutType, required: entry.required, captured: false, snapshotFile: entry.snapshotFile });
      continue;
    }
    const snapshot = await readJson(snapshotPath);
    if (snapshot.private !== true || snapshot.doNotPublish !== true || snapshot.productionEngineSnapshot !== true) throw new Error(`Invalid private production snapshot: ${entry.id}`);
    if (snapshot.provenance?.engine !== 'Tesseract.js' || snapshot.provenance?.source !== 'browser-live') throw new Error(`Invalid browser provenance: ${entry.id}`);
    const primaryGeometry = snapshot.primaryGeometry ?? snapshot.geometry;
    const mergedGeometry = snapshot.geometry;
    if (!primaryGeometry?.tokens?.length || !mergedGeometry?.tokens?.length) throw new Error(`Missing geometry evidence: ${entry.id}`);
    const primary = geometryEvaluation(primaryGeometry, benchmarkCase, groundTruth);
    const recovery = geometryEvaluation(mergedGeometry, benchmarkCase, groundTruth);
    const baselineGroundTruth = await readJson(path.join(b029aRoot, benchmarkCase.groundTruthFile));
    if (!isDeepStrictEqual(groundTruth, baselineGroundTruth)) throw new Error(`Gate2/B029A ground-truth drift: ${entry.id}`);
    const baselineRawText = await readFile(path.join(b029aRoot, benchmarkCase.rawOcrFile), 'utf8');
    const baselineParsed = parseReceiptText(baselineRawText);
    const baselineBenchmark = evaluateReceiptBenchmarkCase(benchmarkCase, baselineGroundTruth, detectedReceiptFromParsed(baselineParsed));
    const acceptedBaselineBenchmark = acceptedB029aBaseline.results.find((result) => result.caseId === entry.id);
    if (!acceptedBaselineBenchmark) throw new Error(`Missing accepted B029A baseline case: ${entry.id}`);
    const baselineEquivalent = isDeepStrictEqual(baselineBenchmark, acceptedBaselineBenchmark);
    const baselineFalseMonetaryItems = falseMonetaryItemCount(baselineBenchmark);
    const baselineFinancial = financialSafety(baselineBenchmark);
    const baselineCatastrophicMoney = isCatastrophicDetected(baselineBenchmark, baselineGroundTruth);
    const plans = actualRecoveryPlans(snapshot, primaryGeometry, primary.reconstruction);
    const triggered = Boolean(snapshot.valueRecovery?.attempted && Number(snapshot.valueRecovery?.passCount ?? 0) > 0);
    const used = Boolean(snapshot.valueRecovery?.used);
    const expectedItems = groundTruth.items?.length ?? 0;
    const primaryIncomplete = primary.reconstruction.completeItemCount < expectedItems || (primary.benchmark.metrics.itemAmountAccuracy ?? 0) < 1;
    const eligibleByProductionPlan = plans.some((plan) => plan.eligible === true);
    const needed = Boolean(eligibleByProductionPlan && primaryIncomplete);
    const triggerClass = classifyGate2RecoveryTrigger(needed, triggered);
    const criticalUnresolvedAfter = recovery.reconstruction.items.filter((item) => item.finalAmountMinor === undefined).length;
    const catastrophicMoney = isCatastrophic(recovery, groundTruth);
    const shadowSelection = decideGate2ShadowSelection({
      primaryCompleteItems: primary.reconstruction.completeItemCount,
      recoveryCompleteItems: recovery.reconstruction.completeItemCount,
      expectedItems,
      primaryAmountAccuracy: primary.benchmark.metrics.itemAmountAccuracy,
      recoveryAmountAccuracy: recovery.benchmark.metrics.itemAmountAccuracy,
      primaryCandidateAccepted: primary.assessment.accepted,
      recoveryCandidateAccepted: recovery.assessment.accepted,
      recoveryTriggered: triggered,
      catastrophicMoney,
      criticalUnresolvedAfter,
    });
    const cellPrecision = recoveryCellPrecision(snapshot, groundTruth);
    const recoveryTokenCount = recoveredTokens(snapshot).length;
    const usableRecoveryTokens = snapshot.valueRecovery?.pages
      ? snapshot.valueRecovery.pages.reduce((sum, page) => sum + Number(page.usableTokenCount ?? 0), 0)
      : countUsableReceiptValueRecoveryTokens({ ...mergedGeometry, tokens: recoveredTokens(snapshot) });
    const pageIsolation = pageIsolationSafety(snapshot, primaryGeometry, mergedGeometry);
    const falseMonetaryItems = falseMonetaryItemCount(recovery.benchmark);
    const financial = financialSafety(recovery.benchmark);
    const selectedRecovery = shadowSelection === 'SELECT_RECOVERY';
    const selectedFalseMonetaryItems = selectedRecovery ? falseMonetaryItems : baselineFalseMonetaryItems;
    const selectedFalseReconciled = selectedRecovery ? recovery.benchmark.metrics.falseReconciled : baselineBenchmark.metrics.falseReconciled;
    const selectedFinancial = selectedRecovery ? financial : baselineFinancial;
    const selectedCatastrophicMoney = selectedRecovery ? catastrophicMoney : baselineCatastrophicMoney;
    const selectedSafety = evaluateGate2SelectedPathSafety({
      shadowSelection,
      triggerClass,
      recoveryTriggered: triggered,
      recoveryCandidateAccepted: recovery.assessment.accepted,
      recoveryCatastrophicMoney: catastrophicMoney,
      criticalUnresolvedAfter,
      primaryCompleteItems: primary.reconstruction.completeItemCount,
      recoveryCompleteItems: recovery.reconstruction.completeItemCount,
      primaryAmountAccuracy: primary.benchmark.metrics.itemAmountAccuracy,
      recoveryAmountAccuracy: recovery.benchmark.metrics.itemAmountAccuracy,
      selectedCatastrophicMoney,
      selectedFalseMonetaryItems,
      selectedFalseReconciled,
      selectedFinancialPassed: selectedFinancial.passed,
      pageIsolationPassed: pageIsolation.passed,
      baselineEquivalent,
    });
    cases.push({
      id: entry.id,
      title: entry.title,
      layoutType: entry.layoutType,
      required: entry.required,
      captured: true,
      snapshotFile: entry.snapshotFile,
      snapshotSha256: await sha256(snapshotPath),
      provenance: snapshot.provenance,
      trigger: { needed, triggered, used, classification: triggerClass, eligibleByProductionPlan, plans },
      recovery: {
        passCount: Number(snapshot.valueRecovery?.passCount ?? 0),
        tokenCount: recoveryTokenCount,
        usableTokenCount: usableRecoveryTokens,
        cellPrecision,
      },
      primary: {
        itemGroups: primary.reconstruction.items.length,
        completeItems: primary.reconstruction.completeItemCount,
        unresolvedItems: primary.reconstruction.items.length - primary.reconstruction.completeItemCount,
        itemAmountAccuracy: primary.benchmark.metrics.itemAmountAccuracy,
        itemRecall: primary.benchmark.metrics.itemRecall,
        itemPrecision: primary.benchmark.metrics.itemPrecision,
        goods: primary.goods,
        candidateAccepted: primary.assessment.accepted,
      },
      baselinePrimary: {
        expectedItems: baselineBenchmark.expectedItemCount,
        detectedItems: baselineBenchmark.detected.items.length,
        itemAmountAccuracy: baselineBenchmark.metrics.itemAmountAccuracy,
        itemRecall: baselineBenchmark.metrics.itemRecall,
        itemPrecision: baselineBenchmark.metrics.itemPrecision,
        falseMonetaryItems: baselineFalseMonetaryItems,
        falseReconciled: baselineBenchmark.metrics.falseReconciled,
        catastrophicMoney: baselineCatastrophicMoney,
        financial: baselineFinancial,
        equivalentToAcceptedBaseline: baselineEquivalent,
        errors: baselineBenchmark.errors,
      },
      recoveryResult: {
        itemGroups: recovery.reconstruction.items.length,
        completeItems: recovery.reconstruction.completeItemCount,
        unresolvedItems: criticalUnresolvedAfter,
        itemAmountAccuracy: recovery.benchmark.metrics.itemAmountAccuracy,
        itemRecall: recovery.benchmark.metrics.itemRecall,
        itemPrecision: recovery.benchmark.metrics.itemPrecision,
        grossItemsTotalMinor: recovery.reconstruction.grossItemsTotalMinor,
        discountsTotalMinor: recovery.reconstruction.discountsTotalMinor,
        goods: recovery.goods,
        final: recovery.parsed.finalPayableMinor ?? recovery.parsed.declaredTotalMinor,
        payment: recovery.parsed.paymentTotalMinor,
        candidateAccepted: recovery.assessment.accepted,
        candidateRejectionReasons: recovery.assessment.rejectionReasons,
        catastrophicMoney,
        falseMonetaryItems,
        falseReconciled: recovery.benchmark.metrics.falseReconciled,
        financial,
      },
      pageIsolation,
      shadowSelection,
      selectedPath: {
        path: selectedSafety.selectedPath,
        falseMonetaryItems: selectedFalseMonetaryItems,
        falseReconciled: selectedFalseReconciled,
        catastrophicMoney: selectedCatastrophicMoney,
        financial: selectedFinancial,
        baselineRegression: selectedSafety.baselineRegression,
        recoveryNotWorse: selectedSafety.recoveryNotWorse,
        strictRecoverySafetyPassed: selectedSafety.strictRecoverySafetyPassed,
      },
    });
  }

  const captured = cases.filter((entry) => entry.captured);
  const required = cases.filter((entry) => entry.required);
  const requiredCaptured = required.filter((entry) => entry.captured);
  const triggerCounts = { TRUE_POSITIVE: 0, TRUE_NEGATIVE: 0, FALSE_POSITIVE: 0, FALSE_NEGATIVE: 0 };
  for (const entry of captured) triggerCounts[entry.trigger.classification] += 1;
  const precisionCases = captured.map((entry) => entry.recovery?.cellPrecision).filter(Boolean);
  const precisionCorrect = precisionCases.reduce((sum, entry) => sum + entry.correct, 0);
  const precisionTotal = precisionCases.reduce((sum, entry) => sum + entry.total, 0);
  const recoveryPrecision = precisionTotal ? precisionCorrect / precisionTotal : undefined;
  const allRequiredCaptured = requiredCaptured.length === required.length;
  const selectedCatastrophicMoneyCases = captured.filter((entry) => entry.selectedPath.catastrophicMoney).length;
  const selectedFalseMonetaryItems = captured.reduce((sum, entry) => sum + entry.selectedPath.falseMonetaryItems, 0);
  const selectedFalseReconciledCases = captured.filter((entry) => entry.selectedPath.falseReconciled).length;
  const pageIsolationFailures = captured.filter((entry) => !entry.pageIsolation.passed).length;
  const baselineRegressionCases = captured.filter((entry) => entry.selectedPath.baselineRegression).length;
  const selectedRecoverySafetyFailures = captured.filter((entry) => entry.selectedPath.path === 'RECOVERY' && !entry.selectedPath.strictRecoverySafetyPassed).length;
  const selectedFinancialMismatchCases = captured.filter((entry) => !entry.selectedPath.financial.passed).length;
  const unusedGeometryFalseMonetaryItems = captured
    .filter((entry) => entry.selectedPath.path === 'PRIMARY')
    .reduce((sum, entry) => sum + entry.recoveryResult.falseMonetaryItems, 0);
  const unusedGeometryFinancialMismatchCases = captured
    .filter((entry) => entry.selectedPath.path === 'PRIMARY' && !entry.recoveryResult.financial.passed).length;
  const decision = decideGate2LiveDecision({
    allRequiredCaptured,
    falsePositiveTriggers: triggerCounts.FALSE_POSITIVE,
    falseNegativeTriggers: triggerCounts.FALSE_NEGATIVE,
    selectedCatastrophicMoneyCases,
    selectedFalseMonetaryItems,
    selectedFalseReconciledCases,
    pageIsolationFailures,
    baselineRegressionCases,
    selectedRecoverySafetyFailures,
    recoveryPrecision,
  });
  const output = {
    private: true,
    doNotPublish: true,
    gate: 'DEV4-A-GATE2-FIX4',
    generatedAt: new Date().toISOString(),
    acceptedB029aBaseline: {
      sourceFile: path.relative(root, acceptedB029aBaselinePath),
      sha256: await sha256(acceptedB029aBaselinePath),
      metricsFingerprint: acceptedB029aBaseline.metricsFingerprint,
    },
    coverage: { requiredCases: required.length, capturedRequiredCases: requiredCaptured.length, capturedCases: captured.length },
    triggerCounts,
    recoveryPrecision,
    safety: {
      selectedCatastrophicMoneyCases,
      selectedFalseMonetaryItems,
      selectedFalseReconciledCases,
      pageIsolationFailures,
      baselineRegressionCases,
      selectedRecoverySafetyFailures,
      selectedFinancialMismatchCases,
      unusedGeometryFalseMonetaryItems,
      unusedGeometryFinancialMismatchCases,
    },
    cases,
    productionGeometrySelected: false,
    decision,
    finalGateStatus: decision === 'LIVE_PASS' ? 'WINDOWS_TECHNICAL_GATE_AND_B029A_REVALIDATION_REQUIRED' : 'NOT_READY',
    next: decision === 'LIVE_PASS'
      ? 'RUN COMPLETE WINDOWS TECHNICAL GATE + B029A BEFORE DEV4-A-GATE3'
      : decision === 'LIVE_GATE_REQUIRED'
        ? 'CAPTURE MISSING LIVE GATE2 SNAPSHOTS'
        : 'INVESTIGATE GATE2 SELECTED-PATH SAFETY FAILURE - DO NOT ENABLE PRODUCTION GEOMETRY',
  };
  await writeFile(path.join(outputDir, 'dev4a-gate2-results.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  const lines = [
    '# DEV4-A-GATE2-FIX4 selected-path + baseline-relative live A/B validation',
    '',
    'PRIVATE - DO NOT PUBLISH',
    '',
    `Required live coverage: ${requiredCaptured.length}/${required.length}`,
    `Live decision: ${decision}`,
    `Recovery precision (where local-role GT is complete): ${pct(recoveryPrecision)}`,
    `Trigger TP/TN/FP/FN: ${triggerCounts.TRUE_POSITIVE}/${triggerCounts.TRUE_NEGATIVE}/${triggerCounts.FALSE_POSITIVE}/${triggerCounts.FALSE_NEGATIVE}`,
    `Production geometry selected: NO`,
    `Accepted B029A fingerprint: ${acceptedB029aBaseline.metricsFingerprint}`,
    '',
    '| Receipt | Layout | Trigger | Primary geom | Recovery geom | Geometry financial | Geometry false money | Candidate | Shadow | Selected path | Selected financial | Selected false money | Baseline regression | Page isolation |',
    '| --- | --- | --- | ---: | ---: | --- | ---: | --- | --- | --- | --- | ---: | --- | --- |',
    ...cases.map((entry) => entry.captured
      ? `| ${entry.id} | ${entry.layoutType} | ${entry.trigger.classification} | ${entry.primary.completeItems}/${entry.primary.itemGroups} | ${entry.recoveryResult.completeItems}/${entry.recoveryResult.itemGroups} | ${entry.recoveryResult.financial.passed ? 'PASS' : 'FAIL'} | ${entry.recoveryResult.falseMonetaryItems} | ${entry.recoveryResult.candidateAccepted ? 'ACCEPTED' : 'REJECTED'} | ${entry.shadowSelection} | ${entry.selectedPath.path} | ${entry.selectedPath.financial.passed ? 'PASS' : 'KNOWN BASELINE FAIL'} | ${entry.selectedPath.falseMonetaryItems} | ${entry.selectedPath.baselineRegression ? 'FAIL' : 'PASS'} | ${entry.pageIsolation.passed ? 'PASS' : 'FAIL'} |`
      : `| ${entry.id} | ${entry.layoutType} | CAPTURE REQUIRED | - | - | - | - | - | - | - | - | - | - | - |`),
    '',
    '## Selected-path safety',
    `- selected-path catastrophic-money cases: ${selectedCatastrophicMoneyCases}`,
    `- selected-path false monetary items: ${selectedFalseMonetaryItems}`,
    `- selected-path false reconciliation (false Zgodne) cases: ${selectedFalseReconciledCases}`,
    `- baseline regression cases: ${baselineRegressionCases}`,
    `- selected recovery strict-safety failures: ${selectedRecoverySafetyFailures}`,
    `- false-positive recovery triggers: ${triggerCounts.FALSE_POSITIVE}`,
    `- false-negative recovery triggers: ${triggerCounts.FALSE_NEGATIVE}`,
    `- page-isolation / primary-coverage failures: ${pageIsolationFailures}`,
    `- selected-path financial mismatch cases (diagnostic; accepted baseline mismatches do not fail KEEP_PRIMARY): ${selectedFinancialMismatchCases}`,
    '',
    '## Unused geometry diagnostics',
    `- false monetary items in unused KEEP_PRIMARY geometry candidates: ${unusedGeometryFalseMonetaryItems}`,
    `- financial mismatches in unused KEEP_PRIMARY geometry candidates: ${unusedGeometryFinancialMismatchCases}`,
    '- these diagnostics remain visible but do not feed LIVE_PASS/LIVE_FAIL unless recovery is actually selected.',
    '',
    '- production geometry selection remains disabled.',
    '- receipt totals are validation-only and are not used to repair item values.',
    '',
    '## Final-gate rule',
    '- `LIVE_PASS` is not the final DEV4-A-GATE2 PASS. The complete Windows technical gate and unchanged B029A baseline must also pass before DEV4-A-GATE3.',
    '',
    '## Next',
    decision === 'LIVE_PASS'
      ? '- Run the complete Windows technical gate and B029A/geometry benchmarks. Only after those are green may DEV4-A-GATE3 start.'
      : decision === 'LIVE_GATE_REQUIRED'
        ? '- Capture the missing browser snapshots with the exact source files in the Gate2 folders, then rerun `npm run benchmark:receipts:gate2`.'
        : '- Stop. Investigate the selected-path or baseline-regression safety failure. Do not enable production geometry selection.',
    '',
  ];
  await writeFile(path.join(reportsDir, 'DEV4A_GATE2_MULTI_RECEIPT_AB_AUDIT.md'), `${lines.join('\n')}\n`, 'utf8');
  process.stdout.write(`${lines.join('\n')}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
