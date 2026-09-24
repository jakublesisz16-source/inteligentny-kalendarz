import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Build214 Finance Items mobile polish', () => {
  it('condenses review state into the Pozycje switch on phones', () => {
    const finance = read('src/finance/FinanceDashboardView.tsx');
    const css = read('src/styles/interface-refinement.css');
    expect(finance).toContain('itemAttentionCount');
    expect(finance).toContain('finance-items-review-badge');
    expect(css).toMatch(/\.finance-expense-section-v177 \.finance-expense-review-link,[\s\S]*?\.finance-expense-section-v177 \.finance-expense-assessment-link \{\s*display: none;/u);
  });

  it('keeps search and filtering simple on narrow screens', () => {
    const finance = read('src/finance/FinanceDashboardView.tsx');
    expect(finance).toContain('placeholder="Szukaj pozycji"');
    expect(finance).toContain('finance-purchase-filter-panel');
    expect(finance).toContain('Filtry');
  });

  it('uses a compact three-layer mobile item card with a right-edge details action', () => {
    const css = read('src/styles/interface-refinement.css');
    expect(css).toContain("'product money details'");
    expect(css).toContain("'category necessity necessity'");
    expect(css).toContain("'merchant date date'");
    expect(css).toContain('.finance-purchase-details-column .icon-button');
    expect(css).toContain('content: none;');
  });

  it('does not change transaction-first Finance or schema 14', () => {
    const finance = read('src/finance/FinanceDashboardView.tsx');
    const version = read('src/core/version.ts');
    expect(finance).toContain("useState<FinanceExpenseListMode>('TRANSACTIONS')");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
