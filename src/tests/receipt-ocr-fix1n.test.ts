import { describe, expect, it } from 'vitest';
import { mergeReceiptOcrChunkTexts } from '../shopping/receipt-ocr/ocr-preprocess-plan';
import { applyReceiptDegradedSafety } from '../shopping/receipt-ocr/receipt-degraded-safety';
import { analyzeReceiptOcrQuality } from '../shopping/receipt-ocr/receipt-ocr-quality';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';
import { analyzeReceiptSourceQuality } from '../shopping/receipt-ocr/receipt-source-quality';

function totals(parsed: ReturnType<typeof parseReceiptText>) {
  return {
    final: parsed.items.reduce((sum, item) => sum + (item.amountMinor ?? 0), 0),
    base: parsed.items.reduce((sum, item) => sum + (item.baseAmountMinor ?? item.amountMinor ?? 0), 0),
    savings: parsed.items.reduce((sum, item) => sum + Math.max(0, (item.baseAmountMinor ?? item.amountMinor ?? 0) - (item.amountMinor ?? 0)), 0),
  };
}

describe('1.1.0-dev.3 DEV3-B022 FIX1N receipt semantics and safety', () => {
  it('uses weighted line value instead of unit price', () => {
    const parsed = parseReceiptText('SKLEP TESTOWY\n16.08.2026\nOWOC LUZ C 0,110 x 9,99 1,10\nSUMA 1,10');
    expect(parsed.items[0]).toMatchObject({ name: 'OWOC LUZ', amountMinor: 110, baseAmountMinor: 110 });
    expect(parsed.items[0]?.amountMinor).not.toBe(999);
  });

  it('recovers a weighted final value when OCR loses the line-total token', () => {
    const parsed = parseReceiptText('SKLEP TESTOWY\n16.08.2026\nOWOC LUZ C 0,110 x 9,99 OCRX\nSUMA 1,10');
    expect(parsed.items[0]).toMatchObject({ name: 'OWOC LUZ', amountMinor: 110, confidence: 'medium' });
    expect(parsed.items[0]?.financialResolution).toBe('quantity-unit-recovery');
  });

  it('keeps the explicit line value for a quantity OCR anomaly', () => {
    const parsed = parseReceiptText('SKLEP TESTOWY\n16.08.2026\nOBUWIE TESTOWE A 4 x 229,00 229,00\nSUMA 229,00');
    expect(parsed.items[0]?.amountMinor).toBe(22900);
    expect(parsed.items[0]?.warnings.join(' ')).toContain('Niepewna ilość');
  });

  it('uses a unique tax subtotal only as secondary evidence for a small damaged line-total error', () => {
    const parsed = parseReceiptText([
      'SKLEP TESTOWY', '16.08.2026', 'PARAGON FISKALNY',
      'SOS ZIELONY B 1.000 x Z.23 7,59',
      'SPRZEDAŻ OPODATKOWANA B 7,55', 'PTU B 8% 0,56', 'SUMA 7,55',
    ].join('\n'));
    expect(parsed.items[0]).toMatchObject({ name: 'SOS ZIELONY', amountMinor: 755, taxMarker: 'B', confidence: 'medium' });
    expect(parsed.items[0]?.warnings.join(' ')).toMatch(/podsumowaniem podatkowym/iu);
  });

  it('does not use tax subtotal balancing when more than one item shares the marker', () => {
    const parsed = parseReceiptText([
      'SKLEP TESTOWY', '16.08.2026',
      'PRODUKT A B 1.000 x Z.23 7,59',
      'PRODUKT B B 1 x 2,00 2,00',
      'SPRZEDAŻ OPODATKOWANA B 9,55', 'SUMA 9,55',
    ].join('\n'));
    expect(parsed.items[0]?.amountMinor).toBe(759);
  });

  it('treats product discount final-price sequence as one logical item', () => {
    const parsed = parseReceiptText('SKLEP TESTOWY\n16.08.2026\nPRODUKT 1 x 8,99 8,99\nRabat -4,50\n4,49\nSUMA 4,49');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({ baseAmountMinor: 899, discountMinor: 450, amountMinor: 449 });
  });

  it('supports multiple explicit discounts before the final item value', () => {
    const parsed = parseReceiptText('SKLEP TESTOWY\n16.08.2026\nPRODUKT 1 x 10,00 10,00\nRabat -1,00\nOpust -0,50\n8,50\nOPUSTY ŁĄCZNIE -1,50\nSUMA 8,50');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({ baseAmountMinor: 1000, discountMinor: 150, amountMinor: 850 });
    expect(parsed.adjustments.map((adjustment) => adjustment.amountMinor)).toEqual([-100, -50]);
    expect(parsed.warnings.some((warning) => warning.code === 'discount-summary-mismatch')).toBe(false);
  });

  it('reconciles a synthetic multipage supermarket-class structure to base, savings and final total', () => {
    const parsed = parseReceiptText([
      'NOVA', '16.08.2026', 'NIEFISKALNY',
      'NAPOJ A 1.000 x 1,19 1,19', 'BUTELKA KAUCJA 1.000 x 0,50 0,50',
      'NAPOJ A 1.000 x 1,19 1,19', 'BUTELKA KAUCJA 1.000 x 0,50 0,50',
      'GAZ C 1.000 x 4,79 4,79', 'BUTELKA KAUCJA 1.000 x 0,50 0,50',
      'MLEKO C 1.000 x 3,69 3,69', 'MIESO C 0.503 x 25,49 12,82',
      'OWOC C 0.110 x 9,99 OCRX', 'SOS B 1.000 x Z.23 7,59',
      'DIP1 C 1.000 x 1,49 1,49', 'Rabat -0,75', '0,74',
      'DIP2 C 1.000 x 1,49 1,49', 'Rabat -0,74', '0,75',
      'SLODY1 A 1.000 x 8,99 8,99', 'Rabat -4,50', '4,49',
      'SLODY2 A 1.000 x 8,99 8,99', 'Rabat -4,49', '4,50',
      'SPRZEDAŻ OPODATKOWANA A 11,37', 'SPRZEDAŻ OPODATKOWANA B 7,55', 'SPRZEDAŻ OPODATKOWANA C 23,89',
      '[[RECEIPT_PAGE_BREAK]]', 'Suma PTU 3,83', 'Suma PLN 44,31', 'Karta płatnicza 44,31',
    ].join('\n'));
    expect(totals(parsed)).toEqual({ base: 5479, savings: 1048, final: 4431 });
    expect(parsed.declaredTotalMinor).toBe(4431);
    expect(parsed.warnings.some((warning) => warning.code === 'sum-mismatch')).toBe(false);
  });

  it('recovers the complete merchant brand from legal/domain/truncated descriptor consensus', () => {
    const parsed = parseReceiptText('(ABC S.A. ul. Testowa 6, 00-001 Miasto\n_.._ www.abc.eu\nSalon Firmowy AB\n16.08.2026\nPARAGON FISKALNY\nProdukt 1 x 10,00 10,00\nSUMA 10,00');
    expect(parsed.merchant).toBe('ABC');
    expect(parsed.merchantConfidence).toBe('high');
  });

  it('keeps a generic store label without independent brand evidence', () => {
    const parsed = parseReceiptText('SKLEP SPOZYWCZY\n16.08.2026\nProdukt 1 x 10,00 10,00\nSUMA 10,00');
    expect(parsed.merchant).toBe('SKLEP SPOZYWCZY');
  });

  it('rates exact item-total-payment reconciliation as financially reliable even for two-line item OCR', () => {
    const quality = analyzeReceiptOcrQuality([
      'ABC S.A.', 'www.abc.eu', '16.08.2026', 'PARAGON FISKALNY',
      '5900000000000 OBUWIE TESTOWE', '1 SZT * 149,99 = 149,99 A',
      'PTU A 23,00% 28,05', 'SUMA PTU 28,05', 'SUMA PLN 149,99', 'ZAPŁACONO KARTA PLN 149,99',
    ].join('\n'), 'photo', 55);
    expect(quality.financialScore).toBeGreaterThanOrEqual(75);
  });

  it('keeps a VAT outlier secondary when items, declared total and payment agree', () => {
    const quality = analyzeReceiptOcrQuality('PARAGON FISKALNY\nProdukt A 1 x 299,00 299,00\nProdukt B 4 x 229,00 229,00\nSPRZEDAŻ OPODATKOWANA A 328,00\nSUMA PLN 528,00\nKARTA 528,00', 'photo', 55);
    expect(quality.financialScore).toBeGreaterThanOrEqual(75);
  });

  it('enters conservative degraded safety for a very-low source with damaged conflicting OCR', () => {
    const raw = 'SKLEP TESTOWY\nPARAGON NIEFISKALNY\nProdukt A 1 x 8,38 8,38\nProdukt B 1 x 4/79 4,79\nRabat -0,/5\n4,43\nSUMA 44 31';
    const parsed = parseReceiptText(raw);
    const quality = analyzeReceiptOcrQuality(raw, 'photo', 19);
    const safe = applyReceiptDegradedSafety(parsed, analyzeReceiptSourceQuality('photo', 190, 920), quality);
    expect(safe.warnings.some((warning) => warning.code === 'degraded-source')).toBe(true);
    expect(safe.items.length).toBeLessThan(parsed.items.length);
  });

  it('improves adjacent fuzzy overlap matching without globally removing legitimate repeated items', () => {
    const merged = mergeReceiptOcrChunkTexts([
      'Produkt Alfa 1 x 5,00 5,00\nMleko Test 1 x 3,69 3,69\nFilet Test 0,503 x 25,49 12,82\nOwoc Luz 0,110 x 9,99 1,10',
      'Mlek0 Test 1 x 3,69 3,69\nFi1et Test 0,503 x 25,49 12,82\n0woc Luz 0,110 x 9,99 1,10\nProdukt Dalej 1 x 2,00 2,00',
    ]);
    expect((merged.match(/Filet|Fi1et/gu) ?? []).length).toBe(1);
    expect(merged).toContain('Produkt Dalej');
    const legitimate = mergeReceiptOcrChunkTexts(['Produkt X 1 x 2,00 2,00\nProdukt X 1 x 2,00 2,00']);
    expect(legitimate.match(/Produkt X/gu)).toHaveLength(2);
  });
});
