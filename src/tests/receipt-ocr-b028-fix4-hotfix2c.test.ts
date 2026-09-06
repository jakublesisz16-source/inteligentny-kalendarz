import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  analyzeReceiptStructuralRegions,
  diagnoseReceiptDateText,
  parseReceiptText,
  resolveReceiptMerchant,
} from '../shopping/receipt-ocr/receipt-parser';
import {
  assessReceiptOcrCandidate,
  shouldRetryReceiptFiscalThreshold,
} from '../shopping/receipt-ocr/receipt-ocr-recovery';
import { analyzeReceiptOcrQuality } from '../shopping/receipt-ocr/receipt-ocr-quality';
import { applyReceiptPartialRecovery } from '../shopping/receipt-ocr/receipt-partial-recovery';
import { applyReceiptStrictOcrGates } from '../shopping/receipt-ocr/receipt-strict-gating';

describe('DEV3-B028-FIX4-HOTFIX2C strict merchant/date/fiscal gating', () => {
  it('rejects out-of-range OCR years instead of exposing a confident false receipt date', () => {
    for (const noisyDate of ['18.08.2006', '2046-09-16']) {
      const text = ['NOVA', 'PARAGON FISKALNY', 'Produkt 10,00', 'SUMA PLN 10,00', `KARTA 10,00 ${noisyDate} 16:17`].join('\n');
      const parsed = parseReceiptText(text);
      expect(parsed.date).toBeUndefined();
      expect(parsed.dateConfidence).toBe('low');
      expect(diagnoseReceiptDateText(text)).toMatchObject({ decision: 'rejected', rejectReason: 'out-of-range' });
    }
  });

  it('does not reintroduce an out-of-range year through partial recovery', () => {
    const text = ['NOVA', 'PARAGON FISKALNY', 'Produkt 10,00', 'SUMA PLN 10,00', 'KARTA 10,00', '2046-09-16 16:17'].join('\n');
    const parsed = parseReceiptText(text);
    const quality = analyzeReceiptOcrQuality(text, 'photo', 25);
    const recovered = applyReceiptPartialRecovery(text, parsed, parsed, { level: 'high', score: 85, warnings: [] }, quality);
    expect(recovered.date).toBeUndefined();
  });

  it('removes a low-evidence merchant only when the whole OCR candidate is genuinely poor', () => {
    const poor = parseReceiptText('DoREaŚ\nPARAGON FISKALNY\nSUMA PLN 3,00');
    const poorQuality = analyzeReceiptOcrQuality('DoREaŚ\nPARAGON FISKALNY\nSUMA PLN 3,00', 'photo', 20);
    expect(applyReceiptStrictOcrGates(poor, poorQuality).parsed.merchant).toBeUndefined();

    const sound = parseReceiptText('NOVA\nPARAGON FISKALNY\nProdukt 10,00\nSUMA PLN 10,00\nKARTA 10,00');
    const soundQuality = analyzeReceiptOcrQuality('NOVA\nPARAGON FISKALNY\nProdukt 10,00\nSUMA PLN 10,00\nKARTA 10,00', 'photo', 80);
    expect(applyReceiptStrictOcrGates(sound, soundQuality).parsed.merchant).toBe('NOVA');
  });

  it('keeps a valid fiscal/payment date and preserves the bounded pre-fiscal textual date regression', () => {
    const paymentDate = parseReceiptText('NOVA\nPARAGON FISKALNY\nProdukt 10,00\nSUMA PLN 10,00\nKARTA 10,00\n18.08.2026 16:17');
    expect(paymentDate.date).toBe('2026-08-18');
    const textualHeaderDate = parseReceiptText('NOVA\n13 lutego 2026\nAdres\nPARAGON FISKALNY\nProdukt 10,00\nSUMA PLN 10,00');
    expect(textualHeaderDate.date).toBe('2026-02-13');
  });

  it('normalizes a punctuation-heavy OCR prefix before the fiscal marker without treating that prefix as structure', () => {
    const regions = analyzeReceiptStructuralRegions([
      '] : 1% X PARAGON FISKALNY A',
      'Produkt 10,00',
      'SUMA PLN 10,00',
      'KARTA 10,00',
    ]);
    expect(regions.fiscalMarkerIndex).toBe(0);
    expect(regions.itemStartIndex).toBe(1);
    expect(regions.itemEndIndex).toBe(2);
  });

  it('does not accept a symbol-heavy fragmented header as the merchant', () => {
    const parsed = parseReceiptText([
      'R z” Ró zwł - w” ZA”',
      'PARAGON FISKALNY',
      'Produkt 10,00',
      'SUMA PLN 10,00',
    ].join('\n'));
    expect(parsed.merchant).toBeUndefined();
    expect(parsed.merchantConfidence).toBe('low');
  });

  it('keeps merchant context evidence inside the fiscal core and excludes a marketing/footer candidate after the total', () => {
    const text = [
      'NOVA MARKET S.A.',
      'PARAGON FISKALNY',
      'Produkt 10,00',
      'SUMA PLN 10,00',
      'KARTA 10,00',
      'LOYALTY OSZCZEDNOSC 4,00',
      'LARGE MARKETING TEXT',
    ].join('\n');
    const parsed = parseReceiptText(text);
    expect(parsed.merchant).toMatch(/^NOVA MARKET/iu);
    expect(parsed.merchant).not.toMatch(/LOYALTY|MARKETING/iu);
  });

  it('closes ordinary product extraction at the first tax/total/payment boundary', () => {
    const parsed = parseReceiptText([
      'NOVA',
      'PARAGON FISKALNY',
      'Produkt A 4,00',
      'Produkt B 6,00',
      'SUMA PLN 10,00',
      'KARTA 10,00',
      'PROMO ITEM 99,00',
    ].join('\n'));
    expect(parsed.items.map((item) => item.name)).toEqual(['Produkt A', 'Produkt B']);
    expect(parsed.detectedItemsTotalMinor).toBe(1000);
  });

  it('reports bounded fiscal/date regions and detects a trailing footer beyond the payment window', () => {
    const lines = [
      'NOVA', 'PARAGON FISKALNY', 'Produkt 10,00', 'SUMA PLN 10,00', 'KARTA 10,00', '18.08.2026 16:17',
      ...Array.from({ length: 16 }, (_, index) => `TECH ${index}`),
      'TAIL ONE', 'TAIL TWO', 'TAIL THREE',
    ];
    const regions = analyzeReceiptStructuralRegions(lines);
    expect(regions.itemStartIndex).toBe(2);
    expect(regions.itemEndIndex).toBe(3);
    expect(regions.paymentStartIndex).toBe(4);
    expect(regions.dateWindowEndIndex).toBeLessThan(lines.length);
    expect(regions.footerContaminationDetected).toBe(true);
  });

  it('keeps legal merchant recovery for a compact header while rejecting address-only evidence', () => {
    const primary = 'NIP 1234567890\nPARAGON FISKALNY\nProdukt 65,00\nSUMA PLN 65,00\nKARTA 65,00\n18.08.2026 16:01';
    const legal = resolveReceiptMerchant(primary, 'NOVA MEDICAL SPÓŁKA Z O.O.\nul. Testowa 5');
    expect(legal.merchant).toMatch(/^NOVA MEDICAL/iu);
    const address = resolveReceiptMerchant(primary, 'ul. Testowa 5\n00-001 Miasto\nNIP 1234567890');
    expect(address.merchant).toBeUndefined();
  });

  it('allows exactly one bounded threshold fallback only after a weak fiscal pass', () => {
    const weak = assessReceiptOcrCandidate('fiscal-region-recovery', 'PARAGON FISKALNY\nProdukt? 5,64\nSUMA PLN 1,63', 'photo', 30);
    const selected = assessReceiptOcrCandidate('primary', 'SUMA PLN 3,00', 'photo', 30);
    expect(shouldRetryReceiptFiscalThreshold(weak, selected, true)).toBe(true);

    const good = assessReceiptOcrCandidate('fiscal-region-recovery', 'PARAGON FISKALNY\nProdukt 10,00\nSUMA PLN 10,00\nKARTA 10,00', 'photo', 60);
    expect(good.goodsReconcile).toBe(true);
    expect(shouldRetryReceiptFiscalThreshold(good, good, true)).toBe(false);
  });

  it('uses PSM 6 for bounded fiscal threshold/header OCR and exposes gating diagnostics without a third full-image pass', () => {
    const engine = readFileSync(new URL('../shopping/receipt-ocr/ocr-engine.ts', import.meta.url), 'utf8');
    const preprocessing = readFileSync(new URL('../shopping/receipt-ocr/image-preprocess.ts', import.meta.url), 'utf8');
    const flow = readFileSync(new URL('../shopping/receipt-ocr/ReceiptScanFlow.tsx', import.meta.url), 'utf8');
    const review = readFileSync(new URL('../shopping/receipt-ocr/ReceiptScanReview.tsx', import.meta.url), 'utf8');

    expect(engine).toContain("profile === 'primary' ? '3' : '6'");
    expect(flow).toContain("'fiscal-threshold-recovery'");
    expect(flow).toContain("'header-recovery'");
    expect(flow.match(/fullOcrPasses \+= 1/gu)).toHaveLength(2);
    expect(flow.match(/fiscalOcrPasses \+= 1/gu)).toHaveLength(2);
    expect(preprocessing).toContain('applyReceiptOtsuThreshold');
    expect(preprocessing).toContain('fiscalThresholdRecoveryChunk');
    expect(review).toContain('Data source');
    expect(review).toContain('Items source');
    expect(review).toContain('Fiscal threshold');
    expect(review).toContain('Tail');
  });
});
