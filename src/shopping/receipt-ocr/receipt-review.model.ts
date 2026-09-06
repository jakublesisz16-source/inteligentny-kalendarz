import type { ExpenseCategory, ReceiptDraft } from '../expenses.types';
import { moneyMinorToInput, parseMoneyToMinor } from '../expenses.utils';
import type { ParsedReceiptDraft, ReceiptReviewDraft } from './receipt-ocr.types';

export function createReceiptReviewDraft(parsed: ParsedReceiptDraft, categories: ExpenseCategory[]): ReceiptReviewDraft {
  const fallbackCategoryId = categories.find((category) => category.name.trim().toLocaleLowerCase('pl-PL') === 'inne')?.id ?? categories[0]?.id ?? '';
  return {
    merchant: parsed.merchant ?? '',
    merchantConfidence: parsed.merchantConfidence,
    date: parsed.date ?? '',
    dateConfidence: parsed.dateConfidence,
    items: parsed.items.map((item, index) => ({
      localId: `ocr-item-${index + 1}`,
      name: item.name,
      categoryId: item.suggestedCategoryId ?? fallbackCategoryId,
      amountText: item.amountMinor === undefined ? '' : moneyMinorToInput(item.amountMinor),
      ...(item.baseAmountMinor === undefined ? {} : { baseAmountMinor: item.baseAmountMinor }),
      ...(item.discountMinor === undefined ? {} : { discountMinor: item.discountMinor }),
      confidence: item.confidence,
      warnings: [...item.warnings],
    })),
    ...(parsed.declaredTotalMinor === undefined ? {} : { declaredTotalMinor: parsed.declaredTotalMinor }),
    ...(parsed.ocrSubtotalMinor === undefined ? {} : { ocrSubtotalMinor: parsed.ocrSubtotalMinor }),
    ...(parsed.declaredSubtotalMinor === undefined ? {} : { declaredSubtotalMinor: parsed.declaredSubtotalMinor }),
    ...(parsed.depositTotalMinor === undefined ? {} : { depositTotalMinor: parsed.depositTotalMinor }),
    ...(parsed.paymentTotalMinor === undefined ? {} : { paymentTotalMinor: parsed.paymentTotalMinor }),
    ...(parsed.unexplainedDifferenceMinor === undefined ? {} : { unexplainedDifferenceMinor: parsed.unexplainedDifferenceMinor }),
    ...(parsed.declaredDiscountTotalMinor === undefined ? {} : { declaredDiscountTotalMinor: parsed.declaredDiscountTotalMinor }),
    parserWarnings: [...parsed.warnings],
    adjustments: [...parsed.adjustments],
  };
}

export function receiptReviewItemsTotalMinor(review: ReceiptReviewDraft): number {
  return review.items.reduce((sum, item) => {
    const amountMinor = parseMoneyToMinor(item.amountText);
    return sum + (amountMinor !== null && amountMinor > 0 ? amountMinor : 0);
  }, 0);
}


export function receiptReviewBaseItemsTotalMinor(review: ReceiptReviewDraft): number {
  return review.items.reduce((sum, item) => {
    const finalAmountMinor = parseMoneyToMinor(item.amountText);
    const fallback = finalAmountMinor !== null && finalAmountMinor > 0 ? finalAmountMinor : 0;
    const base = item.baseAmountMinor !== undefined && item.baseAmountMinor > 0 ? item.baseAmountMinor : fallback;
    return sum + base;
  }, 0);
}

export function receiptReviewSavingsMinor(review: ReceiptReviewDraft): number {
  return review.items.reduce((sum, item) => {
    const finalAmountMinor = parseMoneyToMinor(item.amountText);
    if (finalAmountMinor === null || finalAmountMinor <= 0) return sum;
    const base = item.baseAmountMinor !== undefined && item.baseAmountMinor >= finalAmountMinor ? item.baseAmountMinor : finalAmountMinor;
    return sum + Math.max(0, base - finalAmountMinor);
  }, 0);
}

export function receiptReviewDifferenceMinor(review: ReceiptReviewDraft): number | undefined {
  const itemsTotalMinor = receiptReviewItemsTotalMinor(review);
  if (review.declaredTotalMinor === undefined) return undefined;
  return itemsTotalMinor + (review.depositTotalMinor ?? 0) - review.declaredTotalMinor;
}

export function receiptReviewPaymentDifferenceMinor(review: ReceiptReviewDraft): number | undefined {
  if (review.declaredTotalMinor === undefined || review.paymentTotalMinor === undefined) return undefined;
  return review.paymentTotalMinor - review.declaredTotalMinor;
}

export function isSignificantReceiptMismatch(review: ReceiptReviewDraft): boolean {
  const difference = receiptReviewDifferenceMinor(review);
  return difference !== undefined && Math.abs(difference) >= 100;
}


export interface ReceiptReviewValidationResult {
  valid: boolean;
  message: string;
}

function isValidReceiptDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day;
}

export function validateReceiptReviewForSave(
  review: ReceiptReviewDraft,
  validCategoryIds?: ReadonlySet<string>,
): ReceiptReviewValidationResult {
  if (!review.merchant.trim()) return { valid: false, message: 'Wpisz nazwę sklepu.' };
  if (!isValidReceiptDate(review.date)) return { valid: false, message: 'Wybierz prawidłową datę paragonu.' };
  if (!review.items.length) return { valid: false, message: 'Dodaj co najmniej jedną pozycję paragonu.' };

  for (const item of review.items) {
    const name = item.name.trim();
    const amountMinor = parseMoneyToMinor(item.amountText);
    if (!name) return { valid: false, message: 'Każda pozycja paragonu musi mieć nazwę.' };
    if (!item.categoryId || (validCategoryIds && !validCategoryIds.has(item.categoryId))) {
      return { valid: false, message: `Wybierz kategorię dla pozycji: ${name}.` };
    }
    if (amountMinor === null || amountMinor <= 0) {
      return { valid: false, message: `Wpisz prawidłową kwotę dla pozycji: ${name}.` };
    }
  }

  return { valid: true, message: '' };
}

export function receiptReviewToDraft(review: ReceiptReviewDraft): ReceiptDraft {
  const validation = validateReceiptReviewForSave(review);
  if (!validation.valid) throw new Error(validation.message);

  return {
    merchant: review.merchant.trim(),
    date: review.date,
    items: review.items.map((item) => ({
      name: item.name.trim(),
      categoryId: item.categoryId,
      amountMinor: parseMoneyToMinor(item.amountText)!,
    })),
  };
}
