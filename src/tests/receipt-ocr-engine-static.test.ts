import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string { return readFileSync(new URL(path, import.meta.url), 'utf8'); }

const REQUIRED_RUNTIME = [
  '../../public/ocr/tesseract/tesseract.min.js',
  '../../public/ocr/tesseract/worker.min.js',
  '../../public/ocr/tesseract/core/tesseract-core-lstm.wasm.js',
  '../../public/ocr/tesseract/core/tesseract-core-simd-lstm.wasm.js',
  '../../public/ocr/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js',
  '../../public/ocr/tesseract/lang/pol.traineddata.gz',
] as const;

const MINIMUM_SIZES: Record<(typeof REQUIRED_RUNTIME)[number], number> = {
  '../../public/ocr/tesseract/tesseract.min.js': 10_000,
  '../../public/ocr/tesseract/worker.min.js': 10_000,
  '../../public/ocr/tesseract/core/tesseract-core-lstm.wasm.js': 3_000_000,
  '../../public/ocr/tesseract/core/tesseract-core-simd-lstm.wasm.js': 3_000_000,
  '../../public/ocr/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js': 3_000_000,
  '../../public/ocr/tesseract/lang/pol.traineddata.gz': 100_000,
};

type AssetManifest = {
  status: string;
  runtime: Array<{ path: string; sha256: string | null }>;
};

describe('1.1.0-dev.3 FIX1 local OCR architecture', () => {
  it('keeps OCR engine lazy, local-only and terminable', () => {
    const engine = source('../shopping/receipt-ocr/ocr-engine.ts');
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    expect(engine).toContain("const OCR_VERSION = '7.0.0'");
    expect(engine).toContain("const OCR_LANGUAGE = 'pol'");
    expect(engine).toContain('workerPath: RECEIPT_OCR_ASSETS.worker');
    expect(engine).toContain('corePath: RECEIPT_OCR_ASSETS.core');
    expect(engine).toContain('langPath: RECEIPT_OCR_ASSETS.lang');
    expect(engine).toContain('workerBlobURL: false');
    expect(engine).toContain("cacheMethod: 'none'");
    expect(engine).toContain('terminate()');
    expect(engine).not.toMatch(/https?:\/\//iu);
    expect(engine.toLowerCase()).not.toContain('cdn');
    expect(engine).toContain("document.createElement('script')");
        expect(engine).toContain('script.src = RECEIPT_OCR_ASSETS.script');
        expect(engine).toContain('globalWindow.Tesseract');
        expect(engine).not.toContain('import(/* @vite-ignore */');
    expect(flow).toContain('recognizeReceiptImage');
    expect(flow).toContain('abortRef.current?.abort()');
  });

  it('uses the minimal Tesseract.js 7 LSTM-only browser core matrix', () => {
    const engine = source('../shopping/receipt-ocr/ocr-engine.ts');
    expect(engine).toContain('createWorker(OCR_LANGUAGE, 1');
    const names = REQUIRED_RUNTIME.join('\n');
    expect(names).toContain('tesseract-core-lstm.wasm.js');
    expect(names).toContain('tesseract-core-simd-lstm.wasm.js');
    expect(names).toContain('tesseract-core-relaxedsimd-lstm.wasm.js');
    expect(names).not.toContain('core/tesseract-core.wasm.js');
    expect(names).not.toContain('core/tesseract-core-simd.wasm.js');
    expect(names).not.toContain('core/tesseract-core-relaxedsimd.wasm.js');
    expect(names).not.toMatch(/\.wasm(?:\n|$)/u);
  });

  it('requires all six local runtime assets with non-trivial sizes', () => {
    const missing = REQUIRED_RUNTIME.filter((path) => !existsSync(new URL(path, import.meta.url)));
    expect(missing).toEqual([]);
    for (const path of REQUIRED_RUNTIME) {
      expect(statSync(new URL(path, import.meta.url)).size, path).toBeGreaterThan(MINIMUM_SIZES[path]);
    }
  });

  it('rejects obvious HTML placeholders and checks the embedded WASM loaders', () => {
    for (const path of REQUIRED_RUNTIME.filter((value) => value.endsWith('.js'))) {
      if (!existsSync(new URL(path, import.meta.url))) continue;
      const text = source(path);
      expect(text.slice(0, 512).toLowerCase(), path).not.toContain('<!doctype html');
      expect(text.slice(0, 512).toLowerCase(), path).not.toContain('<html');
    }
    for (const path of REQUIRED_RUNTIME.filter((value) => value.endsWith('.wasm.js'))) {
      if (!existsSync(new URL(path, import.meta.url))) continue;
      const text = source(path);
      expect(text, path).toContain('WebAssembly');
      expect(text, path).toContain('base64');
    }
  });

  it('matches every runtime file against the committed SHA-256 inventory', () => {
    const manifest = JSON.parse(source('../../public/ocr/tesseract/ASSET_MANIFEST.json')) as AssetManifest;
    expect(manifest.status).toBe('complete');
    const byPath = new Map(manifest.runtime.map((entry) => [entry.path, entry.sha256]));
    for (const relative of REQUIRED_RUNTIME) {
      const path = relative.replace('../../public/ocr/tesseract/', '');
      const expected = byPath.get(path);
      expect(expected, `manifest ${path}`).toMatch(/^[a-f0-9]{64}$/u);
      if (!existsSync(new URL(relative, import.meta.url))) continue;
      const actual = createHash('sha256').update(readFileSync(new URL(relative, import.meta.url))).digest('hex');
      expect(actual, path).toBe(expected);
    }
  });

  it('makes every required OCR runtime asset mandatory in Service Worker precache', () => {
    const worker = source('../../public/service-worker.js');
    expect(worker).toContain('MANDATORY_OCR_ASSET_PATHS');
    expect(worker).toContain('fetchMandatoryAsset');
    expect(worker).toContain('if (!response.ok) throw new Error');
    expect(worker).toContain("includes('text/html')");
    expect(worker).not.toContain('Pojedynczy opcjonalny zasób nie blokuje instalacji Service Workera');
    for (const relative of REQUIRED_RUNTIME) {
      const path = relative.replace('../../public/', '');
      expect(worker, path).toContain(`'${path}'`);
    }
  });
});
