import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

function unresolvedDiscounts(raw: string): number {
  return parseReceiptText(raw).warnings.filter((warning) => warning.code === 'item-price-missing').length;
}

describe('1.1.0-dev.3 FIX1D deterministic discount binding', () => {
  it('applies three sequential discounts despite conservative OCR punctuation artifacts', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Jeden C 1.0 x 1,49 _ 1,49C
Rabat -0,75
_ 0,74C
Produkt Dwa C 1.0 x 1,49 1,49C
Rabat -0,74
0,75C _
Produkt Trzy A 1.0 x 8,99 _ 8,99A
Rabat -4,50
| 4,49A
SUMA 5,98`);

    expect(parsed.items.map((item) => [item.name, item.amountMinor])).toEqual([
      ['Produkt Jeden', 74],
      ['Produkt Dwa', 75],
      ['Produkt Trzy', 449],
    ]);
    expect(parsed.adjustments).toHaveLength(3);
    expect(parsed.adjustments.map((item) => item.amountMinor)).toEqual([-75, -74, -450]);
    expect(parsed.warnings.filter((warning) => warning.code === 'item-price-missing')).toHaveLength(0);
    expect(parsed.detectedItemsTotalMinor).toBe(598);
  });

  it('supports a discount label and negative amount split into separate OCR lines', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Alfa C 1.0 x 1,49 1,49C
Rabat
-0,75
0,74C
SUMA 0,74`);

    expect(parsed.items[0]).toMatchObject({ name: 'Produkt Alfa', amountMinor: 74 });
    expect(parsed.adjustments[0]).toMatchObject({ amountMinor: -75, kind: 'discount' });
    expect(parsed.adjustments[0]?.rawText).toBe('Rabat\n-0,75');
    expect(parsed.warnings.some((warning) => warning.code === 'item-price-missing')).toBe(false);
  });

  it('allows one tiny bridge line but keeps the lookup window bounded', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Alfa C 1.0 x 1,49 1,49C
Rabat -0,75
_
0,74C
SUMA 0,74`);
    expect(parsed.items[0]?.amountMinor).toBe(74);
  });

  it('does not scan beyond the three-line discount look-ahead window', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Alfa C 1.0 x 1,49 1,49C
Rabat -0,75
_
|
A
_
0,74C
SUMA 0,74`);
    expect(parsed.items[0]?.amountMinor).toBe(149);
    expect(parsed.warnings.some((warning) => warning.code === 'item-price-missing')).toBe(true);
  });

  it('accepts dot monetary separators and a VAT marker on the final amount', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Kropka A 1.0 x 8.99 8.99A
Rabat -4.50
4.49A
SUMA 4.49`);
    expect(parsed.items[0]).toMatchObject({ name: 'Produkt Kropka', amountMinor: 449 });
  });

  it('rejects an inconsistent printed final token but keeps the exact monetary discount result', () => {
    const raw = `SKLEP TESTOWY
16.08.2026
Produkt Alfa 1,49
Rabat -0,75
0,76
SUMA 0,76`;
    const parsed = parseReceiptText(raw);
    expect(parsed.items[0]?.amountMinor).toBe(74);
    expect(parsed.items[0]?.warnings.join(' ')).toContain('zgodności rabatu');
  });

  it('does not steal the amount from the next product while deriving an exact monetary discount', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Alfa 1,49
Rabat -0,75
Nastepny Produkt 3,20
SUMA 3,94`);
    expect(parsed.items.map((item) => [item.name, item.amountMinor])).toEqual([
      ['Produkt Alfa', 74],
      ['Nastepny Produkt', 320],
    ]);
    expect(parsed.warnings.some((warning) => warning.code === 'item-price-missing')).toBe(false);
  });

  it('does not treat a percentage-only discount as a split monetary discount', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Alfa 10,00
Rabat 20%
-2,00
8,00
SUMA 8,00`);
    expect(parsed.items[0]?.amountMinor).toBe(1000);
    expect(parsed.adjustments).toEqual([{ rawText: 'Rabat 20%', kind: 'discount' }]);
    expect(parsed.warnings.some((warning) => warning.code === 'item-price-missing')).toBe(true);
  });

  it('does not treat an unrelated negative number as a discount without a discount label', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Alfa 4,49
-0,50
3,99
SUMA 4,49`);
    expect(parsed.adjustments).toEqual([]);
    expect(parsed.items[0]?.amountMinor).toBe(449);
  });

  it('cleans a financial suffix containing a narrow OCR separator artifact', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Alfa A 1.0 x 8,99 _ 8,99A
SUMA 8,99`);
    expect(parsed.items[0]).toMatchObject({ name: 'Produkt Alfa', amountMinor: 899 });
  });

  it('cleans a quantity-one financial suffix even when OCR loses the duplicated final amount', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Alfa A 1.0 x 8,99 _
SUMA 8,99`);
    expect(parsed.items[0]).toMatchObject({ name: 'Produkt Alfa', amountMinor: 899 });
  });

  it('keeps genuine A/B/C endings when no quantity structure proves a financial marker', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Witamina C 4,99
Herbata B 3,00
Model A 2,00
SUMA 9,99`);
    expect(parsed.items.map((item) => item.name)).toEqual(['Witamina C', 'Herbata B', 'Model A']);
  });

  it('preserves weighted amount, unit continuation and deposit semantics', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Wagowy C
0.50 x 25,49 12,82C
kg
Butelka
kaucja
1.0 x 0,50 0,50
SUMA 13,32`);
    expect(parsed.items.map((item) => [item.name, item.amountMinor])).toEqual([
      ['Produkt Wagowy', 1282],
      ['Butelka kaucja', 50],
    ]);
  });

  it('keeps all ReceiptItem amounts positive', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Alfa 1,49
Rabat -0,75
0,74
SUMA 0,74`);
    expect(parsed.items.every((item) => (item.amountMinor ?? 0) > 0)).toBe(true);
    expect(parsed.items).toHaveLength(1);
  });

  it('matches the 3981 minor-unit mixed-receipt regression with 3/3 discounts applied', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Towar Jeden A 1.0 x 4,79 4,79A
Towar Dwa B 1.0 x 3,69 3,69B
Towar Wagowy C
0.50 x 25,49 12,82C
kg
Towar Trzy A 6,99
Towar Cztery B 5,54
Towar Piaty C 1.0 x 1,49 _ 1,49C
Rabat -0,75
_ 0,74C
Towar Szosty A 1.0 x 1,49 1,49A
Rabat
-0,74
0,75A
Towar Siodmy B 1.0 x 8,99 _ 8,99B
Rabat -4.50
4.49B _
SUMA 39,81`);

    expect(parsed.adjustments).toHaveLength(3);
    expect(parsed.adjustments.every((adjustment) => (adjustment.amountMinor ?? 0) < 0)).toBe(true);
    expect(parsed.warnings.filter((warning) => warning.code === 'item-price-missing')).toHaveLength(0);
    expect(parsed.detectedItemsTotalMinor).toBe(3981);
    expect(parsed.declaredTotalMinor).toBe(3981);
    expect(parsed.warnings.some((warning) => warning.code === 'sum-mismatch')).toBe(false);
  });

  it('resolves a clean monetary discount without requiring a separately printed final amount', () => {
    const raw = `SKLEP TESTOWY
16.08.2026
Produkt Alfa 1,49
Rabat -0,75
SUMA 0,74`;
    expect(unresolvedDiscounts(raw)).toBe(0);
    expect(parseReceiptText(raw).items[0]?.amountMinor).toBe(74);
  });
});
