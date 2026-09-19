import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.90 Month and Trip Finance consistency', () => {
  it('uses the same summary and category grammar in Month and Trip', () => {
    expect(dashboard).toContain('finance-overview-summary-card finance-trip-summary');
    expect(dashboard).toContain('finance-overview-summary-card finance-month-summary-compact');
    expect(dashboard).toContain('finance-overview-category-strip finance-trip-category-strip');
    expect(dashboard).toContain('finance-overview-category-strip finance-month-category-chips');
    expect(dashboard).toContain('finance-overview-category-chip finance-trip-category-chip');
    expect(dashboard).toContain('finance-overview-category-chip finance-month-category-chip');
  });

  it('uses one transaction row structure with category icons in both views', () => {
    expect(dashboard).toContain('finance-expense-row finance-trip-expense-row');
    expect(dashboard).toContain('finance-expense-row finance-month-transaction-row');
    expect(dashboard).toContain('finance-expense-icon finance-trip-expense-icon');
    expect(dashboard).toContain('finance-expense-icon finance-month-transaction-icon');
    expect(dashboard).toContain("const secondary = [receipt.tripName, formatExpenseMerchantDisplayName(receipt.merchant), categoryLabel]");
  });

  it('keeps empty Month on the same summary hierarchy instead of returning to a separate dashboard style', () => {
    expect(dashboard).toContain('finance-month-empty-view');
    expect(dashboard).toContain('aria-label="Podsumowanie pustego miesiąca"');
    expect(dashboard).toContain('finance-trip-empty finance-month-empty');
  });

  it('centralizes the shared desktop and mobile layout', () => {
    expect(css).toContain('/* 1.2.0.90 - Month and Trip Finance share one compact visual grammar. */');
    expect(css).toContain('.finance-expense-row {');
    expect(css).toContain('grid-template-columns: 64px 28px minmax(0,1fr) auto 12px;');
    expect(responsive).toContain('/* 1.2.0.90 - Month and Trip keep the same Finance hierarchy on phones. */');
  });

  it('keeps schema stable', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
