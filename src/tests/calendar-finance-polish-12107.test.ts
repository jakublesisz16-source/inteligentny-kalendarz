import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { convertForeignReceiptDraftToPln } from '../finance/foreign-receipt';
import type { ReceiptDraft } from '../shopping/expenses.types';

const calendar = readFileSync(new URL('../calendar/CalendarView.tsx', import.meta.url), 'utf8');
const finance = readFileSync(new URL('../finance/FinanceDashboardView.tsx', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('1.2.0.107 calendar and trip finance polish', () => {
  it('keeps month counters clean without the old category dot', () => {
    expect(calendar).toContain('className={`category-count category-${category.toLowerCase()}`}');
    expect(calendar).not.toContain('<i aria-hidden="true" />{counts[category]}');
  });

  it('keeps the foreign-receipt conversion path available even though Trip UI later returns to manual entry', () => {
    expect(finance).not.toContain("Skanowanie zagranicznych paragonów nie jest jeszcze obsługiwane");
    expect(finance).toContain('convertForeignReceiptDraftToPln(receiptDraft, currency, rate)');
  });

  it('converts a foreign scanned receipt to PLN while preserving original total and rate', () => {
    const draft: ReceiptDraft = {
      date: '2026-09-13',
      merchant: 'Budapest Bistro',
      items: [
        { name: 'Obiad', categoryId: 'food', amountMinor: 200_000 },
        { name: 'Napój', categoryId: 'food', amountMinor: 100_000 },
      ],
    };
    const converted = convertForeignReceiptDraftToPln(draft, 'HUF', 0.01188);
    expect(converted.originalCurrency).toBe('HUF');
    expect(converted.originalAmountMinor).toBe(300_000);
    expect(converted.exchangeRatePlnPerUnit).toBe(0.01188);
    expect(converted.conversionSource).toBe('rate');
    expect(converted.items.reduce((sum, item) => sum + item.amountMinor, 0)).toBe(3_564);
  });

  it('reconciles per-item rounding to the converted receipt total', () => {
    const draft: ReceiptDraft = {
      date: '2026-09-13',
      merchant: 'Mini Market',
      items: [
        { name: 'A', categoryId: 'food', amountMinor: 100 },
        { name: 'B', categoryId: 'food', amountMinor: 100 },
        { name: 'C', categoryId: 'food', amountMinor: 100 },
      ],
    };
    const converted = convertForeignReceiptDraftToPln(draft, 'HUF', 0.01188);
    expect(converted.items.reduce((sum, item) => sum + item.amountMinor, 0)).toBe(4);
  });

  it('keeps schema unchanged', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
