import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  calculateReceiptOcrScale,
  mergeReceiptOcrChunkTexts,
  planReceiptOcrChunks,
  RECEIPT_OCR_CHUNK_HEIGHT,
  RECEIPT_OCR_CHUNK_OVERLAP,
  RECEIPT_OCR_MAX_SCALE,
  shouldInvertReceiptLuminance,
} from '../shopping/receipt-ocr/ocr-preprocess-plan';

function source(path: string): string { return readFileSync(new URL(path, import.meta.url), 'utf8'); }

describe('1.1.0-dev.3 FIX1G preprocessing contract', () => {
  it('upscales narrow inputs but never exceeds the max scale', () => {
    expect(calculateReceiptOcrScale(300)).toBe(RECEIPT_OCR_MAX_SCALE);
    expect(calculateReceiptOcrScale(600)).toBeGreaterThan(1);
    expect(calculateReceiptOcrScale(600)).toBeLessThanOrEqual(RECEIPT_OCR_MAX_SCALE);
  });

  it('does not upscale already wide inputs', () => {
    expect(calculateReceiptOcrScale(700)).toBe(1);
    expect(calculateReceiptOcrScale(1200)).toBe(1);
  });

  it('preserves aspect ratio mathematically during scale planning', () => {
    const width = 480;
    const height = 1920;
    const scale = calculateReceiptOcrScale(width);
    expect((width * scale) / (height * scale)).toBeCloseTo(width / height, 8);
  });

  it('detects a predominantly dark receipt background', () => {
    expect(shouldInvertReceiptLuminance([18, 22, 25, 30, 35, 40, 210])).toBe(true);
  });

  it('does not invert a predominantly light receipt background', () => {
    expect(shouldInvertReceiptLuminance([242, 245, 250, 252, 255, 220, 40])).toBe(false);
  });

  it('keeps a normal-height image in one chunk', () => {
    expect(planReceiptOcrChunks(1400)).toEqual([{ index: 0, startY: 0, endY: 1400, height: 1400 }]);
  });

  it('splits a tall image into bounded overlapping chunks with no gaps', () => {
    const chunks = planReceiptOcrChunks(6200);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.height).toBeLessThanOrEqual(RECEIPT_OCR_CHUNK_HEIGHT);
    for (let index = 1; index < chunks.length; index += 1) {
      const previous = chunks[index - 1]!;
      const current = chunks[index]!;
      expect(current.startY).toBeLessThan(previous.endY);
      expect(current.startY).toBeGreaterThan(previous.startY);
    }
    expect(chunks[0]?.startY).toBe(0);
    expect(chunks.at(-1)?.endY).toBe(6200);
  });

  it('uses a positive configured overlap', () => {
    expect(RECEIPT_OCR_CHUNK_OVERLAP).toBeGreaterThan(0);
    const chunks = planReceiptOcrChunks(RECEIPT_OCR_CHUNK_HEIGHT + 1000);
    expect((chunks[0]?.endY ?? 0) - (chunks[1]?.startY ?? 0)).toBeGreaterThan(0);
  });

  it('never creates a final chunk outside image bounds', () => {
    const chunks = planReceiptOcrChunks(5001);
    expect(chunks.every((chunk) => chunk.startY >= 0 && chunk.endY <= 5001 && chunk.endY > chunk.startY)).toBe(true);
  });

  it('deduplicates an exact overlap only at the chunk boundary', () => {
    const merged = mergeReceiptOcrChunkTexts(['AAA\nBBB\nCCC', 'BBB\nCCC\nDDD']);
    expect(merged).toBe('AAA\nBBB\nCCC\nDDD');
  });

  it('does not globally deduplicate legitimate repeated product lines', () => {
    const merged = mergeReceiptOcrChunkTexts(['Produkt A\nProdukt B', 'Produkt A\nProdukt C']);
    expect(merged).toBe('Produkt A\nProdukt B\nProdukt A\nProdukt C');
  });

  it('deduplicates a strongly anchored OCR-variant overlap but keeps the next real product', () => {
    const previous = 'Produkt Beta C 1 x 1,49 1,49C\n20ml\nRabot -0,74\n0,75C\nProdukt Gamma A 1 x 8,99 8,99A\n100g\nRobot -4,50\n4,49A';
    const next = '20ml\nRobot -0,7/4\n0,75\nProdukt Gama A 1 x 8,99 8,99A\n100g\nRabot -4.50\n4,494\nProdukt Delta A 1 x 8,99 8,99A\n100g\nRabat -4,49\n4,50A';
    const merged = mergeReceiptOcrChunkTexts([previous, next]);
    expect(merged).toContain('Produkt Gamma A 1 x 8,99 8,99A');
    expect(merged).not.toContain('Produkt Gama A 1 x 8,99 8,99A');
    expect(merged).toContain('Produkt Delta A 1 x 8,99 8,99A');
  });

  it('keeps chunk text ordering deterministic', () => {
    expect(mergeReceiptOcrChunkTexts(['A', 'B', 'C', 'D'])).toBe('A\nB\nC\nD');
  });

  it('preprocesses in grayscale with conditional inversion and high-quality scaling', () => {
    const preprocess = source('../shopping/receipt-ocr/image-preprocess.ts');
    expect(preprocess).toContain("context.imageSmoothingQuality = 'high'");
    expect(preprocess).toContain('shouldInvertReceiptLuminance');
    expect(preprocess).toContain('255 - value');
    expect(preprocess).toContain('enhanceReceiptChunk');
  });

  it('processes chunks without building a full upscaled intermediate canvas', () => {
    const preprocess = source('../shopping/receipt-ocr/image-preprocess.ts');
    expect(preprocess).toContain('sourceStartY = plan.startY / scale');
    expect(preprocess).toContain('chunkCanvas.width = processedWidth');
    expect(preprocess).toContain('chunkCanvas.height = plan.height');
    expect(preprocess).not.toContain('canvas.width = processedWidth;\n    canvas.height = processedHeight');
  });

  it('reuses one worker and recognizes chunks sequentially', () => {
    const engine = source('../shopping/receipt-ocr/ocr-engine.ts');
    const functionStart = engine.indexOf('export async function recognizeReceiptImageChunks');
    const functionBody = engine.slice(functionStart);
    expect(functionBody).toContain('const activeWorker = await getWorker(onProgress)');
    expect(functionBody).toContain('for (let index = 0; index < chunks.length; index += 1)');
    expect(functionBody).toContain('await recognizeWithWorker(');
    expect(functionBody).not.toContain('Promise.all(');
  });

  it('keeps diagnostics and raw OCR session-only and clears them after save/new image', () => {
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    expect(flow).toContain("const [diagnosticOcrText, setDiagnosticOcrText] = useState('')");
    expect(flow).toContain('const [diagnosticOcrMeta, setDiagnosticOcrMeta] = useState<ReceiptOcrDiagnostics | null>(null)');
    expect(flow).toMatch(/setDiagnosticOcrText\(\s*[A-Za-z_$][\w$]*\s*\)/u);
    expect(flow).toContain('combineReceiptPdfPageTexts(pageTexts)');
    expect(flow).toContain('setDiagnosticOcrMeta(processed.diagnostics)');
    expect(flow.match(/setDiagnosticOcrText\(''\)/gu)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(flow.match(/setDiagnosticOcrMeta\(null\)/gu)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(flow).not.toContain('localStorage');
    expect(flow).not.toContain('sessionStorage');
    expect(flow).not.toContain('indexedDB');
  });

  it('keeps FIX1G preprocessing isolated from the financial parser implementation', () => {
    const preprocess = source('../shopping/receipt-ocr/image-preprocess.ts');
    const plan = source('../shopping/receipt-ocr/ocr-preprocess-plan.ts');
    const engine = source('../shopping/receipt-ocr/ocr-engine.ts');
    for (const implementation of [preprocess, plan, engine]) {
      expect(implementation).not.toContain('receipt-parser');
      expect(implementation).not.toContain('parseReceiptText');
    }
  });

  it('updates only the shell revision while retaining mandatory local OCR runtime', () => {
    const worker = source('../../public/service-worker.js');
    expect(worker).toContain("const CACHE_PREFIX = 'inteligentny-kalendarz-shell-'");
    expect(worker).toContain("const CACHE_NAME = `${CACHE_PREFIX}v1.1.2`");
    expect(worker).toContain('MANDATORY_OCR_ASSET_PATHS');
    expect(worker).toContain("'ocr/tesseract/tesseract.min.js'");
    expect(worker).toContain("'ocr/tesseract/worker.min.js'");
    expect(worker).toContain("'ocr/tesseract/lang/pol.traineddata.gz'");
  });
});
