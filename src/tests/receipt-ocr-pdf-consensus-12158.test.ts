import { describe, expect, it } from 'vitest';
import {
  assessReceiptOcrCandidate,
  chooseReceiptOcrCandidate,
  shouldRetryReceiptPdfOcr,
} from '../shopping/receipt-ocr/receipt-ocr-recovery';

const brokenPrimary = `
SKLEP TESTOWY
PARAGON FISKALNY
Produkt A 1 x 10,00 10,00 A
Produkt B 1 x 5,00 5,00 A
Suma PLN 20,00
Karta platnicza 20,00
2026-09-19
`;

const recovered = `
SKLEP TESTOWY
PARAGON FISKALNY
Produkt A 1 x 10,00 10,00 A
Produkt B 1 x 5,00 5,00 A
Produkt C 1 x 5,00 5,00 A
Suma PLN 20,00
Karta platnicza 20,00
2026-09-19
`;

const completePrimary = `
SKLEP TESTOWY
PARAGON FISKALNY
Produkt A 1 x 10,00 10,00 A
Produkt B 1 x 5,00 5,00 A
Suma PLN 15,00
Karta platnicza 15,00
2026-09-19
`;

describe('1.2.0 Build158 PDF OCR candidate parity', () => {
  it('requires a second PDF OCR hypothesis when the primary item block does not reconcile', () => {
    const primary = assessReceiptOcrCandidate('primary', brokenPrimary, 'pdf', 80);
    expect(primary.parsed.detectedItemsTotalMinor).toBe(1500);
    expect(primary.parsed.declaredTotalMinor).toBe(2000);
    expect(shouldRetryReceiptPdfOcr(primary)).toBe(true);
  });

  it('selects a financially reconciled recovery candidate instead of keeping the broken PDF primary', () => {
    const primary = assessReceiptOcrCandidate('primary', brokenPrimary, 'pdf', 80);
    const recovery = assessReceiptOcrCandidate('single-block-recovery', recovered, 'pdf', 80);
    expect(recovery.parsed.detectedItemsTotalMinor).toBe(2000);
    expect(chooseReceiptOcrCandidate(primary, recovery).profile).toBe('single-block-recovery');
  });

  it('does not add a second OCR pass to an already complete PDF candidate', () => {
    const primary = assessReceiptOcrCandidate('primary', completePrimary, 'pdf', 90);
    expect(primary.goodsReconcile).toBe(true);
    expect(primary.paymentReconciles).toBe(true);
    expect(shouldRetryReceiptPdfOcr(primary)).toBe(false);
  });
});
