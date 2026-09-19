import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Receipt, ReceiptDraft } from '../shopping/expenses.types';
import { findLikelyDuplicateReceipt } from '../shopping/receipt-ocr/receipt-duplicate';

const review = readFileSync(new URL('../shopping/receipt-ocr/ReceiptScanReview.tsx', import.meta.url), 'utf8');
const flow = readFileSync(new URL('../shopping/receipt-ocr/ReceiptScanFlow.tsx', import.meta.url), 'utf8');
const finance = readFileSync(new URL('../finance/FinanceDashboardView.tsx', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

function foreignDraft(): ReceiptDraft {
  return {
    date: '2026-09-13',
    merchant: 'Restaurant Budapest',
    items: [
      { name: 'obiad', categoryId: 'food', amountMinor: 300_000 },
    ],
  };
}

function savedForeignReceipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    id: 'receipt-1',
    date: '2026-09-13',
    merchant: 'Restaurant Budapest',
    items: [{ id: 'item-1', name: 'obiad', categoryId: 'food', amountMinor: 3_564 }],
    totalMinor: 3_564,
    tripName: 'Budapeszt',
    originalCurrency: 'HUF',
    originalAmountMinor: 300_000,
    exchangeRatePlnPerUnit: 0.01188,
    conversionSource: 'rate',
    createdAt: '2026-09-13T12:00:00.000Z',
    updatedAt: '2026-09-13T12:00:00.000Z',
    ...overrides,
  };
}

describe('1.2.0.108 foreign receipt review and duplicate guard', () => {
  it('shows the trip currency in OCR review instead of labelling raw foreign amounts as PLN', () => {
    expect(flow).toContain("displayCurrency?: FinanceCurrencyCode");
    expect(flow).toContain("waluta paragonu: <strong>{displayCurrency}</strong>");
    expect(review).toContain("reviewAmountMinor(value: number, currency: FinanceCurrencyCode)");
    expect(review).toContain("Kwota{displayCurrency === 'PLN' ? '' : ` (${displayCurrency})`}");
    expect(review).toContain("Cena jednostkowa{displayCurrency === 'PLN' ? '' : ` (${displayCurrency})`}");
    expect(finance).toContain("displayCurrency: tripCurrency(activeTripDefinition)");
  });

  it('detects a re-scan of a foreign receipt using preserved original amount metadata', () => {
    const duplicate = findLikelyDuplicateReceipt(foreignDraft(), [savedForeignReceipt()], { currency: 'HUF', tripName: 'Budapeszt' });
    expect(duplicate?.id).toBe('receipt-1');
  });

  it('does not confuse the same raw amount in another trip or currency with a duplicate', () => {
    expect(findLikelyDuplicateReceipt(foreignDraft(), [savedForeignReceipt()], { currency: 'HUF', tripName: 'Praga' })).toBeNull();
    expect(findLikelyDuplicateReceipt(foreignDraft(), [savedForeignReceipt()], { currency: 'EUR', tripName: 'Budapeszt' })).toBeNull();
  });

  it('keeps database schema 14', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
