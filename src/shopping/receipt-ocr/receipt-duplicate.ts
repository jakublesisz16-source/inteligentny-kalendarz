import type { FinanceCurrencyCode, Receipt, ReceiptDraft } from '../expenses.types';
import { normalizeExpenseProductKey } from '../expenses.utils';

function receiptDraftTotalMinor(draft: ReceiptDraft): number {
  return draft.items.reduce((sum, item) => sum + item.amountMinor, 0);
}

function receiptItemFingerprint(items: Array<{ name: string; amountMinor: number }>): string {
  return items
    .map((item) => `${normalizeExpenseProductKey(item.name)}#${item.amountMinor}`)
    .sort((left, right) => left.localeCompare(right, 'pl-PL'))
    .join('|');
}

function receiptAmountFingerprint(items: Array<{ amountMinor: number }>): string {
  return items
    .map((item) => item.amountMinor)
    .sort((left, right) => left - right)
    .join('|');
}

function merchantFingerprint(value: string): string {
  const key = normalizeExpenseProductKey(value);
  if (!key) return '';
  // The same Biedronka receipt may expose either the retail brand or the legal
  // entity name depending on OCR crop/header quality. This alias is only used
  // for duplicate warning and never rewrites the stored merchant.
  if (key.includes('biedronka') || key.includes('jeronimo martins polska')) return 'biedronka';
  return key;
}

/**
 * Conservative duplicate detector used only to warn before saving a scanned receipt.
 * Exact normalized item/name/value matches are preferred. As a second safe path,
 * the warning also triggers for the same date, merchant, total, item count and exact
 * multiset of item amounts. Foreign-trip scans are compared against preserved original
 * currency/total metadata because their stored item values have already been converted to PLN.
 * The user can still explicitly save.
 */
export interface ReceiptDuplicateContext {
  currency?: FinanceCurrencyCode;
  tripName?: string;
}

export function findLikelyDuplicateReceipt(draft: ReceiptDraft, receipts: Receipt[], context: ReceiptDuplicateContext = {}): Receipt | null {
  if (!draft.items.length) return null;
  const merchantKey = merchantFingerprint(draft.merchant);
  if (!merchantKey) return null;
  const totalMinor = receiptDraftTotalMinor(draft);
  const itemFingerprint = receiptItemFingerprint(draft.items);
  const amountFingerprint = receiptAmountFingerprint(draft.items);
  const foreignCurrency = context.currency && context.currency !== 'PLN' ? context.currency : null;
  const tripKey = normalizeExpenseProductKey(context.tripName ?? '');

  return receipts.find((receipt) => {
    if (receipt.date !== draft.date) return false;
    if (merchantFingerprint(receipt.merchant) !== merchantKey) return false;
    if (receipt.items.length !== draft.items.length) return false;

    if (foreignCurrency) {
      if (receipt.originalCurrency !== foreignCurrency) return false;
      if (receipt.originalAmountMinor !== totalMinor) return false;
      if (tripKey && normalizeExpenseProductKey(receipt.tripName ?? '') !== tripKey) return false;
      return true;
    }

    if (receipt.totalMinor !== totalMinor) return false;
    if (receiptItemFingerprint(receipt.items) === itemFingerprint) return true;
    if (draft.items.length < 2) return false;
    return receiptAmountFingerprint(receipt.items) === amountFingerprint;
  }) ?? null;
}
