import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { formatExpenseMerchantDisplayName, formatExpenseProductDisplayName } from '../shopping/expenses.utils';

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

describe('1.2.0.37 Finance composition polish', () => {
  it('keeps OCR source data untouched while cleaning only compact UI labels', () => {
    expect(formatExpenseProductDisplayName('LoDiuDuoWan-Tru120ml')).toBe('Lo Diu Duo Wan - Tru 120 ml');
    expect(formatExpenseProductDisplayName('NapEnerDziko,5lPus!')).toBe('Nap Ener Dziko,5 l Pus');
    expect(formatExpenseMerchantDisplayName('JERONIMO MARTINS POLSKA S.A.')).toBe('Biedronka');
    expect(formatExpenseMerchantDisplayName('Lidl Polska')).toBe('Lidl Polska');
  });

  it('removes the redundant large review card and keeps one compact correction strip by the table', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).not.toContain('finance-review-overview');
    expect(dashboard).toContain('finance-review-strip');
    expect(dashboard).toContain('Do poprawy <strong>{categoryReviewRows.length}</strong>');
    expect(dashboard).toContain('formatExpenseProductDisplayName(row.canonicalName)');
    expect(dashboard).toContain('formatExpenseMerchantDisplayName(row.receipt.merchant)');
  });

  it('forces a coherent four-cell desktop summary and compact category card', () => {
    const css = source('../styles/components.css');
    expect(css).toContain('/* 1.2.0.37 - Finance composition polish and fast correction */');
    expect(css).toContain('grid-template-columns: repeat(4,minmax(0,1fr));');
    expect(css).toContain('.finance-review-strip');
    expect(css).toContain('.finance-category-overview-list-only .finance-core-section-heading');
  });

  it('does not let a production service worker cache stale Vite development CSS/JS', () => {
    const registration = source('../app/registerServiceWorker.ts');
    expect(registration).toContain('if (import.meta.env.DEV)');
    expect(registration).toContain("key.startsWith(APP_CACHE_PREFIX)");
    expect(registration).toContain('registration.unregister()');
    expect(registration).toContain('window.location.reload()');
    expect(registration).toContain('export async function cleanupDevelopmentServiceWorker');
  });
});
