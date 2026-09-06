import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { combineReceiptPdfPageTexts, RECEIPT_PAGE_BREAK } from '../shopping/receipt-ocr/receipt-pdf';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

function captureCombinedTextIdentifier(flow: string): string {
  const match = flow.match(/([A-Za-z_$][\w$]*)\s*=\s*combineReceiptPdfPageTexts\(pageTexts\)/u);
  if (!match?.[1]) throw new Error('ReceiptScanFlow must assign combined PDF OCR text to one aggregate variable.');
  return match[1];
}

describe('1.1.0-dev.3 DEV3-B021 aggregate OCR test contract hotfix', () => {
  it('keeps photo preprocessing source-aware without requiring the retired ocrImageFile local', () => {
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    expect(flow).toContain("const sourceType: ReceiptOcrSourceType = isReceiptPdfFile(targetFile) ? 'pdf' : 'photo'");
    expect(flow).toContain('preprocessReceiptImage(targetFile, targetRotation, sourceType)');
    expect(flow).not.toContain('preprocessReceiptImage(ocrImageFile, targetRotation, sourceType)');
  });

  it('aggregates all PDF page OCR in page order before diagnostics, quality analysis and parsing', () => {
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    const aggregate = captureCombinedTextIdentifier(flow);
    expect(flow).toContain('pageTexts.push(result.text)');
    expect(flow).toContain(`setDiagnosticOcrText(${aggregate})`);
    expect(flow).toContain(`analyzeReceiptOcrQuality(${aggregate}, sourceType, resultConfidence)`);
    expect(flow).toContain(`parseReceiptText(${aggregate})`);
  });

  it('does not regress to parsing or diagnosing one page result directly', () => {
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    expect(flow).not.toContain('setDiagnosticOcrText(result.text)');
    expect(flow).not.toContain('analyzeReceiptOcrQuality(result.text, sourceType, result.confidence)');
    expect(flow).not.toContain('parseReceiptText(result.text)');
  });

  it('keeps the explicit page boundary transient and deterministic', () => {
    const combined = combineReceiptPdfPageTexts(['PAGE A', 'PAGE B', 'PAGE C']);
    expect(combined).toBe(`PAGE A\n${RECEIPT_PAGE_BREAK}\nPAGE B\n${RECEIPT_PAGE_BREAK}\nPAGE C`);
  });

  it('keeps aggregate OCR session-only and away from browser persistence/network APIs', () => {
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    const reviewModel = source('../shopping/receipt-ocr/receipt-review.model.ts');
    for (const implementation of [flow, reviewModel]) {
      expect(implementation).not.toContain('localStorage');
      expect(implementation).not.toContain('sessionStorage');
      expect(implementation).not.toContain('indexedDB');
      expect(implementation).not.toContain('XMLHttpRequest');
    }
    expect(flow).not.toContain('fetch(');
  });
});
