import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createReceipt, deleteDatabaseForTests, listExpenseCategories, listReceipts } from '../storage/database';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';
import { createReceiptReviewDraft, receiptReviewToDraft } from '../shopping/receipt-ocr/receipt-review.model';

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

beforeEach(async () => { await deleteDatabaseForTests(); });

describe('1.2.0.31 Finance quantity and unit price foundation', () => {
  it('keeps a trusted quantity and unit price from an ordinary receipt line', () => {
    const parsed = parseReceiptText('SKLEP TESTOWY\n16.08.2026\nProdukt Alfa A 2 x 1,19 2,38\nSUMA 2,38');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({
      name: 'Produkt Alfa',
      amountMinor: 238,
      quantity: 2,
      unitPriceMinor: 119,
      financialResolution: 'quantity-unit-total-consensus',
    });
  });

  it('keeps an explicit kg unit for a weighted item', () => {
    const parsed = parseReceiptText('SKLEP TESTOWY\n16.08.2026\nBanany luz C 0,252kg x 6,99 1,76\nSUMA 1,76');
    expect(parsed.items[0]).toMatchObject({
      amountMinor: 176,
      quantity: 0.252,
      unit: 'kg',
      unitPriceMinor: 699,
    });
  });

  it('does not persist suspicious quantity metadata when quantity math conflicts with the printed line value', () => {
    const parsed = parseReceiptText('SKLEP TESTOWY\n16.08.2026\nOBUWIE B 4 x 229,00 229,00\nSUMA 229,00');
    expect(parsed.items[0]?.amountMinor).toBe(22900);
    expect(parsed.items[0]?.quantity).toBeUndefined();
    expect(parsed.items[0]?.unitPriceMinor).toBeUndefined();
    expect(parsed.items[0]?.warnings.join(' ')).toMatch(/Niepewna ilość/iu);
  });

  it('carries trusted OCR quantity data through review into the durable receipt draft', async () => {
    const categories = await listExpenseCategories();
    const parsed = parseReceiptText('SKLEP TESTOWY\n16.08.2026\nBanany luz C 0,252kg x 6,99 1,76\nSUMA 1,76');
    const review = createReceiptReviewDraft(parsed, categories);
    expect(review.items[0]).toMatchObject({ quantityText: '0,252', unit: 'kg', unitPriceText: '6,99' });
    const draft = receiptReviewToDraft(review);
    expect(draft.items[0]).toMatchObject({ quantity: 0.252, unit: 'kg', unitPriceMinor: 699, amountMinor: 176 });
  });

  it('stores optional quantity metadata without changing schema 14 compatibility', async () => {
    const category = (await listExpenseCategories())[0]!;
    await createReceipt({
      merchant: 'Sklep',
      date: '2026-09-08',
      source: 'receipt',
      items: [{ name: 'Banany', categoryId: category.id, amountMinor: 176, quantity: 0.252, unit: 'kg', unitPriceMinor: 699 }],
    });
    const [receipt] = await listReceipts();
    expect(receipt?.items[0]).toMatchObject({ quantity: 0.252, unit: 'kg', unitPriceMinor: 699 });
    expect(source('../core/version.ts')).toContain('DATABASE_SCHEMA_VERSION = 14');
  });

  it('shows quantity details only when data exists and keeps the main table compact', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    const review = source('../shopping/receipt-ocr/ReceiptScanReview.tsx');
    expect(dashboard).toContain('hasQuantityData');
    expect(dashboard).toContain('Ilość × cena');
    expect(dashboard).toContain("receiptUnitDetails(row.item) || '—'");
    expect(review).toContain('receipt-review-unit-details');
    expect(review).toContain('Ilość i cena:');
    expect(review).toContain('quantityText: _quantityText');
    expect(review).toContain('unitPriceText: _unitPriceText');
  });
});
