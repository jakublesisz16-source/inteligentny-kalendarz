import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createReceipt, deleteDatabaseForTests, listExpenseCategories, listReceipts } from '../storage/database';
import { findLikelyDuplicateReceipt } from '../shopping/receipt-ocr/receipt-duplicate';
import { classifyNonessentialExpenseGroup } from '../finance/finance-products';

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

beforeEach(async () => { await deleteDatabaseForTests(); });

describe('1.2.0.32 Finance fast review and simple breakdown', () => {
  it('warns for exact duplicates and arithmetic-identical rescans without blocking legitimate different totals', async () => {
    const category = (await listExpenseCategories())[0]!;
    await createReceipt({
      merchant: 'Biedronka Poznań',
      date: '2026-09-08',
      source: 'receipt',
      items: [
        { name: 'Mleko Łaciate', categoryId: category.id, amountMinor: 499 },
        { name: 'Chleb', categoryId: category.id, amountMinor: 399 },
      ],
    });
    const receipts = await listReceipts();
    const duplicate = findLikelyDuplicateReceipt({
      merchant: 'BIEDRONKA POZNAN',
      date: '2026-09-08',
      items: [
        { name: 'Chleb', categoryId: category.id, amountMinor: 399 },
        { name: 'Mleko Laciate', categoryId: category.id, amountMinor: 499 },
      ],
    }, receipts);
    expect(duplicate?.id).toBe(receipts[0]?.id);


    const spellingVariant = findLikelyDuplicateReceipt({
      merchant: 'JERONIMO MARTINS POLSKA',
      date: '2026-09-08',
      items: [
        { name: 'CHLEB PSZENN', categoryId: category.id, amountMinor: 399 },
        { name: 'MLK LAC 3,2', categoryId: category.id, amountMinor: 499 },
      ],
    }, receipts);
    expect(spellingVariant?.id).toBe(receipts[0]?.id);

    const different = findLikelyDuplicateReceipt({
      merchant: 'Biedronka Poznań',
      date: '2026-09-08',
      items: [{ name: 'Inny produkt', categoryId: category.id, amountMinor: 898 }],
    }, receipts);
    expect(different).toBeNull();


    const singleItemReceipt = [{
      ...receipts[0]!,
      id: 'single',
      totalMinor: 499,
      items: [{ ...receipts[0]!.items[0]!, name: 'Mleko Łaciate', amountMinor: 499 }],
    }];
    const oneLineSameAmountDifferentName = findLikelyDuplicateReceipt({
      merchant: 'Biedronka Poznań',
      date: '2026-09-08',
      items: [{ name: 'Inny produkt za tę samą cenę', categoryId: category.id, amountMinor: 499 }],
    }, singleItemReceipt);
    expect(oneLineSameAmountDifferentName).toBeNull();
  });

  it('keeps the nonessential breakdown intentionally small', () => {
    expect(classifyNonessentialExpenseGroup('Czekolada mleczna')).toBe('sweets');
    expect(classifyNonessentialExpenseGroup('Coca Cola gazowana')).toBe('soda-energy');
    expect(classifyNonessentialExpenseGroup('Chipsy ziemniaczane')).toBe('snacks');
    expect(classifyNonessentialExpenseGroup('Dowolny zakup')).toBe('other');
  });

  it('renders trusted OCR items compactly while uncertain items remain immediately editable', () => {
    const review = source('../shopping/receipt-ocr/ReceiptScanReview.tsx');
    expect(review).toContain('receipt-review-item-compact');
    expect(review).toContain('expandedItemIds');
    expect(review).toContain("item.confidence !== 'high' || item.warnings.length > 0");
    expect(review).toContain('Edytuj');
    expect(review).toContain('Zwiń');
  });

  it('checks for a duplicate only at scanned-receipt save time', () => {
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    expect(flow).toContain('findLikelyDuplicateReceipt');
    expect(flow).toContain('Ten paragon wygląda na już zapisany');
    expect(flow).toContain('Zapisać go ponownie?');
  });

  it('keeps nonessential spending visible in the compact month summary and filter', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain('necessityTotals.nonessential');
    expect(dashboard).toContain("filterByNecessity('nonessential')");
    expect(dashboard).toContain('Zbędne <strong>{formatMoneyMinor(necessityTotals.nonessential)}</strong>');
  });
});
