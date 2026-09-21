import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

describe('1.2.0 Build155 receipt patterns from expanded PRIVATE corpus', () => {
  it('keeps multiple deposit lines aggregated separately from goods and reconciles split payment', () => {
    const parsed = parseReceiptText([
      'NOVA MARKET',
      '2026-08-11',
      'PARAGON FISKALNY',
      'Produkt A',
      '1 * 10,00 10,00 C',
      'Produkt B',
      '2 * 5,00 10,00 C',
      'Opust -2,00',
      '8,00 C',
      'SUMA PLN 18,00',
      'OPAKOWANIA ZWROTNE WYDANIA',
      'Puszka kaucja 2 * 0,50 1,00',
      'Butelka kaucja 3 * 0,50 1,50',
      'OPAKOWANIA ZWROTNE SUMA 2,50',
      'DO ZAPŁATY 20,50 PLN',
      'Bon 4,00',
      'Karta płatnicza 16,50',
    ].join('\n'));

    expect(parsed.detectedItemsTotalMinor).toBe(1800);
    expect(parsed.depositTotalMinor).toBe(250);
    expect(parsed.declaredTotalMinor).toBe(2050);
    expect(parsed.paymentTotalMinor).toBe(2050);
    expect(parsed.unexplainedDifferenceMinor).toBe(0);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[1]).toMatchObject({ baseAmountMinor: 1000, discountMinor: 200, amountMinor: 800 });
  });
});
