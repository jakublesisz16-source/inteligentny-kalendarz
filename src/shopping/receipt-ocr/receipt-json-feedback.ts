import type { FinanceCurrencyCode } from '../expenses.types';
import type { ParsedReceiptDraft, ReceiptReviewDraft } from './receipt-ocr.types';
import {
  receiptReviewDifferenceMinor,
  receiptReviewItemNeedsReview,
  receiptReviewItemsTotalMinor,
  receiptReviewSavingsMinor,
  validateReceiptReviewForSave,
} from './receipt-review.model';

export interface ReceiptJsonFeedbackContext {
  sourceFileName: string;
  sourceFileSizeBytes: number;
  format: 'structured-e-receipt-json';
  currency: FinanceCurrencyCode;
  parsed: ParsedReceiptDraft;
}

function copyDefinedNumber(value: number | undefined): number | undefined {
  return value === undefined ? undefined : value;
}

export function buildReceiptJsonFeedbackSnapshot(
  context: ReceiptJsonFeedbackContext,
  review: ReceiptReviewDraft,
  validCategoryIds?: ReadonlySet<string>,
): Record<string, unknown> {
  const validation = validateReceiptReviewForSave(review, validCategoryIds);
  const differenceMinor = receiptReviewDifferenceMinor(review);
  const flaggedItems = review.items.filter(receiptReviewItemNeedsReview);

  return {
    private: true,
    doNotPublish: true,
    productionEngineSnapshot: true,
    provenance: {
      engine: 'structured-json-import',
      source: 'browser-live',
      sourceFileName: context.sourceFileName,
      sourceType: 'json',
      sourceFileSizeBytes: context.sourceFileSizeBytes,
      format: context.format,
      currency: context.currency,
      rawSourceIncluded: false,
      sensitivePaymentMetadataIncluded: false,
    },
    parsed: {
      merchant: context.parsed.merchant,
      merchantConfidence: context.parsed.merchantConfidence,
      date: context.parsed.date,
      dateConfidence: context.parsed.dateConfidence,
      items: context.parsed.items.map((item) => ({
        name: item.name,
        amountMinor: item.amountMinor,
        baseAmountMinor: item.baseAmountMinor,
        discountMinor: item.discountMinor,
        taxMarker: item.taxMarker,
        financialResolution: item.financialResolution,
        quantity: item.quantity,
        unit: item.unit,
        unitPriceMinor: item.unitPriceMinor,
        confidence: item.confidence,
        warnings: item.warnings,
      })),
      declaredTotalMinor: copyDefinedNumber(context.parsed.declaredTotalMinor),
      fiscalSubtotalMinor: copyDefinedNumber(context.parsed.declaredSubtotalMinor ?? context.parsed.ocrSubtotalMinor),
      taxTotalMinor: copyDefinedNumber(context.parsed.taxTotalMinor),
      depositTotalMinor: copyDefinedNumber(context.parsed.depositTotalMinor),
      finalPayableMinor: copyDefinedNumber(context.parsed.finalPayableMinor),
      paymentTotalMinor: copyDefinedNumber(context.parsed.paymentTotalMinor),
      declaredDiscountTotalMinor: copyDefinedNumber(context.parsed.declaredDiscountTotalMinor),
      detectedItemsTotalMinor: context.parsed.detectedItemsTotalMinor,
      unexplainedDifferenceMinor: copyDefinedNumber(context.parsed.unexplainedDifferenceMinor),
      subtotalResolution: context.parsed.subtotalResolution,
      adjustments: context.parsed.adjustments.map((adjustment) => ({
        kind: adjustment.kind,
        amountMinor: adjustment.amountMinor,
      })),
      warnings: context.parsed.warnings.map((warning) => ({ code: warning.code, message: warning.message })),
    },
    review: {
      merchant: review.merchant,
      merchantConfidence: review.merchantConfidence,
      date: review.date,
      dateConfidence: review.dateConfidence,
      itemCount: review.items.length,
      flaggedItemCount: flaggedItems.length,
      flaggedItemNames: flaggedItems.map((item) => item.name),
      itemsTotalMinor: receiptReviewItemsTotalMinor(review),
      savingsMinor: receiptReviewSavingsMinor(review),
      depositTotalMinor: copyDefinedNumber(review.depositTotalMinor),
      declaredTotalMinor: copyDefinedNumber(review.declaredTotalMinor),
      paymentTotalMinor: copyDefinedNumber(review.paymentTotalMinor),
      differenceMinor,
      saveValidation: validation,
      parserWarnings: review.parserWarnings.map((warning) => ({ code: warning.code, message: warning.message })),
      items: review.items.map((item) => ({
        name: item.name,
        categoryId: item.categoryId,
        amountText: item.amountText,
        quantityText: item.quantityText,
        unit: item.unit,
        unitPriceText: item.unitPriceText,
        baseAmountMinor: item.baseAmountMinor,
        discountMinor: item.discountMinor,
        confidence: item.confidence,
        warnings: item.warnings,
        needsReview: receiptReviewItemNeedsReview(item),
      })),
    },
  };
}

export function stringifyReceiptJsonFeedbackSnapshot(
  context: ReceiptJsonFeedbackContext,
  review: ReceiptReviewDraft,
  validCategoryIds?: ReadonlySet<string>,
): string {
  return JSON.stringify(buildReceiptJsonFeedbackSnapshot(context, review, validCategoryIds), null, 2);
}
