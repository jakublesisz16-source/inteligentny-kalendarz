import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const refinement = readFileSync('src/styles/interface-refinement.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('Build220 Finance donut legend readability polish', () => {
  it('maps month and trip legend rows to the same tone tokens as donut slices', () => {
    expect(refinement).toContain('--finance-chart-tone-1');
    expect(refinement).toContain('.finance-dashboard-v2 .finance-month-donut-slice-1');
    expect(refinement).toContain('.finance-month-category-tone-1');
    expect(refinement).toContain('.finance-trip-category-tone-1');
    expect(refinement).toContain('background: var(--finance-category-tone');
  });

  it('uses tone four for the shared 3 plus remainder composition', () => {
    expect(dashboard).toContain('finance-month-category-tone-4" onClick={openCategoryOverview}');
    expect(dashboard).toContain('finance-trip-category-tone-4');
    expect(dashboard).not.toContain('finance-month-category-tone-5" onClick={openCategoryOverview}');
  });

  it('keeps percentages visible on narrow phones and explains foreign-currency trip category values', () => {
    expect(dashboard).toContain('finance-trip-category-currency-note-v220');
    expect(dashboard).toContain('Udział kategorii · kwoty w PLN');
    expect(refinement).toContain('@media (max-width: 390px)');
    expect(refinement).toContain('display: block;\n    font-size: .43rem;');
  });

  it('does not change the database schema', () => {
    expect(version).toContain("DATABASE_SCHEMA_VERSION = 14");
  });
});
