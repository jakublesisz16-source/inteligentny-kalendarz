import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ParsedReceiptDraft, ReceiptReviewDraft } from '../shopping/receipt-ocr/receipt-ocr.types';
import { buildReceiptJsonFeedbackSnapshot, stringifyReceiptJsonFeedbackSnapshot } from '../shopping/receipt-ocr/receipt-json-feedback';

const parsed: ParsedReceiptDraft = {
  merchant: 'SKLEP TESTOWY',
  merchantConfidence: 'high',
  date: '2026-09-20',
  dateConfidence: 'high',
  items: [{
    rawText: 'Produkt A | 2 × 300 = 600',
    name: 'Produkt A',
    amountMinor: 500,
    baseAmountMinor: 600,
    discountMinor: 100,
    taxMarker: 'C',
    financialResolution: 'quantity-unit-total-consensus',
    quantity: 2,
    unitPriceMinor: 300,
    confidence: 'high',
    warnings: [],
  }],
  declaredTotalMinor: 550,
  ocrSubtotalMinor: 500,
  taxTotalMinor: 24,
  declaredSubtotalMinor: 500,
  depositTotalMinor: 50,
  finalPayableMinor: 550,
  paymentTotalMinor: 550,
  unexplainedDifferenceMinor: 0,
  subtotalResolution: 'items-final-consensus',
  declaredDiscountTotalMinor: -100,
  detectedItemsTotalMinor: 500,
  adjustments: [{ rawText: 'Rabat: Produkt A', amountMinor: -100, kind: 'discount' }],
  warnings: [],
};

const review: ReceiptReviewDraft = {
  merchant: 'SKLEP TESTOWY',
  merchantConfidence: 'high',
  date: '2026-09-20',
  dateConfidence: 'high',
  items: [{
    localId: 'ocr-item-1',
    name: 'Produkt A',
    categoryId: 'food',
    amountText: '5,00',
    quantityText: '2',
    unitPriceText: '3,00',
    baseAmountMinor: 600,
    discountMinor: 100,
    confidence: 'high',
    warnings: [],
  }],
  declaredTotalMinor: 550,
  ocrSubtotalMinor: 500,
  declaredSubtotalMinor: 500,
  depositTotalMinor: 50,
  paymentTotalMinor: 550,
  unexplainedDifferenceMinor: 0,
  declaredDiscountTotalMinor: -100,
  parserWarnings: [],
  adjustments: [{ rawText: 'Rabat: Produkt A', amountMinor: -100, kind: 'discount' }],
};

describe('1.2.0 Build161 structured JSON feedback export', () => {
  it('exports a sanitized parser/review snapshot without raw source or payment identifiers', () => {
    const context = {
      sourceFileName: 'receipt.json',
      sourceFileSizeBytes: 1234,
      format: 'structured-e-receipt-json' as const,
      currency: 'PLN' as const,
      parsed,
    };
    const snapshot = buildReceiptJsonFeedbackSnapshot(context, review, new Set(['food']));
    expect(snapshot.provenance).toMatchObject({
      engine: 'structured-json-import',
      sourceType: 'json',
      rawSourceIncluded: false,
      sensitivePaymentMetadataIncluded: false,
    });
    expect(snapshot.review).toMatchObject({ itemCount: 1, itemsTotalMinor: 500, depositTotalMinor: 50, declaredTotalMinor: 550, differenceMinor: 0 });
    const text = stringifyReceiptJsonFeedbackSnapshot(context, review, new Set(['food']));
    expect(text).toContain('"saveValidation"');
    expect(text).not.toContain('Numer karty');
    expect(text).not.toContain('Numer transakcji');
    expect(text).not.toContain('rawText');
  });

  it('keeps JSON feedback actions visible in DEV review while OCR actions remain separate', () => {
    const reviewSource = readFileSync('src/shopping/receipt-ocr/ReceiptScanReview.tsx', 'utf8');
    const flowSource = readFileSync('src/shopping/receipt-ocr/ReceiptScanFlow.tsx', 'utf8');
    const helperSource = readFileSync('src/shopping/receipt-ocr/receipt-json-feedback.ts', 'utf8');
    expect(reviewSource).toContain('Kopiuj diagnostykę JSON');
    expect(reviewSource).toContain('Pobierz raport JSON');
    expect(helperSource).toContain('rawSourceIncluded: false');
    expect(flowSource).toContain('setJsonFeedbackContext({');
    expect(flowSource).toContain('jsonFeedbackContext={jsonFeedbackContext}');
  });
});
