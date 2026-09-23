import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const finance = readFileSync(new URL('../finance/FinanceDashboardView.tsx', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../styles/responsive.css', import.meta.url), 'utf8');
const consistency = readFileSync(new URL('../styles/interface-consistency.css', import.meta.url), 'utf8');


describe('Build 177 Finance default-surface simplification', () => {
  it('keeps both primary month actions available on phones', () => {
    expect(finance).toContain('finance-scan-receipt-long');
    expect(responsive).toContain('.finance-dashboard-controls-v1258 .finance-core-actions .finance-scan-receipt {');
    expect(responsive).toContain('display: inline-flex;');
    expect(responsive).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
  });

  it('keeps the month summary useful but limits mobile category noise', () => {
    expect(finance).toContain('finance-month-dashboard-v177');
    expect(responsive).toContain('.finance-month-dashboard-v177 .finance-month-category-grid > .finance-month-category-row:nth-child(n+3)');
    expect(responsive).toContain('display: none;');
    expect(finance).toContain('>Wszystkie</button>');
  });

  it('keeps review controls one level deeper in item mode', () => {
    expect(finance).toContain("expenseListMode === 'ITEMS' && categoryReviewRows.length");
    expect(finance).toContain("expenseListMode === 'ITEMS' && necessityReviewRows.length");
    expect(finance).toContain('Transakcje');
    expect(finance).toContain('Pozycje');
  });

  it('removes the duplicated month label from the category subsection', () => {
    const categoryHeadingStart = finance.indexOf('className="finance-month-category-heading"');
    const categoryGridStart = finance.indexOf('className="finance-month-category-grid"', categoryHeadingStart);
    const categoryHeading = finance.slice(categoryHeadingStart, categoryGridStart);
    expect(categoryHeading).toContain('>Kategorie</strong>');
    expect(categoryHeading).not.toContain('formatMonthLabel(monthKey)');
    expect(consistency).toContain('1.2.0.177 - Finance keeps the default surface transaction-first and decision-light.');
  });
});
