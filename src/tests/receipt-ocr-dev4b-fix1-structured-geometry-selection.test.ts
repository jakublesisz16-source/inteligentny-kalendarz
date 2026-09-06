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
  type ReceiptGeometryReconstructionResult,
} from '../shopping/receipt-ocr/receipt-geometry-reconstruction';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

const snapshot = JSON.parse(readFileSync(
  new URL('../../_PRIVATE_HISTORY/benchmarks/dev4b/fix1/structured-geometry-consensus/browser-live.json', import.meta.url),
  'utf8',
)) as {
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

const rawOcr = readFileSync(
  new URL('../../_PRIVATE_HISTORY/benchmarks/dev4b/fix1/structured-geometry-consensus/raw-ocr.txt', import.meta.url),
  'utf8',
);

function cloneParsed(parsed: ParsedReceiptDraft): ParsedReceiptDraft {
  return {
    ...parsed,
    items: parsed.items.map((item) => ({ ...item, warnings: [...item.warnings] })),
    adjustments: parsed.adjustments.map((adjustment) => ({ ...adjustment })),
    warnings: parsed.warnings.map((warning) => ({ ...warning })),
  };
}

function cloneReconstruction(reconstruction: ReceiptGeometryReconstructionResult): ReceiptGeometryReconstructionResult {
  return {
    ...reconstruction,
    rows: reconstruction.rows.map((row) => ({ ...row, tokens: [...row.tokens] })),
    items: reconstruction.items.map((item) => ({
      ...item,
      sourceRowIndices: [...item.sourceRowIndices],
      evidence: [...item.evidence],
    })),
    rejectedRows: reconstruction.rejectedRows.map((row) => ({ ...row })),
  };
}

function structuredInput(): ReceiptGeometryProductionSelectionInput {
  const reconstruction = reconstructReceiptTextFromGeometry(snapshot.geometry);
  const geometryCandidate = parseReceiptText(reconstruction.text);
  return {
    primary: parseReceiptText(rawOcr),
    geometryCandidate,
    reconstruction,
    structuredAssessment: assessReceiptGeometryStructuredCandidate(reconstruction, geometryCandidate),
    recovery: {
      attempted: snapshot.valueRecovery.attempted,
      passCount: snapshot.valueRecovery.passCount,
      used: snapshot.valueRecovery.used,
      eligiblePlanCount: snapshot.valueRecovery.pages.filter((entry) => entry.plan.eligible).length,
      usableTokenCount: snapshot.valueRecovery.pages.reduce((sum, entry) => sum + entry.usableTokenCount, 0),
      recoveryTokenCount: snapshot.geometry.tokens.filter((token) => token.source === 'value-column-recovery').length,
      deltas: snapshot.valueRecovery.pages.flatMap((entry) => entry.delta ? [entry.delta] : []),
      plans: snapshot.valueRecovery.pages.map((entry) => entry.plan),
    },
  };
}

describe('DEV4-B-FIX1 structured geometry consensus selector', () => {
  it('selects the confirmed 27.08 browser-live case without a recovery OCR pass', () => {
    const input = structuredInput();
    expect(input.primary?.items).toHaveLength(0);
    expect(input.geometryCandidate?.items).toHaveLength(12);
    expect(input.reconstruction).toMatchObject({
      completeItemCount: 12,
      grossItemsTotalMinor: 5258,
      discountsTotalMinor: -1136,
      itemsTotalMinor: 4122,
    });
    expect(decideReceiptGeometryProductionSelection(input)).toMatchObject({
      decision: 'SELECT_STRUCTURED_GEOMETRY',
      reason: 'selected-structured-geometry',
      primaryItemCount: 0,
      geometryItemCount: 12,
      financiallyConsistent: true,
    });
  });

  it('keeps primary when the structured candidate is rejected', () => {
    const input = structuredInput();
    input.structuredAssessment = { ...input.structuredAssessment!, accepted: false, rejectionReasons: ['low-completeness'] };
    expect(decideReceiptGeometryProductionSelection(input)).toMatchObject({ decision: 'KEEP_PRIMARY', reason: 'candidate-rejected' });
  });

  it('keeps primary when value coverage is not complete and no recovery was run', () => {
    const input = structuredInput();
    input.recovery = {
      ...input.recovery,
      plans: input.recovery.plans.map((plan, index) => index === 0 ? {
        ...plan,
        primaryExplicitValueItemCount: Math.max(0, plan.itemGroupCount - 1),
        primaryMissingValueItemCount: 1,
        primaryValueCoverageRatio: plan.itemGroupCount ? (plan.itemGroupCount - 1) / plan.itemGroupCount : 0,
      } : plan),
    };
    expect(decideReceiptGeometryProductionSelection(input)).toMatchObject({ decision: 'KEEP_PRIMARY', reason: 'recovery-not-attempted' });
  });

  it('keeps primary when an unresolved item remains', () => {
    const input = structuredInput();
    input.reconstruction = cloneReconstruction(input.reconstruction!);
    delete input.reconstruction.items[0]!.finalAmountMinor;
    expect(decideReceiptGeometryProductionSelection(input)).toMatchObject({ decision: 'KEEP_PRIMARY', reason: 'candidate-unresolved' });
  });

  it('keeps primary when quantity is unresolved', () => {
    const input = structuredInput();
    input.reconstruction = cloneReconstruction(input.reconstruction!);
    input.reconstruction.items[0]!.unresolvedReason = 'quantity-unresolved';
    expect(decideReceiptGeometryProductionSelection(input)).toMatchObject({ decision: 'KEEP_PRIMARY', reason: 'candidate-quantity-unresolved' });
  });

  it('keeps primary when a discount is unresolved', () => {
    const input = structuredInput();
    input.reconstruction = cloneReconstruction(input.reconstruction!);
    input.reconstruction.items[0]!.unresolvedReason = 'discount-unresolved';
    expect(decideReceiptGeometryProductionSelection(input)).toMatchObject({ decision: 'KEEP_PRIMARY', reason: 'candidate-discount-unresolved' });
  });

  it('keeps primary when structured geometry does not improve item count', () => {
    const input = structuredInput();
    input.primary = cloneParsed(input.geometryCandidate!);
    expect(decideReceiptGeometryProductionSelection(input)).toMatchObject({ decision: 'KEEP_PRIMARY', reason: 'candidate-not-better' });
  });

  it('keeps primary when independent footer evidence is unavailable', () => {
    const input = structuredInput();
    input.primary = cloneParsed(input.primary!);
    delete input.primary.finalPayableMinor;
    delete input.primary.declaredTotalMinor;
    delete input.primary.ocrSubtotalMinor;
    input.geometryCandidate = cloneParsed(input.geometryCandidate!);
    delete input.geometryCandidate.finalPayableMinor;
    delete input.geometryCandidate.declaredTotalMinor;
    delete input.geometryCandidate.ocrSubtotalMinor;
    delete input.geometryCandidate.paymentTotalMinor;
    expect(decideReceiptGeometryProductionSelection(input)).toMatchObject({ decision: 'KEEP_PRIMARY', reason: 'financial-evidence-insufficient' });
  });


  it('keeps primary when geometry is the only footer source but payment confirmation is missing', () => {
    const input = structuredInput();
    input.geometryCandidate = cloneParsed(input.geometryCandidate!);
    delete input.geometryCandidate.paymentTotalMinor;
    expect(decideReceiptGeometryProductionSelection(input)).toMatchObject({ decision: 'KEEP_PRIMARY', reason: 'financial-evidence-insufficient' });
  });

  it('keeps primary when the geometry total conflicts with the final total', () => {
    const input = structuredInput();
    input.primary = { ...input.primary!, declaredTotalMinor: 5000, finalPayableMinor: 5000, paymentTotalMinor: 5000 };
    delete input.primary.ocrSubtotalMinor;
    expect(decideReceiptGeometryProductionSelection(input)).toMatchObject({ decision: 'KEEP_PRIMARY', reason: 'financial-mismatch' });
  });

  it('keeps primary when payment conflicts with the final total', () => {
    const input = structuredInput();
    input.primary = { ...input.primary!, paymentTotalMinor: 4222 };
    expect(decideReceiptGeometryProductionSelection(input)).toMatchObject({ decision: 'KEEP_PRIMARY', reason: 'financial-mismatch' });
  });

  it('keeps primary when a separate deposit would break the final-total equation', () => {
    const input = structuredInput();
    input.primary = { ...input.primary!, depositTotalMinor: 50 };
    expect(decideReceiptGeometryProductionSelection(input)).toMatchObject({ decision: 'KEEP_PRIMARY', reason: 'financial-mismatch' });
  });

  it('keeps primary when source rows are reused across canonical items', () => {
    const input = structuredInput();
    input.reconstruction = cloneReconstruction(input.reconstruction!);
    input.reconstruction.items[1]!.sourceRowIndices.push(input.reconstruction.items[0]!.sourceRowIndices[0]!);
    expect(decideReceiptGeometryProductionSelection(input)).toMatchObject({ decision: 'KEEP_PRIMARY', reason: 'candidate-source-row-reuse' });
  });

  it('is merchant-agnostic for the structured-consensus path', () => {
    const first = structuredInput();
    first.primary = { ...first.primary!, merchant: 'Sklep Alfa' };
    first.geometryCandidate = { ...first.geometryCandidate!, merchant: 'Nagłówek X' };
    const second = structuredInput();
    second.primary = { ...second.primary!, merchant: 'Dowolny Sprzedawca' };
    second.geometryCandidate = { ...second.geometryCandidate!, merchant: 'Nagłówek Y' };
    expect(decideReceiptGeometryProductionSelection(first).decision).toBe('SELECT_STRUCTURED_GEOMETRY');
    expect(decideReceiptGeometryProductionSelection(second).decision).toBe('SELECT_STRUCTURED_GEOMETRY');
  });
});

describe('DEV4-B-FIX1 structured geometry item-only merge', () => {
  it('reuses the GATE3 item-only merge and preserves primary header/footer metadata', () => {
    const input = structuredInput();
    const primary = input.primary!;
    const geometry = input.geometryCandidate!;
    const merged = applySelectedReceiptGeometryItems(primary, geometry);
    expect(merged.items).toHaveLength(12);
    expect(merged.detectedItemsTotalMinor).toBe(4122);
    expect(merged.merchant).toBe(primary.merchant);
    expect(merged.date).toBe(primary.date);
    expect(merged.declaredTotalMinor).toBe(primary.declaredTotalMinor);
    expect(merged.finalPayableMinor).toBe(primary.finalPayableMinor);
    expect(merged.paymentTotalMinor).toBe(primary.paymentTotalMinor);
    expect(merged.depositTotalMinor).toBe(primary.depositTotalMinor);
    expect(preservesReceiptPrimaryMetadata(primary, merged)).toBe(true);
  });
});
