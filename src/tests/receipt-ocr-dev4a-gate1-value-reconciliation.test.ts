import { describe, expect, it } from 'vitest';
import type { ReceiptOcrGeometry, ReceiptOcrToken } from '../shopping/receipt-ocr/receipt-ocr.types';
import { reconstructReceiptTextFromGeometry } from '../shopping/receipt-ocr/receipt-geometry-reconstruction';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

function token(text: string, x0: number, y0: number, x1: number, y1: number): ReceiptOcrToken {
  return { text, confidence: 90, bbox: { x0, y0, x1, y1 }, page: 1 };
}

function geometry(tokens: ReceiptOcrToken[], width = 600, height = 800): ReceiptOcrGeometry {
  return { source: 'snapshot', imageWidth: width, imageHeight: height, tokens };
}

function header(): ReceiptOcrToken[] {
  return [
    token('Nazwa', 20, 50, 80, 70),
    token('PTU', 290, 50, 320, 70),
    token('Ilość', 340, 50, 390, 70),
    token('Cena', 420, 50, 465, 70),
    token('Wartość', 500, 50, 570, 70),
  ];
}

function valueReconciliationFixture(): ReceiptOcrToken[] {
  const result = header();
  // Missing value-column token: geometry is allowed to use quantity x unit price.
  result.push(
    token('Energy', 20, 100, 95, 120), token('A', 297, 100, 308, 120), token('2x', 345, 100, 370, 120), token('5,49', 420, 100, 465, 120),
    token('Opust', 20, 128, 72, 148), token('-2,00', 505, 128, 558, 148),
    token('8,98', 505, 154, 555, 174),
  );
  // Missing discount amount: semantic Opust + independent net confirmation derives -0.35.
  result.push(
    token('Chicken', 20, 200, 105, 220), token('C', 297, 200, 308, 220), token('0,510x', 340, 200, 394, 220), token('25,49', 420, 200, 470, 220),
    token('Opust', 20, 228, 72, 248),
    token('12,65', 505, 254, 560, 274),
  );
  // Lost discount sign: gross + net confirmation safely establishes the sign.
  result.push(
    token('Cheese', 20, 300, 90, 320), token('C', 297, 300, 308, 320), token('2x', 345, 300, 370, 320), token('14,89', 420, 300, 470, 320), token('29,78', 505, 300, 560, 320),
    token('Opust', 20, 328, 72, 348), token('13,89', 505, 328, 560, 348),
    token('15,89', 505, 354, 560, 374),
  );
  // OCR dropped the decimal separator in a weight. Explicit value + unit price recover 1.390.
  result.push(
    token('Watermelon', 20, 400, 125, 420), token('C', 297, 400, 308, 420), token('1390x', 340, 400, 392, 420), token('5,99', 420, 400, 465, 420), token('8,33', 505, 400, 555, 420),
  );
  result.push(token('SUMA', 410, 470, 455, 490), token('PLN', 460, 470, 492, 490), token('45,85', 505, 470, 565, 490));
  return result;
}

describe('DEV4-A-GATE1 live geometry item value reconciliation', () => {
  it('reproduces the observed 80.45 PLN row-major failure without changing the frozen parser', () => {
    const rowMajor = `PARAGON FISKALNY
Nazwa PTU Ilość Cena Wartość
Ręcznik Milla X2 A 1x 4,69
FrytZigZag900g C 1x 10,39
NapEnerDzik0,5lPus A 2x 5,49
Opust
Fil Z Piersi K kg C 0,510x 25,49
Opust
RożekMarlWiśnia150ml C 1x 4,49
SokMandarynRivPet1l C 1x 4,79
WodaNgPrimavera1l A 2x 1,49
SerGoudaŚwiat 500g C 2x 14,89
Opust
PastaColgateWhite A 1x 12,99
Banan Luz C 0,320x 6,99
Arbuz luz C 1390x 5,99
OPUSTY ŁĄCZNIE -16,24
Suma PLN 88,42
OPAKOWANIA ZWROTNE WYDANIA
Pus Alu Kaucja 2x 0,50 1,00
But Plastik kaucja 3x 0,50 1,50
OPAKOWANIA ZWROTNE SUMA 2,50
DO ZAPŁATY 90,92 PLN
Karta płatnicza 90,92`;
    const parsed = parseReceiptText(rowMajor);
    expect(parsed.items).toHaveLength(11);
    expect(parsed.detectedItemsTotalMinor).toBe(8045);
    expect(parsed.items.map((item) => item.amountMinor)).toEqual([469, 1039, 549, 1300, 449, 479, 149, 1489, 1299, 224, 599]);
  });

  it('reconstructs quantity, gross, discounts and net values without using receipt totals as item sources', () => {
    const result = reconstructReceiptTextFromGeometry(geometry(valueReconciliationFixture()));
    expect(result.items).toHaveLength(4);
    expect(result.completeItemCount).toBe(4);
    expect(result.items.map((item) => item.finalAmountMinor)).toEqual([898, 1265, 1589, 833]);
    expect(result.items.map((item) => item.grossBeforeDiscountMinor)).toEqual([1098, 1300, 2978, 833]);
    expect(result.items.map((item) => item.discountMinor ?? 0)).toEqual([-200, -35, -1389, 0]);
    expect(result.grossItemsTotalMinor).toBe(6209);
    expect(result.discountsTotalMinor).toBe(-1624);
    expect(result.itemsTotalMinor).toBe(4585);
    expect(result.structuredTextGenerated).toBe(true);
  });

  it('does not distribute an aggregate receipt discount across items when individual discount evidence is absent', () => {
    const source = valueReconciliationFixture().filter((item) => !['-2,00', '8,98', '12,65', '13,89', '15,89'].includes(item.text));
    const result = reconstructReceiptTextFromGeometry(geometry(source));
    const discounted = result.items.slice(0, 3);
    expect(discounted.every((item) => item.finalAmountMinor === undefined)).toBe(true);
    expect(discounted.every((item) => item.unresolvedReason === 'discount-unresolved')).toBe(true);
    expect(result.discountsTotalMinor).toBe(0);
    expect(result.itemsTotalMinor).toBe(833);
  });

  it('keeps an ordinary item resolved while a neighboring local discount group remains unresolved', () => {
    const source = header();
    source.push(
      token('Discounted', 20, 100, 115, 120), token('A', 297, 100, 308, 120), token('1x', 345, 100, 370, 120), token('10,00', 420, 100, 470, 120), token('10,00', 505, 100, 560, 120),
      token('Opust', 20, 128, 72, 148),
      token('Regular', 20, 180, 90, 200), token('C', 297, 180, 308, 200), token('1x', 345, 180, 370, 200), token('3,00', 420, 180, 465, 200), token('3,00', 505, 180, 550, 200),
      token('OPUSTY', 20, 230, 90, 250), token('ŁĄCZNIE', 95, 230, 180, 250), token('-1,00', 505, 230, 555, 250),
      token('SUMA', 410, 270, 455, 290), token('PLN', 460, 270, 492, 290), token('12,00', 505, 270, 560, 290),
    );
    const result = reconstructReceiptTextFromGeometry(geometry(source));
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.grossBeforeDiscountMinor).toBe(1000);
    expect(result.items[0]?.finalAmountMinor).toBeUndefined();
    expect(result.items[0]?.unresolvedReason).toBe('discount-unresolved');
    expect(result.items[1]?.finalAmountMinor).toBe(300);
    expect(result.items[1]?.unresolvedReason).toBeUndefined();
    expect(result.discountsTotalMinor).toBe(0);
    expect(result.itemsTotalMinor).toBe(300);
  });

  it('uses quantity x unit-price only when geometry proves the cells, never an aggregate total backfill', () => {
    const result = reconstructReceiptTextFromGeometry(geometry(valueReconciliationFixture()));
    expect(result.items[0]?.grossBeforeDiscountMinor).toBe(1098);
    expect(result.items[0]?.evidence).toContain('quantity-unit-gross-recovery');
    expect(result.text).toContain('Energy A 2x 5,49 10,98');
  });

  it('recovers a missing discount amount only from an Opust group plus an independent net row', () => {
    const result = reconstructReceiptTextFromGeometry(geometry(valueReconciliationFixture()));
    const chicken = result.items[1];
    expect(chicken?.grossBeforeDiscountMinor).toBe(1300);
    expect(chicken?.discountMinor).toBe(-35);
    expect(chicken?.finalAmountMinor).toBe(1265);
    expect(chicken?.evidence).toContain('discount-from-net-confirmation');
  });

  it('recovers a lost discount sign through gross/net consistency and accepts a large discount', () => {
    const result = reconstructReceiptTextFromGeometry(geometry(valueReconciliationFixture()));
    const cheese = result.items[2];
    expect(cheese?.grossBeforeDiscountMinor).toBe(2978);
    expect(cheese?.discountMinor).toBe(-1389);
    expect(cheese?.finalAmountMinor).toBe(1589);
  });

  it('recovers 1390x as 1.390 only when unit-price and explicit row value confirm the decimal placement', () => {
    const result = reconstructReceiptTextFromGeometry(geometry(valueReconciliationFixture()));
    const watermelon = result.items[3];
    expect(watermelon?.quantity).toBe(1.39);
    expect(watermelon?.unitPriceMinor).toBe(599);
    expect(watermelon?.finalAmountMinor).toBe(833);
  });

  it('does not turn 0,510x into money and keeps weighted quantity math in minor units', () => {
    const result = reconstructReceiptTextFromGeometry(geometry(valueReconciliationFixture()));
    const chicken = result.items[1];
    expect(chicken?.quantity).toBe(0.51);
    expect(chicken?.unitPriceMinor).toBe(2549);
    expect(chicken?.grossBeforeDiscountMinor).toBe(1300);
    expect(chicken?.finalAmountMinor).not.toBe(51);
  });

  it('is scale and horizontal-offset invariant', () => {
    const original = valueReconciliationFixture();
    const transform = (scale: number, offsetX: number): ReceiptOcrToken[] => original.map((item) => ({
      ...item,
      bbox: {
        x0: item.bbox.x0 * scale + offsetX,
        y0: item.bbox.y0 * scale,
        x1: item.bbox.x1 * scale + offsetX,
        y1: item.bbox.y1 * scale,
      },
    }));
    const base = reconstructReceiptTextFromGeometry(geometry(original));
    for (const [scale, offset] of [[0.5, 35], [2, 120]] as const) {
      const scaled = reconstructReceiptTextFromGeometry(geometry(transform(scale, offset), 600 * scale + offset + 50, 800 * scale));
      expect(scaled.items.map((item) => item.finalAmountMinor)).toEqual(base.items.map((item) => item.finalAmountMinor));
      expect(scaled.items.map((item) => item.quantity)).toEqual(base.items.map((item) => item.quantity));
    }
  });

  it('keeps aggregate discount and totals outside ordinary item rows', () => {
    const tokens = valueReconciliationFixture();
    tokens.splice(tokens.length - 3, 0, token('OPUSTY', 20, 445, 90, 465), token('ŁĄCZNIE', 95, 445, 180, 465), token('-16,24', 505, 445, 565, 465));
    const result = reconstructReceiptTextFromGeometry(geometry(tokens));
    expect(result.items).toHaveLength(4);
    expect(result.items.some((item) => /opust/iu.test(item.name))).toBe(false);
  });
});
