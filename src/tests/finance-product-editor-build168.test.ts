import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

describe('Build168 Finance product editor clarity', () => {
  it('shows live canonical category and necessity without changing classification logic', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');

    expect(dashboard).toContain('finance-product-classification-preview');
    expect(dashboard).toContain("expenseCategoryPath(categories, editProduct.categoryId)");
    expect(dashboard).toContain("expenseNecessityLabel(editProduct.necessity)");
    expect(dashboard).toContain("editProduct.necessity === 'unknown' ? <small>Wymaga decyzji</small>");
    expect(dashboard).toContain('Używane w Miesiącu, Wyjeździe i eksporcie');
  });

  it('keeps product history compact by default and expandable on demand', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');

    expect(dashboard).toContain('productHistoryExpanded ? 20 : 6');
    expect(dashboard).toContain('finance-product-history-toggle');
    expect(dashboard).toContain("productHistoryExpanded ? 'Pokaż mniej'");
    expect(dashboard).toContain('Pokaż całą historię');
    expect(dashboard).toContain('Historia ceny jednostkowej');
  });

  it('keeps narrow-screen controls readable and touchable', () => {
    const responsive = source('../styles/responsive.css');
    const components = source('../styles/components.css');

    expect(components).toContain('1.2.0.168 - Finance product editor classification and history clarity');
    expect(components).toContain('.finance-product-editor-name { grid-column: 1 / -1; }');
    expect(components).toContain('.finance-product-history-toggle');
    expect(responsive).toContain('1.2.0.168 - Finance product editor mobile clarity');
    expect(responsive).toContain('.finance-product-editor-fields select,');
    expect(responsive).toContain('.finance-product-editor-fields input { min-height: 42px; }');
    expect(responsive).toContain('.finance-product-history-toggle { min-height: 44px; }');
    expect(responsive).toMatch(/@media \(max-width: 390px\)[\s\S]*?\.finance-product-history-heading \{ display: grid; grid-template-columns: 1fr; gap: 3px; \}/u);
  });
});
