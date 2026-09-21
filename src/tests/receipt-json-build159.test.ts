import { describe, expect, it } from 'vitest';
import { parseStructuredReceiptJsonText } from '../shopping/receipt-ocr/receipt-json';

function structuredReceipt(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    protoVersion: '000',
    header: [
      { headerText: { headerTextLines: '<div>ALFA &quot;CODZIENNIE DOBRE CENY&quot; 123</div><div>00-001 MIASTO</div>' } },
      { headerData: { date: '2026-09-20T12:00:00.000Z' } },
    ],
    body: [
      { sellLine: { name: 'Produkt A C', vatId: 'C', price: 300, total: 600, quantity: '2', isStorno: false } },
      { discountLine: { base: 600, value: 100, isDiscount: true, isStorno: false, vatId: 'C' } },
      { sellLine: { name: 'Produkt ważony C', vatId: 'C', price: 1000, total: 250, quantity: '0,250', isStorno: false } },
      { discountSummary: { discounts: 100 } },
      { vatSummary: { currency: 'PLN', vatRatesSummary: [{ vatId: 'C', vatRate: 500, vatSale: 750, vatAmount: 36 }] } },
      { sumInCurrency: { fiscalTotal: 750, totalWithPacks: 800, currency: 'PLN' } },
      { pack: { name: 'Opakowanie', price: 50, quantity: '1', total: 50, isNegative: false } },
      { payment: { amount: 800, currency: 'PLN', reszta: false, type: '2' } },
      { fiscalFooter: { date: '2026-09-20T12:00:00.000Z' } },
    ],
    ...overrides,
  });
}

describe('1.2.0 Build159 structured receipt JSON', () => {
  it('reads exact items, discounts, deposits, totals and payments without OCR', () => {
    const result = parseStructuredReceiptJsonText(structuredReceipt());
    expect(result.currency).toBe('PLN');
    expect(result.parsed.merchant).toBe('ALFA');
    expect(result.parsed.date).toBe('2026-09-20');
    expect(result.parsed.items).toHaveLength(2);
    expect(result.parsed.items[0]).toMatchObject({ name: 'Produkt A', baseAmountMinor: 600, discountMinor: 100, amountMinor: 500, quantity: 2, unitPriceMinor: 300, confidence: 'high' });
    expect(result.parsed.items[1]).toMatchObject({ name: 'Produkt ważony', amountMinor: 250, quantity: 0.25, unitPriceMinor: 1000, confidence: 'high' });
    expect(result.parsed.detectedItemsTotalMinor).toBe(750);
    expect(result.parsed.depositTotalMinor).toBe(50);
    expect(result.parsed.declaredTotalMinor).toBe(800);
    expect(result.parsed.paymentTotalMinor).toBe(800);
    expect(result.parsed.declaredDiscountTotalMinor).toBe(-100);
    expect(result.parsed.unexplainedDifferenceMinor).toBe(0);
  });

  it('fails closed when structured item math conflicts with fiscal totals', () => {
    const broken = JSON.parse(structuredReceipt()) as { body: Array<Record<string, unknown>> };
    const sum = broken.body.find((entry) => 'sumInCurrency' in entry)!.sumInCurrency as { fiscalTotal: number };
    sum.fiscalTotal = 751;
    expect(() => parseStructuredReceiptJsonText(JSON.stringify(broken))).toThrow(/nie zgadzają się z sumą fiskalną/u);
  });

  it('fails closed on storno instead of silently converting a negative correction into an expense', () => {
    const broken = JSON.parse(structuredReceipt()) as { body: Array<Record<string, unknown>> };
    const line = broken.body.find((entry) => 'sellLine' in entry)!.sellLine as { isStorno: boolean };
    line.isStorno = true;
    expect(() => parseStructuredReceiptJsonText(JSON.stringify(broken))).toThrow(/storno/u);
  });
});
