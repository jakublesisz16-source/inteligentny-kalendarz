import { describe, expect, it } from 'vitest';
import { reconstructColumnarReceiptText } from '../shopping/receipt-ocr/receipt-columnar-reconstruction';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

const hybridMultipageFixture = [
  '0 MarketNova',
  '2026-08-11 20:17',
  'NIEFISKALNY',
  'Nazwa PTU Ilość',
  'Produkt A A 1.000 x',
  'Butelka kaucja brak 1.000 x',
  'Produkt B B 1.000 x',
  'Produkt C C 1.000 x',
  'Rabat',
  'Cena',
  '10,00',
  '0,50',
  '4,00',
  'Wartość',
  '10,00',
  '0,50',
  '7,03',
  '4,00',
  '-1,00',
  '3,00',
  // Second OCR chunk overlaps the last discounted row, then continues the table.
  'Produkt C C',
  'Rabat',
  'Produkt D A',
  'Rabat',
  'Sprzedaż opodatkowana B',
  'PTU B 8%',
  '4,00',
  '-1,00',
  '3,00',
  '8,00',
  '-2,00',
  '6,00',
  '7,00',
  '0,56',
  '[[RECEIPT_PAGE_BREAK]]',
  'Suma PTU',
  'Suma PLN',
  'Kasa 1 Kasjer',
  '0,56',
  '26,50',
  'Bon',
  'Karta płatnicza',
  '5,00',
  '21,50',
  'Numer transakcji',
  '1234',
].join('\n');

describe('DEV3-B028-FIX3 hybrid multipage table reconstruction', () => {
  it('reconstructs hybrid name/quantity rows and removes only the overlap duplicate', () => {
    const result = reconstructColumnarReceiptText(hybridMultipageFixture);
    expect(result.applied).toBe(true);
    expect(result.itemCount).toBe(4);
    expect(result.discountCount).toBe(2);
    expect(result.text.match(/Produkt C/g)).toHaveLength(1);
    expect(result.text).toContain('OPAKOWANIA ZWROTNE SUMA 0,50');
    expect(result.text).toContain('Suma PLN 26,50');
    expect(result.text).toContain('Bon 5,00');
    expect(result.text).toContain('Karta płatnicza 21,50');
  });

  it('keeps later unit prices aligned when one unit-price OCR cell is missing', () => {
    const parsed = parseReceiptText(hybridMultipageFixture);
    expect(parsed.items.map((item) => item.amountMinor)).toEqual([1000, 700, 300, 600]);
    expect(parsed.items[1]?.taxMarker).toBe('B');
    expect(parsed.items[1]?.amountMinor).toBe(700);
    expect(parsed.detectedItemsTotalMinor).toBe(2600);
  });

  it('resolves a final Suma PLN from page 2 using deposit and split-payment equations', () => {
    const parsed = parseReceiptText(hybridMultipageFixture);
    expect(parsed.merchant).toBe('MarketNova');
    expect(parsed.depositTotalMinor).toBe(50);
    expect(parsed.ocrSubtotalMinor).toBe(2650);
    expect(parsed.declaredSubtotalMinor).toBe(2600);
    expect(parsed.declaredTotalMinor).toBe(2650);
    expect(parsed.paymentTotalMinor).toBe(2650);
    expect(parsed.unexplainedDifferenceMinor).toBe(0);
    expect(parsed.adjustments.reduce((sum, item) => sum + (item.amountMinor ?? 0), 0)).toBe(-300);
    expect(parsed.warnings.some((warning) => warning.code === 'sum-mismatch')).toBe(false);
  });
  it('rejects hybrid reconstruction when page-two payments do not confirm the final total', () => {
    const broken = hybridMultipageFixture.replace('21,50', '20,50');
    const result = reconstructColumnarReceiptText(broken);
    expect(result.applied).toBe(false);
    expect(result.text).toBe(broken);
  });

  it('removes only an isolated leading OCR zero from merchant candidates', () => {
    const zeroNoise = parseReceiptText('0 MarketNova\n2026-08-11\nProdukt 10,00\nSUMA 10,00');
    const numberedBrand = parseReceiptText('7 Eleven\n2026-08-11\nProdukt 10,00\nSUMA 10,00');
    expect(zeroNoise.merchant).toBe('MarketNova');
    expect(numberedBrand.merchant).toBe('7 Eleven');
  });

});
