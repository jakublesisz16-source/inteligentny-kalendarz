import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { planReceiptFiscalSubregionCrop } from '../shopping/receipt-ocr/ocr-photo-quality-plan';
import { resolveReceiptMerchant } from '../shopping/receipt-ocr/receipt-parser';

function makeSyntheticPaper(width: number, height: number, strongBands: ReadonlyArray<readonly [number, number]>): number[] {
  const values = Array.from({ length: width * height }, () => 205);
  for (const [start, end] of strongBands) {
    for (let y = Math.max(0, start); y <= Math.min(height - 1, end); y += 1) {
      for (let x = 3; x < width - 3; x += 1) {
        // Alternating dark/light strokes produce a strong horizontal edge signal
        // without encoding any merchant/product words in the geometry test.
        values[y * width + x] = x % 2 === 0 ? 80 : 220;
      }
    }
  }
  return values;
}

describe('DEV3-B028-FIX4-HOTFIX2A merchant header and fiscal subregion', () => {
  it('cuts a late cluster of several large text bands while preserving the fiscal prefix', () => {
    const width = 120;
    const height = 240;
    const values = makeSyntheticPaper(width, height, [
      [105, 116], // isolated barcode/bold band - must not trigger by itself
      [170, 178],
      [184, 191],
      [201, 210],
    ]);
    const plan = planReceiptFiscalSubregionCrop(width, height, values);
    expect(plan.applied).toBe(true);
    expect(plan.marketingTailDetected).toBe(true);
    expect(plan.topRatio).toBe(0);
    expect(plan.bottomRatio).toBeGreaterThan(0.60);
    expect(plan.bottomRatio).toBeLessThan(0.75);
  });

  it('does not crop a short/ordinary receipt because of one isolated barcode or bold total', () => {
    const width = 120;
    const height = 240;
    const values = makeSyntheticPaper(width, height, [[120, 136], [205, 208]]);
    const plan = planReceiptFiscalSubregionCrop(width, height, values);
    expect(plan.applied).toBe(false);
    expect(plan.bottomRatio).toBe(1);
  });

  it('does not crop merely because a long receipt contains three strong bands too early', () => {
    const width = 120;
    const height = 240;
    const values = makeSyntheticPaper(width, height, [[70, 78], [88, 96], [106, 114]]);
    expect(planReceiptFiscalSubregionCrop(width, height, values).applied).toBe(false);
  });

  it('recovers a review-only merchant from a supplemental paper-header OCR when primary text starts at NIP', () => {
    const primary = [
      'NIP: 6722087456',
      'nr dok 000328046',
      'PARAGON FISKALNY',
      'Produkt 1 op * 65,00 = 65,00 B',
      'SUMA PLN 65,00',
      'DO ZAPLATY PLN 65,00',
      'ZAPLACONO KARTA PLN 65,00',
      '18.08.2026 16:01',
    ].join('\n');
    const header = [
      'APTEKA MIEJSKA SPÓŁKA Z O.O.',
      'Plac Wolności 6-7',
      '78-200 Białogard',
    ].join('\n');
    const resolved = resolveReceiptMerchant(primary, header);
    expect(resolved.merchant).toMatch(/^APTEKA MIEJSKA/iu);
    expect(resolved.confidence).not.toBe('low');
  });

  it('does not invent a merchant from an address-only supplemental header', () => {
    const resolved = resolveReceiptMerchant('PARAGON FISKALNY\nProdukt 10,00\nSUMA 10,00', 'ul. Testowa 5\n00-001 Miasto\nNIP 1234567890');
    expect(resolved.merchant).toBeUndefined();
  });

  it('uses the detected fiscal region for the single merchant-header OCR and records bounded recovery diagnostics', () => {
    const flow = readFileSync(new URL('../shopping/receipt-ocr/ReceiptScanFlow.tsx', import.meta.url), 'utf8');
    const preprocessing = readFileSync(new URL('../shopping/receipt-ocr/image-preprocess.ts', import.meta.url), 'utf8');
    const review = readFileSync(new URL('../shopping/receipt-ocr/ReceiptScanReview.tsx', import.meta.url), 'utf8');
    expect(flow).toContain('Boolean(processed.fiscalRecoveryChunk)');
    expect(flow).toContain("resolved.confidence !== 'low'");
    expect(flow).toContain('fiscalRecoveryAttempted');
    expect(flow).toContain('fiscalRecoverySelected');
    expect(flow).toContain('headerOcrPasses += 1');
    expect(preprocessing).toContain('planReceiptFiscalSubregionCrop');
    expect(preprocessing).toContain('preferFiscalRegion');
    expect(preprocessing).toContain('planReceiptFiscalRegionCrop');
    expect(preprocessing).toContain('const targetFromDocument');
    expect(preprocessing).toContain('sourceHeight * ratio');
    expect(preprocessing).not.toContain('bitmap.height * ratio');
    expect(review).toContain('Fiscal recovery');
    expect(review).toContain('Merchant source');
  });
});
