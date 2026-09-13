import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string { return readFileSync(path, 'utf8').replace(/\r\n?/g, '\n'); }

const dashboard = source('src/finance/FinanceDashboardView.tsx');
const css = source('src/styles/components.css');
const responsive = source('src/styles/responsive.css');
const version = source('src/core/version.ts');

describe('1.2.0.78 transaction-first monthly Finance view', () => {
  it('defaults monthly expenses to transaction rows and keeps item detail as a second level', () => {
    expect(dashboard).toContain("type FinanceExpenseListMode = 'TRANSACTIONS' | 'ITEMS'");
    expect(dashboard).toContain("useState<FinanceExpenseListMode>('TRANSACTIONS')");
    expect(dashboard).toContain('finance-month-transaction-list');
    expect(dashboard).toContain('>Transakcje</button>');
    expect(dashboard).toContain('>Pozycje</button>');
    expect(dashboard).toContain("expenseListMode === 'TRANSACTIONS'");
  });

  it('keeps category, necessity and review drill-downs on the detailed item view', () => {
    expect(dashboard).toContain("function showReviewPurchases() {\n    setExpenseListMode('ITEMS');");
    expect(dashboard).toContain("function filterByCategory(categoryId: string) {\n    setExpenseListMode('ITEMS');");
    expect(dashboard).toContain("function filterByNecessity(necessity: ExpenseNecessity | '') {\n    setExpenseListMode('ITEMS');");
  });

  it('uses a compact responsive transaction list without changing the database schema', () => {
    expect(css).toContain('/* 1.2.0.78 - Finance month defaults to a lightweight transaction list */');
    expect(responsive).toContain('/* 1.2.0.78 - transaction-first Finance remains readable on mobile */');
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
