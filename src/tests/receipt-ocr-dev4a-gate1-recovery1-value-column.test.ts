import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ReceiptOcrGeometry, ReceiptOcrToken } from '../shopping/receipt-ocr/receipt-ocr.types';
import {
  assessReceiptGeometryStructuredCandidate,
  reconstructReceiptTextFromGeometry,
} from '../shopping/receipt-ocr/receipt-geometry-reconstruction';
import {
  MAX_RECEIPT_VALUE_RECOVERY_PIXELS,
  compareReceiptValueColumnRecovery,
  countUsableReceiptValueRecoveryTokens,
  mergeReceiptOcrGeometryEvidence,
  planReceiptValueColumnRecovery,
} from '../shopping/receipt-ocr/receipt-value-column-recovery';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

const livePrimary = JSON.parse(readFileSync(
  new URL('../../_PRIVATE_HISTORY/benchmarks/dev4a/live/biedronka-clean-columnar/browser-tesseractjs7.json', import.meta.url),
  'utf8',
)) as { geometry: ReceiptOcrGeometry };

const cliRecovery = JSON.parse(readFileSync(
  new URL('../../_PRIVATE_HISTORY/benchmarks/dev4a/recovery1/value-column-psm6-cli-reference.json', import.meta.url),
  'utf8',
)) as { geometry: ReceiptOcrGeometry; productionEngineSnapshot: boolean; calibrationOnly: boolean };

const recoverySource = readFileSync(new URL('../shopping/receipt-ocr/receipt-value-column-recovery.ts', import.meta.url), 'utf8');
const flowSource = readFileSync(new URL('../shopping/receipt-ocr/ReceiptScanFlow.tsx', import.meta.url), 'utf8');

function token(text: string, x0: number, y0: number, x1: number, y1: number): ReceiptOcrToken {
  return { text, confidence: 95, bbox: { x0, y0, x1, y1 }, page: 1, source: 'snapshot' };
}

function completeSyntheticGeometry(): ReceiptOcrGeometry {
  return {
    source: 'snapshot',
    imageWidth: 600,
    imageHeight: 500,
    tokens: [
      token('Nazwa', 20, 40, 80, 60), token('PTU', 280, 40, 315, 60), token('Ilość', 330, 40, 385, 60), token('Cena', 410, 40, 455, 60), token('Wartość', 500, 40, 575, 60),
      token('Water', 20, 90, 90, 110), token('A', 290, 90, 305, 110), token('2x', 345, 90, 370, 110), token('1,50', 415, 90, 460, 110), token('3,00', 510, 90, 560, 110),
      token('Bread', 20, 130, 90, 150), token('C', 290, 130, 305, 150), token('1x', 345, 130, 370, 150), token('4,00', 415, 130, 460, 150), token('4,00', 510, 130, 560, 150),
      token('Milk', 20, 170, 80, 190), token('C', 290, 170, 305, 190), token('1x', 345, 170, 370, 190), token('5,00', 415, 170, 460, 190), token('5,00', 510, 170, 560, 190),
      token('Eggs', 20, 210, 80, 230), token('C', 290, 210, 305, 230), token('1x', 345, 210, 370, 230), token('6,00', 415, 210, 460, 230), token('6,00', 510, 210, 560, 230),
      token('SUMA', 20, 280, 80, 300), token('PLN', 90, 280, 130, 300), token('18,00', 510, 280, 565, 300),
    ],
  };
}

describe('DEV4-A-GATE1-RECOVERY1 narrow value-column OCR recovery', () => {
  it('plans a bounded crop from live geometry anchors and the product section', () => {
    const reconstruction = reconstructReceiptTextFromGeometry(livePrimary.geometry);
    const plan = planReceiptValueColumnRecovery(livePrimary.geometry, reconstruction);
    expect(plan.eligible).toBe(true);
    expect(plan.itemGroupCount).toBe(11);
    expect(plan.primaryExplicitValueItemCount).toBe(0);
    expect(plan.crop).toBeDefined();
    expect(plan.pixelCount).toBeGreaterThan(0);
    expect(plan.pixelCount).toBeLessThanOrEqual(MAX_RECEIPT_VALUE_RECOVERY_PIXELS);
    expect(plan.crop!.x0).toBeGreaterThan(plan.unitPriceAnchor!);
    expect(plan.crop!.x0).toBeLessThan(plan.valueAnchor!);
    expect(plan.crop!.x1).toBeLessThanOrEqual(livePrimary.geometry.imageWidth);
    expect(plan.crop!.y0).toBeLessThan(plan.crop!.y1);
  });

  it('skips recovery when a columnar table already has sufficient explicit value cells', () => {
    const geometry = completeSyntheticGeometry();
    const reconstruction = reconstructReceiptTextFromGeometry(geometry);
    const plan = planReceiptValueColumnRecovery(geometry, reconstruction);
    expect(reconstruction.items).toHaveLength(4);
    expect(reconstruction.items.every((item) => item.evidence.includes('value-column'))).toBe(true);
    expect(plan.eligible).toBe(false);
    expect(plan.reason).toBe('value-coverage-sufficient');
  });

  it('does not run the narrow crop for non-primary production geometry profiles', () => {
    const geometry = { ...livePrimary.geometry, source: 'fiscal-region-recovery' as const };
    const reconstruction = reconstructReceiptTextFromGeometry(geometry);
    const plan = planReceiptValueColumnRecovery(geometry, reconstruction);
    expect(plan.eligible).toBe(false);
    expect(plan.reason).toBe('geometry-source');
  });

  it('keeps the CLI PSM6 crop explicitly non-production while proving the crop contains 17 usable values', () => {
    expect(cliRecovery.productionEngineSnapshot).toBe(false);
    expect(cliRecovery.calibrationOnly).toBe(true);
    expect(cliRecovery.geometry.source).toBe('value-column-recovery');
    expect(countUsableReceiptValueRecoveryTokens(cliRecovery.geometry)).toBe(17);
  });

  it('maps narrow recovery evidence back into the live page without duplicating primary tokens', () => {
    expect(livePrimary.geometry.tokens).toHaveLength(185);
    expect(cliRecovery.geometry.tokens).toHaveLength(17);
    const merged = mergeReceiptOcrGeometryEvidence(livePrimary.geometry, cliRecovery.geometry);
    expect(merged.source).toBe('primary');
    expect(merged.tokens).toHaveLength(202);
    expect(merged.imageWidth).toBe(1760);
  });

  it('reconstructs all 11 item groups from the immutable live primary plus narrow CLI reference evidence', () => {
    const before = reconstructReceiptTextFromGeometry(livePrimary.geometry);
    const merged = mergeReceiptOcrGeometryEvidence(livePrimary.geometry, cliRecovery.geometry);
    const after = reconstructReceiptTextFromGeometry(merged);
    const parsed = parseReceiptText(after.text);
    const assessment = assessReceiptGeometryStructuredCandidate(after, parsed);
    expect(before.completeItemCount).toBe(7);
    expect(after.items).toHaveLength(11);
    expect(after.completeItemCount).toBe(11);
    expect(after.grossItemsTotalMinor).toBe(10466);
    expect(after.discountsTotalMinor).toBe(-1624);
    expect(after.itemsTotalMinor).toBe(8842);
    expect(parsed.items).toHaveLength(11);
    expect(parsed.detectedItemsTotalMinor).toBe(8842);
    expect(parsed.depositTotalMinor).toBe(250);
    expect(parsed.finalPayableMinor).toBe(9092);
    expect(parsed.paymentTotalMinor).toBe(9092);
    expect(assessment.accepted).toBe(true);
  });

  it('uses recovered local 8.33 evidence to resolve the missing separator instead of receipt totals', () => {
    const merged = mergeReceiptOcrGeometryEvidence(livePrimary.geometry, cliRecovery.geometry);
    const after = reconstructReceiptTextFromGeometry(merged);
    const arbuz = after.items.find((item) => /arbuz/iu.test(item.name));
    expect(arbuz?.quantity).toBe(1.39);
    expect(arbuz?.grossBeforeDiscountMinor).toBe(833);
    expect(arbuz?.finalAmountMinor).toBe(833);
    expect(arbuz?.evidence).toContain('quantity-decimal-recovery');
    expect(after.text).not.toContain('8326,10');
  });

  it('reports a real local-evidence delta instead of a receipt-total backfill', () => {
    const before = reconstructReceiptTextFromGeometry(livePrimary.geometry);
    const after = reconstructReceiptTextFromGeometry(mergeReceiptOcrGeometryEvidence(livePrimary.geometry, cliRecovery.geometry));
    expect(compareReceiptValueColumnRecovery(before, after)).toEqual({
      completeBefore: 7,
      completeAfter: 11,
      unresolvedBefore: 4,
      unresolvedAfter: 0,
      recoveredGrossCells: 11,
      recoveredDiscountCells: 3,
      recoveredNetCells: 3,
      recoveredCompleteGroups: 4,
    });
  });

  it('keeps the production recovery planner free of receipt and merchant fixture hard-coding', () => {
    expect(recoverySource).not.toMatch(/Biedronka|Jeronimo|NapEner|Arbuz|88[,.]42|90[,.]92|1760|4360/iu);
    expect(recoverySource).not.toMatch(/declaredGoods.*-.*items|items.*-.*declaredGoods/iu);
  });

  it('integrates exactly one narrow recovery recognize call site behind the Gate3 fail-closed selector', () => {
    expect(flowSource).toContain("'value-column-recovery'");
    expect(flowSource.match(/controller\.signal,\s*'value-column-recovery'/gu)).toHaveLength(1);
    expect(flowSource).toContain('valueColumnRecoveryPasses += 1');
    expect(flowSource).toContain('decideReceiptGeometryProductionSelection');
    expect(flowSource).toContain("geometrySelection.decision !== 'KEEP_PRIMARY'");
  });
});
