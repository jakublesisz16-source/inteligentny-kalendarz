import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createReceipt,
  deleteDatabaseForTests,
  listExpenseCategories,
  listReceipts,
  syncExpenseProductsFromReceipts,
} from '../storage/database';
import { buildExpenseProductAnalytics, buildExpenseUnitPriceSummaries } from '../finance/finance-products';

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

beforeEach(async () => { await deleteDatabaseForTests(); });

describe('1.2.0.35 Finance simple trusted price snapshot', () => {
  it('compares only trusted unit prices for the same stored unit', async () => {
    const category = (await listExpenseCategories())[0]!;
    await createReceipt({
      merchant: 'Sklep A',
      date: '2026-09-01',
      source: 'receipt',
      items: [{ name: 'Banany', categoryId: category.id, amountMinor: 176, quantity: 0.252, unit: 'kg', unitPriceMinor: 699 }],
    });
    await createReceipt({
      merchant: 'Sklep B',
      date: '2026-09-05',
      source: 'receipt',
      items: [{ name: 'Banany', categoryId: category.id, amountMinor: 163, quantity: 0.251, unit: 'kg', unitPriceMinor: 649 }],
    });
    await createReceipt({
      merchant: 'Sklep C',
      date: '2026-09-08',
      source: 'receipt',
      items: [{ name: 'Banany', categoryId: category.id, amountMinor: 182, quantity: 0.25, unit: 'kg', unitPriceMinor: 729 }],
    });
    await createReceipt({
      merchant: 'Sklep D',
      date: '2026-09-09',
      source: 'receipt',
      items: [{ name: 'Banany', categoryId: category.id, amountMinor: 799 }],
    });

    const products = await syncExpenseProductsFromReceipts();
    const analytics = buildExpenseProductAnalytics(await listReceipts(), products);
    const banana = analytics.find((entry) => entry.product.name === 'Banany')!;
    const summaries = buildExpenseUnitPriceSummaries(banana.occurrences);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ unit: 'kg', occurrenceCount: 3, merchantCount: 3 });
    expect(summaries[0]?.latest.unitPriceMinor).toBe(729);
    expect(summaries[0]?.previous?.unitPriceMinor).toBe(649);
    expect(summaries[0]?.lowest.unitPriceMinor).toBe(649);
    expect(summaries[0]?.lowest.merchant).toBe('Sklep B');
  });

  it('keeps different units in separate comparison groups', () => {
    const summaries = buildExpenseUnitPriceSummaries([
      { productId: 'p', receiptId: 'r1', itemId: 'i1', date: '2026-09-08', merchant: 'A', rawName: 'X', categoryId: 'c', amountMinor: 500, quantity: 1, unit: 'kg', unitPriceMinor: 500, receiptCreatedAt: '2026-09-08T10:00:00.000Z' },
      { productId: 'p', receiptId: 'r2', itemId: 'i2', date: '2026-09-07', merchant: 'B', rawName: 'X', categoryId: 'c', amountMinor: 300, quantity: 1, unit: 'op', unitPriceMinor: 300, receiptCreatedAt: '2026-09-07T10:00:00.000Z' },
    ]);
    expect(summaries.map((entry) => entry.unit)).toEqual(['kg', 'op']);
  });

  it('adds the price insight inside the existing product modal instead of a new screen', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain('Cena jednostkowa');
    expect(dashboard).toContain('Najniżej zapisane');
    expect(dashboard).toContain('Po kolejnym zakupie');
    expect(dashboard).toContain('buildExpenseUnitPriceSummaries');
    expect(dashboard).not.toContain('Historia cen</h1>');
    expect(dashboard).not.toContain('Porównywarka sklepów');
  });

  it('does not add a database migration for derived price history', () => {
    const version = source('../core/version.ts');
    const types = source('../shopping/expenses.types.ts');
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
    expect(types).toContain('unitPriceMinor?: number;');
  });
});
