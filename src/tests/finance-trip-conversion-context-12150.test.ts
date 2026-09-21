import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.150 Finance trip conversion context', () => {
  it('labels foreign-trip category shares as PLN-based instead of implying native-currency category totals', () => {
    expect(dashboard).toContain("activeTripCurrency === 'PLN' ? 'udział w kosztach wyjazdu' : 'udział liczony w PLN'");
    expect(dashboard).toContain('{activeTripCategoryContext}');
    expect(dashboard).toContain("'Kategorie wyjazdu - kwoty w PLN'");
  });

  it('keeps original transaction amount primary and marks PLN as a converted secondary value', () => {
    expect(dashboard).toContain('receiptOriginalAmount(receipt) ? <>');
    expect(dashboard).toContain('finance-trip-converted-total');
    expect(dashboard).toContain('≈ {formatMoneyMinor(receipt.totalMinor)}');
  });

  it('does not synthesize category values in the foreign currency', () => {
    expect(dashboard).toContain('<strong>{formatMoneyMinor(entry.totalMinor)}</strong>');
    expect(dashboard).not.toContain('formatCurrencyAmountMinor(entry.totalMinor, activeTripCurrency)');
    expect(css).toContain('/* 1.2.0.150 - Foreign-trip details keep native amounts primary and PLN conversion context explicit. */');
  });

  it('keeps the durable finance schema unchanged', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
