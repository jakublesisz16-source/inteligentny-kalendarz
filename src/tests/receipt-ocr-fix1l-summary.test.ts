import { describe, expect, it } from 'vitest';
import type { ExpenseCategory } from '../shopping/expenses.types';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';
import { createReceiptReviewDraft, receiptReviewBaseItemsTotalMinor, receiptReviewItemsTotalMinor, receiptReviewSavingsMinor } from '../shopping/receipt-ocr/receipt-review.model';

const categories: ExpenseCategory[] = [{ id: 'other', name: 'Inne', sortOrder: 0, createdAt: '', updatedAt: '' }];

describe('1.1.0-dev.3 DEV3-B018 receipt summary semantics', () => {
  it('shows base item total before discounts while persistence amount stays final', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Alfa 1 x 1,49 1,49\nRabat -0,75\n0,74\nProdukt Beta 2 x 8,99 17,98\nOpust -8,99\n8,99\nOPAKOWANIA ZWROTNE WYDANIA\nButelka kaucja 3 x 0,50 1,50\nOPAKOWANIA ZWROTNE SUMA 1,50\nDO ZAPŁATY 11,23 PLN`);
    const review = createReceiptReviewDraft(parsed, categories);
    expect(parsed.items.map((item) => [item.baseAmountMinor, item.discountMinor, item.amountMinor])).toEqual([
      [149, 75, 74], [1798, 899, 899],
    ]);
    expect(parsed.depositTotalMinor).toBe(150);
    expect(receiptReviewBaseItemsTotalMinor(review)).toBe(1947);
    expect(receiptReviewSavingsMinor(review)).toBe(974);
    expect(receiptReviewItemsTotalMinor(review)).toBe(973);
    expect(review.depositTotalMinor).toBe(150);
    expect(review.declaredTotalMinor).toBe(1123);
  });

  it('keeps no-discount receipts at base equals final and zero savings', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Alfa 1 x 299,00 299,00\nProdukt Beta 1 x 229,00 229,00\nSUMA PLN 528,00`);
    const review = createReceiptReviewDraft(parsed, categories);
    expect(receiptReviewBaseItemsTotalMinor(review)).toBe(52800);
    expect(receiptReviewSavingsMinor(review)).toBe(0);
    expect(receiptReviewItemsTotalMinor(review)).toBe(52800);
  });

  it('does not persist transient base and discount fields', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Alfa 1 x 1,49 1,49\nRabat -0,75\n0,74\nSUMA 0,74`);
    const review = createReceiptReviewDraft(parsed, categories);
    expect(review.items[0]).toMatchObject({ baseAmountMinor: 149, discountMinor: 75, amountText: '0,74' });
  });
});
