import type { FinanceCurrencyCode, Receipt, ReceiptDraft } from '../expenses.types';
import { normalizeExpenseProductKey, normalizeReceiptSourceFingerprint } from '../expenses.utils';

function receiptDraftTotalMinor(draft: ReceiptDraft): number {
  return draft.items.reduce((sum, item) => sum + item.amountMinor, 0);
}

function receiptItemFingerprint(items: Array<{ name: string; amountMinor: number }>): string {
  return items
    .map((item) => `${normalizeExpenseProductKey(item.name)}#${item.amountMinor}`)
    .sort((left, right) => left.localeCompare(right, 'pl-PL'))
    .join('|');
}

function receiptItemNameFingerprint(items: Array<{ name: string }>): string {
  return items
    .map((item) => normalizeExpenseProductKey(item.name))
    .filter(Boolean)
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
  // Historical compatibility for receipts saved before merchant-header selection
  // preferred the retail brand over the legal operator. This alias only affects
  // duplicate protection and never rewrites the stored merchant.
  if (key.includes('biedronka') || key.includes('jeronimo martins polska')) return 'biedronka';
  return key;
}

export interface ReceiptDuplicateContext {
  currency?: FinanceCurrencyCode;
  tripName?: string;
}

export type ReceiptDuplicateConfidence = 'exact' | 'likely';
export type ReceiptDuplicateReason = 'same-source' | 'same-items' | 'same-amounts' | 'foreign-same-items' | 'foreign-same-total';

export interface ReceiptDuplicateMatch {
  receipt: Receipt;
  confidence: ReceiptDuplicateConfidence;
  reason: ReceiptDuplicateReason;
}

/**
 * Conservative duplicate classifier used before saving a scanned receipt.
 * `exact` is reserved for the same persisted source-file SHA-256 fingerprint.
 * Content equality alone is only `likely`, because two legitimate purchases can
 * have the same merchant/date/items/amounts. Foreign-trip scans use preserved
 * original currency/total because stored item amounts are already converted to PLN.
 */
export function findReceiptDuplicateMatch(
  draft: ReceiptDraft,
  receipts: Receipt[],
  context: ReceiptDuplicateContext = {},
): ReceiptDuplicateMatch | null {
  if (!draft.items.length) return null;
  const sourceFingerprint = normalizeReceiptSourceFingerprint(draft.sourceFingerprint);
  if (sourceFingerprint) {
    const exactSource = receipts.find((receipt) => normalizeReceiptSourceFingerprint(receipt.sourceFingerprint) === sourceFingerprint);
    if (exactSource) return { receipt: exactSource, confidence: 'exact', reason: 'same-source' };
  }
  const merchantKey = merchantFingerprint(draft.merchant);
  if (!merchantKey) return null;
  const totalMinor = receiptDraftTotalMinor(draft);
  const itemFingerprint = receiptItemFingerprint(draft.items);
  const itemNameFingerprint = receiptItemNameFingerprint(draft.items);
  const amountFingerprint = receiptAmountFingerprint(draft.items);
  const foreignCurrency = context.currency && context.currency !== 'PLN' ? context.currency : null;
  const tripKey = normalizeExpenseProductKey(context.tripName ?? '');

  for (const receipt of receipts) {
    if (receipt.date !== draft.date) continue;
    if (merchantFingerprint(receipt.merchant) !== merchantKey) continue;
    if (receipt.items.length !== draft.items.length) continue;

    if (foreignCurrency) {
      if (receipt.originalCurrency !== foreignCurrency) continue;
      if (receipt.originalAmountMinor !== totalMinor) continue;
      if (tripKey && normalizeExpenseProductKey(receipt.tripName ?? '') !== tripKey) continue;

      if (receiptItemNameFingerprint(receipt.items) === itemNameFingerprint && itemNameFingerprint) {
        return { receipt, confidence: 'likely', reason: 'foreign-same-items' };
      }
      if (draft.items.length >= 2) {
        return { receipt, confidence: 'likely', reason: 'foreign-same-total' };
      }
      continue;
    }

    if (receipt.totalMinor !== totalMinor) continue;
    if (receiptItemFingerprint(receipt.items) === itemFingerprint) {
      return { receipt, confidence: 'likely', reason: 'same-items' };
    }
    if (draft.items.length >= 2 && receiptAmountFingerprint(receipt.items) === amountFingerprint) {
      return { receipt, confidence: 'likely', reason: 'same-amounts' };
    }
  }
  return null;
}

/**
 * Compatibility wrapper for existing callers/tests that only need the receipt.
 */
export function findLikelyDuplicateReceipt(draft: ReceiptDraft, receipts: Receipt[], context: ReceiptDuplicateContext = {}): Receipt | null {
  return findReceiptDuplicateMatch(draft, receipts, context)?.receipt ?? null;
}
