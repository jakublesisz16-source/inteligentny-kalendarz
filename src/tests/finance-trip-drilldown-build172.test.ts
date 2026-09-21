import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.172 Finance trip category drill-down', () => {
  it('keeps trip transactions as the default and opens item drill-down only after category selection', () => {
    expect(dashboard).toContain("const [activeTripCategoryId, setActiveTripCategoryId] = useState('')");
    expect(dashboard).toContain("activeTripCategoryId ? 'Pozycje' : 'Wydatki'");
    expect(dashboard).toContain('finance-trip-item-drilldown');
    expect(dashboard).toContain('finance-trip-expense-list');
  });

  it('turns ranked trip categories into explicit filter controls', () => {
    expect(dashboard).toContain('filterActiveTripByCategory(entry.categoryId)');
    expect(dashboard).toContain('aria-pressed={activeTripCategoryId === entry.categoryId}');
    expect(dashboard).toContain('Pokaż pozycje kategorii');
    expect(dashboard).toContain('Wszystkie transakcje');
  });

  it('uses effective product classification and category descendants in the drill-down', () => {
    expect(dashboard).toContain('expenseCategoryDescendantIds(categories, activeTripCategoryId)');
    expect(dashboard).toContain('resolveExpenseItemClassification(item, productByKey)');
    expect(dashboard).toContain('activeTripItemRows.filter((row) => activeTripCategoryFilterIds.includes(row.categoryId))');
    expect(dashboard).toContain('expenseNecessityLabel(row.necessity)');
  });

  it('keeps editing one tap beyond the item by opening the existing transaction detail', () => {
    expect(dashboard).toContain('onClick={() => setDetailReceipt(row.receipt)}');
    expect(dashboard).toContain('onClick={() => openReceiptEditor(detailReceipt)}>Edytuj</button>');
  });

  it('resets trip drill-down when leaving or switching trip context', () => {
    expect(dashboard.match(/setActiveTripCategoryId\(''\)/gu)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it('keeps the new controls readable on phone widths without schema changes', () => {
    expect(css).toContain('1.2.0.172 - Trip categories become a lightweight item drill-down');
    expect(responsive).toContain('1.2.0.172 - Trip category drill-down remains compact and tappable on phones.');
    expect(responsive).toContain('.finance-trip-drilldown-reset { min-height: 40px; }');
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
