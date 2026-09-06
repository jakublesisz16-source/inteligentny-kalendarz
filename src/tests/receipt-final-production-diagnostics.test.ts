import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string { return readFileSync(new URL(path, import.meta.url), 'utf8'); }

describe('DEV3-B025 production OCR diagnostics cleanup', () => {
  it('keeps user-facing quality warnings outside the DEV-only technical diagnostics block', () => {
    const review = source('../shopping/receipt-ocr/ReceiptScanReview.tsx');
    const warningIndex = review.indexOf('Źródło ma bardzo niską jakość.');
    const devGuardIndex = review.indexOf('import.meta.env.DEV ? (');
    const diagnosticsIndex = review.indexOf('Diagnostyka OCR FIX1J');
    expect(warningIndex).toBeGreaterThan(-1);
    expect(devGuardIndex).toBeGreaterThan(warningIndex);
    expect(diagnosticsIndex).toBeGreaterThan(devGuardIndex);
    expect(review).toContain('Kwoty są spójne, ale część nazw wymaga sprawdzenia.');
  });

  it('guards raw OCR copy UI with the compile-time DEV flag while keeping raw OCR session-only', () => {
    const review = source('../shopping/receipt-ocr/ReceiptScanReview.tsx');
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    expect(review).toContain('import.meta.env.DEV ? (');
    expect(review).toContain('Kopiuj tekst OCR');
    expect(review).toContain('Surowy tekst OCR do ręcznego skopiowania');
    expect(flow).toContain("const [diagnosticOcrText, setDiagnosticOcrText] = useState('')");
    expect(flow).not.toContain('localStorage');
    expect(flow).not.toContain('sessionStorage');
    expect(flow).not.toContain('indexedDB');
  });
});
