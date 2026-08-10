import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface PdfTextItemSnapshot {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfPageSnapshot {
  pageNumber: number;
  width: number;
  height: number;
  items: PdfTextItemSnapshot[];
}

export interface PdfDocumentSnapshot {
  pageCount: number;
  pages: PdfPageSnapshot[];
  fullText: string;
}

export async function readPdfSnapshot(buffer: ArrayBuffer): Promise<PdfDocumentSnapshot> {
  const loadingTask = getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false });
  const pdf = await loadingTask.promise;
  const pages: PdfPageSnapshot[] = [];
  const allText: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: PdfTextItemSnapshot[] = [];
      for (const raw of content.items) {
        if (!('str' in raw) || !('transform' in raw)) continue;
        const text = raw.str.trim();
        if (!text) continue;
        const x = raw.transform[4];
        const baselineY = raw.transform[5];
        const height = Math.abs(raw.height || raw.transform[3] || 0);
        items.push({
          text,
          x,
          y: viewport.height - baselineY,
          width: Math.abs(raw.width || 0),
          height,
        });
        allText.push(text);
      }
      pages.push({ pageNumber, width: viewport.width, height: viewport.height, items });
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
  return { pageCount: pages.length, pages, fullText: allText.join(' ') };
}
