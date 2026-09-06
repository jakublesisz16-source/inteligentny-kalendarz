import { describe, expect, it } from 'vitest';
import { applyReceiptDegradedSafety } from '../shopping/receipt-ocr/receipt-degraded-safety';
import { analyzeReceiptOcrQuality } from '../shopping/receipt-ocr/receipt-ocr-quality';
import { applyReceiptPartialRecovery } from '../shopping/receipt-ocr/receipt-partial-recovery';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';
import { analyzeReceiptSourceQuality } from '../shopping/receipt-ocr/receipt-source-quality';

function recover(raw: string, confidence = 18) {
  const parsed = parseReceiptText(raw);
  const quality = analyzeReceiptOcrQuality(raw, 'photo', confidence);
  const source = analyzeReceiptSourceQuality('photo', 187, 919);
  const safe = applyReceiptDegradedSafety(parsed, source, quality);
  return applyReceiptPartialRecovery(raw, parsed, safe, source, quality);
}

describe('1.1.0-dev.3 DEV3-B026 FIX1Q conservative weak-photo partial recovery', () => {
  it('recovers an anchored space-separated final total without treating SUMA PTU as final', () => {
    const result = recover([
      'NOVA RETAIL POLSKA S.A.',
      'PARAGON NIEFISKALNY',
      'BROKEN PRODUCT 168x 3,69 3,6%',
      'SUMA PTU 3 83',
      'SUMA 44 31',
    ].join('\n'));
    expect(result.declaredTotalMinor).toBe(4431);
    expect(result.warnings.some((warning) => warning.code === 'partial-recovery')).toBe(true);
  });

  it('does not recover arbitrary identifiers as totals without a final-total anchor', () => {
    const result = recover([
      'NOVA RETAIL POLSKA S.A.',
      'PARAGON NIEFISKALNY',
      'Numer transakcji 8551',
      'Numer kasy 13',
      'Suma PTU 3,83',
      '1000078648551241413866',
    ].join('\n'));
    expect(result.declaredTotalMinor).toBeUndefined();
  });

  it('recovers one unambiguous valid date but rejects an invalid damaged date', () => {
    const valid = recover('NOVA S.A.\nData 11/08/2026 20:17\nPARAGON NIEFISKALNY\nSUMA 10 00');
    expect(valid.date).toBe('2026-08-11');
    expect(valid.dateConfidence).toBe('medium');

    const invalid = recover('NOVA S.A.\n2026-88-11 24:17\nPARAGON NIEFISKALNY\nSUMA 10 00');
    expect(invalid.date).toBeUndefined();
  });

  it('prefers full legal/domain consensus over a truncated descriptor candidate', () => {
    const raw = [
      'ABC S.A.',
      'www.abc.eu',
      'Salon Firmowy AB',
      'PARAGON FISKALNY',
      'PRODUKT TEST A 1 x 10,00 10,00',
      'SUMA 10,00',
    ].join('\n');
    const parsed = parseReceiptText(raw);
    const quality = analyzeReceiptOcrQuality(raw, 'photo', 70);
    const source = analyzeReceiptSourceQuality('photo', 700, 1700);
    const result = applyReceiptPartialRecovery(raw, parsed, parsed, source, quality);
    expect(result.merchant).toBe('ABC');
    expect(result.merchantConfidence).toBe('high');
  });

  it('does not invent missing merchant characters when only a two-letter candidate exists', () => {
    const result = recover('AB S.A.\nSalon Firmowy AB\nPARAGON FISKALNY\nSUMA 10 00');
    expect(result.merchant).toBe('AB');
    expect(result.merchantConfidence).toBe('medium');
  });

  it('keeps even full merchant consensus review-only on a very-low source', () => {
    const result = recover('ABC S.A.\nwww.abc.eu\nSalon Firmowy ABC\nPARAGON FISKALNY\nSUMA 10 00');
    expect(result.merchant).toBe('ABC');
    expect(result.merchantConfidence).toBe('medium');
  });

  it('restores only structurally confirmed item equations from a degraded parse', () => {
    const result = recover([
      'NOVA S.A.',
      'PARAGON NIEFISKALNY',
      'PRODUKT A 1 x 4,79 4,79',
      'BROKEN X 168x 3,69 3,6%',
      'PRODUKT B 2 x 1,19 2,38',
      'SUMA 7 17',
    ].join('\n'));
    expect(result.items.map((item) => item.amountMinor)).toEqual([479, 238]);
    expect(result.items.every((item) => item.confidence === 'medium')).toBe(true);
    expect(result.declaredTotalMinor).toBe(717);
  });

  it('preserves weighted lost-separator math as a strong recoverable item', () => {
    const result = recover('NOVA S.A.\nPARAGON NIEFISKALNY\nOWOC LUZ C 0,110 x 9,99 110\nSUMA 1 10');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.amountMinor).toBe(110);
    expect(result.items[0]?.financialResolution).toBe('quantity-unit-recovery');
  });

  it('does not recover a quantity-anomaly explicit line as a strong degraded item', () => {
    const result = recover('NOVA S.A.\nPARAGON NIEFISKALNY\nOBUWIE B 4 x 229,00 229,00\nSUMA 229 00');
    expect(result.items).toHaveLength(0);
    expect(result.declaredTotalMinor).toBe(22900);
  });

  it('keeps good-source 54,79 / 10,48 / 44,31 and 299 + 229 = 528 regressions in the core parser', () => {
    const retail = parseReceiptText([
      'SKLEP TESTOWY', '16.08.2026', 'PARAGON FISKALNY',
      'OBUWIE A 1 x 299,00 299,00',
      'OBUWIE B 4 x 229,00 229,00',
      'SPRZEDAŻ OPODATKOWANA A 328,00',
      'SUMA PLN 528,00', 'KARTA 528,00',
    ].join('\n'));
    expect(retail.items.map((item) => item.amountMinor)).toEqual([29900, 22900]);
    expect(retail.declaredTotalMinor).toBe(52800);

    const weighted = parseReceiptText('SKLEP TESTOWY\n16.08.2026\nOWOC LUZ C 0,110 x 9,99 110\nSUMA 1,10');
    expect(weighted.items[0]?.amountMinor).toBe(110);
  });
});
