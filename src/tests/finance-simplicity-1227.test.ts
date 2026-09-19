import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

describe('Finance simplicity regression', () => {
  it('keeps the empty month focused instead of rendering a wall of zero-value panels', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain('monthSummary.receiptCount === 0');
    expect(dashboard).toContain('Dodaj pierwszy wydatek');
    expect(dashboard).toContain('Po zapisie pojawią się tutaj podsumowanie, kategorie i lista wydatków.');
    expect(dashboard).not.toContain('finance-summary-grid');
  });

  it('hides the parent-category concept from the normal category manager', () => {
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    expect(dashboard).toContain('<Modal title="Kategorie"');
    expect(dashboard).toContain('Podkategorie (${children.length})');
    expect(dashboard).toContain('Nowa podkategoria');
    expect(dashboard).toContain('Dodaj podkategorię');
    expect(dashboard).not.toContain('Kategoria nadrzędna');
    expect(dashboard).not.toContain('<span>Nadrzędna</span>');
  });

  it('keeps one subcategory level and integrates but does not rewrite the OCR engine', () => {
    const database = source('../storage/database.ts');
    const dashboard = source('../finance/FinanceDashboardView.tsx');
    const ocrEngine = source('../shopping/receipt-ocr/ocr-engine.ts');
    const version = source('../core/version.ts');
    expect(database).toContain('Obsługiwany jest jeden poziom podkategorii. Wybierz kategorię główną.');
    expect(dashboard).toContain('ReceiptScanFlow');
    expect(ocrEngine).not.toContain('ExpenseProduct');
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
