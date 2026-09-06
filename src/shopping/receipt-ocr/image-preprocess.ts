import type { ProcessedReceiptImage, ReceiptOcrChunk, ReceiptOcrSourceType } from './receipt-ocr.types';
import type { ReceiptValueColumnRecoveryPlan } from './receipt-value-column-recovery';
import type { ReceiptLocalNumericVerificationCellPlan } from './receipt-local-numeric-verification';
import {
  calculateReceiptOcrScale,
  calculateReceiptPhotoOcrScale,
  planReceiptOcrChunks,
  shouldInvertReceiptLuminance,
} from './ocr-preprocess-plan';
import { chooseReceiptDeskewAngle, planReceiptFiscalRegionCrop, planReceiptFiscalSubregionCrop, planSafeReceiptCrop } from './ocr-photo-quality-plan';
import { analyzeReceiptSourceQuality } from './receipt-source-quality';

export const MAX_RECEIPT_IMAGE_BYTES = 32 * 1024 * 1024;
export const MAX_RECEIPT_IMAGE_PIXELS = 8_000_000;
export const SUPPORTED_RECEIPT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export class ReceiptImageError extends Error {}

export interface SafeReceiptImageDimensions {
  width: number;
  height: number;
  scale: number;
}

function assertValidImageDimensions(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new ReceiptImageError('Zdjęcie ma nieprawidłowe wymiary.');
  }
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)) {
    throw new ReceiptImageError('Zdjęcie ma nieobsługiwane wymiary.');
  }
}

export function calculateSafeReceiptImageDimensions(
  width: number,
  height: number,
  maxPixels = MAX_RECEIPT_IMAGE_PIXELS,
): SafeReceiptImageDimensions {
  assertValidImageDimensions(width, height);
  if (!Number.isFinite(maxPixels) || maxPixels < 1 || !Number.isSafeInteger(maxPixels)) {
    throw new ReceiptImageError('Nie udało się wyznaczyć bezpiecznego rozmiaru obrazu.');
  }

  const pixels = width * height;
  if (!Number.isFinite(pixels) || pixels <= 0) {
    throw new ReceiptImageError('Nie udało się wyznaczyć bezpiecznego rozmiaru obrazu.');
  }
  if (pixels <= maxPixels) return { width, height, scale: 1 };

  const scale = Math.sqrt(maxPixels / pixels);
  if (!Number.isFinite(scale) || scale <= 0 || scale >= 1) {
    throw new ReceiptImageError('Nie udało się wyznaczyć bezpiecznego rozmiaru obrazu.');
  }

  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  if (scaledWidth < 1 || scaledHeight < 1) {
    throw new ReceiptImageError('Zdjęcie ma zbyt skrajne proporcje do bezpiecznego przetworzenia.');
  }

  let targetWidth = Math.max(1, Math.floor(scaledWidth));
  let targetHeight = Math.max(1, Math.floor(scaledHeight));
  if (targetWidth * targetHeight > maxPixels) {
    if (targetWidth >= targetHeight) targetWidth = Math.max(1, Math.floor(maxPixels / targetHeight));
    else targetHeight = Math.max(1, Math.floor(maxPixels / targetWidth));
  }
  if (targetWidth * targetHeight > maxPixels) {
    throw new ReceiptImageError('Nie udało się wyznaczyć bezpiecznego rozmiaru obrazu.');
  }

  return { width: targetWidth, height: targetHeight, scale: Math.min(targetWidth / width, targetHeight / height) };
}

interface EncodedReceiptImageDimensions {
  width: number;
  height: number;
}

function readPngDimensions(bytes: Uint8Array): EncodedReceiptImageDimensions | null {
  if (bytes.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((value, index) => bytes[index] === value)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpegDimensions(bytes: Uint8Array): EncodedReceiptImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) break;
    const length = ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
    if (length < 2 || offset + length > bytes.length) break;
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isStartOfFrame && length >= 7) {
      const height = ((bytes[offset + 3] ?? 0) << 8) | (bytes[offset + 4] ?? 0);
      const width = ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0);
      return { width, height };
    }
    offset += length;
  }
  return null;
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16);
}

function readWebpDimensions(bytes: Uint8Array): EncodedReceiptImageDimensions | null {
  if (bytes.length < 25) return null;
  const ascii = (offset: number, length: number) => String.fromCharCode(...bytes.slice(offset, offset + length));
  if (ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WEBP') return null;
  const chunk = ascii(12, 4);
  if (chunk === 'VP8X') {
    if (bytes.length < 30) return null;
    return { width: 1 + readUint24LE(bytes, 24), height: 1 + readUint24LE(bytes, 27) };
  }
  if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    const b1 = bytes[21] ?? 0;
    const b2 = bytes[22] ?? 0;
    const b3 = bytes[23] ?? 0;
    const b4 = bytes[24] ?? 0;
    return {
      width: 1 + b1 + ((b2 & 0x3f) << 8),
      height: 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10),
    };
  }
  if (chunk === 'VP8 ') {
    if (bytes.length < 30 || bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return {
      width: ((bytes[26] ?? 0) | ((bytes[27] ?? 0) << 8)) & 0x3fff,
      height: ((bytes[28] ?? 0) | ((bytes[29] ?? 0) << 8)) & 0x3fff,
    };
  }
  return null;
}

async function readEncodedReceiptImageDimensions(file: File): Promise<EncodedReceiptImageDimensions> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    throw new ReceiptImageError('Nie udało się odczytać zdjęcia.');
  }
  const dimensions = file.type === 'image/png'
    ? readPngDimensions(bytes)
    : file.type === 'image/jpeg'
      ? readJpegDimensions(bytes)
      : file.type === 'image/webp'
        ? readWebpDimensions(bytes)
        : null;
  if (!dimensions) throw new ReceiptImageError('Nie udało się odczytać wymiarów zdjęcia. Spróbuj innego pliku JPEG, PNG lub WEBP.');
  assertValidImageDimensions(dimensions.width, dimensions.height);
  return dimensions;
}

export function validateReceiptImageFile(file: File): void {
  if (!file) throw new ReceiptImageError('Nie wybrano zdjęcia paragonu.');
  if (!SUPPORTED_RECEIPT_IMAGE_TYPES.includes(file.type as typeof SUPPORTED_RECEIPT_IMAGE_TYPES[number])) {
    throw new ReceiptImageError('Nieobsługiwany format zdjęcia. Użyj JPEG, PNG lub WEBP.');
  }
  if (file.size > MAX_RECEIPT_IMAGE_BYTES) {
    throw new ReceiptImageError('Zdjęcie jest zbyt duże. Maksymalny rozmiar pliku to 32 MB.');
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new ReceiptImageError('Nie udało się przygotować obrazu do OCR. Spróbuj użyć innego zdjęcia lub obrócić obraz.')),
      'image/png',
    );
  });
}

function getContext(canvas: HTMLCanvasElement, willReadFrequently: boolean): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently });
  if (!context) throw new ReceiptImageError('Przeglądarka nie udostępnia wymaganej obsługi obrazu.');
  return context;
}

function drawOrientedBitmap(
  bitmap: ImageBitmap,
  canvas: HTMLCanvasElement,
  rotation: 0 | 90 | 180 | 270,
): void {
  const context = getContext(canvas, false);
  const rotated = rotation === 90 || rotation === 270;
  const drawWidth = rotated ? canvas.height : canvas.width;
  const drawHeight = rotated ? canvas.width : canvas.height;
  context.save();
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(rotation * Math.PI / 180);
  context.drawImage(bitmap, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  context.restore();
}

function luminance(red: number, green: number, blue: number): number {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

interface LuminanceGrid {
  width: number;
  height: number;
  values: number[];
}

function sampleReceiptLuminanceGrid(source: HTMLCanvasElement, maxEdge = 192): LuminanceGrid {
  const ratio = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * ratio));
  const height = Math.max(1, Math.round(source.height * ratio));
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = width;
  sampleCanvas.height = height;
  const context = getContext(sampleCanvas, true);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const values: number[] = [];
  for (let index = 0; index < pixels.length; index += 4) {
    values.push(luminance(pixels[index] ?? 255, pixels[index + 1] ?? 255, pixels[index + 2] ?? 255));
  }
  sampleCanvas.width = 1;
  sampleCanvas.height = 1;
  return { width, height, values };
}

function cropReceiptCanvas(source: HTMLCanvasElement): { canvas: HTMLCanvasElement; applied: boolean; confidence: number } {
  const sample = sampleReceiptLuminanceGrid(source);
  const plan = planSafeReceiptCrop(sample.width, sample.height, sample.values);
  if (!plan.applied) return { canvas: source, applied: false, confidence: plan.confidence };

  const sourceX = Math.max(0, Math.floor(source.width * plan.leftRatio));
  const sourceY = Math.max(0, Math.floor(source.height * plan.topRatio));
  const sourceRight = Math.min(source.width, Math.ceil(source.width * plan.rightRatio));
  const sourceBottom = Math.min(source.height, Math.ceil(source.height * plan.bottomRatio));
  const width = Math.max(1, sourceRight - sourceX);
  const height = Math.max(1, sourceBottom - sourceY);
  if (width < source.width * 0.55 || height < source.height * 0.55) {
    return { canvas: source, applied: false, confidence: plan.confidence };
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = getContext(canvas, false);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(source, sourceX, sourceY, width, height, 0, 0, width, height);
  return { canvas, applied: true, confidence: plan.confidence };
}

interface FiscalRecoveryChunkPlanResult {
  chunk?: ReceiptOcrChunk;
  thresholdChunk?: ReceiptOcrChunk;
  confidence: number;
  subregionApplied?: boolean;
  marketingTailDetected?: boolean;
  leftRatio?: number;
  topRatio?: number;
  rightRatio?: number;
  bottomRatio?: number;
}

function sampleSubgrid(
  sample: LuminanceGrid,
  leftRatio: number,
  topRatio: number,
  rightRatio: number,
  bottomRatio: number,
): LuminanceGrid | undefined {
  const left = Math.max(0, Math.min(sample.width - 1, Math.floor(sample.width * leftRatio)));
  const top = Math.max(0, Math.min(sample.height - 1, Math.floor(sample.height * topRatio)));
  const right = Math.max(left + 1, Math.min(sample.width, Math.ceil(sample.width * rightRatio)));
  const bottom = Math.max(top + 1, Math.min(sample.height, Math.ceil(sample.height * bottomRatio)));
  const width = right - left;
  const height = bottom - top;
  if (width < 1 || height < 1) return undefined;
  const values = new Array<number>(width * height);
  let target = 0;
  for (let y = top; y < bottom; y += 1) {
    const offset = y * sample.width;
    for (let x = left; x < right; x += 1) {
      values[target] = sample.values[offset + x] ?? 255;
      target += 1;
    }
  }
  return { width, height, values };
}

async function createFiscalRecoveryChunk(source: HTMLCanvasElement): Promise<FiscalRecoveryChunkPlanResult> {
  const sample = sampleReceiptLuminanceGrid(source);
  const paperPlan = planReceiptFiscalRegionCrop(sample.width, sample.height, sample.values);
  if (!paperPlan.applied) return { confidence: paperPlan.confidence };

  const paperSample = sampleSubgrid(
    sample,
    paperPlan.leftRatio,
    paperPlan.topRatio,
    paperPlan.rightRatio,
    paperPlan.bottomRatio,
  );
  const subregionPlan = paperSample
    ? planReceiptFiscalSubregionCrop(paperSample.width, paperSample.height, paperSample.values)
    : undefined;

  const localLeft = subregionPlan?.applied ? subregionPlan.leftRatio : 0;
  const localTop = subregionPlan?.applied ? subregionPlan.topRatio : 0;
  const localRight = subregionPlan?.applied ? subregionPlan.rightRatio : 1;
  const localBottom = subregionPlan?.applied ? subregionPlan.bottomRatio : 1;
  const paperWidthRatio = paperPlan.rightRatio - paperPlan.leftRatio;
  const paperHeightRatio = paperPlan.bottomRatio - paperPlan.topRatio;
  const leftRatio = paperPlan.leftRatio + paperWidthRatio * localLeft;
  const topRatio = paperPlan.topRatio + paperHeightRatio * localTop;
  const rightRatio = paperPlan.leftRatio + paperWidthRatio * localRight;
  const bottomRatio = paperPlan.topRatio + paperHeightRatio * localBottom;
  const confidence = subregionPlan?.applied
    ? Math.max(paperPlan.confidence, subregionPlan.confidence)
    : paperPlan.confidence;

  const sourceX = Math.max(0, Math.floor(source.width * leftRatio));
  const sourceY = Math.max(0, Math.floor(source.height * topRatio));
  const sourceRight = Math.min(source.width, Math.ceil(source.width * rightRatio));
  const sourceBottom = Math.min(source.height, Math.ceil(source.height * bottomRatio));
  const cropWidth = Math.max(1, sourceRight - sourceX);
  const cropHeight = Math.max(1, sourceBottom - sourceY);
  if (cropWidth * cropHeight > MAX_RECEIPT_IMAGE_PIXELS) return { confidence };

  const baselineScale = calculateReceiptPhotoOcrScale(cropWidth);
  const maxHeightScale = 2800 / cropHeight;
  const maxPixelScale = Math.sqrt(4_000_000 / Math.max(1, cropWidth * cropHeight));
  const scale = Math.min(baselineScale, maxHeightScale, maxPixelScale);
  if (!Number.isFinite(scale) || scale <= 0) return { confidence };
  const targetWidth = Math.max(1, Math.round(cropWidth * scale));
  const targetHeight = Math.max(1, Math.round(cropHeight * scale));
  if (targetWidth * targetHeight > 4_000_000) return { confidence };

  const canvas = document.createElement('canvas');
  try {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = getContext(canvas, false);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, sourceX, sourceY, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);
    const recoverySamples = sampleReceiptLuminanceGrid(canvas);
    const inverted = shouldInvertReceiptLuminance(recoverySamples.values);
    enhanceReceiptChunk(canvas, inverted, 'photo');
    const blob = await canvasToBlob(canvas);
    applyReceiptOtsuThreshold(canvas);
    const thresholdBlob = await canvasToBlob(canvas);
    return {
      chunk: {
        blob,
        index: 0,
        startY: 0,
        endY: targetHeight,
        width: targetWidth,
        height: targetHeight,
        offsetX: 0,
        overlapTop: 0,
        overlapBottom: 0,
      },
      thresholdChunk: {
        blob: thresholdBlob,
        index: 0,
        startY: 0,
        endY: targetHeight,
        width: targetWidth,
        height: targetHeight,
        offsetX: 0,
        overlapTop: 0,
        overlapBottom: 0,
      },
      confidence,
      subregionApplied: Boolean(subregionPlan?.applied),
      marketingTailDetected: Boolean(subregionPlan?.marketingTailDetected),
      leftRatio,
      topRatio,
      rightRatio,
      bottomRatio,
    };
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}

function rowProjectionScore(canvas: HTMLCanvasElement, inverted: boolean): number {
  const context = getContext(canvas, true);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const rows = new Float64Array(canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    let dark = 0;
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      let value = luminance(pixels[offset] ?? 255, pixels[offset + 1] ?? 255, pixels[offset + 2] ?? 255);
      if (inverted) value = 255 - value;
      if (value < 165) dark += 1;
    }
    rows[y] = dark;
  }
  const mean = rows.reduce((sum, value) => sum + value, 0) / Math.max(1, rows.length);
  return rows.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, rows.length);
}

function estimateReceiptDeskew(source: HTMLCanvasElement, inverted: boolean): number {
  const ratio = Math.min(1, 320 / Math.max(source.width, source.height));
  const width = Math.max(40, Math.round(source.width * ratio));
  const height = Math.max(40, Math.round(source.height * ratio));
  const base = document.createElement('canvas');
  base.width = width;
  base.height = height;
  const baseContext = getContext(base, false);
  baseContext.imageSmoothingEnabled = true;
  baseContext.imageSmoothingQuality = 'high';
  baseContext.drawImage(source, 0, 0, width, height);

  const candidates = [-3, -2, -1, 0, 1, 2, 3].map((angle) => {
    const candidate = document.createElement('canvas');
    candidate.width = width;
    candidate.height = height;
    const context = getContext(candidate, true);
    context.fillStyle = inverted ? '#000000' : '#ffffff';
    context.fillRect(0, 0, width, height);
    context.save();
    context.translate(width / 2, height / 2);
    context.rotate(angle * Math.PI / 180);
    context.drawImage(base, -width / 2, -height / 2);
    context.restore();
    const score = rowProjectionScore(candidate, inverted);
    candidate.width = 1;
    candidate.height = 1;
    return { angle, score };
  });
  base.width = 1;
  base.height = 1;
  return chooseReceiptDeskewAngle(candidates);
}

function rotateReceiptCanvas(source: HTMLCanvasElement, degrees: number, inverted: boolean): HTMLCanvasElement {
  if (Math.abs(degrees) < 0.01) return source;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = getContext(canvas, false);
  context.fillStyle = inverted ? '#000000' : '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(degrees * Math.PI / 180);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  context.restore();
  return canvas;
}

function percentileFromHistogram(histogram: Uint32Array, total: number, ratio: number): number {
  const target = Math.max(1, Math.floor(total * ratio));
  let seen = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    seen += histogram[value] ?? 0;
    if (seen >= target) return value;
  }
  return 255;
}

function applyMildSharpen(grayscale: Uint8Array, width: number, height: number): Uint8Array {
  if (width < 3 || height < 3) return grayscale;
  const output = new Uint8Array(grayscale);
  const strength = 0.08;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const center = grayscale[index] ?? 255;
      const laplacian = 4 * center
        - (grayscale[index - 1] ?? center)
        - (grayscale[index + 1] ?? center)
        - (grayscale[index - width] ?? center)
        - (grayscale[index + width] ?? center);
      output[index] = Math.min(255, Math.max(0, Math.round(center + strength * laplacian)));
    }
  }
  return output;
}

function enhanceReceiptChunk(canvas: HTMLCanvasElement, inverted: boolean, sourceType: ReceiptOcrSourceType): void {
  const context = getContext(canvas, true);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const histogram = new Uint32Array(256);
  let grayscale: Uint8Array<ArrayBufferLike> = new Uint8Array(canvas.width * canvas.height);

  for (let pixel = 0, offset = 0; offset < image.data.length; pixel += 1, offset += 4) {
    let value = Math.round(luminance(image.data[offset] ?? 255, image.data[offset + 1] ?? 255, image.data[offset + 2] ?? 255));
    if (inverted) value = 255 - value;
    grayscale[pixel] = value;
    histogram[value] = (histogram[value] ?? 0) + 1;
  }

  const total = grayscale.length;
  const lowRatio = sourceType === 'pdf' ? 0.01 : 0.02;
  const highRatio = sourceType === 'pdf' ? 0.99 : 0.98;
  let low = percentileFromHistogram(histogram, total, lowRatio);
  let high = percentileFromHistogram(histogram, total, highRatio);
  if (high - low < 48) {
    low = 0;
    high = 255;
  }
  const range = Math.max(1, high - low);
  for (let pixel = 0; pixel < grayscale.length; pixel += 1) {
    grayscale[pixel] = Math.min(255, Math.max(0, Math.round(((grayscale[pixel] ?? 255) - low) * 255 / range)));
  }
  if (sourceType === 'photo') grayscale = applyMildSharpen(grayscale, canvas.width, canvas.height);

  for (let pixel = 0, offset = 0; pixel < grayscale.length; pixel += 1, offset += 4) {
    const value = grayscale[pixel] ?? 255;
    image.data[offset] = value;
    image.data[offset + 1] = value;
    image.data[offset + 2] = value;
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

function applyReceiptOtsuThreshold(canvas: HTMLCanvasElement): void {
  const context = getContext(canvas, true);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const histogram = new Uint32Array(256);
  const total = canvas.width * canvas.height;
  if (total <= 0) return;

  for (let offset = 0; offset < image.data.length; offset += 4) {
    const value = Math.round(luminance(
      image.data[offset] ?? 255,
      image.data[offset + 1] ?? 255,
      image.data[offset + 2] ?? 255,
    ));
    histogram[value] = (histogram[value] ?? 0) + 1;
  }

  let weightedTotal = 0;
  for (let value = 0; value < 256; value += 1) weightedTotal += value * (histogram[value] ?? 0);
  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestVariance = -1;
  let threshold = 168;

  for (let value = 0; value < 256; value += 1) {
    const count = histogram[value] ?? 0;
    backgroundWeight += count;
    if (backgroundWeight === 0) continue;
    const foregroundWeight = total - backgroundWeight;
    if (foregroundWeight === 0) break;
    backgroundSum += value * count;
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (weightedTotal - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = value;
    }
  }

  threshold = Math.max(96, Math.min(220, threshold));
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const gray = Math.round(luminance(
      image.data[offset] ?? 255,
      image.data[offset + 1] ?? 255,
      image.data[offset + 2] ?? 255,
    ));
    const value = gray <= threshold ? 0 : 255;
    image.data[offset] = value;
    image.data[offset + 1] = value;
    image.data[offset + 2] = value;
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}


export async function preprocessReceiptImage(
  file: File,
  rotation: 0 | 90 | 180 | 270,
  sourceType: ReceiptOcrSourceType = 'photo',
): Promise<ProcessedReceiptImage> {
  validateReceiptImageFile(file);
  const encodedDimensions = await readEncodedReceiptImageDimensions(file);
  const safeDimensions = calculateSafeReceiptImageDimensions(encodedDimensions.width, encodedDimensions.height);
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = safeDimensions.scale < 1
      ? await createImageBitmap(file, {
          imageOrientation: 'from-image',
          resizeWidth: safeDimensions.width,
          resizeHeight: safeDimensions.height,
          resizeQuality: 'high',
        })
      : await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ReceiptImageError('Nie udało się odczytać zdjęcia. Spróbuj pliku JPEG, PNG lub WEBP.');
  }

  let orientedCanvas: HTMLCanvasElement | null = null;
  let croppedCanvas: HTMLCanvasElement | null = null;
  let deskewedCanvas: HTMLCanvasElement | null = null;
  try {
    const sourceWidth = encodedDimensions.width;
    const sourceHeight = encodedDimensions.height;
    const sourceQuality = analyzeReceiptSourceQuality(sourceType, sourceWidth, sourceHeight);
    const bitmapWidth = bitmap.width;
    const bitmapHeight = bitmap.height;
    const rotated = rotation === 90 || rotation === 270;
    const orientedWidth = rotated ? bitmapHeight : bitmapWidth;
    const orientedHeight = rotated ? bitmapWidth : bitmapHeight;

    orientedCanvas = document.createElement('canvas');
    orientedCanvas.width = orientedWidth;
    orientedCanvas.height = orientedHeight;
    drawOrientedBitmap(bitmap, orientedCanvas, rotation);
    bitmap.close();
    bitmap = null;

    const fiscalRecovery = sourceType === 'photo'
      ? await createFiscalRecoveryChunk(orientedCanvas)
      : { confidence: 0 };

    const crop = sourceType === 'photo'
      ? cropReceiptCanvas(orientedCanvas)
      : { canvas: orientedCanvas, applied: false, confidence: 1 };
    if (crop.canvas !== orientedCanvas) {
      croppedCanvas = crop.canvas;
      orientedCanvas.width = 1;
      orientedCanvas.height = 1;
      orientedCanvas = null;
    }
    const cropCanvas = crop.canvas;
    const preDeskewSamples = sampleReceiptLuminanceGrid(cropCanvas);
    const inverted = shouldInvertReceiptLuminance(preDeskewSamples.values);
    const deskewDegrees = sourceType === 'photo' ? estimateReceiptDeskew(cropCanvas, inverted) : 0;
    const rotatedSmall = rotateReceiptCanvas(cropCanvas, deskewDegrees, inverted);
    if (rotatedSmall !== cropCanvas) {
      deskewedCanvas = rotatedSmall;
      if (croppedCanvas) {
        croppedCanvas.width = 1;
        croppedCanvas.height = 1;
        croppedCanvas = null;
      } else if (orientedCanvas) {
        orientedCanvas.width = 1;
        orientedCanvas.height = 1;
        orientedCanvas = null;
      }
    }
    const workingCanvas = rotatedSmall;

    const scale = sourceType === 'photo'
      ? calculateReceiptPhotoOcrScale(workingCanvas.width)
      : calculateReceiptOcrScale(workingCanvas.width);
    const processedWidth = Math.max(1, Math.round(workingCanvas.width * scale));
    const processedHeight = Math.max(1, Math.round(workingCanvas.height * scale));
    const plans = sourceType === 'pdf'
      ? planReceiptOcrChunks(processedHeight, 2600, 360)
      : planReceiptOcrChunks(processedHeight);
    const chunks: ReceiptOcrChunk[] = [];

    for (const plan of plans) {
      const sourceStartY = plan.startY / scale;
      const sourceEndY = plan.endY / scale;
      const sourceChunkHeight = Math.max(1 / scale, sourceEndY - sourceStartY);
      const chunkCanvas = document.createElement('canvas');
      try {
        chunkCanvas.width = processedWidth;
        chunkCanvas.height = plan.height;
        const context = getContext(chunkCanvas, false);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, chunkCanvas.width, chunkCanvas.height);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(
          workingCanvas,
          0,
          sourceStartY,
          workingCanvas.width,
          sourceChunkHeight,
          0,
          0,
          processedWidth,
          plan.height,
        );
        enhanceReceiptChunk(chunkCanvas, inverted, sourceType);
        const blob = await canvasToBlob(chunkCanvas);
        const previous = plans[plan.index - 1];
        const next = plans[plan.index + 1];
        chunks.push({
          blob,
          index: plan.index,
          startY: plan.startY,
          endY: plan.endY,
          width: processedWidth,
          height: plan.height,
          offsetX: 0,
          overlapTop: previous ? Math.max(0, previous.endY - plan.startY) : 0,
          overlapBottom: next ? Math.max(0, plan.endY - next.startY) : 0,
        });
      } finally {
        chunkCanvas.width = 1;
        chunkCanvas.height = 1;
      }
    }

    return {
      chunks,
      ...(fiscalRecovery.chunk ? { fiscalRecoveryChunk: fiscalRecovery.chunk } : {}),
      ...(fiscalRecovery.thresholdChunk ? { fiscalThresholdRecoveryChunk: fiscalRecovery.thresholdChunk } : {}),
      width: processedWidth,
      height: processedHeight,
      rotation,
      diagnostics: {
        sourceType,
        sourceQuality,
        pageCount: 1,
        pagesProcessed: 1,
        sourceWidth,
        sourceHeight,
        processedWidth,
        processedHeight,
        scale,
        inverted,
        chunkCount: chunks.length,
        cropApplied: crop.applied,
        cropConfidence: crop.confidence,
        ...(sourceType === 'photo' ? {
          fiscalRecoveryCropAvailable: Boolean(fiscalRecovery.chunk),
          fiscalRecoveryCropConfidence: fiscalRecovery.confidence,
          fiscalRecoverySubregionApplied: Boolean(fiscalRecovery.subregionApplied),
          marketingTailDetected: Boolean(fiscalRecovery.marketingTailDetected),
          ...(fiscalRecovery.leftRatio === undefined ? {} : { fiscalRecoveryCropLeftRatio: fiscalRecovery.leftRatio }),
          ...(fiscalRecovery.topRatio === undefined ? {} : { fiscalRecoveryCropTopRatio: fiscalRecovery.topRatio }),
          ...(fiscalRecovery.rightRatio === undefined ? {} : { fiscalRecoveryCropRightRatio: fiscalRecovery.rightRatio }),
          ...(fiscalRecovery.bottomRatio === undefined ? {} : { fiscalRecoveryCropBottomRatio: fiscalRecovery.bottomRatio }),
        } : {}),
        deskewDegrees,
      },
    };
  } catch (cause) {
    if (cause instanceof ReceiptImageError) throw cause;
    throw new ReceiptImageError('Nie udało się przygotować obrazu do OCR. Spróbuj użyć innego zdjęcia lub obrócić obraz.');
  } finally {
    if (deskewedCanvas) {
      deskewedCanvas.width = 1;
      deskewedCanvas.height = 1;
    }
    if (croppedCanvas) {
      croppedCanvas.width = 1;
      croppedCanvas.height = 1;
    }
    if (orientedCanvas) {
      orientedCanvas.width = 1;
      orientedCanvas.height = 1;
    }
    bitmap?.close();
  }
}
export async function createReceiptHeaderOcrChunk(
  processed: ProcessedReceiptImage,
  ratio = 0.35,
  preferFiscalRegion = false,
): Promise<ReceiptOcrChunk | undefined> {
  const first = preferFiscalRegion ? processed.fiscalRecoveryChunk ?? processed.chunks[0] : processed.chunks[0];
  if (!first || !Number.isFinite(ratio) || ratio <= 0 || ratio > 0.5) return undefined;
  let bitmap: ImageBitmap | null = null;
  const canvas = document.createElement('canvas');
  const analysisCanvas = document.createElement('canvas');
  try {
    bitmap = await createImageBitmap(first.blob);

    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = bitmap.width;
    let sourceHeight = bitmap.height;
    if (preferFiscalRegion) {
      const analysisScale = Math.min(1, 192 / Math.max(bitmap.width, bitmap.height));
      analysisCanvas.width = Math.max(1, Math.round(bitmap.width * analysisScale));
      analysisCanvas.height = Math.max(1, Math.round(bitmap.height * analysisScale));
      const analysisContext = getContext(analysisCanvas, true);
      analysisContext.imageSmoothingEnabled = true;
      analysisContext.imageSmoothingQuality = 'high';
      analysisContext.drawImage(bitmap, 0, 0, analysisCanvas.width, analysisCanvas.height);
      const sample = sampleReceiptLuminanceGrid(analysisCanvas);
      const refined = planReceiptFiscalRegionCrop(sample.width, sample.height, sample.values);
      if (refined.applied) {
        sourceX = Math.max(0, Math.floor(bitmap.width * refined.leftRatio));
        sourceY = Math.max(0, Math.floor(bitmap.height * refined.topRatio));
        const sourceRight = Math.min(bitmap.width, Math.ceil(bitmap.width * refined.rightRatio));
        const sourceBottom = Math.min(bitmap.height, Math.ceil(bitmap.height * refined.bottomRatio));
        sourceWidth = Math.max(1, sourceRight - sourceX);
        sourceHeight = Math.max(1, sourceBottom - sourceY);
      }
    }

    const targetFromDocument = Math.max(1, Math.round(sourceHeight * ratio));
    const cropHeight = Math.min(sourceHeight, Math.max(1, Math.min(900, targetFromDocument)));
    canvas.width = sourceWidth;
    canvas.height = cropHeight;
    const context = getContext(canvas, false);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, sourceX, sourceY, sourceWidth, cropHeight, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas);
    return {
      blob,
      index: 0,
      startY: 0,
      endY: cropHeight,
      width: sourceWidth,
      height: cropHeight,
      offsetX: 0,
      ...(first.page === undefined ? {} : { page: first.page }),
      overlapTop: 0,
      overlapBottom: 0,
    };
  } catch {
    return undefined;
  } finally {
    bitmap?.close();
    analysisCanvas.width = 1;
    analysisCanvas.height = 1;
    canvas.width = 1;
    canvas.height = 1;
  }
}



export async function createReceiptValueColumnRecoveryChunk(
  processed: ProcessedReceiptImage,
  plan: ReceiptValueColumnRecoveryPlan,
): Promise<ReceiptOcrChunk | undefined> {
  const crop = plan.crop;
  if (!plan.eligible || !crop) return undefined;
  const source = processed.chunks.find((chunk) => {
    const page = chunk.page ?? 1;
    return page === plan.page
      && chunk.startY <= crop.y0
      && chunk.endY >= crop.y1
      && (chunk.offsetX ?? 0) <= crop.x0
      && (chunk.offsetX ?? 0) + (chunk.width ?? processed.width) >= crop.x1;
  });
  if (!source) return undefined;

  let bitmap: ImageBitmap | null = null;
  const canvas = document.createElement('canvas');
  try {
    bitmap = await createImageBitmap(source.blob);
    const sourceOffsetX = source.offsetX ?? 0;
    const sourceX = crop.x0 - sourceOffsetX;
    const sourceY = crop.y0 - source.startY;
    const width = crop.x1 - crop.x0;
    const height = crop.y1 - crop.y0;
    if (width <= 0 || height <= 0
      || sourceX < 0 || sourceY < 0
      || sourceX + width > bitmap.width + 1
      || sourceY + height > bitmap.height + 1) return undefined;

    canvas.width = width;
    canvas.height = height;
    const context = getContext(canvas, false);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, sourceX, sourceY, width, height, 0, 0, width, height);
    const blob = await canvasToBlob(canvas);
    return {
      blob,
      index: 0,
      startY: crop.y0,
      endY: crop.y1,
      width,
      height,
      offsetX: crop.x0,
      page: plan.page,
      overlapTop: 0,
      overlapBottom: 0,
    };
  } catch {
    return undefined;
  } finally {
    bitmap?.close();
    canvas.width = 1;
    canvas.height = 1;
  }
}


export async function createReceiptLocalNumericVerificationChunk(
  processed: ProcessedReceiptImage,
  cell: ReceiptLocalNumericVerificationCellPlan,
): Promise<ReceiptOcrChunk | undefined> {
  const crop = cell.crop;
  const source = processed.chunks.find((chunk) => {
    const page = chunk.page ?? 1;
    return page === cell.page
      && chunk.startY <= crop.y0
      && chunk.endY >= crop.y1
      && (chunk.offsetX ?? 0) <= crop.x0
      && (chunk.offsetX ?? 0) + (chunk.width ?? processed.width) >= crop.x1;
  });
  if (!source) return undefined;

  let bitmap: ImageBitmap | null = null;
  const canvas = document.createElement('canvas');
  try {
    bitmap = await createImageBitmap(source.blob);
    const sourceOffsetX = source.offsetX ?? 0;
    const sourceX = crop.x0 - sourceOffsetX;
    const sourceY = crop.y0 - source.startY;
    const width = crop.x1 - crop.x0;
    const height = crop.y1 - crop.y0;
    if (width <= 0 || height <= 0
      || sourceX < 0 || sourceY < 0
      || sourceX + width > bitmap.width + 1
      || sourceY + height > bitmap.height + 1) return undefined;

    canvas.width = width;
    canvas.height = height;
    const context = getContext(canvas, true);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, sourceX, sourceY, width, height, 0, 0, width, height);

    // Cell crops are already grayscale from the receipt preprocessing pipeline.
    // Apply a bounded local contrast stretch only; do not infer or synthesize digits.
    const pixels = context.getImageData(0, 0, width, height);
    let min = 255;
    let max = 0;
    for (let index = 0; index < pixels.data.length; index += 4) {
      const value = pixels.data[index] ?? 255;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    if (max - min >= 24) {
      const range = max - min;
      for (let index = 0; index < pixels.data.length; index += 4) {
        const value = pixels.data[index] ?? 255;
        const stretched = Math.max(0, Math.min(255, Math.round(((value - min) * 255) / range)));
        pixels.data[index] = stretched;
        pixels.data[index + 1] = stretched;
        pixels.data[index + 2] = stretched;
        pixels.data[index + 3] = 255;
      }
      context.putImageData(pixels, 0, 0);
    }

    const blob = await canvasToBlob(canvas);
    return {
      blob,
      index: 0,
      startY: crop.y0,
      endY: crop.y1,
      width,
      height,
      offsetX: crop.x0,
      page: cell.page,
      overlapTop: 0,
      overlapBottom: 0,
    };
  } catch {
    return undefined;
  } finally {
    bitmap?.close();
    canvas.width = 1;
    canvas.height = 1;
  }
}
