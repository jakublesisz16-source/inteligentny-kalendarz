import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

describe('Build166 Finance mobile product assessment workflow', () => {
  it('keeps category correction and necessity assessment visually separate', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    const components = source('../styles/components.css');

    expect(dashboard).toContain('finance-expense-review-link');
    expect(dashboard).toContain('finance-expense-assessment-link');
    expect(dashboard).toContain("filterByNecessity('unknown')");
    expect(dashboard).toContain("function filterByNecessity(necessity: ExpenseNecessity | '') {");
    expect(dashboard).toContain('setReviewOnly(false);');
    expect(dashboard).toContain("row.categoryNeedsReview ? 'is-category-review-row' : ''");
    expect(dashboard).toContain("row.necessityNeedsReview ? 'is-necessity-review-row' : ''");
    expect(dashboard).toContain("row.necessityNeedsReview ? ' is-assessment' : ''");
    expect(dashboard).toContain("activeNecessity === 'unknown' ? 'is-active is-assessment' : 'is-assessment'");

    expect(components).toContain('.finance-purchase-table tbody tr.is-category-review-row');
    expect(components).toContain('.finance-purchase-table tbody tr.is-necessity-review-row:not(.is-category-review-row)');
    expect(components).toContain('.finance-necessity-select.is-assessment');
    expect(components).toContain('.finance-quick-filters > button.is-assessment');
  });

  it('gives the 390/360px workflow phone-sized touch targets without flattening the table into the viewport', () => {
    const responsive = source('../styles/responsive.css');

    expect(responsive).toContain('1.2.0.166 - Finance mobile assessment workflow and touch targets.');
    expect(responsive).toMatch(/@media \(max-width: 620px\)[\s\S]*?\.finance-expense-review-link,[\s\S]*?\.finance-expense-assessment-link,[\s\S]*?\.finance-expense-mode-switch button,[\s\S]*?\.finance-quick-filters > button,[\s\S]*?\.finance-category-select,[\s\S]*?\.finance-necessity-select \{ min-height: 40px; \}/u);
    expect(responsive).toContain('.finance-purchase-details-column .icon-button { width: 40px; height: 40px; min-width: 40px; }');
    expect(responsive).toContain('.finance-purchase-product-button { min-height: 40px; display: inline-flex; align-items: center; }');
    expect(responsive).toContain(".finance-purchase-product-button::after { content: '›';");
    expect(responsive).toContain('.finance-quick-filters { -webkit-overflow-scrolling: touch; overscroll-behavior-inline: contain; }');
    expect(responsive).toMatch(/@media \(max-width: 390px\)[\s\S]*?\.finance-expense-heading-tools \{ width: 100%; margin-left: 0; justify-content: flex-start; \}/u);
    expect(responsive).toContain('.finance-expense-mode-switch { margin-left: auto; }');
  });

  it('keeps the product editor stacked and history readable on narrow screens', () => {
    const responsive = source('../styles/responsive.css');
    const dashboard = source('../finance/FinanceDashboardView.tsx');

    expect(dashboard).toContain('className="finance-product-editor-fields"');
    expect(dashboard).toContain('<span>Typ wydatku</span>');
    expect(dashboard).toContain('className="finance-product-stats"');
    expect(dashboard).toContain('className="finance-product-history-row"');
    expect(responsive).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.finance-product-editor-fields \{ grid-template-columns: 1fr; \}/u);
    expect(responsive).toMatch(/@media \(max-width: 620px\)[\s\S]*?\.finance-product-history-row \{ grid-template-columns: minmax\(0,1fr\) auto; \}/u);
    expect(responsive).toMatch(/@media \(max-width: 430px\)[\s\S]*?\.finance-product-stats \{ grid-template-columns: 1fr; \}/u);
  });
});
