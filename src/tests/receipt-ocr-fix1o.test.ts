import { describe, expect, it } from 'vitest';
import { applyReceiptDegradedSafety } from '../shopping/receipt-ocr/receipt-degraded-safety';
import { analyzeReceiptOcrQuality } from '../shopping/receipt-ocr/receipt-ocr-quality';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';
import { analyzeReceiptSourceQuality } from '../shopping/receipt-ocr/receipt-source-quality';

function parseMerchant(header: string) {
  return parseReceiptText(`${header}\nPARAGON FISKALNY\nProdukt Testowy 1 x 10,00 10,00\nSUMA 10,00`);
}

describe('1.1.0-dev.3 DEV3-B023 FIX1O merchant confidence and final line verification', () => {
  it('recovers a weighted line value when OCR drops the decimal separator from the final token', () => {
    const parsed = parseReceiptText('SKLEP TESTOWY\n16.08.2026\nOWOC LUZ C 0,110 x 9,99 110\nSUMA 1,10');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({
      name: 'OWOC LUZ',
      amountMinor: 110,
      baseAmountMinor: 110,
      financialResolution: 'quantity-unit-recovery',
      confidence: 'medium',
    });
  });

  it('keeps an ordinary explicit weighted line total when its decimal separator is present', () => {
    const parsed = parseReceiptText('SKLEP TESTOWY\n16.08.2026\nOWOC LUZ C 0,110 x 9,99 1,10\nSUMA 1,10');
    expect(parsed.items[0]).toMatchObject({ amountMinor: 110, baseAmountMinor: 110 });
  });

  it('does not mark a repeated two-letter merchant truncation as OK', () => {
    const parsed = parseMerchant('AB S.A.\nSalon Firmowy AB');
    expect(parsed.merchant).toBe('AB');
    expect(parsed.merchantConfidence).toBe('medium');
    expect(parsed.warnings.some((warning) => warning.code === 'merchant-uncertain')).toBe(true);
  });

  it('still accepts a three-letter merchant confirmed by independent legal/domain/descriptor evidence', () => {
    const parsed = parseMerchant('ABC S.A.\nwww.abc.eu\nSalon Firmowy AB');
    expect(parsed.merchant).toBe('ABC');
    expect(parsed.merchantConfidence).toBe('high');
  });

  it('clears merchant auto-fill when degraded safety is triggered for a very-low source', () => {
    const raw = 'DRMSP\nPARAGON NIEFISKALNY\nProdukt A 1 x 8,38 8,38\nProdukt B 1 x 4/79 4,79\nRabat -0,/5\n4,43\nSUMA 44 31';
    const parsed = parseReceiptText(raw);
    expect(parsed.merchant).toBe('DRMSP');
    const quality = analyzeReceiptOcrQuality(raw, 'photo', 19);
    const safe = applyReceiptDegradedSafety(parsed, analyzeReceiptSourceQuality('photo', 190, 920), quality);
    expect(safe.merchant).toBeUndefined();
    expect(safe.merchantConfidence).toBe('low');
    expect(safe.warnings.some((warning) => warning.code === 'degraded-source')).toBe(true);
  });

  it('preserves the confirmed 299 + 229 = 528 quantity-anomaly behavior', () => {
    const parsed = parseReceiptText([
      'SKLEP TESTOWY', '16.08.2026', 'PARAGON FISKALNY',
      'OBUWIE A 1 x 299,00 299,00',
      'OBUWIE B 4 x 229,00 229,00',
      'SPRZEDAŻ OPODATKOWANA A 328,00',
      'SUMA PLN 528,00', 'KARTA 528,00',
    ].join('\n'));
    expect(parsed.items.map((item) => item.amountMinor)).toEqual([29900, 22900]);
    expect(parsed.detectedItemsTotalMinor).toBe(52800);
    expect(parsed.declaredTotalMinor).toBe(52800);
  });
});
