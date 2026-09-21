import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.149 Finance trip currency clarity', () => {
  it('uses the configured trip currency as the primary total only when every receipt has a complete matching original amount', () => {
    expect(dashboard).toContain('function completeTripOriginalTotal');
    expect(dashboard).toContain("receipt.originalCurrency !== currency || receipt.originalAmountMinor === undefined");
    expect(dashboard).toContain('activeTripOriginalTotalMinor !== null ? formatCurrencyAmountMinor');
    expect(dashboard).toContain('≈ {formatMoneyMinor(activeTripTotalMinor)} po przeliczeniu');
  });

  it('keeps PLN as the safe fallback for incomplete or legacy trip receipts', () => {
    expect(dashboard).toContain(': formatMoneyMinor(activeTripTotalMinor)');
    expect(dashboard).toContain(': formatMoneyMinor(trip.totalMinor)');
  });

  it('applies the same currency hierarchy to the trip average and overview list', () => {
    expect(dashboard).toContain('activeTripOriginalAverageMinor');
    expect(dashboard).toContain('finance-trip-card-v149');
    expect(dashboard).toContain('originalTotalMinor !== null ? formatCurrencyAmountMinor(originalTotalMinor, currency)');
    expect(dashboard).toContain('<small>≈ {formatMoneyMinor(trip.totalMinor)}</small>');
  });

  it('keeps the trip name and dates readable as context below the primary amount', () => {
    expect(dashboard).toContain('finance-trip-hero-context');
    expect(css).toContain('/* 1.2.0.149 - Trip currency clarity');
    expect(responsive).toContain('/* 1.2.0.149 - Keep trip currency context readable on narrow screens. */');
  });

  it('does not change the durable finance schema', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
