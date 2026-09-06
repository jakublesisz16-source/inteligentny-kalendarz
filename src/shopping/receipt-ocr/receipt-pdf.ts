import { ReceiptImageError } from './image-preprocess';

export const RECEIPT_PDF_TARGET_WIDTH = 1800;
export const RECEIPT_PDF_MAX_SCALE = 8;
export const RECEIPT_PDF_MAX_RENDER_PIXELS = 8_000_000;
export const MAX_RECEIPT_PDF_PAGES = 6;
export const RECEIPT_PAGE_BREAK = '[[RECEIPT_PAGE_BREAK]]';

export interface ReceiptPdfRenderPlan {
  scale: number;
  width: number;
  height: number;
}

export interface RenderedReceiptPdfPage {
  file: File;
  width: number;
  height: number;
  pageNumber: number;
  pageCount: number;
}

export function planReceiptPdfRender(width: number, height: number): ReceiptPdfRenderPlan {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new ReceiptImageError('PDF ma nieprawidłowy rozmiar strony.');
  }

  let scale = Math.min(RECEIPT_PDF_MAX_SCALE, Math.max(1, RECEIPT_PDF_TARGET_WIDTH / width));
  let renderedWidth = Math.max(1, Math.round(width * scale));
  let renderedHeight = Math.max(1, Math.round(height * scale));
  const pixels = renderedWidth * renderedHeight;

  if (pixels > RECEIPT_PDF_MAX_RENDER_PIXELS) {
    const safeScale = Math.sqrt(RECEIPT_PDF_MAX_RENDER_PIXELS / (width * height)) * 0.999;
    scale = Math.min(scale, safeScale);
    renderedWidth = Math.max(1, Math.round(width * scale));
    renderedHeight = Math.max(1, Math.round(height * scale));
  }

  return { scale, width: renderedWidth, height: renderedHeight };
}

export function validateReceiptPdfPageCount(pageCount: number): void {
  if (!Number.isInteger(pageCount) || pageCount <= 0) {
    throw new ReceiptImageError('PDF nie zawiera stron możliwych do odczytu.');
  }
  if (pageCount > MAX_RECEIPT_PDF_PAGES) {
    throw new ReceiptImageError(`PDF ma zbyt wiele stron. Skaner paragonów obsługuje maksymalnie ${MAX_RECEIPT_PDF_PAGES} stron.`);
  }
}

export function combineReceiptPdfPageTexts(pageTexts: readonly string[]): string {
  return pageTexts
    .map((text) => text.trim())
    .filter(Boolean)
    .join(`\n${RECEIPT_PAGE_BREAK}\n`)
    .trim();
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new ReceiptImageError('Nie udało się wyrenderować PDF do obrazu.')),
      'image/png',
    );
  });
}

function assertPdfSignature(bytes: Uint8Array): void {
  const signature = String.fromCharCode(...bytes.slice(0, 5));
  if (signature !== '%PDF-') {
    throw new ReceiptImageError('Wybrany plik nie jest prawidłowym dokumentem PDF.');
  }
}

function abortError(): DOMException {
  return new DOMException('Odczyt PDF anulowany.', 'AbortError');
}

export async function renderReceiptPdfPages(
  file: File,
  onPage: (page: RenderedReceiptPdfPage) => Promise<void> | void,
  signal?: AbortSignal,
): Promise<number> {
  if (signal?.aborted) throw abortError();

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new ReceiptImageError('Nie udało się odczytać pliku PDF.');
  }
  if (signal?.aborted) throw abortError();

  const bytes = new Uint8Array(buffer);
  assertPdfSignature(bytes);

  const [{ GlobalWorkerOptions, getDocument }, workerModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  GlobalWorkerOptions.workerSrc = workerModule.default;

  const loadingTask = getDocument({
    data: bytes,
    useWorkerFetch: false,
  });
  const abort = () => { void loadingTask.destroy(); };
  signal?.addEventListener('abort', abort, { once: true });

  try {
    const pdf = await loadingTask.promise;
    if (signal?.aborted) throw abortError();
    validateReceiptPdfPageCount(pdf.numPages);

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      if (signal?.aborted) throw abortError();
      const page = await pdf.getPage(pageNumber);
      let canvas: HTMLCanvasElement | null = null;
      let pageCleaned = false;
      try {
        const baseViewport = page.getViewport({ scale: 1 });
        const plan = planReceiptPdfRender(baseViewport.width, baseViewport.height);
        const viewport = page.getViewport({ scale: plan.scale });

        canvas = document.createElement('canvas');
        canvas.width = plan.width;
        canvas.height = plan.height;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new ReceiptImageError('Przeglądarka nie udostępnia wymaganej obsługi PDF.');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        const renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
          background: 'rgb(255,255,255)',
        });
        await renderTask.promise;
        if (signal?.aborted) throw abortError();

        const blob = await canvasToPng(canvas);
        if (signal?.aborted) throw abortError();
        const renderedPage: RenderedReceiptPdfPage = {
          file: new File([blob], `receipt-pdf-page-${pageNumber}.png`, { type: 'image/png' }),
          width: plan.width,
          height: plan.height,
          pageNumber,
          pageCount: pdf.numPages,
        };
        page.cleanup();
        pageCleaned = true;
        canvas.width = 1;
        canvas.height = 1;
        canvas = null;
        await onPage(renderedPage);
      } catch (cause) {
        if (signal?.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) throw abortError();
        if (cause instanceof ReceiptImageError) throw cause;
        throw new ReceiptImageError(`Nie udało się odczytać strony ${pageNumber} z ${pdf.numPages}. Spróbuj ponownie lub użyj innego pliku.`);
      } finally {
        if (!pageCleaned) page.cleanup();
        if (canvas) {
          canvas.width = 1;
          canvas.height = 1;
        }
      }
    }
    return pdf.numPages;
  } catch (cause) {
    if (signal?.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) throw abortError();
    if (cause instanceof ReceiptImageError) throw cause;
    throw new ReceiptImageError('Nie udało się odczytać PDF paragonu. Spróbuj innego pliku.');
  } finally {
    signal?.removeEventListener('abort', abort);
    try { await loadingTask.destroy(); } catch { /* document may already be destroyed after cancellation */ }
  }
}
