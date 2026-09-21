import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const modal = readFileSync('src/finance/FinanceQuickExpenseModal.tsx', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.89 travel-ready trip category cues', () => {
  it('shows compact category totals inside the existing trip summary', () => {
    expect(dashboard).toContain('activeTripCategoryTotals');
    expect(dashboard).toContain('finance-trip-category-strip');
    expect(dashboard).toContain('finance-trip-category-chip');
    expect(dashboard).toContain('<ExpenseCategoryIcon category={entry.category} />');
    expect(dashboard).toContain('.slice(0, 4)');
  });

  it('adds category icons to trip expense rows without creating another panel', () => {
    expect(dashboard).toContain('finance-trip-expense-icon');
    expect(dashboard).toContain('<ExpenseCategoryIcon category={category ?? { id: categoryId }} />');
    expect(css).toContain('/* 1.2.0.89 - travel-ready category cues');
  });

  it('keeps mobile fast-entry optimized for amount and save', () => {
    expect(modal).toContain('data-modal-autofocus="true"');
    expect(modal).toContain('inputMode="decimal"');
    expect(responsive).toContain('/* 1.2.0.89 - fast trip spending on phones */');
    expect(responsive).toContain('grid-template-columns: minmax(0,.7fr) minmax(0,1.3fr)');
    expect(responsive).toContain('min-height: 46px');
  });

  it('keeps schema stable', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
