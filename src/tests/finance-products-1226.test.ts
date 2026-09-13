import { describe, expect, it } from 'vitest';
import { buildExpenseProductAnalytics, filterExpenseProductAnalytics } from '../finance/finance-products';
import type { ExpenseProduct, Receipt } from '../shopping/expenses.types';

const product: ExpenseProduct = {
  id: 'product-milk',
  name: 'Mleko Łaciate 3,2% 1 l',
  originalName: 'MLEKO LAC 3,2 1L',
  normalizedKey: 'mleko lac 3 2 1l',
  categoryId: 'expense-category-food',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

const receipts: Receipt[] = [
  {
    id: 'r2', date: '2026-09-03', merchant: 'Biedronka', totalMinor: 549,
    items: [{ id: 'i2', name: 'Mleko Lac 3,2 1L', categoryId: 'expense-category-food', amountMinor: 549 }],
    source: 'receipt', createdAt: '2026-09-03T10:00:00.000Z', updatedAt: '2026-09-03T10:00:00.000Z',
  },
  {
    id: 'r1', date: '2026-08-20', merchant: 'Lidl', totalMinor: 499,
    items: [{ id: 'i1', name: 'MLEKO LAC 3,2 1L', categoryId: 'expense-category-food', amountMinor: 499 }],
    source: 'receipt', createdAt: '2026-08-20T10:00:00.000Z', updatedAt: '2026-08-20T10:00:00.000Z',
  },
];

describe('1.2.0.26 finance product analytics', () => {
  it('keeps raw receipt item names while aggregating them under a persistent normalized product', () => {
    const result = buildExpenseProductAnalytics(receipts, [product]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      occurrenceCount: 2,
      merchantCount: 2,
      totalMinor: 1048,
      averageMinor: 524,
      minimumMinor: 499,
      maximumMinor: 549,
      lastAmountMinor: 549,
      lastDate: '2026-09-03',
      lastMerchant: 'Biedronka',
    });
    expect(result[0]!.occurrences.map((entry) => entry.rawName)).toEqual(['Mleko Lac 3,2 1L', 'MLEKO LAC 3,2 1L']);
  });

  it('searches by canonical name, raw name and merchant', () => {
    const result = buildExpenseProductAnalytics(receipts, [product]);
    expect(filterExpenseProductAnalytics(result, 'Łaciate')).toHaveLength(1);
    expect(filterExpenseProductAnalytics(result, 'Lidl')).toHaveLength(1);
    expect(filterExpenseProductAnalytics(result, 'nie istnieje')).toEqual([]);
  });
});
