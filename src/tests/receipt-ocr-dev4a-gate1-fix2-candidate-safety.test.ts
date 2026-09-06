import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ReceiptOcrGeometry, ReceiptOcrToken } from '../shopping/receipt-ocr/receipt-ocr.types';
import {
  assessReceiptGeometryStructuredCandidate,
  reconstructReceiptTextFromGeometry,
} from '../shopping/receipt-ocr/receipt-geometry-reconstruction';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

function token(text: string, x0: number, y0: number, x1: number, y1: number): ReceiptOcrToken {
  return { text, confidence: 90, bbox: { x0, y0, x1, y1 }, page: 1 };
}

function geometry(tokens: ReceiptOcrToken[], width = 600, height = 900): ReceiptOcrGeometry {
  return { source: 'snapshot', imageWidth: width, imageHeight: height, tokens };
}

function header(): ReceiptOcrToken[] {
  return [
    token('Nazwa', 20, 50, 80, 70),
    token('PTU', 290, 50, 320, 70),
    token('Ilość', 340, 50, 390, 70),
    token('Cena', 420, 50, 465, 70),
    token('Wartość', 500, 50, 570, 70),
  ];
}

function assess(tokens: ReceiptOcrToken[]) {
  const reconstruction = reconstructReceiptTextFromGeometry(geometry(tokens));
  const parsed = parseReceiptText(reconstruction.text);
  return { reconstruction, parsed, assessment: assessReceiptGeometryStructuredCandidate(reconstruction, parsed) };
}

const liveSnapshot = JSON.parse(readFileSync(
  new URL('../../_PRIVATE_HISTORY/benchmarks/dev4a/live/biedronka-clean-columnar/browser-tesseractjs7.json', import.meta.url),
  'utf8',
)) as { geometry: ReceiptOcrGeometry };

describe('DEV4-A-GATE1-FIX2 ambiguous quantity and structured candidate safety', () => {
  it('keeps a digit-only long quantity unresolved when no independent value-column token exists', () => {
    const source = header();
    source.push(
      token('Arbuz', 20, 100, 75, 120), token('C', 297, 100, 308, 120),
      token('1390x', 340, 100, 392, 120), token('5,99', 420, 100, 465, 120),
      token('SUMA', 410, 180, 455, 200), token('PLN', 460, 180, 492, 200), token('8,33', 505, 180, 555, 200),
    );
    const { reconstruction, assessment } = assess(source);
    const item = reconstruction.items[0];
    expect(item?.quantity).toBeUndefined();
    expect(item?.grossBeforeDiscountMinor).toBeUndefined();
    expect(item?.finalAmountMinor).toBeUndefined();
    expect(item?.unresolvedReason).toBe('quantity-unresolved');
    expect(item?.evidence).toContain('ambiguous-quantity');
    expect(reconstruction.text).not.toContain('8326,10');
    expect(assessment.accepted).toBe(false);
    expect(assessment.rejectionReasons).toContain('ambiguous-quantity');
  });

  it('keeps explicit decimal quantities valid without requiring a value-column token', () => {
    const source = header();
    source.push(
      token('Banan', 20, 100, 75, 120), token('C', 297, 100, 308, 120),
      token('0,320x', 340, 100, 394, 120), token('6,99', 420, 100, 465, 120),
      token('SUMA', 410, 180, 455, 200), token('PLN', 460, 180, 492, 200), token('2,24', 505, 180, 555, 200),
    );
    const { reconstruction } = assess(source);
    expect(reconstruction.items[0]?.quantity).toBe(0.32);
    expect(reconstruction.items[0]?.finalAmountMinor).toBe(224);
  });

  it('recovers a missing decimal separator only when local value-column money confirms one placement', () => {
    const source = header();
    source.push(
      token('Arbuz', 20, 100, 75, 120), token('C', 297, 100, 308, 120),
      token('1390x', 340, 100, 392, 120), token('5,99', 420, 100, 465, 120), token('8,33', 505, 100, 555, 120),
      token('SUMA', 410, 180, 455, 200), token('PLN', 460, 180, 492, 200), token('8,33', 505, 180, 555, 200),
    );
    const { reconstruction, assessment } = assess(source);
    expect(reconstruction.items[0]?.quantity).toBe(1.39);
    expect(reconstruction.items[0]?.finalAmountMinor).toBe(833);
    expect(reconstruction.items[0]?.evidence).toContain('quantity-decimal-recovery');
    expect(assessment.accepted).toBe(true);
  });

  it('uses declared receipt totals only to reject a catastrophic structured candidate, never to repair it', () => {
    const source = header();
    source.push(
      token('Expensive', 20, 100, 100, 120), token('A', 297, 100, 308, 120),
      token('1x', 345, 100, 370, 120), token('5000,00', 410, 100, 470, 120), token('5000,00', 495, 100, 570, 120),
      token('SUMA', 410, 180, 455, 200), token('PLN', 460, 180, 492, 200), token('100,00', 505, 180, 565, 200),
    );
    const { reconstruction, assessment } = assess(source);
    expect(reconstruction.items[0]?.finalAmountMinor).toBe(500000);
    expect(assessment.accepted).toBe(false);
    expect(assessment.rejectionReasons).toContain('item-outlier');
    expect(assessment.rejectionReasons).toContain('goods-mismatch');
    expect(reconstruction.items[0]?.finalAmountMinor).toBe(500000);
  });

  it('does not require a declared subtotal when a locally complete structured candidate is otherwise coherent', () => {
    const source = header();
    source.push(
      token('Water', 20, 100, 75, 120), token('A', 297, 100, 308, 120),
      token('2x', 345, 100, 370, 120), token('1,50', 420, 100, 465, 120), token('3,00', 505, 100, 555, 120),
    );
    const { parsed, assessment } = assess(source);
    expect(parsed.subtotalResolution).toBe('items-only');
    expect(assessment.accepted).toBe(true);
    expect(assessment.declaredGoodsSubtotalMinor).toBeUndefined();
  });

  it('replays the immutable browser Tesseract.js 7 snapshot without inventing 8326.10 PLN', () => {
    expect(liveSnapshot.geometry.tokens).toHaveLength(185);
    const reconstruction = reconstructReceiptTextFromGeometry(liveSnapshot.geometry);
    const parsed = parseReceiptText(reconstruction.text);
    const assessment = assessReceiptGeometryStructuredCandidate(reconstruction, parsed);
    expect(reconstruction.validTokenCount).toBe(185);
    expect(reconstruction.items).toHaveLength(11);
    expect(reconstruction.completeItemCount).toBe(7);
    expect(reconstruction.items.filter((item) => item.unresolvedReason === 'discount-unresolved')).toHaveLength(3);
    expect(reconstruction.items.filter((item) => item.unresolvedReason === 'quantity-unresolved')).toHaveLength(1);
    const arbuz = reconstruction.items.find((item) => /arbuz/iu.test(item.name));
    expect(arbuz?.name).toBe('Arbuz luz');
    expect(arbuz?.quantity).toBeUndefined();
    expect(arbuz?.grossBeforeDiscountMinor).toBeUndefined();
    expect(arbuz?.finalAmountMinor).toBeUndefined();
    expect(reconstruction.text).not.toContain('8326,10');
    expect(Math.max(...parsed.items.map((item) => item.amountMinor ?? 0))).toBeLessThan(8842 * 4);
    expect(assessment.accepted).toBe(false);
    expect(assessment.rejectionReasons).toContain('ambiguous-quantity');
    expect(assessment.rejectionReasons).toContain('low-completeness');
    expect(assessment.rejectionReasons).toContain('goods-mismatch');
    expect(assessment.rejectionReasons).not.toContain('item-outlier');
  });
});
