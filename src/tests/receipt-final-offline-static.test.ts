import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string { return readFileSync(new URL(path, import.meta.url), 'utf8'); }

const OCR_PATHS = [
  'ocr/tesseract/tesseract.min.js',
  'ocr/tesseract/worker.min.js',
  'ocr/tesseract/core/tesseract-core-lstm.wasm.js',
  'ocr/tesseract/core/tesseract-core-simd-lstm.wasm.js',
  'ocr/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'ocr/tesseract/lang/pol.traineddata.gz',
] as const;

describe('DEV3-B026 offline and Service Worker data-safety regression', () => {
  it('keeps all OCR runtime assets local and mandatory in the B026 Service Worker', () => {
    const worker = source('../../public/service-worker.js');
    expect(worker).toContain("const CACHE_PREFIX = 'inteligentny-kalendarz-shell-'");
    expect(worker).toContain("const CACHE_NAME = `${CACHE_PREFIX}v1.1.0`");
    for (const path of OCR_PATHS) {
      expect(worker).toContain(`'${path}'`);
      expect(existsSync(new URL(`../../public/${path}`, import.meta.url))).toBe(true);
    }
    expect(worker).not.toMatch(/indexedDB|deleteDatabase/iu);
    expect(worker).toContain('caches.delete');
    expect(worker).toContain('discoverBundledAssetUrls');
    expect(worker).toContain('nestedAssets');
  });

  it('uses bundled local PDF.js and a bundled worker URL with no CDN/network OCR dependency', () => {
    const pdf = source('../shopping/receipt-ocr/receipt-pdf.ts');
    const engine = source('../shopping/receipt-ocr/ocr-engine.ts');
    expect(pdf).toContain("import('pdfjs-dist')");
    expect(pdf).toContain("import('pdfjs-dist/build/pdf.worker.min.mjs?url')");
    expect(pdf).not.toMatch(/https?:\/\//iu);
    expect(engine).not.toMatch(/https?:\/\//iu);
    expect(engine.toLocaleLowerCase('en-US')).not.toContain('cdn');
  });

  it('registers the Service Worker only in production and never caches private receipt files explicitly', () => {
    const main = source('../main.tsx');
    const worker = source('../../public/service-worker.js');
    expect(main).toContain('if (import.meta.env.PROD) registerServiceWorker();');
    expect(worker).toContain("const PRIVATE_FILE_EXTENSIONS = ['.pdf', '.xlsx', '.xls', '.json'];");
    expect(worker).toContain('url.origin !== self.location.origin');
  });
});
