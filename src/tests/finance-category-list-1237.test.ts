import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

describe('1.2.0.37 Finance category list', () => {
  it('keeps the Finance heading without a redundant subtitle', () => {
    const view = source('../finance/FinanceView.tsx');
    expect(view).toContain('<h1>Finanse</h1>');
    expect(view).not.toContain('Skanuj paragony i od razu widz');
    expect(view).not.toContain('view-subtitle');
  });

  it('replaces the donut with compact clickable category rows and progress bars', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain('finance-overview-category-strip');
    expect(dashboard).toContain('finance-overview-category-chip');
    expect(dashboard).toContain('finance-month-category-chips');
    expect(dashboard).toContain('categoryAnalytics.slice(0, 4)');
    expect(dashboard).not.toContain('finance-category-donut');
    expect(dashboard).not.toContain('donutSegments');
  });

  it('keeps category rows directly connected to the purchase filter', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain('onClick={() => filterByCategory(entry.categoryId)}');
    expect(dashboard).toContain('aria-pressed={activeCategoryId === entry.categoryId}');
  });

  it('uses a compact list layout instead of chart-specific CSS', () => {
    const css = source('../styles/components.css');
    expect(css).toContain('/* 1.2.0.37 - Finance category list instead of chart */');
    expect(css).toContain('.finance-category-bar-track');
    expect(css).not.toContain('.finance-category-donut-segment');
  });
});
