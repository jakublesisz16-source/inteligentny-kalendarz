import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

describe('1.2.0 Build152 receipt parser patterns observed in private real-receipt corpus', () => {
  it('applies a TANIEJ promotion to the preceding item and reconciles the goods subtotal', () => {
    const parsed = parseReceiptText([
      'NOVA MARKET',
      '2026-08-08',
      'PARAGON FISKALNY',
      'ROGAL',
      '2 * 3,99 7,98 C',
      'Taniej za 2 -0,80',
      'WODA',
      '1 * 3,00 3,00 C',
      'SUMA PLN 10,18',
      'KARTA 10,18',
    ].join('\n'));

    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0]).toMatchObject({
      name: 'ROGAL',
      baseAmountMinor: 798,
      amountMinor: 718,
      discountMinor: 80,
    });
    expect(parsed.adjustments).toContainEqual({
      rawText: 'Taniej za 2 -0,80',
      amountMinor: -80,
      kind: 'discount',
    });
    expect(parsed.detectedItemsTotalMinor).toBe(1018);
    expect(parsed.unexplainedDifferenceMinor).toBe(0);
    expect(parsed.warnings.some((warning) => warning.code === 'sum-mismatch')).toBe(false);
  });

  it('does not turn a generic marketing phrase ending in TANIEJ into a receipt discount', () => {
    const parsed = parseReceiptText([
      'NOVA MARKET',
      'PARAGON FISKALNY',
      'ROGAL',
      '1 * 5,00 5,00 C',
      'KUPUJ TANIEJ',
      'WODA',
      '1 * 3,00 3,00 C',
      'SUMA PLN 8,00',
      'KARTA 8,00',
    ].join('\n'));

    expect(parsed.items).toHaveLength(2);
    expect(parsed.adjustments).toHaveLength(0);
    expect(parsed.warnings.some((warning) => warning.code === 'discount-detected')).toBe(false);
    expect(parsed.detectedItemsTotalMinor).toBe(800);
    expect(parsed.unexplainedDifferenceMinor).toBe(0);
  });

  it('prefers a trade brand embedded with a quoted slogan over a later legal operator', () => {
    const parsed = parseReceiptText([
      'NOVA "CODZIENNIE NISKIE CENY" 7727',
      'OPERATOR RETAIL POLSKA S.A.',
      'NIP 1234567890',
      'PARAGON FISKALNY',
      'PRODUKT 1 x 10,00 10,00',
      'SUMA PLN 10,00',
    ].join('\n'));

    expect(parsed.merchant).toBe('NOVA');
    expect(parsed.merchant).not.toMatch(/OPERATOR/iu);
  });

  it('keeps the same trade-brand decision when OCR loses slogan quotation marks', () => {
    const parsed = parseReceiptText([
      'NOVA CODZIENNIE NISKIE CENY 7727',
      'OPERATOR RETAIL POLSKA S.A.',
      'NIP 1234567890',
      'PARAGON FISKALNY',
      'PRODUKT 1 x 10,00 10,00',
      'SUMA PLN 10,00',
    ].join('\n'));

    expect(parsed.merchant).toBe('NOVA');
  });

  it('does not promote a detached short logo fragment merely because a slogan appears on the next line', () => {
    const parsed = parseReceiptText([
      'XYZ',
      'CODZIENNIE DOBRE CENY',
      'Sklep 123',
      'NOVA RETAIL POLSKA S.A.',
      'PARAGON FISKALNY',
      'PRODUKT 1 x 10,00 10,00',
      'SUMA PLN 10,00',
    ].join('\n'));

    expect(parsed.merchant).toBe('NOVA RETAIL POLSKA');
  });

  it('keeps tax subtotal, goods subtotal, deposits and final payment separated', () => {
    const parsed = parseReceiptText([
      'NOVA',
      '2026-06-25',
      'PARAGON FISKALNY',
      'OWOC',
      '0,430kg x 6,99 3,01 C',
      'PIECZYWO',
      '2 * 1,77 3,54 C',
      'PTU A 3,54',
      'Kwota A 23,00% 0,66',
      'PTU C 3,01',
      'Kwota C 5,00% 0,14',
      'Suma 0,80',
      'Suma PLN 6,55',
      'OPAKOWANIA ZWROTNE WYDANIA',
      'Kaucja PET 2 * 0,50 1,00',
      'OPAKOWANIA ZWROTNE SUMA 1,00',
      'Suma 7,55',
      'Płatność Karta płatnicza 7,55',
    ].join('\n'));

    expect(parsed.taxTotalMinor).toBe(80);
    expect(parsed.ocrSubtotalMinor).toBe(655);
    expect(parsed.depositTotalMinor).toBe(100);
    expect(parsed.declaredTotalMinor).toBe(755);
    expect(parsed.paymentTotalMinor).toBe(755);
    expect(parsed.detectedItemsTotalMinor).toBe(655);
    expect(parsed.unexplainedDifferenceMinor).toBe(0);
  });
});
