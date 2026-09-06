import { describe, expect, it } from 'vitest';
import { parseReceiptText, resolveReceiptMerchant } from '../shopping/receipt-ocr/receipt-parser';
import { shouldRecoverMerchantHeader } from '../shopping/receipt-ocr/receipt-ocr-recovery';
import { analyzeReceiptOcrQuality } from '../shopping/receipt-ocr/receipt-ocr-quality';

const lidlTulips = [
  'o',
  '13 lut 2026',
  'Lidl sp. z.o. o. sp. k.',
  'Poznańska 48, Jankowice',
  '62-080 Tarnowo Podgórne',
  '2026-82-13',
  'Tulipany25szt.kw.c. 1 * 39,99 39,99 B',
  'PTU B 39,99',
  'Kwota B 08,00% 2,96',
  'Suma 2,96',
  'Razem 39,99',
  'Płatność Karta płatnicza 39,99',
  'RAZEM PLN 39,99',
].join('\n');

const cccPrimary = [
  'CC S.A. ul. Strefowa 6, 59-101 Polkowice',
  'Salon Firmowy CC',
  'Białogard, Salon 1865',
  'NIP: 6922200609',
  'PARAGON FISKALNY',
  'OBUWIE HI23-GIANKA-OS 1 SZT * 149,99 = 149,99 A',
  'SUMA PTU 28,05',
  'SUMA PLN 149,99',
  'ZAPŁACONO KARTA (Karta) PLN 149,99',
  '02.08.2024 16:04',
].join('\n');

const cccHeaderRecovery = [
  'CE S.A. ul. Strefowa 6, 59-101 Polkowice',
  'www.ccc.eu',
  'Salon Firmowy CCC',
].join('\n');

describe('DEV3-B028-FIX4 date, total-role and merchant header recovery', () => {
  it('parses Polish textual dates without repairing an invalid numeric OCR candidate', () => {
    const parsed = parseReceiptText(lidlTulips);
    expect(parsed.date).toBe('2026-02-13');
    expect(parsed.dateConfidence).toBe('high');
  });

  it('accepts inflected Polish month names', () => {
    expect(parseReceiptText('NOVA\n13 lutego 2026\nProdukt 10,00\nSuma 10,00').date).toBe('2026-02-13');
    expect(parseReceiptText('NOVA\n2 października 2026\nProdukt 10,00\nSuma 10,00').date).toBe('2026-10-02');
  });

  it('rejects an impossible numeric date when no valid alternative exists', () => {
    const parsed = parseReceiptText('NOVA\n2026-82-13\nProdukt 10,00\nSuma 10,00');
    expect(parsed.date).toBeUndefined();
    expect(parsed.warnings.some((warning) => warning.code === 'date-missing')).toBe(true);
  });

  it('classifies a tax-scoped generic Suma separately from the strong final total', () => {
    const parsed = parseReceiptText(lidlTulips);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.detectedItemsTotalMinor).toBe(3999);
    expect(parsed.taxTotalMinor).toBe(296);
    expect(parsed.declaredTotalMinor).toBe(3999);
    expect(parsed.finalPayableMinor).toBe(3999);
    expect(parsed.paymentTotalMinor).toBe(3999);
    expect(parsed.unexplainedDifferenceMinor).toBe(0);
    expect(parsed.warnings.some((warning) => warning.code === 'sum-mismatch')).toBe(false);
    expect(analyzeReceiptOcrQuality(lidlTulips, 'photo', 100).financialScore).toBeGreaterThanOrEqual(75);
  });

  it('keeps a plain generic Suma as the final total when it is not in a tax context', () => {
    const parsed = parseReceiptText('NOVA\n2026-08-01\nProdukt 25,00\nSuma 25,00\nKarta 25,00');
    expect(parsed.declaredTotalMinor).toBe(2500);
    expect(parsed.paymentTotalMinor).toBe(2500);
    expect(parsed.unexplainedDifferenceMinor).toBe(0);
  });

  it('keeps an explicit strong-total/payment conflict visible instead of silently replacing it', () => {
    const parsed = parseReceiptText('NOVA\n2026-08-01\nProdukt 39,99\nRazem 40,99\nKarta 39,99');
    expect(parsed.declaredTotalMinor).toBe(4099);
    expect(parsed.paymentTotalMinor).toBe(3999);
    expect(parsed.unexplainedDifferenceMinor).toBe(-100);
    expect(parsed.warnings.some((warning) => warning.code === 'sum-mismatch')).toBe(true);
  });

  it('keeps the CCC financial parse intact and marks the weak merchant for header recovery', () => {
    const parsed = parseReceiptText(cccPrimary);
    expect(parsed.merchant).toBe('CC');
    expect(parsed.merchantConfidence).toBe('medium');
    expect(parsed.date).toBe('2024-08-02');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.detectedItemsTotalMinor).toBe(14999);
    expect(parsed.declaredTotalMinor).toBe(14999);
    expect(parsed.paymentTotalMinor).toBe(14999);
    expect(parsed.unexplainedDifferenceMinor).toBe(0);
    expect(shouldRecoverMerchantHeader(parsed, 'photo')).toBe(true);
    expect(shouldRecoverMerchantHeader(parsed, 'pdf')).toBe(false);
  });

  it('uses independent header evidence to recover a longer merchant candidate without a merchant dictionary', () => {
    const resolved = resolveReceiptMerchant(cccPrimary, cccHeaderRecovery);
    expect(resolved.merchant).toBe('CCC');
    expect(resolved.confidence).toBe('high');
    expect(resolved.warnings).toHaveLength(0);
  });
});
