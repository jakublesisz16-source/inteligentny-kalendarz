import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

describe('1.1.0-dev.3 FIX1E narrow OCR VAT-marker recovery after discounts', () => {
  it('accepts a final amount when VAT C is OCR-confused with the euro glyph', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Alfa C 1.0 x 1,49 1,49C
Rabat -0,75
0,74€
SUMA 0,74`);
    expect(parsed.items[0]).toMatchObject({ name: 'Produkt Alfa', amountMinor: 74 });
    expect(parsed.warnings.some((warning) => warning.code === 'item-price-missing')).toBe(false);
  });

  it('accepts an A marker OCR-confused as a trailing 4 after two decimals', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Alfa A 1.0 x 8,99 8,99A
Rabat -4,50
4,494
SUMA 4,49`);
    expect(parsed.items[0]).toMatchObject({ name: 'Produkt Alfa', amountMinor: 449 });
    expect(parsed.warnings.some((warning) => warning.code === 'item-price-missing')).toBe(false);
  });

  it('accepts a B marker OCR-confused as a trailing 8 after two decimals', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Beta B 1.0 x 7,55 7,55B
Rabat -1,00
6,558
SUMA 6,55`);
    expect(parsed.items[0]).toMatchObject({ name: 'Produkt Beta', amountMinor: 655 });
  });

  it('does not accept an arbitrary third decimal digit as confirmation but keeps exact discount math', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Alfa A 1.0 x 8,99 8,99A
Rabat -4,50
4,490
SUMA 4,49`);
    expect(parsed.items[0]?.amountMinor).toBe(449);
    expect(parsed.items[0]?.warnings.join(' ')).toContain('zgodności rabatu');
  });

  it('does not accept a multi-character suffix as confirmation but keeps exact discount math', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Alfa A 1.0 x 8,99 8,99A
Rabat -4,50
4,49XYZ
SUMA 4,49`);
    expect(parsed.items[0]?.amountMinor).toBe(449);
    expect(parsed.items[0]?.warnings.join(' ')).toContain('zgodności rabatu');
  });

  it('applies all three discounts when two final VAT markers have narrow OCR confusions', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Towar Jeden C 1.0 x 1,49 1,49C
Rabat -0,75
0,74€
Towar Dwa C 1.0 x 1,49 1,49C
Rabat -0,74
0,75C
Towar Trzy A 1.0 x 8,99 8,99A
Rabat -4,50
4,494
SUMA 5,98`);
    expect(parsed.items.map((item) => item.amountMinor)).toEqual([74, 75, 449]);
    expect(parsed.detectedItemsTotalMinor).toBe(598);
    expect(parsed.warnings.filter((warning) => warning.code === 'item-price-missing')).toHaveLength(0);
  });
});
