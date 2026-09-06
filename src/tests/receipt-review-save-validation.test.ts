import { describe, expect, it } from 'vitest';
import type { ReceiptReviewDraft } from '../shopping/receipt-ocr/receipt-ocr.types';
import { receiptReviewToDraft, validateReceiptReviewForSave } from '../shopping/receipt-ocr/receipt-review.model';

function validReview(): ReceiptReviewDraft {
  return {
    merchant: 'Sklep Testowy',
    merchantConfidence: 'high',
    date: '2026-08-18',
    dateConfidence: 'high',
    items: [{
      localId: '1',
      name: 'Produkt',
      categoryId: 'other',
      amountText: '10,00',
      confidence: 'high',
      warnings: [],
    }],
    parserWarnings: [],
    adjustments: [],
  };
}

describe('DEV3-B024 receipt review save validation', () => {
  it('blocks a completely empty degraded review', () => {
    const review = validReview();
    review.merchant = '';
    review.date = '';
    review.items = [];
    expect(validateReceiptReviewForSave(review, new Set(['other']))).toEqual({ valid: false, message: 'Wpisz nazwę sklepu.' });
    expect(() => receiptReviewToDraft(review)).toThrow('Wpisz nazwę sklepu.');
  });

  it('blocks missing date and missing items', () => {
    const missingDate = validReview();
    missingDate.date = '';
    expect(validateReceiptReviewForSave(missingDate, new Set(['other'])).valid).toBe(false);

    const missingItems = validReview();
    missingItems.items = [];
    expect(validateReceiptReviewForSave(missingItems, new Set(['other'])).valid).toBe(false);
  });

  it('checks that the selected category still exists', () => {
    const review = validReview();
    expect(validateReceiptReviewForSave(review, new Set(['different']))).toEqual({
      valid: false,
      message: 'Wybierz kategorię dla pozycji: Produkt.',
    });
  });

  it('allows a manually completed review and converts it through the same validator', () => {
    const review = validReview();
    expect(validateReceiptReviewForSave(review, new Set(['other']))).toEqual({ valid: true, message: '' });
    expect(receiptReviewToDraft(review)).toEqual({
      merchant: 'Sklep Testowy',
      date: '2026-08-18',
      items: [{ name: 'Produkt', categoryId: 'other', amountMinor: 1000 }],
    });
  });

  it('rejects an impossible ISO calendar date instead of accepting the shape alone', () => {
    const review = validReview();
    review.date = '2026-02-31';
    expect(validateReceiptReviewForSave(review).valid).toBe(false);
  });
});
