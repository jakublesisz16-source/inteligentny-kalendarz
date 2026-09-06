import { describe, expect, it } from 'vitest';
import type { Receipt } from '../shopping/expenses.types';
import {
  aggregateReceiptsByCategory,
  filterReceiptHistory,
  formatMoneyMinor,
  parseMoneyToMinor,
  receiptsForMonth,
  sortReceiptsNewestFirst,
  totalReceiptsMinor,
} from '../shopping/expenses.utils';

function receipt(input: Pick<Receipt, 'id' | 'date' | 'totalMinor' | 'items'>): Receipt {
  return {
    merchant: input.id,
    createdAt: `${input.date}T10:00:00.000Z`,
    updatedAt: `${input.date}T10:00:00.000Z`,
    ...input,
  };
}

describe('1.1.0-dev.1 expense utils', () => {
  it('parses PLN input to integer minor units and rejects invalid values', () => {
    expect(parseMoneyToMinor('4,49')).toBe(449);
    expect(parseMoneyToMinor('4.49')).toBe(449);
    expect(parseMoneyToMinor(' 1 234,50 zł ')).toBe(123450);
    expect(parseMoneyToMinor('4,499')).toBeNull();
    expect(parseMoneyToMinor('-4,49')).toBeNull();
    expect(parseMoneyToMinor('abc')).toBeNull();
  });

  it('formats minor units deterministically', () => {
    expect(formatMoneyMinor(0)).toBe('0,00 zł');
    expect(formatMoneyMinor(449)).toBe('4,49 zł');
    expect(formatMoneyMinor(100000)).toBe('1 000,00 zł');
    expect(formatMoneyMinor(123450)).toBe('1 234,50 zł');
    expect(formatMoneyMinor(123456789)).toBe('1 234 567,89 zł');
  });

  it('filters, totals and aggregates receipts by month and category', () => {
    const augustA = receipt({
      id: 'a', date: '2026-08-15', totalMinor: 1500,
      items: [
        { id: 'a1', name: 'Jedzenie', categoryId: 'food', amountMinor: 1000 },
        { id: 'a2', name: 'Higiena', categoryId: 'hygiene', amountMinor: 500 },
      ],
    });
    const augustB = receipt({
      id: 'b', date: '2026-08-10', totalMinor: 700,
      items: [{ id: 'b1', name: 'Jedzenie 2', categoryId: 'food', amountMinor: 700 }],
    });
    const july = receipt({
      id: 'c', date: '2026-07-31', totalMinor: 900,
      items: [{ id: 'c1', name: 'Lipiec', categoryId: 'food', amountMinor: 900 }],
    });

    const august = receiptsForMonth([july, augustB, augustA], '2026-08');
    expect(totalReceiptsMinor(august)).toBe(2200);
    expect(aggregateReceiptsByCategory(august)).toEqual(new Map([['food', 1700], ['hygiene', 500]]));
    expect(sortReceiptsNewestFirst(august).map((entry) => entry.id)).toEqual(['a', 'b']);
  });
  it('filters receipt history by merchant, product, category and combined criteria without mutation', () => {
    const source = [
      { ...receipt({ id: 'a', date: '2026-08-15', totalMinor: 1500, items: [{ id: 'a1', name: 'Mleko bez laktozy', categoryId: 'food', amountMinor: 1500 }] }), merchant: '  Biedronka  ' },
      { ...receipt({ id: 'b', date: '2026-08-14', totalMinor: 900, items: [{ id: 'b1', name: 'Szampon', categoryId: 'hygiene', amountMinor: 900 }] }), merchant: 'Rossmann' },
      { ...receipt({ id: 'c', date: '2026-08-13', totalMinor: 500, items: [{ id: 'c1', name: 'Mleko UHT', categoryId: 'food', amountMinor: 500 }] }), merchant: 'LIDL' },
    ];
    const snapshot = structuredClone(source);
    expect(filterReceiptHistory(source, { query: '  biedronka ' }).map((item) => item.id)).toEqual(['a']);
    expect(filterReceiptHistory(source, { query: 'MLEKO' }).map((item) => item.id)).toEqual(['a', 'c']);
    expect(filterReceiptHistory(source, { categoryId: 'hygiene' }).map((item) => item.id)).toEqual(['b']);
    expect(filterReceiptHistory(source, { merchantKey: 'lidl' }).map((item) => item.id)).toEqual(['c']);
    expect(filterReceiptHistory(source, { query: 'mleko', categoryId: 'food', merchantKey: 'biedronka' }).map((item) => item.id)).toEqual(['a']);
    expect(source).toEqual(snapshot);
  });

});
