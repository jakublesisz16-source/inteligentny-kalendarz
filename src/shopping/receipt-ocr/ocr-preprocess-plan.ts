export const RECEIPT_OCR_TARGET_WIDTH = 1400;
export const RECEIPT_OCR_MIN_UPSCALE_WIDTH = 700;
export const RECEIPT_OCR_MAX_SCALE = 4;
export const RECEIPT_OCR_CHUNK_HEIGHT = 2200;
export const RECEIPT_OCR_CHUNK_OVERLAP = 320;
export const RECEIPT_OCR_EXTREME_NARROW_WIDTH = 320;
export const RECEIPT_OCR_EXTREME_TARGET_WIDTH = 1200;
export const RECEIPT_OCR_EXTREME_MAX_SCALE = 6;

export interface ReceiptOcrChunkPlan {
  index: number;
  startY: number;
  endY: number;
  height: number;
}

export function calculateReceiptOcrScale(sourceWidth: number): number {
  if (!Number.isFinite(sourceWidth) || sourceWidth <= 0) return 1;
  if (sourceWidth >= RECEIPT_OCR_MIN_UPSCALE_WIDTH) return 1;
  return Math.min(RECEIPT_OCR_MAX_SCALE, RECEIPT_OCR_TARGET_WIDTH / sourceWidth);
}

export function calculateReceiptPhotoOcrScale(sourceWidth: number): number {
  const baseline = calculateReceiptOcrScale(sourceWidth);
  if (!Number.isFinite(sourceWidth) || sourceWidth <= 0 || sourceWidth >= RECEIPT_OCR_EXTREME_NARROW_WIDTH) return baseline;
  const extreme = Math.min(RECEIPT_OCR_EXTREME_MAX_SCALE, RECEIPT_OCR_EXTREME_TARGET_WIDTH / sourceWidth);
  return Math.max(baseline, extreme);
}

export function planReceiptOcrChunks(
  imageHeight: number,
  chunkHeight = RECEIPT_OCR_CHUNK_HEIGHT,
  overlap = RECEIPT_OCR_CHUNK_OVERLAP,
): ReceiptOcrChunkPlan[] {
  const height = Math.max(1, Math.round(imageHeight));
  const safeChunkHeight = Math.max(1, Math.round(chunkHeight));
  const safeOverlap = Math.min(Math.max(0, Math.round(overlap)), safeChunkHeight - 1);

  if (height <= safeChunkHeight) {
    return [{ index: 0, startY: 0, endY: height, height }];
  }

  const plans: ReceiptOcrChunkPlan[] = [];
  let startY = 0;

  while (startY < height) {
    const endY = Math.min(height, startY + safeChunkHeight);
    plans.push({ index: plans.length, startY, endY, height: endY - startY });
    if (endY >= height) break;

    const nextStart = endY - safeOverlap;
    if (nextStart <= startY) break;
    startY = nextStart;
  }

  return plans;
}

export function shouldInvertReceiptLuminance(samples: readonly number[]): boolean {
  const clean = samples
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.min(255, Math.max(0, value)));
  if (!clean.length) return false;

  const sorted = [...clean].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 255;
  const darkRatio = clean.filter((value) => value < 128).length / clean.length;
  return median < 128 && darkRatio >= 0.55;
}

function normalizedBoundaryLine(line: string): string {
  return line.trim().replace(/\s+/gu, ' ');
}

function fuzzyBoundaryLine(line: string): string {
  return normalizedBoundaryLine(line)
    .toLocaleLowerCase('pl-PL')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    // Boundary-local matching may normalize the most common OCR glyph swaps.
    // This never changes parser text and therefore cannot rewrite real prices.
    .replace(/0/gu, 'o')
    .replace(/[1il]/gu, 'l');
}

function editDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = previous[rightIndex - 1]! + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(
        previous[rightIndex]! + 1,
        current[rightIndex - 1]! + 1,
        substitution,
      );
    }
    previous = current;
  }
  return previous[right.length] ?? Math.max(left.length, right.length);
}

function boundarySimilarity(left: string, right: string): number {
  const a = fuzzyBoundaryLine(left);
  const b = fuzzyBoundaryLine(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (Math.min(a.length, b.length) < 4) return 0;
  return 1 - editDistance(a, b) / Math.max(a.length, b.length);
}

function fuzzyBoundaryPrefixLength(previous: readonly string[], next: readonly string[]): number {
  let previousCursor = 0;
  const anchors: Array<{ previousIndex: number; nextIndex: number; score: number; length: number }> = [];

  for (let nextIndex = 0; nextIndex < next.length; nextIndex += 1) {
    let best: { previousIndex: number; score: number; length: number } | null = null;
    for (let previousIndex = previousCursor; previousIndex < previous.length; previousIndex += 1) {
      const score = boundarySimilarity(previous[previousIndex] ?? '', next[nextIndex] ?? '');
      const length = Math.max(fuzzyBoundaryLine(previous[previousIndex] ?? '').length, fuzzyBoundaryLine(next[nextIndex] ?? '').length);
      if (score < 0.80) continue;
      if (!best || score > best.score) best = { previousIndex, score, length };
    }
    if (!best) continue;
    anchors.push({ ...best, nextIndex });
    previousCursor = best.previousIndex + 1;
  }

  if (anchors.length < 2) return 0;
  if (!anchors.some((anchor) => anchor.length >= 10)) return 0;
  const average = anchors.reduce((sum, anchor) => sum + anchor.score, 0) / anchors.length;
  if (anchors.length === 2 && average < 0.91) return 0;
  if (anchors.length >= 3 && average < 0.84) return 0;

  const last = anchors[anchors.length - 1]!;
  let prefixLength = last.nextIndex + 1;
  const previousTrailing = previous.length - last.previousIndex - 1;
  const maxExtension = Math.min(2, previousTrailing, next.length - prefixLength);
  for (let offset = 0; offset < maxExtension; offset += 1) {
    const candidate = normalizedBoundaryLine(next[prefixLength] ?? '');
    if (!candidate || candidate.length > 12 || !/\d/u.test(candidate)) break;
    prefixLength += 1;
  }
  return prefixLength;
}

export function mergeReceiptOcrChunkTexts(texts: readonly string[], windowSize = 24): string {
  const chunks = texts
    .map((text) => text.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0);
  if (!chunks.length) return '';

  const merged = [...(chunks[0] ?? [])];
  for (let chunkIndex = 1; chunkIndex < chunks.length; chunkIndex += 1) {
    const next = chunks[chunkIndex] ?? [];
    const maxOverlap = Math.min(windowSize, merged.length, next.length);
    let matched = 0;

    for (let size = maxOverlap; size >= 1; size -= 1) {
      let same = true;
      for (let index = 0; index < size; index += 1) {
        const previousLine = merged[merged.length - size + index] ?? '';
        const nextLine = next[index] ?? '';
        if (normalizedBoundaryLine(previousLine) !== normalizedBoundaryLine(nextLine)) {
          same = false;
          break;
        }
      }
      if (same) {
        matched = size;
        break;
      }
    }

    if (matched < 2) {
      const previousWindow = merged.slice(Math.max(0, merged.length - windowSize));
      const nextWindow = next.slice(0, windowSize);
      matched = Math.max(matched, fuzzyBoundaryPrefixLength(previousWindow, nextWindow));
    }

    merged.push(...next.slice(matched));
  }

  return merged.join('\n').trim();
}
