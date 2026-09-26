import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const review = readFileSync(new URL('../shopping/receipt-ocr/ReceiptScanReview.tsx', import.meta.url), 'utf8');
const finance = readFileSync(new URL('../finance/FinanceDashboardView.tsx', import.meta.url), 'utf8');
const refinement = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('Build236 Receipt -> Finance mobile polish', () => {
  it('keeps only the bottom sticky Receipt save action', () => {
    expect(review).not.toContain('receipt-review-mobile-save');
    expect(review).toContain('receipt-review-actions');
    expect(review).toContain('Zapisz paragon');
  });

  it('keeps merchant/date context while removing the redundant third mobile row', () => {
    expect(finance).toContain('finance-purchase-mobile-context');
    expect(finance).toContain("{formatExpenseMerchantDisplayName(row.receipt.merchant)} · {formatShortDate(row.receipt.date)}");
    expect(refinement).toContain("'product money details'");
    expect(refinement).toContain("'category necessity necessity'");
    expect(refinement).toContain('.finance-purchase-merchant-column,');
    expect(refinement).toContain('.finance-purchase-date-column { display: none; }');
  });

  it('keeps compact bulk correction as a two-column mobile action row', () => {
    expect(refinement).toContain('.finance-bulk-review-bar > span { display: none; }');
    expect(refinement).toContain('grid-template-columns: minmax(0, 1fr) auto;');
    expect(refinement).toContain('min-width: 92px;');
  });

  it('keeps the 1.2.0 release line and schema 14', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'1\.2\.0\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
