import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

describe('Finance products foundation regression', () => {
  it('keeps category management directly accessible and avoids a duplicate heading action', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain('finance-core-actions');
    expect(dashboard).toContain('>Kategorie</button>');
    expect(dashboard).not.toContain('>Zarządzaj</button>');
  });

  it('keeps canonical product history behind the product name instead of a separate catalogue block', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).not.toContain('Kartoteka produktów');
    expect(dashboard).toContain('finance-purchase-product-button');
    expect(dashboard).toContain('Nazwa ujednolicona');
    expect(dashboard).toContain('Oryginalna nazwa z historii');
    expect(dashboard).toContain('Historia ceny pojawia się automatycznie tylko tam, gdzie paragon podał pewną jednostkę i cenę jednostkową.');
  });

  it('keeps the dedicated product store in schema 14', () => {
    const database = source('../storage/database.ts');
    const version = source('../core/version.ts');
    expect(database).toContain("const STORE_EXPENSE_PRODUCTS = 'expenseProducts'");
    expect(database).toContain('syncExpenseProductsFromReceipts');
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
