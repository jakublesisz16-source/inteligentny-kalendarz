import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chooseReceiptDeskewAngle, planSafeReceiptCrop } from '../shopping/receipt-ocr/ocr-photo-quality-plan';
import { calculateReceiptPhotoOcrScale } from '../shopping/receipt-ocr/ocr-preprocess-plan';
import { planReceiptPdfRender, RECEIPT_PDF_TARGET_WIDTH } from '../shopping/receipt-ocr/receipt-pdf';

function source(path: string): string { return readFileSync(new URL(path, import.meta.url), 'utf8'); }

function centeredReceiptSample(width: number, height: number): number[] {
  const values = Array<number>(width * height).fill(250);
  for (let y = 10; y < height - 10; y += 1) {
    for (let x = 20; x < width - 20; x += 1) values[y * width + x] = 45;
  }
  return values;
}

describe('1.1.0-dev.3 DEV3-B015 source-aware OCR quality contract', () => {
  it('uses a higher deterministic PDF render target within the safe range', () => {
    expect(RECEIPT_PDF_TARGET_WIDTH).toBe(1800);
    expect(planReceiptPdfRender(300, 700).width).toBeGreaterThan(1600);
    expect(planReceiptPdfRender(300, 700).width).toBeLessThanOrEqual(1800);
  });


  it('gives extremely narrow photos more OCR pixels without unbounded scaling', () => {
    expect(calculateReceiptPhotoOcrScale(187)).toBe(6);
    expect(calculateReceiptPhotoOcrScale(300)).toBe(4);
    expect(calculateReceiptPhotoOcrScale(700)).toBe(1);
  });


  it('uses a slightly larger bounded chunk for clean PDF renders while keeping photo defaults', () => {
    const preprocess = source('../shopping/receipt-ocr/image-preprocess.ts');
    expect(preprocess).toContain("sourceType === 'pdf'");
    expect(preprocess).toContain('planReceiptOcrChunks(processedHeight, 2600, 360)');
    expect(preprocess).toContain(': planReceiptOcrChunks(processedHeight)');
  });

  it('detects safe large margins around a centered photo receipt', () => {
    const plan = planSafeReceiptCrop(100, 100, centeredReceiptSample(100, 100));
    expect(plan.applied).toBe(true);
    expect(plan.leftRatio).toBeGreaterThan(0);
    expect(plan.rightRatio).toBeLessThan(1);
  });

  it('does not crop when content reaches the image boundaries', () => {
    const values = Array<number>(100 * 100).fill(45);
    const plan = planSafeReceiptCrop(100, 100, values);
    expect(plan.applied).toBe(false);
  });

  it('chooses a small deskew only with a clear projection improvement', () => {
    expect(chooseReceiptDeskewAngle([
      { angle: -2, score: 112 },
      { angle: 0, score: 100 },
      { angle: 2, score: 101 },
    ])).toBe(-2);
  });

  it('keeps neutral deskew when improvement is too small', () => {
    expect(chooseReceiptDeskewAngle([
      { angle: -2, score: 105 },
      { angle: 0, score: 100 },
      { angle: 2, score: 104 },
    ])).toBe(0);
  });

  it('routes PDF and photo through source-aware preprocessing', () => {
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    const preprocess = source('../shopping/receipt-ocr/image-preprocess.ts');
    expect(flow).toContain("const sourceType: ReceiptOcrSourceType = isReceiptPdfFile(targetFile) ? 'pdf' : 'photo'");
    expect(flow).toContain('preprocessReceiptImage(targetFile, targetRotation, sourceType)');
    expect(flow).toContain("preprocessReceiptImage(rendered.file, targetRotation, 'pdf')");
    expect(preprocess).toContain("sourceType: ReceiptOcrSourceType = 'photo'");
    expect(preprocess).toContain("sourceType === 'photo'");
  });

  it('keeps PDF free from photo crop and deskew transforms', () => {
    const preprocess = source('../shopping/receipt-ocr/image-preprocess.ts');
    expect(preprocess).toContain("sourceType === 'photo'");
    expect(preprocess).toContain('cropReceiptCanvas(orientedCanvas)');
    expect(preprocess).toContain('estimateReceiptDeskew(cropCanvas, inverted)');
  });

  it('uses mild sharpening only for photos and percentile contrast for both sources', () => {
    const preprocess = source('../shopping/receipt-ocr/image-preprocess.ts');
    expect(preprocess).toContain("sourceType === 'pdf' ? 0.01 : 0.02");
    expect(preprocess).toContain("sourceType === 'photo') grayscale = applyMildSharpen");
  });

  it('keeps quality and raw OCR session-only and clears them on new scan/save', () => {
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    expect(flow).toContain('const [diagnosticOcrQuality, setDiagnosticOcrQuality]');
    expect(flow).toMatch(/analyzeReceiptOcrQuality\(\s*[A-Za-z_$][\w$]*\s*,\s*sourceType\s*,\s*[A-Za-z_$][\w$]*\s*\)/u);
    expect(flow).toContain('combineReceiptPdfPageTexts(pageTexts)');
    expect(flow.match(/setDiagnosticOcrQuality\(null\)/gu)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(flow).not.toContain('localStorage');
    expect(flow).not.toContain('sessionStorage');
    expect(flow).not.toContain('indexedDB');
  });

  it('shows source, OCR quality and suspicious financial line count in diagnostics', () => {
    const review = source('../shopping/receipt-ocr/ReceiptScanReview.tsx');
    expect(review).toContain("diagnosticOcrMeta.sourceType === 'pdf' ? 'PDF' : 'Zdjęcie'");
    expect(review).toContain('Jakość OCR');
    expect(review).toContain('consistentFinancialLines');
    expect(review).toContain('suspiciousFinancialLines');
    expect(review).toContain('OCR wymaga dokładnego sprawdzenia.');
  });
});
