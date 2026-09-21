import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const rates = readFileSync('src/finance/exchange-rates.ts', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.86 trip-ready Finance compaction', () => {
  it('keeps month Finance compact without hiding the primary transaction flow', () => {
    expect(dashboard).toContain('finance-overview-category-strip');
    expect(dashboard).toContain('finance-month-transaction-list');
    expect(dashboard).toContain('formatShortDate(receipt.date)');
    expect(dashboard).not.toContain('finance-category-overview-compact finance-category-overview-list-only finance-category-overview-light');
    expect(css).toContain('/* 1.2.0.86 - compact trip-ready Finance without adding new concepts */');
  });

  it('keeps mobile focused on manual expense entry during the trip', () => {
    expect(responsive).toContain('/* 1.2.0.86 - compact Finance stays thumb-friendly on phones */');
    expect(responsive).toContain('.finance-dashboard-controls-v1258 .finance-core-actions .finance-scan-receipt { display: none; }');
    expect(dashboard).toContain('button button-primary finance-manual-expense');
  });

  it('keeps currency conversion fully local and offline', () => {
    expect(rates).toContain('LOCAL_CURRENT_PLN_RATES');
    expect(rates).toContain("LOCAL_RATE_SNAPSHOT_DATE = '2026-09-11'");
    expect(rates).toContain('HUF: 0.01188');
    expect(rates).not.toContain('api.frankfurter.dev');
    expect(rates).not.toContain('fetch(');
  });

  it('does not change the database schema', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
