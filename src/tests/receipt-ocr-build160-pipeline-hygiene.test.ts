import { describe, expect, it } from 'vitest';
import { dedupeReceiptOcrTokens } from '../shopping/receipt-ocr/ocr-engine';
import { reconcileParsedReceiptFinancials } from '../shopping/receipt-ocr/receipt-financial-reconciliation';
import { trimReceiptTechnicalFooterRows, type ReceiptOcrRow } from '../shopping/receipt-ocr/receipt-geometry-reconstruction';
import { normalizeReceiptItemDisplayName, parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';
import type { ReceiptOcrToken } from '../shopping/receipt-ocr/receipt-ocr.types';

function row(text: string, y: number): ReceiptOcrRow {
  return {
    page: 1,
    text,
    tokens: [],
    bbox: { x0: 0, y0: y, x1: 1000, y1: y + 30 },
    medianHeight: 30,
  };
}

function token(text: string, chunkIndex: number, x0: number, x1: number, confidence: number): ReceiptOcrToken {
  return {
    text,
    confidence,
    bbox: { x0, y0: 100, x1, y1: 140 },
    page: 1,
    chunkIndex,
    source: 'primary',
  };
}

describe('Receipt OCR Build160 pipeline hygiene', () => {
  it('normalizes only a strongly shaped terminal litre glyph error in a product name', () => {
    expect(normalizeReceiptItemDisplayName('WodaTestowa1|!')).toBe('WodaTestowa1l');
    expect(normalizeReceiptItemDisplayName('ABC1|!')).toBe('ABC1|!');
    expect(normalizeReceiptItemDisplayName('WodaTestowa1,49')).toBe('WodaTestowa1,49');
  });

  it('keeps raw OCR but exposes the normalized product display name', () => {
    const parsed = parseReceiptText(`
SKLEP TESTOWY\nPARAGON FISKALNY\nNazwa PTU Ilość Cena Wartość\nWodaTestowa1|! A 2x 1,49 2,98\nSuma PLN 2,98\nKarta płatnicza 2,98\nData 11/09/2026 07:11:31
`);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.rawText).toContain('WodaTestowa1|!');
    expect(parsed.items[0]?.name).toBe('WodaTestowa1l');
  });

  it('deduplicates overlapping chunk copies and prefers the stronger reading', () => {
    const result = dedupeReceiptOcrTokens([
      token('transakcji', 0, 264, 484, 95),
      token('transakcji', 1, 264, 482, 95),
      token('1/27/260911298216', 0, 1197, 1668, 23),
      token('1727260911298216', 1, 1197, 1668, 53),
    ]);
    expect(result.map((entry) => entry.text)).toEqual(['transakcji', '1727260911298216']);
  });

  it('does not collapse adjacent non-overlapping repeated words', () => {
    const result = dedupeReceiptOcrTokens([
      token('Numer', 0, 100, 180, 96),
      token('Numer', 1, 250, 330, 96),
    ]);
    expect(result).toHaveLength(2);
  });

  it('cuts parser-facing technical footer only after final, payment and date are confirmed', () => {
    const rows = [
      row('Suma PLN 13,34', 10),
      row('OPAKOWANIA ZWROTNE SUMA 1,00', 50),
      row('DO ZAPŁATY 14,34 PLN', 90),
      row('Karta płatnicza 14,34', 130),
      row('Numer transakcji 2982', 170),
      row('Data 11/09/2026 07:11:31', 210),
      row('PRA PLO AIEAFOFZS GYF%', 250),
      row('Numer karty: 9954 7*****885', 290),
    ];
    expect(trimReceiptTechnicalFooterRows(rows).map((entry) => entry.text)).toEqual(rows.slice(0, 6).map((entry) => entry.text));
  });

  it('does not cut an early header date before final/payment evidence', () => {
    const rows = [
      row('Data 11/09/2026 07:11:31', 10),
      row('Produkt A 1x 2,00 2,00', 50),
      row('Suma PLN 2,00', 90),
      row('Karta płatnicza 2,00', 130),
    ];
    expect(trimReceiptTechnicalFooterRows(rows)).toHaveLength(4);
  });

  it('uses one production-facing financial consistency result for the selected draft', () => {
    const financial = reconcileParsedReceiptFinancials({
      detectedItemsTotalMinor: 1334,
      ocrSubtotalMinor: 1334,
      depositTotalMinor: 100,
      finalPayableMinor: 1434,
      declaredTotalMinor: 1434,
      paymentTotalMinor: 1434,
    });
    expect(financial.financiallyConsistent).toBe(true);
    expect(financial.unexplainedDifferenceMinor).toBe(0);
    expect(financial.paymentDifferenceMinor).toBe(0);
  });
});
