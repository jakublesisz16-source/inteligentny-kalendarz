import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const rates = readFileSync('src/finance/exchange-rates.ts', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.87 compact travel-ready Finance month', () => {
  it('uses one compact monthly summary surface instead of separate overview/category panels', () => {
    expect(dashboard).toContain('finance-month-summary-compact');
    expect(dashboard).toContain('finance-month-summary-meta');
    expect(dashboard).toContain('finance-month-category-chips');
    expect(dashboard).not.toContain('panel finance-month-overview finance-necessity-overview finance-fast-overview');
    expect(dashboard).not.toContain('panel finance-category-strip');
    expect(css).toContain('/* 1.2.0.87 - month Finance mirrors the compact trip summary */');
  });

  it('keeps transaction-first and trip-ready primary actions intact', () => {
    expect(dashboard).toContain('finance-month-transaction-list');
    expect(dashboard).toContain('button button-primary finance-manual-expense');
    expect(dashboard).toContain('openReceiptEditor(detailReceipt)');
    expect(dashboard).toContain('removeReceipt(detailReceipt)');
  });

  it('keeps the travel currency path offline and mobile summary compact', () => {
    expect(rates).toContain('LOCAL_CURRENT_PLN_RATES');
    expect(rates).not.toContain('fetch(');
    expect(rates).not.toContain('api.frankfurter.dev');
    expect(responsive).toContain('/* 1.2.0.87 - compact month summary remains readable on phones */');
  });

  it('does not migrate the database before the trip release', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
