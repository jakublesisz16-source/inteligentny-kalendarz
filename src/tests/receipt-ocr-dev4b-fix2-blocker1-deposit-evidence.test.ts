import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

function receipt(lines: string[]): string {
  return [
    'SKLEP TESTOWY',
    '28.08.2026',
    'PARAGON FISKALNY',
    ...lines,
  ].join('\n');
}

function hasSumMismatch(parsed: ReturnType<typeof parseReceiptText>): boolean {
  return parsed.warnings.some((warning) => warning.code === 'sum-mismatch');
}

describe('DEV4-B-FIX2-BLOCKER1 safe deposit item evidence', () => {
  it('treats the exact browser-damaged deposit summary marker as a terminator only', () => {
    const parsed = parseReceiptText(receipt([
      'Produkt testowy 76,65',
      'Suma PLN 76,65',
      'OPAKOWANIA ZWROTNE WYDANIA',
      'But Plastik kaucja 3X 0,50 1,50',
      'OPAKOWANIA ZWBOTNE SIIMA 1 50)',
      'DO ZAPŁATY 78,15 PLN',
      'Bon 4.00',
      'Karta płatnicza 74,15',
    ]));

    expect(parsed.depositTotalMinor).toBe(150);
    expect(parsed.finalPayableMinor).toBe(7815);
    expect(parsed.paymentTotalMinor).toBe(7815);
    expect(parsed.detectedItemsTotalMinor).toBe(7665);
    expect(hasSumMismatch(parsed)).toBe(false);
  });

  it('does not read any amount from a damaged deposit summary marker without clean item evidence', () => {
    const parsed = parseReceiptText(receipt([
      'Produkt testowy 10,00',
      'Suma PLN 10,00',
      'OPAKOWANIA ZWROTNE WYDANIA',
      'OPAKOWANIA ZWBOTNE SIIMA 1 50)',
      'DO ZAPŁATY 11,50 PLN',
      'Karta płatnicza 11,50',
    ]));

    expect(parsed.depositTotalMinor).toBeUndefined();
    expect(parsed.unexplainedDifferenceMinor).toBe(-150);
    expect(hasSumMismatch(parsed)).toBe(true);
  });

  it('uses clean item evidence from an explicit deposit section when the printed deposit summary is damaged', () => {
    const parsed = parseReceiptText(receipt([
      'Produkt testowy 76,65',
      'Suma PLN 76,65',
      'OPAKOWANIA ZWROTNE WYDANIA',
      'Butelka kaucja 3 x 0,50 1,50',
      'OPAKOWANIA OPAKOWANIA ZWBOTNE ZWROTNE SIIMA SUMA 1 1,50 50)',
      'DO ZAPŁATY 78,15 PLN',
      'Bon 4,00',
      'Karta płatnicza 74,15',
    ]));

    expect(parsed.depositTotalMinor).toBe(150);
    expect(parsed.ocrSubtotalMinor).toBe(7665);
    expect(parsed.finalPayableMinor).toBe(7815);
    expect(parsed.paymentTotalMinor).toBe(7815);
    expect(parsed.detectedItemsTotalMinor).toBe(7665);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items.some((item) => /kaucja|opakowania/iu.test(item.name))).toBe(false);
    expect(hasSumMismatch(parsed)).toBe(false);
  });

  it('sums multiple independently parseable rows inside one explicit deposit section', () => {
    const parsed = parseReceiptText(receipt([
      'Produkt testowy 10,00',
      'Suma PLN 10,00',
      'OPAKOWANIA ZWROTNE WYDANIA',
      'Butelka A kaucja 1 x 0,50 0,50',
      'Butelka B kaucja 2 x 0,50 1,00',
      'DO ZAPŁATY 11,50 PLN',
      'Karta płatnicza 11,50',
    ]));

    expect(parsed.depositTotalMinor).toBe(150);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.detectedItemsTotalMinor).toBe(1000);
    expect(parsed.unexplainedDifferenceMinor).toBe(0);
    expect(hasSumMismatch(parsed)).toBe(false);
  });

  it('preserves the existing clean printed summary path', () => {
    const parsed = parseReceiptText(receipt([
      'Produkt testowy 10,00',
      'Suma PLN 10,00',
      'OPAKOWANIA ZWROTNE SUMA 2,00',
      'DO ZAPŁATY 12,00 PLN',
      'Karta płatnicza 12,00',
    ]));

    expect(parsed.depositTotalMinor).toBe(200);
    expect(parsed.declaredTotalMinor).toBe(1200);
    expect(parsed.unexplainedDifferenceMinor).toBe(0);
    expect(hasSumMismatch(parsed)).toBe(false);
  });

  it('keeps the printed summary when clean item evidence agrees with it', () => {
    const parsed = parseReceiptText(receipt([
      'Produkt testowy 10,00',
      'Suma PLN 10,00',
      'OPAKOWANIA ZWROTNE WYDANIA',
      'Butelka kaucja 3 x 0,50 1,50',
      'OPAKOWANIA ZWROTNE SUMA 1,50',
      'DO ZAPŁATY 11,50 PLN',
      'Karta płatnicza 11,50',
    ]));

    expect(parsed.depositTotalMinor).toBe(150);
    expect(hasSumMismatch(parsed)).toBe(false);
  });

  it('does not silently replace a clean summary when safe item evidence conflicts with it', () => {
    const parsed = parseReceiptText(receipt([
      'Produkt testowy 10,00',
      'Suma PLN 10,00',
      'OPAKOWANIA ZWROTNE WYDANIA',
      'Butelka kaucja 3 x 0,50 1,50',
      'OPAKOWANIA ZWROTNE SUMA 2,00',
      'DO ZAPŁATY 12,00 PLN',
      'Karta płatnicza 12,00',
    ]));

    expect(parsed.depositTotalMinor).toBe(200);
    expect(hasSumMismatch(parsed)).toBe(true);
  });

  it('does not create deposit evidence from a goods row containing the word kaucja outside an explicit deposit section', () => {
    const parsed = parseReceiptText(receipt([
      'Produkt kaucja promocyjna 1,50',
      'Suma PLN 1,50',
      'DO ZAPŁATY 1,50 PLN',
      'Karta płatnicza 1,50',
    ]));

    expect(parsed.depositTotalMinor).toBeUndefined();
    expect(parsed.items).toHaveLength(1);
    expect(parsed.detectedItemsTotalMinor).toBe(150);
  });

  it('fails closed when the only deposit-looking row is ambiguous', () => {
    const parsed = parseReceiptText(receipt([
      'Produkt testowy 10,00',
      'Suma PLN 10,00',
      'OPAKOWANIA ZWROTNE WYDANIA',
      'Butelka kaucja 3 x O,5?',
      'DO ZAPŁATY 11,50 PLN',
      'Karta płatnicza 11,50',
    ]));

    expect(parsed.depositTotalMinor).toBeUndefined();
    expect(hasSumMismatch(parsed)).toBe(true);
  });

  it('keeps review required for ambiguous deposit evidence even when totals coincidentally balance', () => {
    const parsed = parseReceiptText(receipt([
      'Produkt testowy 10,00',
      'Suma PLN 10,00',
      'OPAKOWANIA ZWROTNE WYDANIA',
      'Butelka kaucja 3 x O,5?',
      'DO ZAPŁATY 10,00 PLN',
      'Karta płatnicza 10,00',
    ]));

    expect(parsed.depositTotalMinor).toBeUndefined();
    expect(parsed.unexplainedDifferenceMinor).toBe(0);
    expect(hasSumMismatch(parsed)).toBe(true);
  });

  it('does not accept a partial sum when one of multiple deposit rows is ambiguous', () => {
    const parsed = parseReceiptText(receipt([
      'Produkt testowy 10,00',
      'Suma PLN 10,00',
      'OPAKOWANIA ZWROTNE WYDANIA',
      'Butelka A kaucja 1 x 0,50 0,50',
      'Butelka B kaucja 2 x O,5?',
      'DO ZAPŁATY 11,50 PLN',
      'Karta płatnicza 11,50',
    ]));

    expect(parsed.depositTotalMinor).toBeUndefined();
    expect(hasSumMismatch(parsed)).toBe(true);
  });

  it('never derives a deposit from final minus goods without independent deposit rows', () => {
    const parsed = parseReceiptText(receipt([
      'Produkt testowy 10,00',
      'Suma PLN 10,00',
      'DO ZAPŁATY 11,50 PLN',
      'Karta płatnicza 11,50',
    ]));

    expect(parsed.depositTotalMinor).toBeUndefined();
    expect(parsed.unexplainedDifferenceMinor).toBe(-150);
  });

  it('never derives a deposit from split-payment structure alone', () => {
    const parsed = parseReceiptText(receipt([
      'Produkt testowy 10,00',
      'Suma PLN 10,00',
      'DO ZAPŁATY 11,50 PLN',
      'Bon 1,50',
      'Karta płatnicza 10,00',
    ]));

    expect(parsed.depositTotalMinor).toBeUndefined();
    expect(parsed.paymentTotalMinor).toBe(1150);
    expect(parsed.unexplainedDifferenceMinor).toBe(-150);
  });

  it('does not carry a deposit-section authorization across a receipt page break', () => {
    const parsed = parseReceiptText(receipt([
      'Produkt testowy 10,00',
      'Suma PLN 10,00',
      'OPAKOWANIA ZWROTNE WYDANIA',
      '[[RECEIPT_PAGE_BREAK]]',
      'Butelka kaucja 3 x 0,50 1,50',
      'DO ZAPŁATY 11,50 PLN',
      'Karta płatnicza 11,50',
    ]));

    expect(parsed.depositTotalMinor).toBeUndefined();
    expect(parsed.items).toHaveLength(1);
    expect(hasSumMismatch(parsed)).toBe(true);
  });
});
