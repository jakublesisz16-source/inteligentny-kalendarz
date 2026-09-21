import { describe, expect, it } from 'vitest';
import type { ExpenseCategory, ExpenseProduct, Receipt } from '../shopping/expenses.types';
import { normalizeExpenseProductKey } from '../shopping/expenses.utils';
import { suggestCategoryId } from '../shopping/receipt-ocr/category-suggestions';

const categories: ExpenseCategory[] = [
  ['expense-category-food', 'Jedzenie'],
  ['expense-category-drinks', 'Napoje'],
  ['expense-category-home', 'Dom / Chemia'],
  ['expense-category-transport', 'Transport'],
  ['expense-category-other', 'Inne'],
].map(([id, name], sortOrder) => ({ id: id!, name: name!, sortOrder, createdAt: '', updatedAt: '' }));

function product(name: string, categoryId: string): ExpenseProduct {
  return {
    id: `product-${categoryId}-${name}`,
    name,
    originalName: name,
    normalizedKey: normalizeExpenseProductKey(name),
    categoryId,
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
  };
}

function receipt(name: string, categoryId: string): Receipt {
  return {
    id: 'receipt-history',
    date: '2026-09-19',
    merchant: 'Sklep',
    items: [{ id: 'item-history', name, categoryId, amountMinor: 100 }],
    totalMinor: 100,
    createdAt: '2026-09-19T12:00:00.000Z',
    updatedAt: '2026-09-19T12:00:00.000Z',
  };
}

describe('Build164 finance category quality', () => {
  it.each([
    'FilKurChoB Anty kg',
    'Olej Kujawski 1l',
    'Przy D KurKam20 30g',
    'PrzypPaprKamis16-20g',
    'PrzyCzosKamis16-20g',
    'SkrzydełkaPikanS450g',
    'WaflePano60g',
    'Pieprz Culineo 80g',
    'Sól Culineo 1kg',
    'PizzaProscGB430g',
  ])('classifies generic grocery food signal: %s', (name) => {
    expect(suggestCategoryId(name, [], categories)).toBe('expense-category-food');
  });

  it.each([
    'Olej silnikowy 5W30 4l',
    'Olej do silnika 10W40 1l',
    'Olej hydrauliczny 1l',
  ])('does not classify obvious technical oil as food: %s', (name) => {
    expect(suggestCategoryId(name, [], categories)).not.toBe('expense-category-food');
  });

  it('lets a learned non-other category override built-in heuristics', () => {
    const learned = product('Olej silnikowy 5W30 4l', 'expense-category-transport');
    expect(suggestCategoryId(learned.originalName, [], categories, [learned])).toBe('expense-category-transport');
  });

  it('repairs a learned Other product when a stronger generic food rule exists', () => {
    const learnedOther = product('Olej Kujawski 1l', 'expense-category-other');
    expect(suggestCategoryId(learnedOther.originalName, [], categories, [learnedOther])).toBe('expense-category-food');
  });

  it('keeps explicit non-other receipt history ahead of built-in suggestions', () => {
    const historical = receipt('Olej warsztatowy 1l', 'expense-category-transport');
    expect(suggestCategoryId('Olej warsztatowy 1l', [historical], categories)).toBe('expense-category-transport');
  });
});
