import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  planReceiptPdfRender,
  RECEIPT_PDF_MAX_RENDER_PIXELS,
  RECEIPT_PDF_MAX_SCALE,
  RECEIPT_PDF_TARGET_WIDTH,
} from '../shopping/receipt-ocr/receipt-pdf';

function source(path: string): string { return readFileSync(new URL(path, import.meta.url), 'utf8'); }

describe('1.1.0-dev.3 DEV3-B015 receipt PDF OCR source contract', () => {
  it('renders a typical narrow PDF page near the OCR target width without exceeding max scale', () => {
    const plan = planReceiptPdfRender(240, 600);
    expect(plan.width).toBeGreaterThanOrEqual(1500);
    expect(plan.width).toBeLessThanOrEqual(RECEIPT_PDF_TARGET_WIDTH + 2);
    expect(plan.scale).toBeLessThanOrEqual(RECEIPT_PDF_MAX_SCALE);
    expect(plan.width * plan.height).toBeLessThanOrEqual(RECEIPT_PDF_MAX_RENDER_PIXELS + plan.width);
  });

  it('caps pathological tall PDF pages by render pixel budget', () => {
    const plan = planReceiptPdfRender(300, 10000);
    expect(plan.width * plan.height).toBeLessThanOrEqual(RECEIPT_PDF_MAX_RENDER_PIXELS + plan.width);
  });

  it('keeps the camera image-only but allows PDF from the gallery/file picker', () => {
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    expect(flow).toContain('accept="image/*" capture="environment"');
    expect(flow).toContain('accept="image/*,application/pdf,.pdf"');
    expect(flow).toContain('Wybierz zdjęcie / PDF');
  });

  it('renders PDF locally through the pinned pdfjs-dist worker and first page canvas', () => {
    const renderer = source('../shopping/receipt-ocr/receipt-pdf.ts');
    expect(renderer).toContain("import('pdfjs-dist')");
    expect(renderer).toContain('Promise.all([');
    expect(renderer).not.toContain("import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'");
    expect(renderer).not.toContain("import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'");
    expect(renderer).toContain("pdfjs-dist/build/pdf.worker.min.mjs?url");
    expect(renderer).toContain('data: bytes');
    expect(renderer).toContain('useWorkerFetch: false');
    expect(renderer).toContain('validateReceiptPdfPageCount(pdf.numPages)');
    expect(renderer).toContain('pageNumber <= pdf.numPages');
    expect(renderer).toContain('pdf.getPage(pageNumber)');
    expect(renderer).toContain('page.render({');
    expect(renderer).toContain('canvas,');
    expect(renderer).toContain('receipt-pdf-page-${pageNumber}.png');
  });

  it('validates the PDF signature and does not use a remote URL or fetch', () => {
    const renderer = source('../shopping/receipt-ocr/receipt-pdf.ts');
    expect(renderer).toContain("signature !== '%PDF-'");
    expect(renderer).not.toContain('fetch(');
    expect(renderer).not.toContain('http://');
    expect(renderer).not.toContain('https://');
  });

  it('cleans PDF.js, canvas and object URL resources', () => {
    const renderer = source('../shopping/receipt-ocr/receipt-pdf.ts');
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    expect(renderer).toContain('page.cleanup()');
    expect(renderer).toContain('await loadingTask.destroy()');
    expect(renderer).toContain('canvas.width = 1');
    expect(renderer).toContain('canvas.height = 1');
    expect(flow).toContain('URL.revokeObjectURL');
  });

  it('routes the rendered PNG through the existing FIX1G preprocessing and OCR pipeline', () => {
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    expect(flow).toContain('renderReceiptPdfPages(targetFile');
    expect(flow).toContain("preprocessReceiptImage(rendered.file, targetRotation, 'pdf')");
    expect(flow).toContain('combineReceiptPdfPageTexts(pageTexts)');
    expect(flow).toContain('recognizeReceiptImageChunks(processed.chunks');
    expect(flow).toMatch(/parseReceiptText\(\s*[A-Za-z_$][\w$]*\s*\)/u);
    expect(flow).not.toContain('parseReceiptText(result.text)');
  });

  it('keeps PDF and raw OCR transient instead of adding persistence', () => {
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    const renderer = source('../shopping/receipt-ocr/receipt-pdf.ts');
    for (const implementation of [flow, renderer]) {
      expect(implementation).not.toContain('localStorage');
      expect(implementation).not.toContain('sessionStorage');
      expect(implementation).not.toContain('indexedDB');
    }
  });
});
