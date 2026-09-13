import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createReceipt,
  deleteDatabaseForTests,
  listExpenseCategories,
  syncExpenseProductsFromReceipts,
  updateExpenseProduct,
} from '../storage/database';
import { expenseNecessityLabel, inferExpenseNecessity } from '../shopping/expenses.utils';

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

beforeEach(async () => { await deleteDatabaseForTests(); });

describe('1.2.0.30 Finance necessity classification', () => {
  it('uses conservative automatic suggestions for obvious products', () => {
    expect(inferExpenseNecessity('Czekolada mleczna 100 g')).toBe('nonessential');
    expect(inferExpenseNecessity('Napój gazowany Cola 1,5 l')).toBe('nonessential');
    expect(inferExpenseNecessity('Monster Energy 500 ml')).toBe('nonessential');
    expect(inferExpenseNecessity('Chipsy ziemniaczane')).toBe('nonessential');
    expect(inferExpenseNecessity('Mleko 3,2% 1 l')).toBe('essential');
    expect(inferExpenseNecessity('Papier toaletowy 8 rolek')).toBe('essential');
    expect(inferExpenseNecessity('Produkt nieznany OCR')).toBe('unknown');
    expect(expenseNecessityLabel('essential')).toBe('Niezbędne');
    expect(expenseNecessityLabel('nonessential')).toBe('Zbędne');
    expect(expenseNecessityLabel('unknown')).toBe('Do oceny');
  });

  it('stores the suggestion on the product and keeps a manual correction', async () => {
    const category = (await listExpenseCategories()).find((entry) => entry.id === 'expense-category-food')!;
    await createReceipt({
      merchant: 'Sklep',
      date: '2026-09-07',
      source: 'receipt',
      items: [{ name: 'Czekolada mleczna 100 g', categoryId: category.id, amountMinor: 699 }],
    });

    const [created] = await syncExpenseProductsFromReceipts();
    expect(created?.necessity).toBe('nonessential');

    await updateExpenseProduct(created!.id, {
      name: created!.name,
      categoryId: created!.categoryId,
      necessity: 'essential',
    });

    const [afterSync] = await syncExpenseProductsFromReceipts();
    expect(afterSync?.necessity).toBe('essential');
  });

  it('keeps the main finance screen simple and makes type editable inline', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain('Niezbędne <strong>{formatMoneyMinor(necessityTotals.essential)}</strong>');
    expect(dashboard).toContain('Zbędne <strong>{formatMoneyMinor(necessityTotals.nonessential)}</strong>');
    expect(dashboard).toContain('finance-necessity-select');
    expect(dashboard).toContain('changeProductNecessity');
    expect(dashboard).toContain('<span>Typ</span>');
    expect(dashboard).not.toContain('Budżet miesięczny');
    expect(dashboard).not.toContain('Cele oszczędnościowe');
  });

  it('keeps necessity independent from receipt quantity metadata', () => {
    const types = source('../shopping/expenses.types.ts');
    const parser = source('../shopping/receipt-ocr/receipt-parser.ts');
    const version = source('../core/version.ts');
    expect(types).toContain("export type ExpenseNecessity = 'essential' | 'nonessential' | 'unknown';");
    expect(types).toContain('necessity?: ExpenseNecessity;');
    expect(parser).not.toContain('ExpenseNecessity');
    expect(version).toContain("APP_VERSION = '1.2.0'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
