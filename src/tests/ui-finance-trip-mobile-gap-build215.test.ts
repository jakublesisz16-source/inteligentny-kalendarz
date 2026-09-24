import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Build215 Finance trip mobile compaction', () => {
  it('removes the empty category heading row on phones', () => {
    const css = read('src/styles/interface-refinement.css');
    expect(css).toMatch(/Build215 - trip detail mobile compaction[\s\S]*?\.finance-trip-dashboard-v148 \.finance-trip-category-heading \{\s*display: none;/u);
    expect(css).toMatch(/\.finance-trip-dashboard-v148 \.finance-trip-category-ranking \{[\s\S]*?margin-top: 0;[\s\S]*?padding-top: 0;/u);
  });

  it('keeps a clean divider while moving categories directly under the trip summary', () => {
    const css = read('src/styles/interface-refinement.css');
    expect(css).toMatch(/\.finance-trip-dashboard-v148 \.finance-trip-hero-total \{\s*border-bottom: 0;/u);
    expect(css).toContain('border-top: 1px solid color-mix(in srgb, var(--line) 70%, transparent);');
  });

  it('does not remove trip currency editing or category filtering', () => {
    const finance = read('src/finance/FinanceDashboardView.tsx');
    expect(finance).toContain('finance-trip-currency-compact');
    expect(finance).toContain('openTripCurrencySettings');
    expect(finance).toContain('filterActiveTripByCategory');
  });

  it('does not change schema 14', () => {
    const version = read('src/core/version.ts');
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
