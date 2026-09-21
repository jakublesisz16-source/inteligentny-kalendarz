import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('finance dashboard foundation regression', () => {
  it('keeps the main finance surface focused on current essentials', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain('Wydatki w miesiącu');
    expect(dashboard).toContain('poprzednio');
    expect(dashboard).toContain('Największe kategorie');
    expect(dashboard).toContain('Wydatki');
    expect(dashboard).toContain('finance-scan-receipt-short">Skanuj');
    expect(dashboard).toContain('finance-scan-receipt-long">paragon');
    expect(dashboard).toContain('finance-manual-expense');
    expect(dashboard).not.toContain('Ostatnie 6 miesięcy');
  });

  it('uses the existing expense persistence model without a database migration', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    const version = source('../core/version.ts');
    expect(dashboard).toContain('await createReceipt({');
    expect(dashboard).toContain('items: [{');
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });

  it('wires the protected receipt OCR flow into Finance without restoring legacy analytics clutter', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain('ReceiptScanFlow');
    expect(dashboard).toContain('finance-scan-receipt-short">Skanuj');
    expect(dashboard).toContain('finance-scan-receipt-long">paragon');
    expect(dashboard).not.toContain('aggregateExpensesByProduct');
    expect(dashboard).not.toContain('aggregateExpensesByMerchant');
  });

  it('preserves the legacy finance engine instead of deleting it', () => {
    const legacy = source('../shopping/ExpensesView.tsx');
    expect(legacy).toContain('ReceiptScanFlow');
    expect(legacy).toContain('aggregateExpensesByProduct');
    expect(legacy).toContain('createExpenseCategory');
  });
});
