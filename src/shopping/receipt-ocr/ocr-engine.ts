import type { OcrProgress, OcrRecognitionResult, ReceiptOcrChunk, ReceiptOcrGeometry, ReceiptOcrGeometrySource, ReceiptOcrToken } from './receipt-ocr.types';
import { mergeReceiptOcrChunkTexts } from './ocr-preprocess-plan';

interface TesseractBboxLike {
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
}

interface TesseractWordLike {
  text?: string;
  confidence?: number;
  bbox?: TesseractBboxLike;
}

interface TesseractLineLike {
  words?: TesseractWordLike[];
}

interface TesseractParagraphLike {
  lines?: TesseractLineLike[];
}

interface TesseractBlockLike {
  paragraphs?: TesseractParagraphLike[];
}

interface TesseractRecognitionDataLike {
  text: string;
  confidence?: number;
  blocks?: TesseractBlockLike[] | null;
}

interface TesseractWorkerLike {
  recognize(
    image: Blob,
    options?: Record<string, unknown>,
    output?: { text?: boolean; blocks?: boolean },
  ): Promise<{ data: TesseractRecognitionDataLike }>;
  setParameters(parameters: Record<string, string>): Promise<unknown>;
  terminate(): Promise<unknown>;
}

export type ReceiptOcrEngineProfile = 'primary' | 'single-block-recovery' | 'fiscal-region-recovery' | 'fiscal-threshold-recovery' | 'header-recovery' | 'value-column-recovery' | 'local-numeric-verification';

interface TesseractModuleLike {
  createWorker(
    languages: string | string[],
    oem?: number,
    options?: {
      workerPath?: string;
      corePath?: string;
      langPath?: string;
      workerBlobURL?: boolean;
      cacheMethod?: 'write' | 'readOnly' | 'refresh' | 'none';
      logger?: (message: { status?: string; progress?: number }) => void;
    },
  ): Promise<TesseractWorkerLike>;
}

const OCR_VERSION = '7.0.0';
const OCR_LANGUAGE = 'pol';

function assetBase(): string {
  const viteBase = import.meta.env.BASE_URL || '/';
  return `${viteBase.endsWith('/') ? viteBase : `${viteBase}/`}ocr/tesseract`;
}

export const RECEIPT_OCR_ASSETS = {
  version: OCR_VERSION,
  language: OCR_LANGUAGE,
  script: `${assetBase()}/tesseract.min.js`,
  worker: `${assetBase()}/worker.min.js`,
  core: `${assetBase()}/core`,
  lang: `${assetBase()}/lang`,
} as const;

let worker: TesseractWorkerLike | null = null;
let initPromise: Promise<TesseractWorkerLike> | null = null;
let workerGeneration = 0;
let progressSink: ((progress: OcrProgress) => void) | null = null;

function mapProgress(message: { status?: string; progress?: number }): void {
  if (!progressSink) return;
  const status = message.status ?? '';
  const progress = typeof message.progress === 'number' ? Math.min(1, Math.max(0, message.progress)) : undefined;
  const label = /recogniz/iu.test(status) ? 'Rozpoznaję tekst...' : 'Uruchamiam lokalny OCR...';
  progressSink({ stage: 'recognizing', ...(progress === undefined ? {} : { progress }), label });
}

async function loadTesseractModule(): Promise<TesseractModuleLike> {
  const globalWindow = window as Window & { Tesseract?: TesseractModuleLike };
  if (globalWindow.Tesseract) return globalWindow.Tesseract;

  return new Promise<TesseractModuleLike>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = RECEIPT_OCR_ASSETS.script;
    script.async = true;
    script.dataset.receiptOcrRuntime = OCR_VERSION;

    script.onload = () => {
      if (globalWindow.Tesseract) {
        resolve(globalWindow.Tesseract);
        return;
      }
      script.remove();
      reject(new Error('Lokalny moduł OCR uruchomił się nieprawidłowo. Spróbuj ponownie.'));
    };

    script.onerror = () => {
      script.remove();
      reject(new Error('Lokalne pliki OCR nie są dostępne. Zainstaluj pełną wersję aplikacji i spróbuj ponownie.'));
    };

    document.head.appendChild(script);
  });
}

async function getWorker(onProgress?: (progress: OcrProgress) => void): Promise<TesseractWorkerLike> {
  progressSink = onProgress ?? null;
  if (worker) return worker;
  if (!initPromise) {
    const generationAtStart = workerGeneration;
    const pending = (async () => {
      const tesseract = await loadTesseractModule();
      const created = await tesseract.createWorker(OCR_LANGUAGE, 1, {
        workerPath: RECEIPT_OCR_ASSETS.worker,
        corePath: RECEIPT_OCR_ASSETS.core,
        langPath: RECEIPT_OCR_ASSETS.lang,
        workerBlobURL: false,
        cacheMethod: 'none',
        logger: mapProgress,
      });
      if (generationAtStart !== workerGeneration) {
        try { await created.terminate(); } catch { /* already unavailable after cancellation */ }
        throw new DOMException('OCR anulowany.', 'AbortError');
      }
      worker = created;
      return created;
    })();
    initPromise = pending;
    void pending.finally(() => {
      if (initPromise === pending) initPromise = null;
    }).catch(() => undefined);
  }
  return initPromise;
}

function abortError(): DOMException {
  return new DOMException('OCR anulowany.', 'AbortError');
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeGeometryTokenText(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

function geometryTokenKey(token: ReceiptOcrToken): string {
  return [
    token.page,
    normalizeGeometryTokenText(token.text).toLocaleLowerCase('pl-PL'),
    Math.round(token.bbox.x0 / 2),
    Math.round(token.bbox.y0 / 2),
    Math.round(token.bbox.x1 / 2),
    Math.round(token.bbox.y1 / 2),
  ].join('|');
}

function extractReceiptOcrTokens(
  blocks: readonly TesseractBlockLike[] | null | undefined,
  chunk: ReceiptOcrChunk,
  geometryContextSource: ReceiptOcrGeometrySource,
): ReceiptOcrToken[] {
  if (!blocks?.length) return [];
  const tokens: ReceiptOcrToken[] = [];
  const page = chunk.page ?? 1;
  const offsetX = chunk.offsetX ?? 0;
  const offsetY = chunk.startY;
  blocks.forEach((block, blockIndex) => {
    block.paragraphs?.forEach((paragraph, paragraphIndex) => {
      paragraph.lines?.forEach((line, lineIndex) => {
        line.words?.forEach((word, wordIndex) => {
          const text = normalizeGeometryTokenText(word.text ?? '');
          const bbox = word.bbox;
          if (!text || !bbox
            || !isFiniteCoordinate(bbox.x0) || !isFiniteCoordinate(bbox.y0)
            || !isFiniteCoordinate(bbox.x1) || !isFiniteCoordinate(bbox.y1)) return;
          const x0 = bbox.x0 + offsetX;
          const y0 = bbox.y0 + offsetY;
          const x1 = bbox.x1 + offsetX;
          const y1 = bbox.y1 + offsetY;
          if (!(x0 >= 0 && y0 >= 0 && x1 > x0 && y1 > y0)) return;
          tokens.push({
            text,
            ...(typeof word.confidence === 'number' && Number.isFinite(word.confidence) ? { confidence: word.confidence } : {}),
            bbox: { x0, y0, x1, y1 },
            page,
            chunkIndex: chunk.index,
            blockIndex,
            paragraphIndex,
            lineIndex,
            wordIndex,
            source: geometryContextSource,
          });
        });
      });
    });
  });
  return tokens;
}

function mergeReceiptOcrGeometry(
  geometries: readonly ReceiptOcrGeometry[],
  source: ReceiptOcrGeometrySource,
): ReceiptOcrGeometry | undefined {
  if (!geometries.length) return undefined;
  const seen = new Set<string>();
  const tokens: ReceiptOcrToken[] = [];
  for (const geometry of geometries) {
    for (const token of geometry.tokens) {
      const key = geometryTokenKey(token);
      if (seen.has(key)) continue;
      seen.add(key);
      tokens.push(token);
    }
  }
  tokens.sort((left, right) => left.page - right.page
    || left.bbox.y0 - right.bbox.y0
    || left.bbox.x0 - right.bbox.x0
    || left.text.localeCompare(right.text, 'pl'));
  if (!tokens.length) return undefined;
  return {
    source,
    imageWidth: Math.max(...geometries.map((geometry) => geometry.imageWidth)),
    imageHeight: Math.max(...geometries.map((geometry) => geometry.imageHeight)),
    tokens,
  };
}

async function configureReceiptOcrProfile(
  activeWorker: TesseractWorkerLike,
  profile: ReceiptOcrEngineProfile,
): Promise<void> {
  await activeWorker.setParameters({
    // Full-image primary OCR uses automatic page segmentation. All bounded
    // receipt/header recovery crops are compact text blocks and use PSM 6.
    tessedit_pageseg_mode: profile === 'primary' ? '3' : '6',
  });
}

async function recognizeWithWorker(
  activeWorker: TesseractWorkerLike,
  image: Blob,
  onProgress?: (progress: OcrProgress) => void,
  signal?: AbortSignal,
  geometryContext?: { chunk: ReceiptOcrChunk; source: ReceiptOcrGeometrySource },
): Promise<OcrRecognitionResult> {
  if (signal?.aborted) throw abortError();
  progressSink = onProgress ?? null;
  // Tesseract.js v6+ disables granular outputs by default. Requesting `blocks`
  // here does not add a second OCR pass; it exposes word geometry from the same
  // recognition job so DEV4-A can reconstruct visual rows/columns.
  const result = await activeWorker.recognize(image, {}, { text: true, blocks: true });
  if (signal?.aborted) throw abortError();
  const geometry = geometryContext
    ? (() => {
        const tokens = extractReceiptOcrTokens(result.data.blocks, geometryContext.chunk, geometryContext.source);
        if (!tokens.length) return undefined;
        const chunkWidth = geometryContext.chunk.width ?? Math.max(...tokens.map((token) => token.bbox.x1));
        const chunkHeight = geometryContext.chunk.height ?? Math.max(...tokens.map((token) => token.bbox.y1 - geometryContext.chunk.startY));
        return {
          source: geometryContext.source,
          imageWidth: Math.max(1, (geometryContext.chunk.offsetX ?? 0) + chunkWidth),
          imageHeight: Math.max(geometryContext.chunk.endY, geometryContext.chunk.startY + chunkHeight),
          tokens,
        } satisfies ReceiptOcrGeometry;
      })()
    : undefined;
  return {
    text: result.data.text ?? '',
    ...(result.data.confidence === undefined ? {} : { confidence: result.data.confidence }),
    ...(geometry ? { geometry } : {}),
  };
}

export async function recognizeReceiptImage(
  image: Blob,
  onProgress?: (progress: OcrProgress) => void,
  signal?: AbortSignal,
): Promise<OcrRecognitionResult> {
  if (signal?.aborted) throw abortError();
  const activeWorker = await getWorker(onProgress);
  if (signal?.aborted) throw abortError();
  await configureReceiptOcrProfile(activeWorker, 'primary');
  if (signal?.aborted) throw abortError();
  const abort = () => { void disposeReceiptOcrEngine(); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    return await recognizeWithWorker(activeWorker, image, onProgress, signal);
  } finally {
    signal?.removeEventListener('abort', abort);
    progressSink = null;
  }
}

export async function recognizeReceiptImageChunks(
  chunks: readonly ReceiptOcrChunk[],
  onProgress?: (progress: OcrProgress) => void,
  signal?: AbortSignal,
  profile: ReceiptOcrEngineProfile = 'primary',
): Promise<OcrRecognitionResult> {
  if (signal?.aborted) throw abortError();
  if (!chunks.length) return { text: '' };

  const activeWorker = await getWorker(onProgress);
  if (signal?.aborted) throw abortError();
  await configureReceiptOcrProfile(activeWorker, profile);
  if (signal?.aborted) throw abortError();
  const abort = () => { void disposeReceiptOcrEngine(); };
  signal?.addEventListener('abort', abort, { once: true });

  try {
    const texts: string[] = [];
    const confidences: number[] = [];
    const geometries: ReceiptOcrGeometry[] = [];
    const chunkCount = chunks.length;

    for (let index = 0; index < chunks.length; index += 1) {
      if (signal?.aborted) throw abortError();
      const chunk = chunks[index];
      if (!chunk) continue;
      const result = await recognizeWithWorker(
        activeWorker,
        chunk.blob,
        (next) => {
          const localProgress = next.progress ?? 0;
          onProgress?.({
            ...next,
            progress: Math.min(1, (index + localProgress) / chunkCount),
            label: chunkCount > 1 ? `Rozpoznaję fragment ${index + 1} z ${chunkCount}...` : next.label,
          });
        },
        signal,
        { chunk, source: profile },
      );
      texts.push(result.text);
      if (typeof result.confidence === 'number') confidences.push(result.confidence);
      if (result.geometry) geometries.push(result.geometry);
    }

    onProgress?.({ stage: 'recognizing', progress: 1, label: 'Łączę rozpoznany tekst...' });
    const text = mergeReceiptOcrChunkTexts(texts);
    const confidence = confidences.length
      ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
      : undefined;
    const geometry = mergeReceiptOcrGeometry(geometries, profile);
    return {
      text,
      ...(confidence === undefined ? {} : { confidence }),
      ...(geometry ? { geometry } : {}),
    };
  } finally {
    signal?.removeEventListener('abort', abort);
    progressSink = null;
  }
}

export async function disposeReceiptOcrEngine(): Promise<void> {
  workerGeneration += 1;
  const current = worker;
  const pending = initPromise;
  worker = null;
  initPromise = null;
  progressSink = null;
  if (current) {
    try { await current.terminate(); } catch { /* worker may already be terminated after cancel */ }
  }
  if (pending) {
    try { await pending; } catch { /* cancellation intentionally invalidates pending initialization */ }
  }
}
