import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

function receipt(body: string, total = '3,79'): string {
  return [
    'SKLEP TESTOWY',
    'PARAGON FISKALNY',
    body,
    'PTU C 3,79',
    'Kwota C 5,00% 0,18',
    `Suma PLN ${total}`,
    `Karta płatnicza ${total}`,
    'Data 19/09/2026 12:00:00',
  ].join('\n');
}

describe('1.2.0 Build156 OCR percent-as-quantity-separator recovery', () => {
  it('recovers a pending-name quantity line when OCR reads 1 * as 1%', () => {
    const parsed = parseReceiptText(receipt('Napój testowy\n1% 3.79 3.79 C'));
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.name).toContain('Napój testowy');
    expect(parsed.items[0]?.quantity).toBe(1);
    expect(parsed.items[0]?.unitPriceMinor).toBe(379);
    expect(parsed.items[0]?.amountMinor).toBe(379);
    expect(parsed.unexplainedDifferenceMinor).toBe(0);
  });

  it('recovers the same corruption when product and quantity remain on one line', () => {
    const parsed = parseReceiptText(receipt('Napój testowy 1% 3.79 3.79 C'));
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.quantity).toBe(1);
    expect(parsed.items[0]?.unitPriceMinor).toBe(379);
    expect(parsed.items[0]?.amountMinor).toBe(379);
  });

  it('does not promote ordinary VAT percentage lines into products', () => {
    const parsed = parseReceiptText(receipt('Napój testowy\n1 * 3.79 3.79 C'));
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items.some((item) => /Kwota|PTU/iu.test(item.name))).toBe(false);
  });

  it('fails closed for a percent separator whose quantity math does not match the line total', () => {
    const parsed = parseReceiptText(receipt('Napój testowy\n1% 4.99 3.79 C'));
    expect(parsed.items).toHaveLength(0);
    expect(parsed.warnings.some((warning) => warning.code === 'sum-mismatch' || warning.code === 'no-items')).toBe(true);
  });
});
