import { describe, expect, it } from 'vitest';
import type { ExpenseCategory } from '../shopping/expenses.types';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';
import { createReceiptReviewDraft, isSignificantReceiptMismatch } from '../shopping/receipt-ocr/receipt-review.model';

const categories: ExpenseCategory[] = [{ id: 'other', name: 'Inne', sortOrder: 0, createdAt: '', updatedAt: '' }];

describe('1.2.0 Build157 low-resolution receipt fail-closed safety', () => {
  it('keeps a sub-zloty OCR value error visible and requires explicit save confirmation', () => {
    const parsed = parseReceiptText([
      'SKLEP TESTOWY',
      '2026-06-25',
      'Produkt A',
      '1 x 10,00 10,00 C',
      'Produkt B',
      '1 x 5,00 5,60 C',
      'SUMA PLN 15,00',
    ].join('\n'));

    expect(parsed.items).toHaveLength(2);
    expect(parsed.detectedItemsTotalMinor).toBe(1560);
    expect(parsed.declaredTotalMinor).toBe(1500);
    expect(parsed.unexplainedDifferenceMinor).toBe(60);
    expect(parsed.warnings.some((warning) => warning.code === 'sum-mismatch')).toBe(true);
    expect(parsed.items[1]?.warnings.length).toBeGreaterThan(0);

    const review = createReceiptReviewDraft(parsed, categories);
    expect(isSignificantReceiptMismatch(review)).toBe(true);
  });
});
