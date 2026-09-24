import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('finance categories and history regression', () => {
  it('keeps category management and editing available while using one purchase table', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain('finance-scan-receipt-short">Skanuj');
    expect(dashboard).toContain('finance-scan-receipt-long">paragon');
    expect(dashboard).toContain('<Modal title="Kategorie"');
    expect(dashboard).toContain('placeholder="Szukaj pozycji"');
    expect(dashboard).toContain('Wyczyść filtry');
    expect(dashboard).toContain('Edytuj transakcję');
    expect(dashboard).toContain('Transakcja usunięta.');
    expect(dashboard).toContain('Cofnij');
    expect(dashboard).toContain('finance-purchase-table');
  });

  it('uses OCR in the main finance flow without reintroducing the old merchant/product dashboard blocks', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain('ReceiptScanFlow');
    expect(dashboard).toContain('finance-scan-receipt-short">Skanuj');
    expect(dashboard).toContain('finance-scan-receipt-long">paragon');
    expect(dashboard).not.toContain('aggregateExpensesByProduct');
    expect(dashboard).not.toContain('aggregateExpensesByMerchant');
  });

  it('marks manual and scanned receipt sources without modifying the OCR engine', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    const ocrEngine = source('../shopping/receipt-ocr/ocr-engine.ts');
    expect(dashboard).toContain("source: 'manual'");
    expect(dashboard).toContain("source: 'receipt'");
    expect(ocrEngine).not.toContain('ReceiptSource');
  });

  it('keeps current schema 14', () => {
    const version = source('../core/version.ts');
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
