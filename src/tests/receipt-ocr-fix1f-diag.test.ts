import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string { return readFileSync(new URL(path, import.meta.url), 'utf8'); }

describe('1.1.0-dev.3 FIX1F-DIAG raw OCR diagnostic contract', () => {
  it('keeps raw OCR only in ReceiptScanFlow memory and passes it directly to review', () => {
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    expect(flow).toContain("const [diagnosticOcrText, setDiagnosticOcrText] = useState('')");
    expect(flow).toMatch(/setDiagnosticOcrText\(\s*[A-Za-z_$][\w$]*\s*\)/u);
    expect(flow).toContain('combineReceiptPdfPageTexts(pageTexts)');
    expect(flow).toContain('diagnosticOcrText={diagnosticOcrText}');
  });

  it('offers explicit copy diagnostics without logging raw OCR', () => {
    const review = source('../shopping/receipt-ocr/ReceiptScanReview.tsx');
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    expect(review).toContain('Kopiuj tekst OCR');
    expect(review).toContain('navigator.clipboard?.writeText');
    expect(review).toContain("document.execCommand('copy')");
    expect(review).toContain('Surowy tekst OCR do ręcznego skopiowania');
    expect(review).not.toContain('console.log');
    expect(flow).not.toContain('console.log');
  });

  it('does not add raw OCR to persistent review/parser models', () => {
    const types = source('../shopping/receipt-ocr/receipt-ocr.types.ts');
    const persistence = source('../shopping/receipt-ocr/receipt-review.model.ts');
    expect(types).not.toContain('diagnosticOcrText');
    expect(types).not.toContain('rawOcrText');
    expect(persistence).not.toContain('diagnosticOcrText');
    expect(persistence).not.toContain('rawOcrText');
  });

  it('does not persist the diagnostic through browser storage APIs', () => {
    const review = source('../shopping/receipt-ocr/ReceiptScanReview.tsx');
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    for (const text of [review, flow]) {
      expect(text).not.toContain('localStorage');
      expect(text).not.toContain('sessionStorage');
      expect(text).not.toContain('indexedDB');
      expect(text).not.toContain('fetch(');
      expect(text).not.toContain('XMLHttpRequest');
    }
  });
});
