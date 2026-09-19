import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

describe('1.2.0.35 Finance compact workflow', () => {
  it('keeps the compact summary/category foundation while the current release may place review directly by the table', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    const styles = source('../styles/components.css');
    expect(dashboard).toContain('finance-overview-summary-card');
    expect(dashboard).toContain('finance-overview-category-strip');
    expect(dashboard).toContain('Do poprawy');
    expect(styles).toContain('.finance-overview-category-strip');
  });

  it('treats Other or an unknown necessity as one quick review queue', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain('reviewPurchaseRows');
    expect(dashboard).toContain("row.necessity === 'unknown'");
    expect(dashboard).toContain('row.effectiveCategoryId === otherCategoryId');
    expect(dashboard).toContain('showReviewPurchases');
    expect(dashboard).toContain('setReviewOnly(true)');
  });

  it('jumps to review automatically only after the newly saved receipt is present in derived rows', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain('const savedReceipt = await createReceipt');
    expect(dashboard).toContain('setAutoReviewReceiptId(savedReceipt.id)');
    expect(dashboard).toContain('row.receipt.id === autoReviewReceiptId');
    expect(dashboard).toContain('Paragon zapisany. Wszystkie pozycje są przypisane.');
  });

  it('adds one-click filters and bulk category correction without a new screen', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain('finance-quick-filters');
    expect(dashboard).toContain('Do poprawy');
    expect(dashboard).toContain('Zaznacz widoczne');
    expect(dashboard).toContain('applyBulkCategory');
    expect(dashboard).toContain('await updateReceiptItemCategory(row.receipt.id, row.item.id, bulkCategoryId)');
    expect(dashboard).toContain('Ustaw kategorię...');
  });

  it('keeps inline category learning and highlights editable review fields', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    const styles = source('../styles/components.css');
    expect(dashboard).toContain('changePurchaseCategory');
    expect(dashboard).toContain('changeProductNecessity');
    expect(dashboard).toContain('finance-category-select');
    expect(dashboard).toContain('finance-necessity-select');
    expect(styles).toContain('.finance-purchase-table thead th { position: sticky;');
    expect(styles).toContain('.finance-purchase-table tbody tr.is-review-row');
  });

  it('stays on schema 14 and does not add a finance budget or rule-engine store', () => {
    const version = source('../core/version.ts');
    const database = source('../storage/database.ts');
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
    expect(database).not.toContain('STORE_FINANCE_RULES');
    expect(database).not.toContain('STORE_FINANCE_BUDGETS');
  });
});
