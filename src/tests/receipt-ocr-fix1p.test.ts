import { describe, expect, it } from 'vitest';
import { applyReceiptDegradedSafety } from '../shopping/receipt-ocr/receipt-degraded-safety';
import { analyzeReceiptOcrQuality } from '../shopping/receipt-ocr/receipt-ocr-quality';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';
import { analyzeReceiptSourceQuality } from '../shopping/receipt-ocr/receipt-source-quality';

function parseMerchant(header: string) {
  return parseReceiptText(`${header}\nPARAGON FISKALNY\nProdukt Testowy 1 x 10,00 10,00\nSUMA 10,00`);
}

describe('1.1.0-dev.3 DEV3-B024 FIX1P merchant final gate', () => {
  it('prefers complete independent legal/domain consensus over a truncated descriptor', () => {
    const parsed = parseMerchant('ABC S.A.\nwww.abc.eu\nSalon Firmowy AB');
    expect(parsed.merchant).toBe('ABC');
    expect(parsed.merchantConfidence).toBe('high');
  });

  it('keeps an unconfirmed two-letter merchant review-only instead of inventing missing characters', () => {
    const parsed = parseMerchant('AB S.A.\nSalon Firmowy AB');
    expect(parsed.merchant).toBe('AB');
    expect(parsed.merchantConfidence).toBe('medium');
  });

  it('uses a reliable legal fallback instead of an unconfirmed three-letter logo/header fragment', () => {
    const parsed = parseMerchant('XYZ\nCODZIENNIE DOBRE CENY\nSklep 123\nNOVA RETAIL POLSKA S.A.');
    expect(parsed.merchant).toBe('NOVA RETAIL POLSKA');
    expect(parsed.merchantConfidence).toBe('medium');
  });

  it('preserves a structurally strong shopping-centre descriptor candidate', () => {
    const parsed = parseMerchant('LEGAL HOLDING S.A.\nVENETA C.H. FORUM');
    expect(parsed.merchant).toBe('VENETA');
  });

  it('continues clearing merchant auto-fill in very-low degraded mode', () => {
    const raw = 'XYZ\nPARAGON NIEFISKALNY\nProdukt A 1 x 8,38 8,38\nProdukt B 1 x 4/79 4,79\nRabat -0,/5\n4,43\nSUMA 44 31';
    const parsed = parseReceiptText(raw);
    const quality = analyzeReceiptOcrQuality(raw, 'photo', 19);
    const safe = applyReceiptDegradedSafety(parsed, analyzeReceiptSourceQuality('photo', 190, 920), quality);
    expect(safe.merchant).toBeUndefined();
    expect(safe.merchantConfidence).toBe('low');
  });

  it('preserves weighted and 299 + 229 financial regressions', () => {
    const weighted = parseReceiptText('SKLEP TESTOWY\n16.08.2026\nOWOC LUZ C 0,110 x 9,99 110\nSUMA 1,10');
    expect(weighted.items[0]?.amountMinor).toBe(110);

    const retail = parseReceiptText([
      'SKLEP TESTOWY', '16.08.2026', 'PARAGON FISKALNY',
      'OBUWIE A 1 x 299,00 299,00',
      'OBUWIE B 4 x 229,00 229,00',
      'SPRZEDAŻ OPODATKOWANA A 328,00',
      'SUMA PLN 528,00', 'KARTA 528,00',
    ].join('\n'));
    expect(retail.items.map((item) => item.amountMinor)).toEqual([29900, 22900]);
    expect(retail.declaredTotalMinor).toBe(52800);
  });
});
