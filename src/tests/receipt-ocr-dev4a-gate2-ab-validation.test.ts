import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ReceiptOcrGeometry } from '../shopping/receipt-ocr/receipt-ocr.types';
import { reconstructReceiptTextFromGeometry, assessReceiptGeometryStructuredCandidate } from '../shopping/receipt-ocr/receipt-geometry-reconstruction';
import { planReceiptValueColumnRecovery } from '../shopping/receipt-ocr/receipt-value-column-recovery';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';
import { classifyGate2RecoveryTrigger, decideGate2LiveDecision, decideGate2ShadowSelection, evaluateGate2SelectedPathSafety } from '../benchmarks/receipt-gate2';

const cleanSnapshot = JSON.parse(readFileSync(
  new URL('../../_PRIVATE_HISTORY/benchmarks/dev4a/gate2/biedronka-clean/browser-gate2.json', import.meta.url),
  'utf8',
)) as {
  private: boolean;
  doNotPublish: boolean;
  productionEngineSnapshot: boolean;
  provenance: { engine: string; source: string; tokenCount: number; mergedTokenCount: number };
  primaryGeometry: ReceiptOcrGeometry;
  geometry: ReceiptOcrGeometry;
  valueRecovery: { attempted: boolean; passCount: number; used: boolean };
};

const flowSource = readFileSync(new URL('../shopping/receipt-ocr/ReceiptScanFlow.tsx', import.meta.url), 'utf8');

describe('DEV4-A-GATE2 multi-receipt A/B validation harness', () => {
  it('archives the real browser RECOVERY1 proof as the first immutable Gate2 live case', () => {
    expect(cleanSnapshot.private).toBe(true);
    expect(cleanSnapshot.doNotPublish).toBe(true);
    expect(cleanSnapshot.productionEngineSnapshot).toBe(true);
    expect(cleanSnapshot.provenance.engine).toBe('Tesseract.js');
    expect(cleanSnapshot.provenance.source).toBe('browser-live');
    expect(cleanSnapshot.provenance.tokenCount).toBe(185);
    expect(cleanSnapshot.provenance.mergedTokenCount).toBe(202);
    expect(cleanSnapshot.valueRecovery).toMatchObject({ attempted: true, passCount: 1, used: true });
  });

  it('replays clean columnar primary vs recovery without changing the original OCR pass', () => {
    const primary = reconstructReceiptTextFromGeometry(cleanSnapshot.primaryGeometry);
    const recovery = reconstructReceiptTextFromGeometry(cleanSnapshot.geometry);
    const primaryParsed = parseReceiptText(primary.text);
    const recoveryParsed = parseReceiptText(recovery.text);
    expect(primary.items).toHaveLength(11);
    expect(primary.completeItemCount).toBe(7);
    expect(recovery.items).toHaveLength(11);
    expect(recovery.completeItemCount).toBe(11);
    expect(recovery.grossItemsTotalMinor).toBe(10466);
    expect(recovery.discountsTotalMinor).toBe(-1624);
    expect(recovery.itemsTotalMinor).toBe(8842);
    expect(recoveryParsed.depositTotalMinor).toBe(250);
    expect(recoveryParsed.finalPayableMinor).toBe(9092);
    expect(recoveryParsed.paymentTotalMinor).toBe(9092);
    expect(assessReceiptGeometryStructuredCandidate(primary, primaryParsed).accepted).toBe(false);
    expect(assessReceiptGeometryStructuredCandidate(recovery, recoveryParsed).accepted).toBe(true);
  });

  it('classifies the clean case as a true-positive conditional recovery trigger', () => {
    const primary = reconstructReceiptTextFromGeometry(cleanSnapshot.primaryGeometry);
    const plan = planReceiptValueColumnRecovery(cleanSnapshot.primaryGeometry, primary);
    expect(plan.eligible).toBe(true);
    expect(classifyGate2RecoveryTrigger(true, cleanSnapshot.valueRecovery.attempted)).toBe('TRUE_POSITIVE');
  });

  it('keeps a negative-control trigger classification explicit', () => {
    expect(classifyGate2RecoveryTrigger(false, false)).toBe('TRUE_NEGATIVE');
    expect(classifyGate2RecoveryTrigger(false, true)).toBe('FALSE_POSITIVE');
    expect(classifyGate2RecoveryTrigger(true, false)).toBe('FALSE_NEGATIVE');
  });

  it('shadow-selects recovery only when it is accepted, safer and materially better', () => {
    expect(decideGate2ShadowSelection({
      primaryCompleteItems: 7,
      recoveryCompleteItems: 11,
      expectedItems: 11,
      primaryAmountAccuracy: 0.6,
      recoveryAmountAccuracy: 1,
      primaryCandidateAccepted: false,
      recoveryCandidateAccepted: true,
      recoveryTriggered: true,
      catastrophicMoney: false,
      criticalUnresolvedAfter: 0,
    })).toBe('SELECT_RECOVERY');
    expect(decideGate2ShadowSelection({
      primaryCompleteItems: 4,
      recoveryCompleteItems: 4,
      expectedItems: 4,
      primaryAmountAccuracy: 1,
      recoveryAmountAccuracy: 1,
      primaryCandidateAccepted: true,
      recoveryCandidateAccepted: true,
      recoveryTriggered: false,
      catastrophicMoney: false,
      criticalUnresolvedAfter: 0,
    })).toBe('KEEP_PRIMARY');
  });


  it('evaluates safety on the selected path and keeps unsafe unused geometry diagnostic-only', () => {
    const keepPrimary = evaluateGate2SelectedPathSafety({
      shadowSelection: 'KEEP_PRIMARY',
      triggerClass: 'TRUE_NEGATIVE',
      recoveryTriggered: false,
      recoveryCandidateAccepted: true,
      recoveryCatastrophicMoney: true,
      criticalUnresolvedAfter: 3,
      primaryCompleteItems: 9,
      recoveryCompleteItems: 12,
      primaryAmountAccuracy: 1,
      recoveryAmountAccuracy: 0.4,
      selectedCatastrophicMoney: false,
      selectedFalseMonetaryItems: 0,
      selectedFalseReconciled: false,
      selectedFinancialPassed: false,
      pageIsolationPassed: true,
      baselineEquivalent: true,
    });
    expect(keepPrimary).toMatchObject({
      selectedPath: 'PRIMARY',
      baselineRegression: false,
      strictRecoverySafetyPassed: true,
    });
  });

  it('fails strict safety when the same unsafe geometry would actually be selected', () => {
    const selectedRecovery = evaluateGate2SelectedPathSafety({
      shadowSelection: 'SELECT_RECOVERY',
      triggerClass: 'TRUE_POSITIVE',
      recoveryTriggered: true,
      recoveryCandidateAccepted: true,
      recoveryCatastrophicMoney: true,
      criticalUnresolvedAfter: 0,
      primaryCompleteItems: 7,
      recoveryCompleteItems: 11,
      primaryAmountAccuracy: 0.6,
      recoveryAmountAccuracy: 1,
      selectedCatastrophicMoney: true,
      selectedFalseMonetaryItems: 2,
      selectedFalseReconciled: false,
      selectedFinancialPassed: false,
      pageIsolationPassed: true,
      baselineEquivalent: true,
    });
    expect(selectedRecovery.selectedPath).toBe('RECOVERY');
    expect(selectedRecovery.strictRecoverySafetyPassed).toBe(false);
  });

  it('treats primary drift from the accepted B029A result as a blocking baseline regression', () => {
    const selected = evaluateGate2SelectedPathSafety({
      shadowSelection: 'KEEP_PRIMARY',
      triggerClass: 'TRUE_NEGATIVE',
      recoveryTriggered: false,
      recoveryCandidateAccepted: false,
      recoveryCatastrophicMoney: false,
      criticalUnresolvedAfter: 0,
      primaryCompleteItems: 4,
      recoveryCompleteItems: 4,
      primaryAmountAccuracy: 1,
      recoveryAmountAccuracy: 1,
      selectedCatastrophicMoney: false,
      selectedFalseMonetaryItems: 0,
      selectedFalseReconciled: false,
      selectedFinancialPassed: true,
      pageIsolationPassed: true,
      baselineEquivalent: false,
    });
    expect(selected.baselineRegression).toBe(true);
  });

  it('refuses a live PASS for trigger, selected-path, baseline, page-isolation or precision failures', () => {
    const safe = {
      allRequiredCaptured: true,
      falsePositiveTriggers: 0,
      falseNegativeTriggers: 0,
      selectedCatastrophicMoneyCases: 0,
      selectedFalseMonetaryItems: 0,
      selectedFalseReconciledCases: 0,
      pageIsolationFailures: 0,
      baselineRegressionCases: 0,
      selectedRecoverySafetyFailures: 0,
      recoveryPrecision: 0.95,
    } as const;
    expect(decideGate2LiveDecision(safe)).toBe('LIVE_PASS');
    expect(decideGate2LiveDecision({ ...safe, allRequiredCaptured: false })).toBe('LIVE_GATE_REQUIRED');
    expect(decideGate2LiveDecision({ ...safe, falseNegativeTriggers: 1 })).toBe('LIVE_FAIL');
    expect(decideGate2LiveDecision({ ...safe, falsePositiveTriggers: 1 })).toBe('LIVE_FAIL');
    expect(decideGate2LiveDecision({ ...safe, selectedCatastrophicMoneyCases: 1 })).toBe('LIVE_FAIL');
    expect(decideGate2LiveDecision({ ...safe, selectedFalseMonetaryItems: 1 })).toBe('LIVE_FAIL');
    expect(decideGate2LiveDecision({ ...safe, selectedFalseReconciledCases: 1 })).toBe('LIVE_FAIL');
    expect(decideGate2LiveDecision({ ...safe, pageIsolationFailures: 1 })).toBe('LIVE_FAIL');
    expect(decideGate2LiveDecision({ ...safe, baselineRegressionCases: 1 })).toBe('LIVE_FAIL');
    expect(decideGate2LiveDecision({ ...safe, selectedRecoverySafetyFailures: 1 })).toBe('LIVE_FAIL');
    expect(decideGate2LiveDecision({ ...safe, recoveryPrecision: 0.949 })).toBe('LIVE_FAIL');
  });

  it('keeps a complete per-page primary geometry snapshot for multipage A/B replay', () => {
    expect(flowSource).toContain('combineReceiptPrimaryGeometryForSnapshot(valueColumnRecoveryRecords, selectedGeometry)');
    expect(flowSource).not.toContain('valueColumnRecoveryRecords.find((record) => record.primaryGeometry)?.primaryGeometry');
  });

  it('keeps Gate2 shadow logic independent after production selector integration', () => {
    expect(flowSource).toContain('decideReceiptGeometryProductionSelection');
    expect(flowSource).toContain("geometrySelection.decision !== 'KEEP_PRIMARY'");
    expect(flowSource).toContain('parsedBeforeMerchantRecovery = primaryParsedForGeometrySelection');
  });
});
