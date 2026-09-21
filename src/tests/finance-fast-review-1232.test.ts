import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createReceipt, deleteDatabaseForTests, listExpenseCategories, listReceipts } from '../storage/database';
import { findLikelyDuplicateReceipt, findReceiptDuplicateMatch } from '../shopping/receipt-ocr/receipt-duplicate';
import { classifyNonessentialExpenseGroup } from '../finance/finance-products';

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

beforeEach(async () => { await deleteDatabaseForTests(); });

describe('1.2.0.32 Finance fast review and simple breakdown', () => {
  it('keeps content-identical rescans as likely while exact source identity is reserved for persisted source hashes', async () => {
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

    const exactMatch = findReceiptDuplicateMatch({
      merchant: 'BIEDRONKA POZNAN',
      date: '2026-09-08',
      items: [
        { name: 'Chleb', categoryId: category.id, amountMinor: 399 },
        { name: 'Mleko Laciate', categoryId: category.id, amountMinor: 499 },
      ],
    }, receipts);
    expect(exactMatch?.confidence).toBe('likely');
    expect(exactMatch?.reason).toBe('same-items');

    const amountOnlyMatch = findReceiptDuplicateMatch({
      merchant: 'Biedronka Poznań',
      date: '2026-09-08',
      items: [
        { name: 'Inna nazwa A', categoryId: category.id, amountMinor: 399 },
        { name: 'Inna nazwa B', categoryId: category.id, amountMinor: 499 },
      ],
    }, receipts);
    expect(amountOnlyMatch?.confidence).toBe('likely');
    expect(amountOnlyMatch?.reason).toBe('same-amounts');

    const sourceFingerprint = `sha256:${'a'.repeat(64)}`;
    const sameSourceMatch = findReceiptDuplicateMatch({
      merchant: 'OCR po korekcie',
      date: '2026-09-09',
      sourceFingerprint,
      items: [
        { name: 'Inna nazwa', categoryId: category.id, amountMinor: 123 },
        { name: 'Druga nazwa', categoryId: category.id, amountMinor: 456 },
      ],
    }, [{ ...receipts[0]!, sourceFingerprint }]);
    expect(sameSourceMatch?.confidence).toBe('exact');
    expect(sameSourceMatch?.reason).toBe('same-source');
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
    expect(review).toContain('receiptReviewItemNeedsReview');
    expect(review).toContain('Sprawdzone');
    expect(review).toContain('Edytuj');
    expect(review).toContain('Zwiń');
  });

  it('checks for a duplicate only at scanned-receipt save time', () => {
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    expect(flow).toContain('findReceiptDuplicateMatch');
    expect(flow).toContain('Ten sam plik paragonu jest już zapisany');
    expect(flow).toContain('Ten paragon jest podobny do już zapisanego');
    expect(flow).toContain('createReceiptSourceFingerprint');
  });

  it('keeps nonessential spending visible in the compact month summary and filter', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain('necessityTotals.nonessential');
    expect(dashboard).toContain("filterByNecessity('nonessential')");
    expect(dashboard).toContain('<span>Zbędne</span>');
    expect(dashboard).toContain('<strong>{formatMoneyMinor(necessityTotals.nonessential)}</strong>');
  });
});
