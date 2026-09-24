import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.79 Finance hierarchy polish', () => {
  it('makes manual expenses primary without removing receipt scanning', () => {
    expect(dashboard).toContain('button button-primary finance-manual-expense');
    expect(dashboard).toContain('>+ Wydatek</button>');
    expect(dashboard).toContain('button button-secondary finance-scan-receipt');
    expect(dashboard).toContain('finance-scan-receipt-short">Skanuj');
    expect(dashboard).toContain('finance-scan-receipt-long">paragon');
  });

  it('keeps trips light and removes dashboard-like duplicate statistics', () => {
    expect(dashboard).toContain('finance-trips-heading');
    expect(dashboard).toContain('finance-trip-summary-simple');
    expect(dashboard).toContain('finance-trip-summary-meta');
    expect(dashboard).not.toContain('Twoje wyjazdy');
    expect(dashboard).not.toContain('finance-trip-summary-stats');
    expect(dashboard).not.toContain('activeTripItemCount');
    expect(dashboard).not.toContain('activeTripCategoryRows');
  });

  it('puts the expense description before merchant metadata in transaction rows', () => {
    expect(dashboard).toContain('function receiptExpenseTitle(receipt: Receipt)');
    expect(dashboard).toContain('<strong>{receiptExpenseTitle(receipt)}</strong>');
    expect(dashboard).toContain("[formatExpenseMerchantDisplayName(receipt.merchant), categoryLabel].filter(Boolean).join(' · ')");
    expect(dashboard).toContain('placeholder="Szukaj pozycji"');
  });

  it('uses lighter desktop and mobile presentation without a schema bump', () => {
    expect(css).toContain('/* 1.2.0.79 - Finance hierarchy polish: expense-first actions and lighter trips */');
    expect(responsive).toContain('/* 1.2.0.79 - simple Finance hierarchy on phones */');
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
