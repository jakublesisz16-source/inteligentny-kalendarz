import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

describe('1.2.0.35 Finance fast category review', () => {
  it('makes the category editable directly in the purchase table', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    const database = source('../storage/database.ts');
    expect(dashboard).toContain('finance-category-select');
    expect(dashboard).toContain('changePurchaseCategory');
    expect(dashboard).toContain('updateReceiptItemCategory');
    expect(database).toContain('export async function updateReceiptItemCategory');
    expect(database).toContain("db.transaction([STORE_RECEIPTS, STORE_EXPENSE_PRODUCTS], 'readwrite')");
  });

  it('opens categories as a monthly overview first and keeps management secondary', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain('finance-category-overview-list');
    expect(dashboard).toContain('do przejrzenia');
    expect(dashboard).toContain('Zarządzaj kategoriami');
    expect(dashboard).toContain('showCategoryPurchases');
  });

  it('uses the canonical product category across old occurrences without rewriting receipt amounts', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain('buildExpenseProductIndex');
    expect(dashboard).toContain('resolveExpenseItemClassification');
    expect(dashboard).toContain('categorizedReceipts');
    expect(dashboard).toContain('effectiveCategoryId');
  });

  it('feeds learned products back into receipt category suggestions', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    const suggestions = source('../shopping/receipt-ocr/category-suggestions.ts');
    expect(dashboard).toContain('products={products}');
    expect(flow).toContain('products = []');
    expect(flow).toContain('products,');
    expect(suggestions).toContain('products: ExpenseProduct[] = []');
    expect(suggestions).toContain('learnedProduct');
  });
});
