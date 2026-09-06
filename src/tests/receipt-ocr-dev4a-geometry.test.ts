import { describe, expect, it } from 'vitest';
import type { ReceiptOcrGeometry, ReceiptOcrToken } from '../shopping/receipt-ocr/receipt-ocr.types';
import {
  calculateReceiptMedianTokenHeight,
  clusterReceiptTokensIntoRows,
  inferReceiptColumns,
  reconstructReceiptItemsFromGeometry,
  reconstructReceiptTextFromGeometry,
  validateReceiptOcrGeometry,
} from '../shopping/receipt-ocr/receipt-geometry-reconstruction';

function token(text: string, x0: number, y0: number, x1: number, y1: number, page = 1): ReceiptOcrToken {
  return { text, confidence: 90, bbox: { x0, y0, x1, y1 }, page };
}

function geometry(tokens: ReceiptOcrToken[], width = 600, height = 900): ReceiptOcrGeometry {
  return { source: 'snapshot', imageWidth: width, imageHeight: height, tokens };
}

function tableTokens(): ReceiptOcrToken[] {
  const result: ReceiptOcrToken[] = [
    token('Nazwa', 20, 100, 80, 120),
    token('PTU', 290, 100, 320, 120),
    token('Ilość', 340, 100, 390, 120),
    token('Cena', 420, 100, 465, 120),
    token('Wartość', 500, 100, 570, 120),
  ];
  const rows = [
    ['Apple', 'C', '2x', '3,00', '6,00'],
    ['Banana', 'C', '0,5x', '8,00', '4,00'],
    ['Water', 'A', '3x', '1,50', '4,50'],
  ];
  rows.forEach((row, index) => {
    const y = 145 + index * 42;
    result.push(
      token(row[0]!, 20, y, 150, y + 19),
      token(row[1]!, 296, y, 307, y + 19),
      token(row[2]!, 342, y, 389, y + 19),
      token(row[3]!, 420, y, 466, y + 19),
      token(row[4]!, 505, y, 557, y + 19),
    );
  });
  result.push(token('SUMA', 390, 300, 430, 320), token('PLN', 435, 300, 470, 320), token('14,50', 505, 300, 560, 320));
  return result;
}

describe('DEV4-A OCR geometry capture and table reconstruction', () => {
  it('validates bounding boxes and rejects invalid geometry without crashing', () => {
    const input = geometry([
      token('ok', 10, 10, 30, 30),
      token('bad', 40, 40, 30, 60),
      token('outside', 590, 20, 620, 40),
    ]);
    const result = validateReceiptOcrGeometry(input);
    expect(result.valid.map((item) => item.text)).toEqual(['ok']);
    expect(result.invalid).toHaveLength(2);
  });

  it('uses a robust median token height instead of a large marketing outlier', () => {
    const value = calculateReceiptMedianTokenHeight([
      token('a', 0, 0, 10, 20),
      token('b', 0, 30, 10, 50),
      token('c', 0, 60, 10, 81),
      token('MARKETING', 0, 100, 300, 260),
    ]);
    expect(value).toBeGreaterThanOrEqual(20);
    expect(value).toBeLessThan(30);
  });

  it('clusters tokens on the same visual line and keeps the next line separate', () => {
    const rows = clusterReceiptTokensIntoRows([
      token('A', 10, 10, 20, 30),
      token('B', 40, 12, 50, 31),
      token('C', 10, 55, 20, 75),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.text).toBe('A B');
    expect(rows[1]?.text).toBe('C');
  });

  it('is deterministic even when input token order changes', () => {
    const source = tableTokens();
    const left = reconstructReceiptTextFromGeometry(geometry(source));
    const right = reconstructReceiptTextFromGeometry(geometry([...source].reverse()));
    expect(right.text).toBe(left.text);
    expect(right.items).toEqual(left.items);
  });

  it('infers five-column receipt anchors from a visual header', () => {
    const rows = clusterReceiptTokensIntoRows(tableTokens());
    const columns = inferReceiptColumns(rows, 600);
    expect(columns?.source).toBe('header');
    expect(columns?.anchors.name).toBeLessThan(columns?.anchors.quantity ?? 0);
    expect(columns?.anchors.quantity).toBeLessThan(columns?.anchors.unitPrice ?? 0);
    expect(columns?.anchors.unitPrice).toBeLessThan(columns?.anchors.value ?? 0);
  });

  it('reconstructs item values from the value column rather than quantity cells', () => {
    const rows = clusterReceiptTokensIntoRows(tableTokens());
    const columns = inferReceiptColumns(rows, 600);
    const reconstructed = reconstructReceiptItemsFromGeometry(rows, columns);
    expect(reconstructed.items).toHaveLength(3);
    expect(reconstructed.items.map((item) => item.finalAmountMinor)).toEqual([600, 400, 450]);
    expect(reconstructed.items.map((item) => item.quantity)).toEqual([2, 0.5, 3]);
  });

  it('never turns 0,510x from a quantity column into a 0.51 item value', () => {
    const source = [
      token('Nazwa', 20, 100, 80, 120), token('PTU', 290, 100, 320, 120), token('Ilość', 340, 100, 390, 120), token('Cena', 420, 100, 465, 120), token('Wartość', 500, 100, 570, 120),
      token('Fil', 20, 150, 45, 170), token('Z', 50, 150, 60, 170), token('Piersi', 65, 150, 110, 170), token('K', 115, 150, 125, 170), token('kg', 130, 150, 150, 170),
      token('C', 298, 150, 308, 170), token('0,510x', 340, 150, 390, 170), token('25,49', 420, 150, 468, 170), token('13,00', 505, 150, 558, 170),
      token('SUMA', 390, 210, 430, 230), token('PLN', 435, 210, 470, 230), token('13,00', 505, 210, 558, 230),
    ];
    const result = reconstructReceiptTextFromGeometry(geometry(source));
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.quantity).toBe(0.51);
    expect(result.items[0]?.finalAmountMinor).toBe(1300);
  });

  it('keeps duplicate equal-value products as separate visual rows', () => {
    const source = tableTokens().filter((item) => item.bbox.y0 <= 120);
    source.push(
      token('MilkA', 20, 150, 120, 170), token('C', 298, 150, 308, 170), token('1x', 345, 150, 370, 170), token('5,00', 420, 150, 465, 170), token('5,00', 505, 150, 552, 170),
      token('MilkB', 20, 190, 120, 210), token('C', 298, 190, 308, 210), token('1x', 345, 190, 370, 210), token('5,00', 420, 190, 465, 210), token('5,00', 505, 190, 552, 210),
      token('SUMA', 390, 250, 430, 270), token('PLN', 435, 250, 470, 270), token('10,00', 505, 250, 558, 270),
    );
    const result = reconstructReceiptTextFromGeometry(geometry(source));
    expect(result.items.map((item) => item.name)).toEqual(['MilkA', 'MilkB']);
    expect(result.items.map((item) => item.finalAmountMinor)).toEqual([500, 500]);
  });

  it('conservatively joins a preceding name-only visual row to the structured row below', () => {
    const source = tableTokens().filter((item) => item.bbox.y0 <= 120);
    source.push(
      token('Long', 20, 145, 60, 165), token('Product', 65, 145, 125, 165),
      token('Name', 20, 175, 60, 195), token('Here', 65, 175, 100, 195), token('C', 298, 175, 308, 195), token('1x', 345, 175, 370, 195), token('10,00', 420, 175, 470, 195), token('10,00', 505, 175, 560, 195),
      token('SUMA', 390, 230, 430, 250), token('PLN', 435, 230, 470, 250), token('10,00', 505, 230, 560, 250),
    );
    const result = reconstructReceiptTextFromGeometry(geometry(source));
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.name).toContain('Long Product Name Here');
  });

  it('does not emit ordinary items after the financial section boundary', () => {
    const source = tableTokens();
    source.push(token('Karta', 20, 350, 80, 370), token('14,50', 505, 350, 560, 370));
    const result = reconstructReceiptTextFromGeometry(geometry(source));
    expect(result.items.map((item) => item.name)).not.toContain('Karta');
  });

  it('does not emit an Opust row as a product', () => {
    const source = tableTokens().filter((item) => item.bbox.y0 <= 187);
    source.push(token('Opust', 20, 190, 70, 210), token('-2,00', 505, 190, 560, 210));
    source.push(token('SUMA', 390, 240, 430, 260), token('PLN', 435, 240, 470, 260), token('8,00', 505, 240, 550, 260));
    const result = reconstructReceiptTextFromGeometry(geometry(source));
    expect(result.items.some((item) => /opust/iu.test(item.name))).toBe(false);
  });

  it('keeps page-local rows separate in multipage geometry', () => {
    const rows = clusterReceiptTokensIntoRows([
      token('page1', 10, 10, 60, 30, 1),
      token('page2', 10, 10, 60, 30, 2),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.page)).toEqual([1, 2]);
  });

  it('restores row-major reading order from column-major token enumeration', () => {
    const source = tableTokens();
    const columnMajor = [...source].sort((a, b) => a.bbox.x0 - b.bbox.x0 || a.bbox.y0 - b.bbox.y0);
    const result = reconstructReceiptTextFromGeometry(geometry(columnMajor));
    expect(result.text).toContain('Apple C 2x 3,00 6,00');
    expect(result.text).toContain('Banana C 0,5x 8,00 4,00');
    expect(result.text.indexOf('Apple')).toBeLessThan(result.text.indexOf('Banana'));
  });

  it('works on a second table with different anchors and font scale', () => {
    const source = [
      token('Nazwa', 40, 80, 105, 108), token('Ilość', 410, 80, 470, 108), token('Cena', 545, 80, 600, 108), token('Wartość', 690, 80, 780, 108),
      token('Tea', 40, 140, 100, 168), token('4x', 420, 140, 455, 168), token('2,50', 550, 140, 605, 168), token('10,00', 700, 140, 770, 168),
      token('Bread', 40, 200, 120, 228), token('1x', 420, 200, 455, 228), token('5,25', 550, 200, 605, 228), token('5,25', 700, 200, 760, 228),
      token('SUMA', 600, 270, 655, 298), token('PLN', 660, 270, 700, 298), token('15,25', 710, 270, 780, 298),
    ];
    const result = reconstructReceiptTextFromGeometry(geometry(source, 820, 400));
    expect(result.columns?.source).toBe('header');
    expect(result.items.map((item) => item.finalAmountMinor)).toEqual([1000, 525]);
  });
});
