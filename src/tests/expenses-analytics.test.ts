import { describe, expect, it } from 'vitest';
import type { ExpenseCategory, Receipt } from '../shopping/expenses.types';
import {
  aggregateExpensesByCategory,
  aggregateExpensesByMerchant,
  aggregateExpensesByProduct,
  compareMonthExpenses,
  getMonthExpenseSummary,
  getSixMonthTrend,
  rankProductsByFrequency,
} from '../shopping/expenses.utils';

function receipt(input: {
  id: string;
  date: string;
  merchant: string;
  items: Array<{ id: string; name: string; categoryId: string; amountMinor: number }>;
  createdAt?: string;
}): Receipt {
  const totalMinor = input.items.reduce((sum, item) => sum + item.amountMinor, 0);
  return {
    id: input.id,
    date: input.date,
    merchant: input.merchant,
    items: input.items,
    totalMinor,
    createdAt: input.createdAt ?? `${input.date}T10:00:00.000Z`,
    updatedAt: input.createdAt ?? `${input.date}T10:00:00.000Z`,
  };
}

const categories: ExpenseCategory[] = [
  { id: 'food', name: 'Jedzenie', sortOrder: 0, createdAt: 'x', updatedAt: 'x' },
  { id: 'home', name: 'Dom', sortOrder: 1, createdAt: 'x', updatedAt: 'x' },
  { id: 'other', name: 'Inne', sortOrder: 2, createdAt: 'x', updatedAt: 'x' },
];

const data: Receipt[] = [
  receipt({
    id: 'aug-a', date: '2026-08-15', merchant: ' Lidl ',
    items: [
      { id: 'a1', name: 'Mleko', categoryId: 'food', amountMinor: 1000 },
      { id: 'a2', name: 'Płyn do naczyń', categoryId: 'home', amountMinor: 500 },
    ],
  }),
  receipt({
    id: 'aug-b', date: '2026-08-10', merchant: 'LIDL',
    items: [
      { id: 'b1', name: ' mleko ', categoryId: 'food', amountMinor: 700 },
      { id: 'b2', name: 'Chleb', categoryId: 'food', amountMinor: 300 },
    ],
  }),
  receipt({
    id: 'aug-c', date: '2026-08-20', merchant: 'Biedronka',
    items: [{ id: 'c1', name: 'Kawa', categoryId: 'food', amountMinor: 2000 }],
  }),
  receipt({
    id: 'jul-a', date: '2026-07-20', merchant: 'Lidl',
    items: [{ id: 'j1', name: 'Lipiec', categoryId: 'food', amountMinor: 2500 }],
  }),
];

describe('1.1.0-dev.2 expense analytics', () => {
  it('calculates month total, receipt count, average and largest receipt', () => {
    const summary = getMonthExpenseSummary(data, '2026-08');
    expect(summary.totalMinor).toBe(4500);
    expect(summary.receiptCount).toBe(3);
    expect(summary.averageReceiptMinor).toBe(1500);
    expect(summary.largestReceipt?.id).toBe('aug-c');
  });

  it('uses newest date then stable id for largest-receipt ties', () => {
    const tied = [
      receipt({ id: 'b', date: '2026-08-20', merchant: 'B', items: [{ id: '1', name: 'X', categoryId: 'food', amountMinor: 1000 }] }),
      receipt({ id: 'a', date: '2026-08-20', merchant: 'A', items: [{ id: '2', name: 'Y', categoryId: 'food', amountMinor: 1000 }] }),
      receipt({ id: 'older', date: '2026-08-19', merchant: 'C', items: [{ id: '3', name: 'Z', categoryId: 'food', amountMinor: 1000 }] }),
    ];
    expect(getMonthExpenseSummary(tied, '2026-08').largestReceipt?.id).toBe('a');
  });

  it('compares growth and decline without floating money math', () => {
    const growth = compareMonthExpenses(data, '2026-08');
    expect(growth).toEqual({
      currentTotalMinor: 4500,
      previousTotalMinor: 2500,
      differenceMinor: 2000,
      percentageChange: 80,
      state: 'comparable',
    });
    const decline = compareMonthExpenses(data, '2026-09');
    expect(decline.currentTotalMinor).toBe(0);
    expect(decline.previousTotalMinor).toBe(4500);
    expect(decline.percentageChange).toBe(-100);
    expect(decline.state).toBe('comparable');
  });

  it('handles zero previous month and both empty months without Infinity', () => {
    const onlyAugust = data.filter((entry) => entry.date.startsWith('2026-08'));
    const noPrevious = compareMonthExpenses(onlyAugust, '2026-08');
    expect(noPrevious.state).toBe('no-comparison');
    expect(noPrevious.percentageChange).toBeNull();
    const empty = compareMonthExpenses([], '2026-08');
    expect(empty.state).toBe('empty');
    expect(empty.percentageChange).toBeNull();
  });

  it('creates exactly six chronological trend points and fills missing months with zero', () => {
    const trend = getSixMonthTrend(data, '2026-08');
    expect(trend.map((point) => point.monthKey)).toEqual(['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']);
    expect(trend.map((point) => point.totalMinor)).toEqual([0, 0, 0, 0, 2500, 4500]);
  });

  it('keeps the six-month trend correct across a year boundary', () => {
    const trend = getSixMonthTrend([], '2026-04');
    expect(trend.map((point) => point.monthKey)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04']);
  });

  it('aggregates categories with item count, share and deterministic sorting', () => {
    const result = aggregateExpensesByCategory(data, categories, '2026-08');
    expect(result.map((entry) => [entry.categoryId, entry.totalMinor, entry.itemCount, entry.sharePercent])).toEqual([
      ['food', 4000, 4, 88.9],
      ['home', 500, 1, 11.1],
    ]);
  });

  it('normalizes merchant case and whitespace without fuzzy matching', () => {
    const result = aggregateExpensesByMerchant(data, '2026-08');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ key: 'lidl', name: 'Lidl', totalMinor: 2500, receiptCount: 2, averageReceiptMinor: 1250 });
    expect(result[1]).toMatchObject({ key: 'biedronka', totalMinor: 2000, receiptCount: 1, averageReceiptMinor: 2000 });
  });

  it('aggregates products case-insensitively and ranks by total expense', () => {
    const result = aggregateExpensesByProduct(data, '2026-08');
    expect(result.map((entry) => [entry.key, entry.totalMinor, entry.occurrenceCount])).toEqual([
      ['kawa', 2000, 1],
      ['mleko', 1700, 2],
      ['płyn do naczyń', 500, 1],
      ['chleb', 300, 1],
    ]);
  });

  it('ranks frequent products by occurrence then total and normalized name', () => {
    const products = aggregateExpensesByProduct(data, '2026-08');
    const ranked = rankProductsByFrequency(products);
    expect(ranked.map((entry) => entry.key)).toEqual(['mleko', 'kawa', 'płyn do naczyń', 'chleb']);
  });

  it('returns safe empty analytics', () => {
    expect(getMonthExpenseSummary([], '2026-08')).toMatchObject({ totalMinor: 0, receiptCount: 0, averageReceiptMinor: 0, largestReceipt: null });
    expect(aggregateExpensesByCategory([], categories, '2026-08')).toEqual([]);
    expect(aggregateExpensesByMerchant([], '2026-08')).toEqual([]);
    expect(aggregateExpensesByProduct([], '2026-08')).toEqual([]);
  });
});
