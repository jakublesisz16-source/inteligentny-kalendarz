import { describe, expect, it } from 'vitest';
import { parseReceiptPriceMinor, parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

describe('1.1.0-dev.3 pure receipt parser', () => {
  it('detects merchant, DD.MM.YYYY date, several items and semantic total', () => {
    const parsed = parseReceiptText(`SKLEP SPOZYWCZY\nul. Testowa 12\nNIP 1234567890\n16.08.2026 19:42\nCHLEB ZYTNI 6,99\nMLEKO 3,2% 4,29\nWODA 2,49\nDO ZAPLATY 13,77\nKARTA 13,77`);
    expect(parsed.merchant).toBe('SKLEP SPOZYWCZY');
    expect(parsed.date).toBe('2026-08-16');
    expect(parsed.items.map((item) => [item.name, item.amountMinor])).toEqual([
      ['CHLEB ZYTNI', 699], ['MLEKO 3,2%', 429], ['WODA', 249],
    ]);
    expect(parsed.declaredTotalMinor).toBe(1377);
  });

  it('supports ISO and dash dates deterministically', () => {
    expect(parseReceiptText('SKLEP\n2026-08-16\nPRODUKT 1,00\nSUMA 1,00').date).toBe('2026-08-16');
    expect(parseReceiptText('SKLEP\n16-08-2026\nPRODUKT 1,00\nSUMA 1,00').date).toBe('2026-08-16');
  });

  it('does not choose address, NIP or fiscal metadata as merchant', () => {
    const parsed = parseReceiptText('MARKET TEST\nul. Polna 1\n00-001 Warszawa\nNIP 1112223344\nPARAGON FISKALNY\nPRODUKT 2,00\nRAZEM 2,00');
    expect(parsed.merchant).toBe('MARKET TEST');
  });

  it('parses comma, dot, grouped amounts and a trailing tax letter', () => {
    expect(parseReceiptPriceMinor('4,99')).toBe(499);
    expect(parseReceiptPriceMinor('4.99')).toBe(499);
    expect(parseReceiptPriceMinor('1 234,50')).toBe(123450);
    const parsed = parseReceiptText('SKLEP\n16.08.2026\nPRODUKT 12,99A\nSUMA 12,99');
    expect(parsed.items[0]?.amountMinor).toBe(1299);
  });

  it('handles quantity x unit price on the same and following line using final line amount', () => {
    const inline = parseReceiptText('SKLEP\n16.08.2026\nMLEKO 2 x 4,49 8,98\nSUMA 8,98');
    expect(inline.items[0]).toMatchObject({ name: 'MLEKO', amountMinor: 898 });
    const split = parseReceiptText('SKLEP\n16.08.2026\nMLEKO\n1 x 4,49 4,49\nSUMA 4,49');
    expect(split.items[0]).toMatchObject({ name: 'MLEKO', amountMinor: 449 });
  });

  it('prioritizes DO ZAPLATY/RAZEM/SUMA and ignores VAT, payment and change lines', () => {
    const parsed = parseReceiptText(`SKLEP\n16.08.2026\nPRODUKT 10,00\nSUMA PTU 1,87\nVAT 1,87\nSUMA 10,00\nRAZEM 10,00\nDO ZAPLATY 10,00\nGOTOWKA 20,00\nRESZTA 10,00`);
    expect(parsed.declaredTotalMinor).toBe(1000);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.name).toBe('PRODUKT');
  });

  it('detects a negative discount as an ephemeral adjustment instead of a product', () => {
    const parsed = parseReceiptText('SKLEP\n16.08.2026\nPRODUKT 10,00\nRABAT -1,00\nDO ZAPLATY 9,00');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.adjustments).toEqual([{ rawText: 'RABAT -1,00', amountMinor: -100, kind: 'discount' }]);
    expect(parsed.warnings.some((warning) => warning.code === 'discount-detected')).toBe(true);
  });

  it('applies O/0 and I/1 repair only in numeric price context', () => {
    expect(parseReceiptPriceMinor('4,O9')).toBe(409);
    const parsed = parseReceiptText('OI MARKET\n16.08.2026\nSOK OI 4,O9\nSUMA 4,09');
    expect(parsed.merchant).toBe('OI MARKET');
    expect(parsed.items[0]?.name).toBe('SOK OI');
    expect(parsed.items[0]?.amountMinor).toBe(409);
  });

  it('returns warnings for empty/garbage text and missing merchant/date/total without inventing data', () => {
    const empty = parseReceiptText('');
    expect(empty.merchant).toBeUndefined();
    expect(empty.date).toBeUndefined();
    expect(empty.declaredTotalMinor).toBeUndefined();
    expect(empty.items).toEqual([]);
    expect(empty.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining(['merchant-uncertain', 'date-missing', 'total-missing', 'no-items']));

    const garbage = parseReceiptText('### 123\n---\n???');
    expect(garbage.merchant).toBeUndefined();
    expect(garbage.items).toEqual([]);
  });

  it('marks multiple dates as ambiguous and prefers the stronger candidate with an attached time', () => {
    const parsed = parseReceiptText('SKLEP\n15.08.2026\n16.08.2026 10:10\nPRODUKT 1,00\nSUMA 1,00');
    expect(parsed.date).toBe('2026-08-16');
    expect(parsed.warnings.some((warning) => warning.code === 'date-ambiguous')).toBe(true);
  });

  it('keeps duplicate-looking product lines as separate legitimate positions', () => {
    const parsed = parseReceiptText('SKLEP\n16.08.2026\nWODA 2,00\nWODA 2,00\nSUMA 4,00');
    expect(parsed.items).toHaveLength(2);
    expect(parsed.detectedItemsTotalMinor).toBe(400);
  });
});
