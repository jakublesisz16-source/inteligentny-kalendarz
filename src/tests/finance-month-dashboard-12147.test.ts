import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.147 Finance month dashboard hierarchy', () => {
  it('puts monthly spend and comparison ahead of secondary metrics', () => {
    expect(dashboard).toContain('finance-month-dashboard-v147');
    expect(dashboard).toContain('Wydatki w miesiącu');
    expect(dashboard).toContain('monthSummary.totalMinor');
    expect(dashboard).toContain('monthSummary.averageReceiptMinor');
    expect(dashboard).toContain('Transakcje');
    expect(dashboard).toContain('Średnio');
  });

  it('keeps necessity filtering but moves review work next to the expense list', () => {
    expect(dashboard).toContain("filterByNecessity('essential')");
    expect(dashboard).toContain("filterByNecessity('nonessential')");
    expect(dashboard).toContain('finance-expense-review-link');
    expect(dashboard).toContain('Do poprawy <strong>{categoryReviewRows.length}</strong>');
    expect(dashboard).not.toContain("className={`${reviewOnly ? 'is-active ' : ''}${categoryReviewRows.length ? 'has-review' : ''}`.trim()");
  });

  it('shows the four largest categories with amount, share and a lightweight progress bar', () => {
    expect(dashboard).toContain('Największe kategorie');
    expect(dashboard).toContain('Wszystkie kategorie');
    expect(dashboard).toContain('categoryAnalytics.slice(0, 4)');
    expect(dashboard).toContain('entry.sharePercent.toFixed(1)');
    expect(dashboard).toContain('finance-month-category-bar');
    expect(dashboard).toContain('onClick={() => filterByCategory(entry.categoryId)}');
  });

  it('uses dashboard layout on desktop and folds to a single readable column on narrow phones', () => {
    expect(css).toContain('/* 1.2.0.147 - Finance month dashboard hierarchy: total first, lightweight metrics, ranked categories. */');
    expect(css).toContain('grid-template-columns: repeat(4,minmax(0,1fr));');
    expect(responsive).toContain('/* 1.2.0.147 - Finance month dashboard folds cleanly without shrinking touch targets. */');
    expect(responsive).toContain('.finance-month-dashboard-v147 .finance-month-dashboard-head { grid-template-columns: 1fr; }');
    expect(responsive).toContain('.finance-month-category-grid { grid-template-columns: 1fr; }');
  });

  it('does not change the durable finance schema', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
