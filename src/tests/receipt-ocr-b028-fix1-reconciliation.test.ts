import { describe, expect, it } from 'vitest';
import { reconcileReceiptFinancials } from '../shopping/receipt-ocr/receipt-financial-reconciliation';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';
import { createReceiptReviewDraft, receiptReviewDifferenceMinor, receiptReviewItemsTotalMinor, receiptReviewSavingsMinor } from '../shopping/receipt-ocr/receipt-review.model';

const categories = [{ id: 'other', name: 'Inne', sortOrder: 0, createdAt: '', updatedAt: '' }];

describe('1.1.0-dev.3 DEV3-B028-FIX1 merchant and financial reconciliation', () => {
  it('recovers a merchant from repeated document evidence when the logo line is corrupted', () => {
    const parsed = parseReceiptText([
      'I.2ABIL.',
      'Adres siedziby: Testowa 1',
      'nr rej: BDO 000000001 Nova sp.',
      '2026-08-01',
      'Produkt A',
      '1 * 10.00 10.00 C',
      'Nova Plus kupon -1,00',
      'Produkt B 5,00',
      'Suma PLN 14,00',
      'Suma 14,00',
      'Z Nova Plus zaoszczędzono',
      '1,00 zł',
    ].join('\n'));
    expect(parsed.merchant).toBe('Nova');
    expect(parsed.merchantConfidence).toBe('high');
  });

  it('keeps an ordinary correct first-line merchant when no stronger conflicting evidence exists', () => {
    const parsed = parseReceiptText('NOVA\n2026-08-01\nProdukt A 10,00\nSUMA 10,00');
    expect(parsed.merchant).toBe('NOVA');
  });

  it('uses two independent equations to repair a conflicting OCR subtotal', () => {
    const result = reconcileReceiptFinancials({
      itemsTotalMinor: 3251,
      ocrSubtotalMinor: 3224,
      depositTotalMinor: 600,
      finalTotalMinor: 3851,
      paymentTotalMinor: 3851,
    });
    expect(result).toMatchObject({
      reconciledSubtotalMinor: 3251,
      subtotalResolution: 'items-final-consensus',
      unexplainedDifferenceMinor: 0,
      paymentDifferenceMinor: 0,
      financiallyConsistent: true,
      subtotalCorrectedFromOcr: true,
    });
  });


  it('reconciles an ordinary receipt without a deposit', () => {
    const result = reconcileReceiptFinancials({ itemsTotalMinor: 3251, ocrSubtotalMinor: 3251, finalTotalMinor: 3251, paymentTotalMinor: 3251 });
    expect(result.reconciledSubtotalMinor).toBe(3251);
    expect(result.unexplainedDifferenceMinor).toBe(0);
    expect(result.paymentDifferenceMinor).toBe(0);
    expect(result.financiallyConsistent).toBe(true);
  });

  it('marks a conflicting payment as unresolved instead of correcting it', () => {
    const result = reconcileReceiptFinancials({ itemsTotalMinor: 3251, finalTotalMinor: 3251, paymentTotalMinor: 4000 });
    expect(result.reconciledSubtotalMinor).toBe(3251);
    expect(result.paymentDifferenceMinor).toBe(749);
    expect(result.financiallyConsistent).toBe(false);
  });
  it('does not invent a correction when the evidence does not reconcile', () => {
    const result = reconcileReceiptFinancials({
      itemsTotalMinor: 2000,
      ocrSubtotalMinor: 2100,
      finalTotalMinor: 3000,
    });
    expect(result.reconciledSubtotalMinor).toBe(2100);
    expect(result.subtotalResolution).toBe('ocr-unconfirmed');
    expect(result.financiallyConsistent).toBe(false);
  });

  it('treats a deposit as explained structure instead of a receipt mismatch', () => {
    const parsed = parseReceiptText([
      'NOVA',
      '2026-08-01',
      'Produkt A 10,00',
      'Suma PLN 10,00',
      'Opakowania zwrotne suma 2,00',
      'Suma 12,00',
      'Płatność Karta płatnicza 12,00',
    ].join('\n'));
    const review = createReceiptReviewDraft(parsed, categories);
    expect(receiptReviewItemsTotalMinor(review)).toBe(1000);
    expect(review.depositTotalMinor).toBe(200);
    expect(review.declaredTotalMinor).toBe(1200);
    expect(receiptReviewDifferenceMinor(review)).toBe(0);
  });

  it('uses final post-discount amounts as the review item sum', () => {
    const parsed = parseReceiptText([
      'NOVA',
      '2026-08-01',
      'Produkt A 10,99',
      'Program kupon -1,10',
      'Produkt B 1,76',
      'Program kupon -1,01',
      'Produkt C 11,88',
      'Produkt D 9,99',
      'Suma PLN 32,24',
      'Opakowania zwrotne suma 6,00',
      'Suma 38,51',
      'Płatność Karta płatnicza 38,51',
      'Zaoszczędzono',
      '2,11 zł',
    ].join('\n'));
    const review = createReceiptReviewDraft(parsed, categories);
    expect(review.items.map((item) => item.amountText)).toEqual(['9,89', '0,75', '11,88', '9,99']);
    expect(receiptReviewItemsTotalMinor(review)).toBe(3251);
    expect(receiptReviewSavingsMinor(review)).toBe(211);
    expect(review.ocrSubtotalMinor).toBe(3224);
    expect(review.declaredSubtotalMinor).toBe(3251);
    expect(review.depositTotalMinor).toBe(600);
    expect(review.paymentTotalMinor).toBe(3851);
    expect(receiptReviewDifferenceMinor(review)).toBe(0);
  });

  it('recovers a damaged litre suffix only in the quantity look-ahead path', () => {
    const parsed = parseReceiptText('NOVA\n2026-08-01\nNapój źródlany 1,51.\n12 * 0.99 11.88 A\nSUMA 11,88');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.name).toBe('Napój źródlany 1,5 l');
    expect(parsed.items[0]?.amountMinor).toBe(1188);
  });
});
