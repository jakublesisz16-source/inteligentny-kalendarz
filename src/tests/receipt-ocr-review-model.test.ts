import { describe, expect, it } from 'vitest';
import type { ExpenseCategory } from '../shopping/expenses.types';
import type { ReceiptReviewDraft } from '../shopping/receipt-ocr/receipt-ocr.types';
import { isSignificantReceiptMismatch, receiptReviewDifferenceMinor, receiptReviewItemsTotalMinor, receiptReviewToDraft } from '../shopping/receipt-ocr/receipt-review.model';

const categories: ExpenseCategory[] = [{ id: 'other', name: 'Inne', sortOrder: 0, createdAt: '', updatedAt: '' }];
void categories;

function review(): ReceiptReviewDraft {
  return {
    merchant: 'Sklep', merchantConfidence: 'high', date: '2026-08-16', dateConfidence: 'high', declaredTotalMinor: 500,
    parserWarnings: [], adjustments: [],
    items: [
      { localId: '1', name: 'A', categoryId: 'other', amountText: '2,00', confidence: 'high', warnings: [] },
      { localId: '2', name: 'B', categoryId: 'other', amountText: '3,00', confidence: 'high', warnings: [] },
    ],
  };
}

describe('1.1.0-dev.3 receipt review model', () => {
  it('builds the existing ReceiptDraft shape without OCR metadata', () => {
    const draft = receiptReviewToDraft(review());
    expect(draft).toEqual({ merchant: 'Sklep', date: '2026-08-16', items: [
      { name: 'A', categoryId: 'other', amountMinor: 200 }, { name: 'B', categoryId: 'other', amountMinor: 300 },
    ] });
    expect(JSON.stringify(draft)).not.toContain('confidence');
    expect(JSON.stringify(draft)).not.toContain('raw');
  });

  it('compares item and declared totals in integer minor units', () => {
    expect(receiptReviewItemsTotalMinor(review())).toBe(500);
    expect(receiptReviewDifferenceMinor(review())).toBe(0);
    const changed = review(); changed.items[1]!.amountText = '4,00';
    expect(receiptReviewDifferenceMinor(changed)).toBe(100);
    expect(isSignificantReceiptMismatch(changed)).toBe(true);
  });

  it('does not invent a receipt total when OCR did not find one', () => {
    const draft = review(); delete draft.declaredTotalMinor;
    expect(receiptReviewDifferenceMinor(draft)).toBeUndefined();
    expect(isSignificantReceiptMismatch(draft)).toBe(false);
  });

  it('rejects invalid data before persistence while allowing corrected OCR data', () => {
    const invalid = review(); invalid.items[0]!.amountText = '0';
    expect(() => receiptReviewToDraft(invalid)).toThrow('prawid\u0142ow\u0105 kwot\u0119');
    invalid.items[0]!.amountText = '1,25';
    expect(receiptReviewToDraft(invalid).items[0]!.amountMinor).toBe(125);
  });
});
