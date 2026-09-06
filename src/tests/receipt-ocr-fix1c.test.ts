import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';
import { createReceiptReviewDraft, receiptReviewToDraft } from '../shopping/receipt-ocr/receipt-review.model';

describe('1.1.0-dev.3 FIX1C discount final price and structural cleanup', () => {
  it('uses the printed final price after a mathematically matching discount', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Alfa C 1.0 x 1,49 1,49C
Rabat -0,75
0,74C
SUMA 0,74`);

    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({ name: 'Produkt Alfa', amountMinor: 74 });
    expect(parsed.adjustments).toEqual([{ rawText: 'Rabat -0,75', amountMinor: -75, kind: 'discount' }]);
    expect(parsed.detectedItemsTotalMinor).toBe(74);
  });

  it('keeps several discounts bound to their own preceding products', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Alfa C 1.0 x 1,49 1,49C
Rabat -0,75
0,74C
Produkt Beta A 1.0 x 1,49 1,49A
Rabat -0,74
0,75A
Produkt Gamma B 1.0 x 8,99 8,99B
Rabat -4,50
4,49B
SUMA 5,98`);

    expect(parsed.items.map((item) => [item.name, item.amountMinor])).toEqual([
      ['Produkt Alfa', 74],
      ['Produkt Beta', 75],
      ['Produkt Gamma', 449],
    ]);
    expect(parsed.detectedItemsTotalMinor).toBe(598);
    expect(parsed.warnings.some((warning) => warning.code === 'sum-mismatch')).toBe(false);
  });

  it('accepts dot decimal prices in the same conservative discount structure', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Kropka A 1.0 x 2.00 2.00A
Rabat -0.25
1.75A
SUMA 1.75`);

    expect(parsed.items[0]).toMatchObject({ name: 'Produkt Kropka', amountMinor: 175 });
  });

  it('keeps a real trailing C in a normal product name', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Witamina C 4,99
SUMA 4,99`);
    expect(parsed.items[0]).toMatchObject({ name: 'Witamina C', amountMinor: 499 });
  });

  it('uses the final line amount for weighted products and ignores unit-only continuation lines', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Wagowy C
0.50 x 25,49 12,82C
kg
Produkt Drugi A 1.0 x 3,69 3,69A
1l
SUMA 16,51`);

    expect(parsed.items.map((item) => [item.name, item.amountMinor])).toEqual([
      ['Produkt Wagowy', 1282],
      ['Produkt Drugi', 369],
    ]);
  });

  it('keeps a deposit descriptor attached to a positive sale item instead of treating it as a discount', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
But Plastik
kaucja
1.0 x 0,50 0,50
SUMA 0,50`);

    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({ name: 'But Plastik kaucja', amountMinor: 50 });
    expect(parsed.adjustments).toEqual([]);
  });

  it('derives a net amount from an exact monetary discount when no printed final price exists', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Alfa 1,49
Rabat -0,75
SUMA 0,74`);

    expect(parsed.items[0]?.amountMinor).toBe(74);
    expect(parsed.warnings.some((warning) => warning.code === 'item-price-missing')).toBe(false);
    expect(parsed.items.every((item) => (item.amountMinor ?? 0) > 0)).toBe(true);
  });

  it('keeps the next-product boundary while deriving the previous exact monetary discount', () => {
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

  it('does not create negative ReceiptItem entries from an unrelated discount', () => {
    const parsed = parseReceiptText(`Rabat -1,00
SUMA 0,00`);
    expect(parsed.items).toEqual([]);
    expect(parsed.adjustments).toEqual([{ rawText: 'Rabat -1,00', amountMinor: -100, kind: 'discount' }]);
  });

  it('keeps missing merchant and date unresolved instead of inventing values', () => {
    const parsed = parseReceiptText(`Produkt Alfa 2,00
SUMA 2,00`);
    expect(parsed.merchant).toBeUndefined();
    expect(parsed.date).toBeUndefined();
    expect(parsed.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining(['merchant-uncertain', 'date-missing']));
  });


  it('keeps discount metadata ephemeral when converting reviewed OCR to ReceiptDraft', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Alfa C 1.0 x 1,49 1,49C
Rabat -0,75
0,74C
SUMA 0,74`);
    const review = createReceiptReviewDraft(parsed, [{ id: 'other', name: 'Inne', sortOrder: 0, createdAt: '', updatedAt: '' }]);
    const draft = receiptReviewToDraft(review);

    expect(draft).toEqual({
      merchant: 'SKLEP TESTOWY',
      date: '2026-08-16',
      items: [{ name: 'Produkt Alfa', categoryId: 'other', amountMinor: 74 }],
    });
    expect(JSON.stringify(draft)).not.toContain('adjustments');
    expect(JSON.stringify(draft)).not.toContain('rawText');
    expect(draft.items.every((item) => item.amountMinor > 0)).toBe(true);
  });

  it('matches a larger synthetic mixed receipt total after three discounts', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Towar Jeden A 1.0 x 4,79 4,79A
Towar Dwa B 1.0 x 3,69 3,69B
Towar Wagowy C
0.50 x 25,49 12,82C
kg
Towar Trzy A 6,99
Towar Cztery B 5,54
Towar Piaty C 1.0 x 1,49 1,49C
Rabat -0,75
0,74C
Towar Szosty A 1.0 x 1,49 1,49A
Rabat -0,74
0,75A
Towar Siodmy B 1.0 x 8,99 8,99B
Rabat -4,50
4,49B
SUMA 39,81`);

    expect(parsed.detectedItemsTotalMinor).toBe(3981);
    expect(parsed.declaredTotalMinor).toBe(3981);
    expect(parsed.warnings.some((warning) => warning.code === 'sum-mismatch')).toBe(false);
    expect(parsed.items.every((item) => (item.amountMinor ?? 0) > 0)).toBe(true);
  });
});
