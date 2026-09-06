import { describe, expect, it } from 'vitest';
import { reconstructColumnarReceiptText } from '../shopping/receipt-ocr/receipt-columnar-reconstruction';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';
import { analyzeReceiptOcrQuality } from '../shopping/receipt-ocr/receipt-ocr-quality';

const columnMajorFixture = [
  'MARKET NOVA',
  '2026-08-11',
  'PARAGON FISKALNY',
  'Nazwa',
  'Napój A 1,5l',
  'Mleko B 1l',
  'Owoc luz',
  'Deser C',
  'Opust',
  'OPUSTY ŁĄCZNIE:',
  'Sprzedaż opodatkowana A',
  'Suma PTU',
  'PTU',
  'ABCA',
  'Ilość',
  '2x',
  '1x',
  '0,500 x',
  '2x',
  'Cena',
  '1,20',
  '3,50',
  '10,00',
  '4,00',
  'nr: 12345',
  'Wartość',
  '2,40',
  '3,50',
  '5,00',
  '8,00',
  '-2,00',
  '6,00',
  '-2,00',
  '16,90',
  '1,90',
  'Suma PLN 16,90',
  'OPAKOWANIA ZWROTNE WYDANIA',
  'But kaucja 2 x 0,50 1,00',
  'OPAKOWANIA ZWROTNE SUMA 1,00',
  'DO ZAPŁATY 17,90 PLN',
  'Bon 5,00',
  'Karta płatnicza 12,90',
  'Udzielono łącznie opustów 2,00',
].join('\n');

describe('DEV3-B028-FIX2 columnar receipt reconstruction', () => {
  it('reconstructs a column-major OCR table only when quantity, unit price and values reconcile', () => {
    const result = reconstructColumnarReceiptText(columnMajorFixture);
    expect(result.applied).toBe(true);
    expect(result.itemCount).toBe(4);
    expect(result.discountCount).toBe(1);
    expect(result.text).toContain('Napój A 1,5l 2 x 1,20 2,40');
    expect(result.text).toContain('Deser C 2 x 4,00 8,00');
    expect(result.text).toContain('Opust -2,00\n6,00');
  });

  it('parses reconstructed items, discount, deposit and split payment without merchant-specific rules', () => {
    const parsed = parseReceiptText(columnMajorFixture);
    expect(parsed.items).toHaveLength(4);
    expect(parsed.items.map((item) => item.amountMinor)).toEqual([240, 350, 500, 600]);
    expect(parsed.items[3]?.baseAmountMinor).toBe(800);
    expect(parsed.items[3]?.discountMinor).toBe(200);
    expect(parsed.detectedItemsTotalMinor).toBe(1690);
    expect(parsed.declaredSubtotalMinor).toBe(1690);
    expect(parsed.depositTotalMinor).toBe(100);
    expect(parsed.declaredTotalMinor).toBe(1790);
    expect(parsed.paymentTotalMinor).toBe(1790);
    expect(parsed.declaredDiscountTotalMinor).toBe(-200);
    expect(parsed.unexplainedDifferenceMinor).toBe(0);
    expect(parsed.warnings.some((warning) => warning.code === 'sum-mismatch')).toBe(false);
    expect(parsed.warnings.some((warning) => warning.code === 'discount-summary-mismatch')).toBe(false);
  });

  it('uses reconstructed financial lines for quality instead of penalizing the raw column order', () => {
    const quality = analyzeReceiptOcrQuality(columnMajorFixture, 'pdf', 98);
    expect(quality.productLikeLines).toBeGreaterThanOrEqual(4);
    expect(quality.financialScore).toBeGreaterThanOrEqual(75);
    expect(quality.level).not.toBe('low');
  });

  it('does not reconstruct when a column count is inconsistent', () => {
    const broken = columnMajorFixture.replace('\n1x\n0,500 x\n2x\nCena', '\n1x\n0,500 x\nCena');
    const result = reconstructColumnarReceiptText(broken);
    expect(result.applied).toBe(false);
    expect(result.text).toBe(broken);
  });

  it('does not touch ordinary row-major receipts', () => {
    const ordinary = 'MARKET NOVA\n2026-08-11\nProdukt A 10,00\nSUMA 10,00';
    const result = reconstructColumnarReceiptText(ordinary);
    expect(result.applied).toBe(false);
    expect(result.text).toBe(ordinary);
  });
});
