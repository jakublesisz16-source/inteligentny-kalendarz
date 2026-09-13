import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

describe('1.2.0.30 Finance core flow', () => {
  it('makes receipt scanning the primary finance action', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain('className="button button-secondary finance-scan-receipt"');
    expect(dashboard).toContain('Skanuj paragon');
    expect(dashboard).toContain('finance-manual-expense');
    expect(dashboard).toContain('<ReceiptScanFlow');
    expect(dashboard).toContain('onSave={saveScannedReceipt}');
  });

  it('automatically persists scanned receipts into the existing finance model', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain("let receiptDraft: ReceiptDraft = { ...draft, source: 'receipt'");
    expect(dashboard).toContain('const savedReceipt = await createReceipt(receiptDraft);');
    expect(dashboard).toContain('setMonthKey(draft.date.slice(0, 7));');
    expect(dashboard).toContain('await refresh();');
    expect(dashboard).toContain('setAutoReviewReceiptId(savedReceipt.id)');
    expect(dashboard).toContain('Wszystkie pozycje są przypisane.');
  });

  it('uses one category composition view and one table instead of stacked report blocks', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain('finance-overview-category-strip');
    expect(dashboard).toContain('finance-overview-category-chip');
    expect(dashboard).not.toContain('finance-category-donut');
    expect(dashboard).toContain('finance-purchase-table');
    expect(dashboard).toContain('Szukaj nazwy, miejsca lub kategorii');
    expect(dashboard).not.toContain('Ostatnie 6 miesięcy');
    expect(dashboard).not.toContain('Kartoteka produktów');
  });

  it('does not keep the superseded budget system or change the durable schema/OCR parser contract', () => {
    const version = source('../core/version.ts');
    const parser = source('../shopping/receipt-ocr/receipt-parser.ts');
    const settings = source('../settings/settings.types.ts');
    const database = source('../storage/database.ts');
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
    expect(settings).not.toContain('financeBudgets');
    expect(database).not.toContain('normalizeFinanceBudgets');
    expect(parser).not.toContain('ExpenseProduct');
    expect(parser).not.toContain('finance-purchase-table');
  });
});
