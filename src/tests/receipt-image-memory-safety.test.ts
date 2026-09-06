import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  calculateSafeReceiptImageDimensions,
  MAX_RECEIPT_IMAGE_PIXELS,
  preprocessReceiptImage,
  ReceiptImageError,
} from '../shopping/receipt-ocr/image-preprocess';

function pixels(width: number, height: number): number { return width * height; }
function source(path: string): string { return readFileSync(new URL(path, import.meta.url), 'utf8'); }

function expectAspectClose(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): void {
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = targetWidth / targetHeight;
  expect(Math.abs(targetAspect - sourceAspect) / sourceAspect).toBeLessThan(0.001);
}

describe('1.1.0-dev.3 DEV3-B027 photo memory safety', () => {
  it('keeps a normal image below the pixel budget unchanged', () => {
    expect(calculateSafeReceiptImageDimensions(2000, 1500)).toEqual({ width: 2000, height: 1500, scale: 1 });
  });

  it('keeps an image exactly on the pixel budget unchanged', () => {
    expect(calculateSafeReceiptImageDimensions(4000, 2000)).toEqual({ width: 4000, height: 2000, scale: 1 });
  });

  it('downscales an image just above the pixel budget', () => {
    const plan = calculateSafeReceiptImageDimensions(4001, 2000);
    expect(plan.scale).toBeLessThan(1);
    expect(pixels(plan.width, plan.height)).toBeLessThanOrEqual(MAX_RECEIPT_IMAGE_PIXELS);
    expectAspectClose(4001, 2000, plan.width, plan.height);
  });

  it('caps a 48 MP photo while preserving its aspect ratio', () => {
    const plan = calculateSafeReceiptImageDimensions(8000, 6000);
    expect(pixels(plan.width, plan.height)).toBeLessThanOrEqual(MAX_RECEIPT_IMAGE_PIXELS);
    expectAspectClose(8000, 6000, plan.width, plan.height);
  });

  it('caps a realistic approximately 108 MP photo while preserving its aspect ratio', () => {
    const plan = calculateSafeReceiptImageDimensions(12000, 9000);
    expect(pixels(plan.width, plan.height)).toBeLessThanOrEqual(MAX_RECEIPT_IMAGE_PIXELS);
    expectAspectClose(12000, 9000, plan.width, plan.height);
  });

  it('handles panoramic and portrait images deterministically', () => {
    const panorama = calculateSafeReceiptImageDimensions(20000, 1000);
    const portrait = calculateSafeReceiptImageDimensions(1000, 20000);
    for (const plan of [panorama, portrait]) {
      expect(pixels(plan.width, plan.height)).toBeLessThanOrEqual(MAX_RECEIPT_IMAGE_PIXELS);
    }
    expectAspectClose(20000, 1000, panorama.width, panorama.height);
    expectAspectClose(1000, 20000, portrait.width, portrait.height);
  });

  it('rejects invalid and non-finite dimensions instead of allocating a canvas', () => {
    const invalidDimensions: ReadonlyArray<readonly [number, number]> = [
      [0, 100],
      [-1, 100],
      [100, 0],
      [Number.NaN, 100],
      [Number.POSITIVE_INFINITY, 100],
    ];

    for (const [width, height] of invalidDimensions) {
      expect(() => calculateSafeReceiptImageDimensions(width, height)).toThrow(ReceiptImageError);
    }
    expect(() => calculateSafeReceiptImageDimensions(Number.MAX_SAFE_INTEGER, 1)).toThrow(ReceiptImageError);
  });


  it('reads encoded PNG dimensions before decode and requests a bounded bitmap for oversized input', async () => {
    const bytes = new Uint8Array(24);
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].forEach((value, index) => { bytes[index] = value; });
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 12000);
    view.setUint32(20, 9000);
    const file = new File([bytes], 'large.png', { type: 'image/png' });
    let options: ImageBitmapOptions | undefined;
    vi.stubGlobal('createImageBitmap', async (_file: Blob, received?: ImageBitmapOptions) => {
      options = received;
      throw new Error('stop after decode request');
    });
    try {
      await expect(preprocessReceiptImage(file, 0, 'photo')).rejects.toThrow('Nie udało się odczytać zdjęcia');
      expect(options?.resizeWidth).toBeGreaterThan(0);
      expect(options?.resizeHeight).toBeGreaterThan(0);
      expect((options?.resizeWidth ?? 0) * (options?.resizeHeight ?? 0)).toBeLessThanOrEqual(MAX_RECEIPT_IMAGE_PIXELS);
      expect(options?.resizeQuality).toBe('high');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('probes encoded dimensions before decoding and requests bounded ImageBitmap resize only above the limit', () => {
    const implementation = source('../shopping/receipt-ocr/image-preprocess.ts');
    expect(implementation).toContain('readEncodedReceiptImageDimensions(file)');
    expect(implementation).toContain('safeDimensions.scale < 1');
    expect(implementation).toContain('resizeWidth: safeDimensions.width');
    expect(implementation).toContain('resizeHeight: safeDimensions.height');
    expect(implementation).toContain("resizeQuality: 'high'");
    expect(implementation).toContain('bitmap.close();');
    expect(implementation).toContain('bitmap = null;');
  });

  it('releases superseded working canvases and every OCR chunk canvas', () => {
    const implementation = source('../shopping/receipt-ocr/image-preprocess.ts');
    expect(implementation).toContain('orientedCanvas.width = 1');
    expect(implementation).toContain('croppedCanvas.width = 1');
    expect(implementation).toContain('deskewedCanvas.width = 1');
    expect(implementation).toContain('finally {\n        chunkCanvas.width = 1;');
  });
});
