import { describe, expect, it } from 'vitest';
import type { ReceiptReviewDraft, ReceiptReviewItem } from '../shopping/receipt-ocr/receipt-ocr.types';
import { convertForeignReceiptDraftToPln } from '../finance/foreign-receipt';
import { receiptReviewItemNeedsReview, receiptReviewToDraft } from '../shopping/receipt-ocr/receipt-review.model';

function baseReview(): ReceiptReviewDraft {
  return {
    merchant: 'Sklep Testowy',
    merchantConfidence: 'high',
    date: '2026-09-19',
    dateConfidence: 'high',
    declaredTotalMinor: 9092,
    depositTotalMinor: 250,
    parserWarnings: [],
    adjustments: [],
    items: [
      { localId: 'goods', name: 'Zakupy', categoryId: 'other', amountText: '88,42', confidence: 'high', warnings: [] },
    ],
  };
}

function reviewItem(patch: Partial<ReceiptReviewItem> = {}): ReceiptReviewItem {
  return {
    localId: 'item',
    name: 'Produkt',
    categoryId: 'other',
    amountText: '7,98',
    confidence: 'medium',
    warnings: [],
    ...patch,
  };
}

describe('1.2.0 Build155 receipt deposit persistence and review semantics', () => {
  it('converts detected deposit into a durable receipt item so the saved total matches the paid total', () => {
    const draft = receiptReviewToDraft(baseReview(), { depositCategoryId: 'expense-category-deposit' });
    expect(draft.items).toEqual([
      { name: 'Zakupy', categoryId: 'other', amountMinor: 8842 },
      { name: 'Kaucja / opakowania zwrotne', categoryId: 'expense-category-deposit', amountMinor: 250 },
    ]);
    expect(draft.items.reduce((sum, item) => sum + item.amountMinor, 0)).toBe(9092);
  });


  it('does not duplicate a deposit that the user already represented explicitly with the same total', () => {
    const review = baseReview();
    review.items.push({
      localId: 'deposit-manual',
      name: 'Kaucja',
      categoryId: 'expense-category-deposit',
      amountText: '2,50',
      confidence: 'high',
      warnings: [],
    });
    const draft = receiptReviewToDraft(review, { depositCategoryId: 'expense-category-deposit' });
    expect(draft.items.filter((item) => item.categoryId === 'expense-category-deposit')).toHaveLength(1);
    expect(draft.items.reduce((sum, item) => sum + item.amountMinor, 0)).toBe(9092);
  });

  it('fails closed when an explicitly represented deposit conflicts with the OCR deposit total', () => {
    const review = baseReview();
    review.items.push({
      localId: 'deposit-manual',
      name: 'Kaucja',
      categoryId: 'expense-category-deposit',
      amountText: '1,50',
      confidence: 'high',
      warnings: [],
    });
    expect(() => receiptReviewToDraft(review, { depositCategoryId: 'expense-category-deposit' })).toThrow(/Kaucja w pozycjach/iu);
  });

  it('keeps the generated deposit inside foreign-trip conversion and original total metadata', () => {
    const draft = receiptReviewToDraft(baseReview(), { depositCategoryId: 'expense-category-deposit' });
    const converted = convertForeignReceiptDraftToPln(draft, 'EUR', 4.25);
    expect(converted.originalCurrency).toBe('EUR');
    expect(converted.originalAmountMinor).toBe(9092);
    expect(converted.items).toHaveLength(2);
    expect(converted.items.some((item) => item.categoryId === 'expense-category-deposit')).toBe(true);
    expect(converted.items.reduce((sum, item) => sum + item.amountMinor, 0)).toBe(Math.round(9092 * 4.25));
  });

  it('fails closed instead of silently dropping a detected deposit when the category cannot be resolved', () => {
    expect(() => receiptReviewToDraft(baseReview())).toThrow(/Kaucja \/ opakowania zwrotne/iu);
  });

  it('does not flag a medium-confidence Nx price item when the arithmetic is exact and there are no warnings', () => {
    expect(receiptReviewItemNeedsReview(reviewItem({ quantityText: '2', unitPriceText: '3,99' }))).toBe(false);
  });

  it('does not flag a medium-confidence weighted item when quantity x unit price matches the amount', () => {
    expect(receiptReviewItemNeedsReview(reviewItem({ amountText: '3,72', quantityText: '0,248', unit: 'kg', unitPriceText: '14,99' }))).toBe(false);
  });

  it('does not flag a clean discount when base minus discount matches the final amount', () => {
    expect(receiptReviewItemNeedsReview(reviewItem({ amountText: '7,18', baseAmountMinor: 798, discountMinor: 80 }))).toBe(false);
  });

  it('still requires review for arithmetic mismatches, warnings and low-confidence items', () => {
    expect(receiptReviewItemNeedsReview(reviewItem({ quantityText: '2', unitPriceText: '4,99' }))).toBe(true);
    expect(receiptReviewItemNeedsReview(reviewItem({ quantityText: '2', unitPriceText: '3,99', warnings: ['Niepewna ilość.'] }))).toBe(true);
    expect(receiptReviewItemNeedsReview(reviewItem({ confidence: 'low', quantityText: '2', unitPriceText: '3,99' }))).toBe(true);
  });
});
