import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { combineReceiptPdfPageTexts, MAX_RECEIPT_PDF_PAGES, RECEIPT_PAGE_BREAK, validateReceiptPdfPageCount } from '../shopping/receipt-ocr/receipt-pdf';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

function source(path: string): string { return readFileSync(new URL(path, import.meta.url), 'utf8'); }

describe('1.1.0-dev.3 DEV3-B020 multi-page receipt PDF', () => {
  it('accepts up to six pages and rejects seven', () => {
    expect(() => validateReceiptPdfPageCount(1)).not.toThrow();
    expect(() => validateReceiptPdfPageCount(MAX_RECEIPT_PDF_PAGES)).not.toThrow();
    expect(() => validateReceiptPdfPageCount(MAX_RECEIPT_PDF_PAGES + 1)).toThrow(/maksymalnie/iu);
  });

  it('combines pages in original order with an explicit transient page boundary', () => {
    const combined = combineReceiptPdfPageTexts(['PAGE ONE', 'PAGE TWO']);
    expect(combined).toBe(`PAGE ONE\n${RECEIPT_PAGE_BREAK}\nPAGE TWO`);
  });

  it('does not reset document parsing at a page break and can take total/payment from page 2', () => {
    const raw = combineReceiptPdfPageTexts([
      'SKLEP TESTOWY\nPARAGON FISKALNY\nProdukt Alfa 1 x 40,00 40,00\nProdukt Beta 1 x 60,00 60,00\nSPRZEDAŻ OPODATKOWANA A 100,00\nPTU A 23% 18,70',
      'SUMA PLN 100,00\nKARTA 100,00\nNumer transakcji 123',
    ]);
    const parsed = parseReceiptText(raw);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.declaredTotalMinor).toBe(10000);
    expect(parsed.items.map((item) => item.amountMinor)).toEqual([4000, 6000]);
  });

  it('renders pages sequentially and keeps PDF data local', () => {
    const renderer = source('../shopping/receipt-ocr/receipt-pdf.ts');
    expect(renderer).toContain('for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1)');
    expect(renderer).toContain('page.cleanup()');
    expect(renderer).toContain('await loadingTask.destroy()');
    expect(renderer).not.toContain('fetch(');
    expect(renderer).not.toContain('https://');
  });

  it('routes all PDF pages through one shared OCR engine path', () => {
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    expect(flow).toContain('renderReceiptPdfPages(targetFile');
    expect(flow).toContain('recognizeReceiptImageChunks(processed.chunks');
    expect(flow).toContain('combineReceiptPdfPageTexts(pageTexts)');
    expect(flow).not.toContain('createWorker(');
  });
});
