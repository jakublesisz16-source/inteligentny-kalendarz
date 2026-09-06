import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ParsedReceiptDraft, ReceiptOcrGeometry } from '../shopping/receipt-ocr/receipt-ocr.types';
import type { ReceiptValueColumnRecoveryPlan } from '../shopping/receipt-ocr/receipt-value-column-recovery';
import {
  applySelectedReceiptGeometryItems,
  decideReceiptGeometryProductionSelection,
  preservesReceiptPrimaryMetadata,
  type ReceiptGeometryProductionSelectionInput,
} from '../shopping/receipt-ocr/receipt-geometry-production-selector';
import {
  assessReceiptGeometryStructuredCandidate,
  reconstructReceiptTextFromGeometry,
} from '../shopping/receipt-ocr/receipt-geometry-reconstruction';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

const cleanSnapshot = JSON.parse(readFileSync(
  new URL('../../_PRIVATE_HISTORY/benchmarks/dev4a/gate2/biedronka-clean/browser-gate2.json', import.meta.url),
  'utf8',
)) as {
  primaryGeometry: ReceiptOcrGeometry;
  geometry: ReceiptOcrGeometry;
  valueRecovery: {
    attempted: boolean;
    passCount: number;
    used: boolean;
    pages: Array<{
      plan: ReceiptValueColumnRecoveryPlan;
      usableTokenCount: number;
      delta?: {
        completeBefore: number;
        completeAfter: number;
        unresolvedBefore: number;
        unresolvedAfter: number;
        recoveredGrossCells: number;
        recoveredDiscountCells: number;
        recoveredNetCells: number;
        recoveredCompleteGroups: number;
      };
    }>;
  };
};

const cleanPrimaryText = readFileSync(
  new URL('../../_PRIVATE_HISTORY/benchmarks/b029a/raw-ocr/biedronka-clean-columnar.txt', import.meta.url),
  'utf8',
);

function validInput(): ReceiptGeometryProductionSelectionInput {
  const reconstruction = reconstructReceiptTextFromGeometry(cleanSnapshot.geometry);
  const geometryCandidate = parseReceiptText(reconstruction.text);
  return {
    primary: parseReceiptText(cleanPrimaryText),
    geometryCandidate,
    reconstruction,
    structuredAssessment: assessReceiptGeometryStructuredCandidate(reconstruction, geometryCandidate),
    recovery: {
      attempted: cleanSnapshot.valueRecovery.attempted,
      passCount: cleanSnapshot.valueRecovery.passCount,
      used: cleanSnapshot.valueRecovery.used,
      eligiblePlanCount: cleanSnapshot.valueRecovery.pages.filter((entry) => entry.plan.eligible).length,
      usableTokenCount: cleanSnapshot.valueRecovery.pages.reduce((sum, entry) => sum + entry.usableTokenCount, 0),
      recoveryTokenCount: cleanSnapshot.geometry.tokens.filter((token) => token.source === 'value-column-recovery').length,
      deltas: cleanSnapshot.valueRecovery.pages.flatMap((entry) => entry.delta ? [entry.delta] : []),
      plans: cleanSnapshot.valueRecovery.pages.map((entry) => entry.plan),
    },
  };
}

function cloneParsed(parsed: ParsedReceiptDraft): ParsedReceiptDraft {
  return {
    ...parsed,
    items: parsed.items.map((item) => ({ ...item, warnings: [...item.warnings] })),
    adjustments: parsed.adjustments.map((adjustment) => ({ ...adjustment })),
    warnings: parsed.warnings.map((warning) => ({ ...warning })),
  };
}

describe('DEV4-A-GATE3 runtime-only production geometry selector', () => {
  it('selects the validated live recovery case using runtime evidence only', () => {
    const selected = decideReceiptGeometryProductionSelection(validInput());
    expect(selected).toMatchObject({
      decision: 'SELECT_RECOVERY',
      reason: 'selected-recovery',
      primaryItemCount: 1,
      geometryItemCount: 11,
      completeBefore: 7,
      completeAfter: 11,
      recoveredCompleteGroups: 4,
      financiallyConsistent: true,
    });
  });

  it('keeps primary when recovery was not triggered', () => {
    const input = validInput();
    input.recovery = { ...input.recovery, attempted: false, passCount: 0, used: false };
    expect(decideReceiptGeometryProductionSelection(input).decision).toBe('KEEP_PRIMARY');
  });

  it('keeps primary when the structured candidate is rejected', () => {
    const input = validInput();
    input.structuredAssessment = { ...input.structuredAssessment!, accepted: false, rejectionReasons: ['low-completeness'] };
    expect(decideReceiptGeometryProductionSelection(input).decision).toBe('KEEP_PRIMARY');
  });

  it('keeps primary when recovery does not materially improve completeness', () => {
    const input = validInput();
    input.recovery = {
      ...input.recovery,
      deltas: input.recovery.deltas.map((delta) => ({ ...delta, completeAfter: delta.completeBefore, recoveredCompleteGroups: 0 })),
    };
    expect(decideReceiptGeometryProductionSelection(input).decision).toBe('KEEP_PRIMARY');
  });

  it('keeps primary when completeness regresses', () => {
    const input = validInput();
    input.recovery = {
      ...input.recovery,
      deltas: input.recovery.deltas.map((delta) => ({ ...delta, completeAfter: delta.completeBefore - 1 })),
    };
    expect(decideReceiptGeometryProductionSelection(input).decision).toBe('KEEP_PRIMARY');
  });

  it('keeps primary when unresolved rows remain after recovery', () => {
    const input = validInput();
    input.recovery = {
      ...input.recovery,
      deltas: input.recovery.deltas.map((delta) => ({ ...delta, unresolvedAfter: 1 })),
    };
    expect(decideReceiptGeometryProductionSelection(input).decision).toBe('KEEP_PRIMARY');
  });

  it('keeps primary for quantity-unresolved geometry evidence', () => {
    const input = validInput();
    input.reconstruction = {
      ...input.reconstruction!,
      items: input.reconstruction!.items.map((item, index) => index === 0 ? { ...item, unresolvedReason: 'quantity-unresolved' } : item),
    };
    expect(decideReceiptGeometryProductionSelection(input).decision).toBe('KEEP_PRIMARY');
  });

  it('keeps primary when a selected geometry item has no positive final amount', () => {
    const input = validInput();
    input.geometryCandidate = cloneParsed(input.geometryCandidate!);
    delete input.geometryCandidate.items[0]!.amountMinor;
    expect(decideReceiptGeometryProductionSelection(input).decision).toBe('KEEP_PRIMARY');
  });

  it('keeps primary on independent footer financial mismatch', () => {
    const input = validInput();
    input.primary = { ...input.primary!, declaredTotalMinor: 20000, finalPayableMinor: 20000, paymentTotalMinor: 20000 };
    delete input.primary.ocrSubtotalMinor;
    expect(decideReceiptGeometryProductionSelection(input)).toMatchObject({ decision: 'KEEP_PRIMARY', reason: 'financial-mismatch' });
  });

  it('keeps primary when geometry does not improve the primary item count', () => {
    const input = validInput();
    input.primary = cloneParsed(input.geometryCandidate!);
    expect(decideReceiptGeometryProductionSelection(input)).toMatchObject({ decision: 'KEEP_PRIMARY', reason: 'candidate-not-better' });
  });

  it('is merchant-agnostic and does not use store identity to select recovery', () => {
    const first = validInput();
    first.primary = { ...first.primary!, merchant: 'Sklep Alfa' };
    first.geometryCandidate = { ...first.geometryCandidate!, merchant: 'Inny nagłówek' };
    const second = validInput();
    second.primary = { ...second.primary!, merchant: 'Dowolny Sprzedawca' };
    second.geometryCandidate = { ...second.geometryCandidate!, merchant: 'Jeszcze Inny' };
    expect(decideReceiptGeometryProductionSelection(first).decision).toBe('SELECT_RECOVERY');
    expect(decideReceiptGeometryProductionSelection(second).decision).toBe('SELECT_RECOVERY');
  });
});

describe('DEV4-A-GATE3 item-only merge', () => {
  it('replaces only the validated item block and preserves primary header/footer metadata', () => {
    const input = validInput();
    const primary = input.primary!;
    const geometry = input.geometryCandidate!;
    const merged = applySelectedReceiptGeometryItems(primary, geometry);

    expect(merged.items).toHaveLength(11);
    expect(merged.detectedItemsTotalMinor).toBe(8842);
    expect(merged.merchant).toBe(primary.merchant);
    expect(merged.merchantConfidence).toBe(primary.merchantConfidence);
    expect(merged.date).toBe(primary.date);
    expect(merged.dateConfidence).toBe(primary.dateConfidence);
    expect(merged.declaredTotalMinor).toBe(primary.declaredTotalMinor);
    expect(merged.finalPayableMinor).toBe(primary.finalPayableMinor);
    expect(merged.paymentTotalMinor).toBe(primary.paymentTotalMinor);
    expect(merged.depositTotalMinor).toBe(primary.depositTotalMinor);
    expect(merged.ocrSubtotalMinor).toBe(primary.ocrSubtotalMinor);
    expect(merged.adjustments).toEqual(primary.adjustments);
    expect(merged.declaredSubtotalMinor).toBe(8842);
    expect(merged.unexplainedDifferenceMinor).toBe(0);
    expect(preservesReceiptPrimaryMetadata(primary, merged)).toBe(true);
  });

  it('does not copy geometry-only merchant, date, footer or category suggestions', () => {
    const input = validInput();
    const primary = { ...input.primary!, merchant: 'PRIMARY SHOP', date: '2026-08-04' };
    const geometry = cloneParsed(input.geometryCandidate!);
    geometry.merchant = 'GEOMETRY SHOP';
    geometry.date = '1999-01-01';
    geometry.declaredTotalMinor = 1;
    geometry.finalPayableMinor = 2;
    geometry.paymentTotalMinor = 3;
    geometry.depositTotalMinor = 4;
    geometry.items[0]!.suggestedCategoryId = 'geometry-only-category';

    const merged = applySelectedReceiptGeometryItems(primary, geometry);
    expect(merged.merchant).toBe('PRIMARY SHOP');
    expect(merged.date).toBe('2026-08-04');
    expect(merged.declaredTotalMinor).toBe(primary.declaredTotalMinor);
    expect(merged.finalPayableMinor).toBe(primary.finalPayableMinor);
    expect(merged.paymentTotalMinor).toBe(primary.paymentTotalMinor);
    expect(merged.depositTotalMinor).toBe(primary.depositTotalMinor);
    expect(merged.items[0]!.suggestedCategoryId).toBeUndefined();
  });
});
