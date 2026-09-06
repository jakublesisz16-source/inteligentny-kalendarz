import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { planReceiptFiscalRegionCrop } from '../shopping/receipt-ocr/ocr-photo-quality-plan';
import { assessReceiptOcrCandidate, shouldRecoverReceiptFiscalRegion } from '../shopping/receipt-ocr/receipt-ocr-recovery';
import { normalizeReceiptStructuralLine, parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';
import { createReceiptReviewDraft, receiptReviewDifferenceMinor } from '../shopping/receipt-ocr/receipt-review.model';
import type { ExpenseCategory } from '../shopping/expenses.types';
import type { ReceiptSourceQuality } from '../shopping/receipt-ocr/receipt-ocr.types';

const goodPhotoSource: ReceiptSourceQuality = { level: 'high', score: 85, warnings: [] };
const categories: ExpenseCategory[] = [{ id: 'other', name: 'Inne', sortOrder: 0, createdAt: '', updatedAt: '' }];

const pharmacyNoisyOcr = [
  'A „a 7 (4 s',
  '4 ak R AWUŹ 90) „ARD',
  '"a APTEKA MIEJSKA SPÓŁKA Z 0.0.',
  '< „ Plac Wolności 6-7',
  'Y. | 78-200 Białogard',
  '"SA | POCZTA: Białogard',
  '4 NIP: 6722087456',
  'b nr. dok.000328046',
  'ZABE PARAGON FISKALNY |',
  '4. M heobianacid sw.cytr. tabl. d/ssani „93058 sŹ,',
  '/ e, 1 op * 65,00 = 65,00 B |',
  'A "BE Bez recepty 65,00. 2',
  '> " EA Sp.op.B 65,00 z',
  'A PTU B= 8,00% 4,81 <P',
  'PZ SUMA PTU 4,81 47 A',
  '7» SUMA PLII 65,00 7',
  '_ | 00 ZAPŁATY PLN 65,00 43',
  'WI ROZLICZENIE PŁATNOŚCI , 7 HA A',
  '| ZAPŁACONO KARTA PLN 65,00 , po',
  '= 00117/1258 KIJ/01 18.08.2026 16:01 A z.',
].join('\n');

describe('DEV3-B028-FIX4-HOTFIX2 fiscal region recovery and noisy structure guard', () => {
  it('recovers strong fiscal markers from behind a short OCR garbage prefix', () => {
    expect(normalizeReceiptStructuralLine('PZ SUMA PTU 4,81')).toBe('SUMA PTU 4,81');
    expect(normalizeReceiptStructuralLine('7» SUMA PLII 65,00')).toBe('SUMA PLN 65,00');
    expect(normalizeReceiptStructuralLine('_ | 00 ZAPŁATY PLN 65,00')).toBe('DO ZAPŁATY PLN 65,00');
    expect(normalizeReceiptStructuralLine('| ZAPŁACONO KARTA PLN 65,00')).toBe('ZAPŁACONO KARTA PLN 65,00');
  });

  it('does not overmatch an ordinary line merely because it contains the word Suma', () => {
    expect(normalizeReceiptStructuralLine('PZ SUMA Mix 65,00')).toBe('PZ SUMA MIX 65,00');
  });

  it('parses the noisy pharmacy receipt as one item and excludes fiscal summaries from items', () => {
    const parsed = parseReceiptText(pharmacyNoisyOcr);
    expect(parsed.merchant).toBe('APTEKA MIEJSKA');
    expect(parsed.date).toBe('2026-08-18');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.amountMinor).toBe(6500);
    expect(parsed.taxTotalMinor).toBe(481);
    expect(parsed.declaredTotalMinor).toBe(6500);
    expect(parsed.finalPayableMinor).toBe(6500);
    expect(parsed.paymentTotalMinor).toBe(6500);
    expect(parsed.detectedItemsTotalMinor).toBe(6500);
    expect(parsed.unexplainedDifferenceMinor).toBe(0);
  });

  it('allows fiscal-region OCR only for a good source whose selected OCR result remains structurally poor', () => {
    const broken = assessReceiptOcrCandidate('single-block-recovery', 'MOJE ZAKUPY\n18.08.2006\nSUMA 3,00', 'photo', 25);
    expect(shouldRecoverReceiptFiscalRegion(broken, goodPhotoSource, true)).toBe(true);
  });

  it('does not run fiscal-region OCR when a normal short receipt already reconciles', () => {
    const good = assessReceiptOcrCandidate('primary', 'MARKET TEST\n18.08.2026\nProdukt A 5,00\nProdukt B 7,00\nSUMA 12,00', 'photo', 82);
    expect(good.goodsReconcile).toBe(true);
    expect(shouldRecoverReceiptFiscalRegion(good, goodPhotoSource, true)).toBe(false);
  });

  it('does not claim a matching status when the final receipt total is missing', () => {
    const review = createReceiptReviewDraft({
      merchant: 'MARKET', merchantConfidence: 'medium', date: '2026-08-18', dateConfidence: 'high',
      items: [{ rawText: 'Produkt 65,00', name: 'Produkt', amountMinor: 6500, baseAmountMinor: 6500, discountMinor: 0, confidence: 'medium', warnings: [] }],
      declaredSubtotalMinor: 6500,
      detectedItemsTotalMinor: 6500,
      adjustments: [], warnings: [{ code: 'total-missing', message: 'Brak sumy.' }],
    }, categories);
    expect(review.declaredTotalMinor).toBeUndefined();
    expect(receiptReviewDifferenceMinor(review)).toBeUndefined();
  });

  it('finds a coherent small paper-like region without requiring the normal 55-percent crop', () => {
    const width = 64;
    const height = 96;
    const values = Array.from({ length: width * height }, () => 140);
    for (let y = 18; y < 82; y += 1) {
      for (let x = 20; x < 45; x += 1) values[y * width + x] = 210;
    }
    const plan = planReceiptFiscalRegionCrop(width, height, values);
    expect(plan.applied).toBe(true);
    expect(plan.leftRatio).toBeGreaterThan(0.15);
    expect(plan.rightRatio).toBeLessThan(0.85);
    expect(plan.topRatio).toBeGreaterThan(0.05);
    expect(plan.bottomRatio).toBeLessThan(0.95);
  });

  it('keeps the fiscal-region pass bounded and conditional in production flow', () => {
    const flow = readFileSync(new URL('../shopping/receipt-ocr/ReceiptScanFlow.tsx', import.meta.url), 'utf8');
    const preprocessing = readFileSync(new URL('../shopping/receipt-ocr/image-preprocess.ts', import.meta.url), 'utf8');
    expect(flow).toContain('shouldRecoverReceiptFiscalRegion');
    expect(flow).toContain('processed.fiscalRecoveryChunk');
    expect(flow).toContain("'fiscal-region-recovery'");
    expect(preprocessing).toContain('4_000_000');
    expect(preprocessing).toContain('MAX_RECEIPT_IMAGE_PIXELS');
  });
});
