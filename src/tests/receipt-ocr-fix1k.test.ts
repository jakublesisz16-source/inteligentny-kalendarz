import { describe, expect, it } from 'vitest';
import { analyzeReceiptOcrQuality } from '../shopping/receipt-ocr/receipt-ocr-quality';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

function unresolvedDiscounts(raw: string): number {
  return parseReceiptText(raw).warnings.filter((warning) => warning.code === 'item-price-missing').length;
}

describe('1.1.0-dev.3 DEV3-B017 FIX1K financial semantics', () => {
  it('treats Opust as the same structural discount class as Rabat', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Alfa C 1 x 1,49 1,49C\nOpust -0,75\n0,74\nSUMA 0,74`);
    expect(parsed.items[0]).toMatchObject({ name: 'Produkt Alfa', amountMinor: 74 });
    expect(parsed.adjustments[0]).toMatchObject({ kind: 'discount', amountMinor: -75 });
  });

  it('recovers a slash-damaged discount only when base and final math confirm it', () => {
    const raw = `SKLEP TESTOWY\n16.08.2026\nProdukt Beta C 1 x 1,49 1,49C\nRabat -0,/5\n0.74C\nSUMA 0,74`;
    const parsed = parseReceiptText(raw);
    expect(parsed.items[0]).toMatchObject({ amountMinor: 74, confidence: 'medium' });
    expect(parsed.items[0]?.warnings.join(' ')).toContain('potwierdzona na podstawie zgodności rabatu');
    expect(parsed.adjustments[0]?.amountMinor).toBe(-75);
    expect(unresolvedDiscounts(raw)).toBe(0);
  });

  it('recovers an extra-slash discount only from an exact final relationship', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Gamma C 1 x 1,49 1,49C\nRabat -0,7/4\n0.75C\nSUMA 0,75`);
    expect(parsed.items[0]?.amountMinor).toBe(75);
    expect(parsed.adjustments[0]?.amountMinor).toBe(-74);
  });

  it('recovers a missing trailing zero in a final token only inside confirmed discount math', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Delta A 1 x 8,99 8,99A\nRabat -4,49\n4.5A\nSUMA 4,50`);
    expect(parsed.items[0]).toMatchObject({ amountMinor: 450, confidence: 'medium' });
    expect(parsed.items[0]?.warnings.length).toBeGreaterThan(0);
  });

  it('does not recover a mathematically inconsistent noisy discount', () => {
    const raw = `SKLEP TESTOWY\n16.08.2026\nProdukt Epsilon C 1 x 1,49 1,49C\nRabat -0,/5\n0,84\nSUMA 0,84`;
    const parsed = parseReceiptText(raw);
    expect(parsed.items[0]?.amountMinor).toBe(149);
    expect(unresolvedDiscounts(raw)).toBe(1);
  });

  it('keeps the next product boundary stronger than printed-final lookup while deriving clean discount math', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Zeta A 1 x 8,99 8,99A
Rabat -4,50
Produkt Eta 4,49
SUMA 13,48`);
    expect(parsed.items.map((item) => [item.name, item.amountMinor])).toEqual([
      ['Produkt Zeta', 449],
      ['Produkt Eta', 449],
    ]);
    expect(parsed.warnings.some((warning) => warning.code === 'item-price-missing')).toBe(false);
  });

  it('passes the four noisy PHOTO discount sequences deterministically', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Jeden C 1 x 1,49 1,49C\nRabat -0,/5\n0.74C\nProdukt Dwa C 1 x 1,49 1,49C\nRabat -0,7/4\n0.75C\nProdukt Trzy A 1 x 8,99 8,99A\nRabat -4,50\n4.49A\nProdukt Cztery A 1 x 8,99 8,99A\nRabat -4,49\n4.5A\nSUMA 10,48`);
    expect(parsed.items.map((item) => item.amountMinor)).toEqual([74, 75, 449, 450]);
    expect(parsed.adjustments.map((adjustment) => adjustment.amountMinor)).toEqual([-75, -74, -450, -449]);
    expect(parsed.detectedItemsTotalMinor).toBe(1048);
    expect(parsed.declaredTotalMinor).toBe(1048);
    expect(parsed.warnings.filter((warning) => warning.code === 'item-price-missing')).toHaveLength(0);
  });

  it('recovers a separator-damaged weighted line total from quantity times unit price', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Wagowy C 0,110 x 9,99 110\nSUMA 1,10`);
    expect(parsed.items[0]).toMatchObject({ name: 'Produkt Wagowy', amountMinor: 110, confidence: 'medium' });
    expect(parsed.items[0]?.warnings.join(' ')).toContain('ilości i ceny jednostkowej');
    expect(parsed.detectedItemsTotalMinor).toBe(110);
  });

  it('uses the line total as the base for a quantity-greater-than-one Opust', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Iota A 2 x 8,99 17,98\nOpust -8,99\n8,99\nSUMA 8,99`);
    expect(parsed.items[0]?.amountMinor).toBe(899);
    expect(parsed.adjustments[0]?.amountMinor).toBe(-899);
  });

  it('uses DO ZAPŁATY as final declared total over Suma PLN', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Alfa 42,81\nSuma PLN 42,81\nOPAKOWANIA ZWROTNE WYDANIA\nButelka kaucja 3 x 0,50 1,50\nOPAKOWANIA ZWROTNE SUMA 1,50\nDO ZAPŁATY 44,31 PLN\nBon 4,50\nKarta płatnicza 39,81`);
    expect(parsed.declaredSubtotalMinor).toBe(4281);
    expect(parsed.depositTotalMinor).toBe(150);
    expect(parsed.finalPayableMinor).toBe(4431);
    expect(parsed.declaredTotalMinor).toBe(4431);
  });

  it('parses a PDF deposit section after VAT as goods plus a separate deposit total', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Alfa 2,00
SPRZEDAŻ OPODATKOWANA A 2,00
PTU A 23% 0,46
Suma PTU 0,46
Suma PLN 2,00
OPAKOWANIA ZWROTNE WYDANIA
Butelka kaucja 3 x 0,50 1,50
OPAKOWANIA ZWROTNE SUMA 1,50
DO ZAPŁATY 3,50 PLN
Karta płatnicza 3,50`);
    expect(parsed.items.map((item) => [item.name, item.amountMinor])).toEqual([
      ['Produkt Alfa', 200],
    ]);
    expect(parsed.detectedItemsTotalMinor).toBe(200);
    expect(parsed.depositTotalMinor).toBe(150);
    expect(parsed.declaredTotalMinor).toBe(350);
    expect(parsed.warnings.some((warning) => warning.code === 'sum-mismatch')).toBe(false);
  });

  it('does not create deposit, deposit summary, DO ZAPŁATY, payment or footer rows as ordinary items', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Alfa 2,00
SPRZEDAŻ OPODATKOWANA A 2,00
Suma PLN 2,00
OPAKOWANIA ZWROTNE WYDANIA
Butelka kaucja 1 x 0,50 0,50
OPAKOWANIA ZWROTNE SUMA 0,50
DO ZAPŁATY 2,50 PLN
Bon 1,00
Karta płatnicza 1,50
Numer transakcji 1234
Promocje 0,20`);
    expect(parsed.items.map((item) => item.name)).toEqual(['Produkt Alfa']);
    expect(parsed.depositTotalMinor).toBe(50);
    expect(parsed.declaredTotalMinor).toBe(250);
  });

  it('keeps PHOTO kaucja continuation as a normal positive item', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nButelka Plastik 1 x 0,50 0,50\nkaucja\nSUMA 0,50`);
    expect(parsed.items[0]).toMatchObject({ name: 'Butelka Plastik kaucja', amountMinor: 50 });
  });

  it('uses aggregate Opust only as validation and not as another adjustment', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt A 1 x 1,49 1,49\nOpust -0,75\n0,74\nProdukt B 1 x 1,49 1,49\nOpust -0,74\n0,75\nOPUSTY ŁĄCZNIE: -1,49\nSUMA 1,49`);
    expect(parsed.adjustments.map((adjustment) => adjustment.amountMinor)).toEqual([-75, -74]);
    expect(parsed.declaredDiscountTotalMinor).toBe(-149);
    expect(parsed.warnings.some((warning) => warning.code === 'discount-summary-mismatch')).toBe(false);
  });

  it('warns when aggregate discount does not match resolved item discounts', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt A 1 x 1,49 1,49\nOpust -0,75\n0,74\nOPUSTY ŁĄCZNIE: -0,80\nSUMA 0,74`);
    expect(parsed.warnings.some((warning) => warning.code === 'discount-summary-mismatch')).toBe(true);
  });

  it('reconciles the synthetic PDF subtotal plus deposits to final payable without balancing items', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nPARAGON FISKALNY\nProdukt Alfa A 2 x 1,19 2,38\nProdukt Beta C 1 x 4,79 4,79\nProdukt Gamma C 1 x 3,69 3,69\nProdukt Delta C 0,503 x 25,49 12,82\nProdukt Epsilon C 0,110 x 9,99 1,10\nProdukt Zeta B 1 x 7,55 7,55\nProdukt Eta C 1 x 1,49 1,49\nOpust -0,75\n0,74\nProdukt Theta C 1 x 1,49 1,49\nOpust -0,74\n0,75\nProdukt Iota A 2 x 8,99 17,98\nOpust -8,99\n8,99\nOPUSTY ŁĄCZNIE: -10,48\nSPRZEDAŻ OPODATKOWANA A 11,37\nPTU A 23% 2,13\nSUMA PTU 3,83\nSuma PLN 42,81\nOPAKOWANIA ZWROTNE WYDANIA\nButelka kaucja 3 x 0,50 1,50\nOPAKOWANIA ZWROTNE SUMA 1,50\nDO ZAPŁATY 44,31 PLN\nBon 4,50\nKarta płatnicza 39,81`);
    expect(parsed.detectedItemsTotalMinor).toBe(4281);
    expect(parsed.declaredSubtotalMinor).toBe(4281);
    expect(parsed.depositTotalMinor).toBe(150);
    expect(parsed.finalPayableMinor).toBe(4431);
    expect(parsed.declaredTotalMinor).toBe(4431);
    expect(parsed.declaredDiscountTotalMinor).toBe(-1048);
    expect(parsed.warnings.some((warning) => warning.code === 'sum-mismatch')).toBe(false);
    expect(parsed.items.some((item) => /korekta|różnica|brakująca/iu.test(item.name))).toBe(false);
  });

  it('flags slash-damaged and incomplete-decimal money tokens in OCR quality', () => {
    const quality = analyzeReceiptOcrQuality([
      'PARAGON',
      'Produkt Alfa 1 x 4/79 4,79',
      'Produkt Beta 1 x 1,49 1,49',
      'Rabat -0,/5',
      '0.74C',
      'Produkt Gamma 1 x 1,49 1,49',
      'Rabat -0,7/4',
      '0.75C',
      'Produkt Delta 1 x 8,99 8,99',
      'Rabat -4,49',
      '4.5A',
      'SUMA 10,48',
    ].join('\n'), 'photo');
    expect(quality.suspiciousTokens).toBeGreaterThanOrEqual(4);
    expect(quality.suspiciousDiscountSequences).toBeGreaterThan(0);
  });

  it('keeps mathematically recovered item confidence below high', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Alfa 1 x 1,49 1,49\nRabat -0,/5\n0,74\nSUMA 0,74`);
    expect(parsed.items[0]?.confidence).toBe('medium');
  });

  it('remains deterministic for identical PDF-like financial input', () => {
    const raw = `SKLEP TESTOWY\n16.08.2026\nProdukt Alfa 1 x 1,49 1,49\nOpust -0,75\n0,74\nSuma PLN 0,74\nOPAKOWANIA ZWROTNE WYDANIA\nButelka kaucja 1 x 0,50 0,50\nOPAKOWANIA ZWROTNE SUMA 0,50\nDO ZAPŁATY 1,24 PLN`;
    expect(parseReceiptText(raw)).toEqual(parseReceiptText(raw));
  });
});
