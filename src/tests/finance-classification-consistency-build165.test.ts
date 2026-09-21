import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ExpenseProduct, ReceiptItem } from '../shopping/expenses.types';
import {
  buildExpenseProductIndex,
  expenseItemNeedsCategoryReview,
  expenseItemNeedsNecessityReview,
  normalizeExpenseProductKey,
  resolveExpenseItemClassification,
} from '../shopping/expenses.utils';

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

function product(overrides: Partial<ExpenseProduct> = {}): ExpenseProduct {
  const name = overrides.name ?? 'Mleko testowe 1l';
  return {
    id: 'product-1',
    name,
    originalName: name,
    normalizedKey: normalizeExpenseProductKey(name),
    categoryId: 'expense-category-food',
    necessity: 'essential',
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
    ...overrides,
  };
}

function item(overrides: Partial<ReceiptItem> = {}): ReceiptItem {
  return {
    id: 'item-1',
    name: 'Mleko testowe 1l',
    categoryId: 'expense-category-other',
    amountMinor: 499,
    ...overrides,
  };
}

describe('Build165 finance classification consistency', () => {
  it('uses the canonical product as the effective category/name/necessity source without rewriting the receipt item', () => {
    const storedItem = item();
    const canonical = product();
    const classification = resolveExpenseItemClassification(storedItem, buildExpenseProductIndex([canonical]));

    expect(classification.categoryId).toBe('expense-category-food');
    expect(classification.necessity).toBe('essential');
    expect(classification.canonicalName).toBe(canonical.name);
    expect(storedItem.categoryId).toBe('expense-category-other');
  });

  it('falls back to the stored category and Do oceny when no canonical product exists', () => {
    const classification = resolveExpenseItemClassification(item({ name: 'Nieznany produkt' }), buildExpenseProductIndex([]));
    expect(classification.categoryId).toBe('expense-category-other');
    expect(classification.necessity).toBe('unknown');
  });

  it('keeps category correction and necessity assessment as separate review reasons', () => {
    const categoryOnly = resolveExpenseItemClassification(
      item({ name: 'Produkt kat' }),
      buildExpenseProductIndex([product({ name: 'Produkt kat', categoryId: 'expense-category-other', necessity: 'essential' })]),
    );
    expect(expenseItemNeedsCategoryReview(categoryOnly, 'expense-category-other')).toBe(true);
    expect(expenseItemNeedsNecessityReview(categoryOnly)).toBe(false);

    const necessityOnly = resolveExpenseItemClassification(
      item({ name: 'Produkt typ', categoryId: 'expense-category-food' }),
      buildExpenseProductIndex([product({ name: 'Produkt typ', categoryId: 'expense-category-food', necessity: 'unknown' })]),
    );
    expect(expenseItemNeedsCategoryReview(necessityOnly, 'expense-category-other')).toBe(false);
    expect(expenseItemNeedsNecessityReview(necessityOnly)).toBe(true);
  });

  it('wires the same resolver through month, trip, detail/editor and export, while auto-review stays category-only', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    const database = source('../storage/database.ts');
    const excel = source('../data-transfer/excel-export.ts');

    expect(dashboard).toContain('resolveExpenseItemClassification(item, productByKey).categoryId');
    expect(dashboard).toContain('const classification = resolveExpenseItemClassification(item, productByKey);');
    expect(dashboard).toContain('const form = receiptEditForm(receipt, productByKey);');
    expect(dashboard).toContain('setEditReceipt(persistedTrip ? { ...form, tripName: persistedTrip.name } : form);');
    expect(dashboard).toContain('const rowsToReview = savedRows.filter((row) => row.categoryNeedsReview);');
    expect(dashboard).toContain("filterByNecessity('unknown')");
    expect(dashboard).toContain('originalEffectiveCategoryId');
    expect(dashboard).toContain('categoryChanged');

    expect(database).toContain('const receiptNeedsUpdate = item.categoryId !== categoryId;');
    expect(database).toContain('const productNeedsUpdate = Boolean(product && product.categoryId !== categoryId);');
    expect(database).toContain('if (!receiptNeedsUpdate && !productNeedsUpdate)');

    expect(excel).toContain('buildExpenseProductIndex(asExpenseProducts(stores.expenseProducts ?? []))');
    expect(excel).toContain("'Nazwa ujednolicona', 'Typ', 'Kategoria zapisana', 'Dane dodatkowe'");
    expect(excel).toContain('expenseNecessityLabel(classification.necessity)');
  });
});
