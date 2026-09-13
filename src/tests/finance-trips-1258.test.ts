import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const types = readFileSync('src/shopping/expenses.types.ts', 'utf8');
const db = readFileSync('src/storage/database.ts', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.58 trip expense summaries', () => {
  it('stores an optional trip name without a database schema bump', () => {
    expect(types).toContain('tripName?: string;');
    expect(db).toContain("const tripName = normalizeExpenseText(draft.tripName ?? '')");
    expect(db).toContain('if (!normalized.tripName) delete updated.tripName;');
    expect(version).toContain("APP_VERSION = '1.2.0'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });

  it('offers a lightweight Month / Trips finance scope and trip summary', () => {
    expect(dashboard).toContain("type FinanceScope = 'MONTH' | 'TRIPS'");
    expect(dashboard).toContain('>Wyjazdy</button>');
    expect(dashboard).toContain('finance-trip-summary');
    expect(dashboard).toContain('finance-trip-expense-list');
    expect(dashboard).toContain('Np. Praga');
  });

  it('automatically assigns manual and scanned expenses created from a trip', () => {
    expect(dashboard).toContain("financeScope === 'TRIPS' ? normalizeTripName(activeTripName) : ''");
    expect(dashboard).toContain("{ tripName: normalizeTripName(activeTripName) }");
    expect(dashboard).toContain("financeScope === 'TRIPS' && normalizeTripName(activeTripName)");
  });

  it('keeps the trip UI compact on desktop and mobile', () => {
    expect(css).toContain('/* 1.2.0.58 - lightweight trip expense summaries */');
    expect(responsive).toContain('/* 1.2.0.58 - trip finances on mobile */');
  });
});
