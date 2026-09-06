export interface ReceiptCropPlan {
  applied: boolean;
  leftRatio: number;
  topRatio: number;
  rightRatio: number;
  bottomRatio: number;
  confidence: number;
}

export interface ReceiptDeskewCandidate {
  angle: number;
  score: number;
}

export interface ReceiptFiscalRegionPlan extends ReceiptCropPlan {
  polarity: 'bright' | 'dark' | 'none';
}

export interface ReceiptFiscalSubregionPlan extends ReceiptCropPlan {
  marketingTailDetected: boolean;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function median(values: readonly number[]): number {
  if (!values.length) return 255;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle] ?? 255;
  return ((sorted[middle - 1] ?? 255) + (sorted[middle] ?? 255)) / 2;
}

export function planSafeReceiptCrop(
  sampleWidth: number,
  sampleHeight: number,
  luminanceValues: readonly number[],
): ReceiptCropPlan {
  const width = Math.max(1, Math.round(sampleWidth));
  const height = Math.max(1, Math.round(sampleHeight));
  if (luminanceValues.length !== width * height || width < 8 || height < 8) {
    return { applied: false, leftRatio: 0, topRatio: 0, rightRatio: 1, bottomRatio: 1, confidence: 0 };
  }

  const cornerWidth = Math.max(2, Math.round(width * 0.08));
  const cornerHeight = Math.max(2, Math.round(height * 0.08));
  const corners: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inCorner = (x < cornerWidth || x >= width - cornerWidth)
        && (y < cornerHeight || y >= height - cornerHeight);
      if (inCorner) corners.push(luminanceValues[y * width + x] ?? 255);
    }
  }

  const background = median(corners);
  const rowCounts = new Uint32Array(height);
  const columnCounts = new Uint32Array(width);
  let contentPixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = luminanceValues[y * width + x] ?? background;
      if (Math.abs(value - background) < 28) continue;
      rowCounts[y] = (rowCounts[y] ?? 0) + 1;
      columnCounts[x] = (columnCounts[x] ?? 0) + 1;
      contentPixels += 1;
    }
  }

  if (contentPixels < width * height * 0.008) {
    return { applied: false, leftRatio: 0, topRatio: 0, rightRatio: 1, bottomRatio: 1, confidence: 0 };
  }

  const rowThreshold = Math.max(1, Math.round(width * 0.015));
  const columnThreshold = Math.max(1, Math.round(height * 0.015));
  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;

  while (top < height && (rowCounts[top] ?? 0) < rowThreshold) top += 1;
  while (bottom > top && (rowCounts[bottom] ?? 0) < rowThreshold) bottom -= 1;
  while (left < width && (columnCounts[left] ?? 0) < columnThreshold) left += 1;
  while (right > left && (columnCounts[right] ?? 0) < columnThreshold) right -= 1;

  if (top >= bottom || left >= right) {
    return { applied: false, leftRatio: 0, topRatio: 0, rightRatio: 1, bottomRatio: 1, confidence: 0 };
  }

  const padX = Math.max(1, Math.round(width * 0.035));
  const padY = Math.max(1, Math.round(height * 0.025));
  left = Math.max(0, left - padX);
  right = Math.min(width - 1, right + padX);
  top = Math.max(0, top - padY);
  bottom = Math.min(height - 1, bottom + padY);

  const retainedWidth = (right - left + 1) / width;
  const retainedHeight = (bottom - top + 1) / height;
  const retainedArea = retainedWidth * retainedHeight;
  const removedArea = 1 - retainedArea;
  const contentRatio = contentPixels / (width * height);
  const confidence = clamp01(removedArea * 2.4 + Math.min(0.35, contentRatio * 1.2));
  const applied = retainedWidth >= 0.55
    && retainedHeight >= 0.55
    && removedArea >= 0.08
    && confidence >= 0.32;

  if (!applied) {
    return { applied: false, leftRatio: 0, topRatio: 0, rightRatio: 1, bottomRatio: 1, confidence };
  }

  return {
    applied: true,
    leftRatio: left / width,
    topRatio: top / height,
    rightRatio: (right + 1) / width,
    bottomRatio: (bottom + 1) / height,
    confidence,
  };
}

interface RegionComponent {
  pixels: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function componentScore(
  component: RegionComponent,
  width: number,
  height: number,
  polarity: 'bright' | 'dark',
): number {
  const boxWidth = component.maxX - component.minX + 1;
  const boxHeight = component.maxY - component.minY + 1;
  const boxArea = boxWidth * boxHeight;
  const imageArea = width * height;
  const areaRatio = boxArea / imageArea;
  const density = component.pixels / Math.max(1, boxArea);
  const widthRatio = boxWidth / width;
  const heightRatio = boxHeight / height;
  if (areaRatio < 0.018 || areaRatio > 0.72) return -1;
  if (widthRatio < 0.10 || heightRatio < 0.16) return -1;
  if (density < 0.24) return -1;

  const centerX = (component.minX + component.maxX + 1) / 2 / width;
  const centerY = (component.minY + component.maxY + 1) / 2 / height;
  const centerDistance = Math.sqrt((centerX - 0.5) ** 2 + (centerY - 0.5) ** 2) / Math.SQRT1_2;
  const centrality = clamp01(1 - centerDistance);
  const aspect = boxWidth / Math.max(1, boxHeight);
  const receiptAspect = aspect >= 0.18 && aspect <= 1.35 ? 1 : 0.45;
  const touchesEdges = Number(component.minX <= 1) + Number(component.minY <= 1)
    + Number(component.maxX >= width - 2) + Number(component.maxY >= height - 2);
  const edgePenalty = touchesEdges >= 2 ? 0.24 : touchesEdges === 1 ? 0.08 : 0;
  const sizeScore = areaRatio <= 0.38 ? 1 : clamp01(1 - (areaRatio - 0.38) / 0.34);
  const polarityBonus = polarity === 'bright' ? 0.08 : 0;
  return density * 0.34 + centrality * 0.26 + receiptAspect * 0.16 + sizeScore * 0.16 + polarityBonus - edgePenalty;
}

function connectedComponents(mask: Uint8Array, width: number, height: number): RegionComponent[] {
  const visited = new Uint8Array(mask.length);
  const components: RegionComponent[] = [];
  const queueX = new Int16Array(mask.length);
  const queueY = new Int16Array(mask.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (!mask[start] || visited[start]) continue;
      let head = 0;
      let tail = 0;
      queueX[tail] = x;
      queueY[tail] = y;
      tail += 1;
      visited[start] = 1;
      const component: RegionComponent = { pixels: 0, minX: x, minY: y, maxX: x, maxY: y };

      while (head < tail) {
        const currentX = queueX[head] ?? 0;
        const currentY = queueY[head] ?? 0;
        head += 1;
        component.pixels += 1;
        component.minX = Math.min(component.minX, currentX);
        component.minY = Math.min(component.minY, currentY);
        component.maxX = Math.max(component.maxX, currentX);
        component.maxY = Math.max(component.maxY, currentY);

        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nextX = currentX + dx;
            const nextY = currentY + dy;
            if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
            const nextIndex = nextY * width + nextX;
            if (!mask[nextIndex] || visited[nextIndex]) continue;
            visited[nextIndex] = 1;
            queueX[tail] = nextX;
            queueY[tail] = nextY;
            tail += 1;
          }
        }
      }
      components.push(component);
    }
  }
  return components;
}

/**
 * Conservative recovery-only crop for a small paper receipt photographed on a
 * much larger background. Unlike the normal crop, this is allowed to retain a
 * substantially smaller part of the frame, but only when a coherent, paper-like
 * luminance component is present. It never runs OCR by itself.
 */
export function planReceiptFiscalRegionCrop(
  sampleWidth: number,
  sampleHeight: number,
  luminanceValues: readonly number[],
): ReceiptFiscalRegionPlan {
  const width = Math.max(1, Math.round(sampleWidth));
  const height = Math.max(1, Math.round(sampleHeight));
  const fallback: ReceiptFiscalRegionPlan = {
    applied: false,
    leftRatio: 0,
    topRatio: 0,
    rightRatio: 1,
    bottomRatio: 1,
    confidence: 0,
    polarity: 'none',
  };
  if (luminanceValues.length !== width * height || width < 16 || height < 16) return fallback;

  // Recovery photos may contain dark phone-case/table edges in the corners, so
  // corner-only background estimation is too fragile here. The global median is
  // deliberately used only by this recovery planner; the normal crop retains
  // its stricter corner-based behavior.
  const background = median(luminanceValues.filter((value) => Number.isFinite(value)));
  const delta = 24;
  const plans: Array<{ component: RegionComponent; score: number; polarity: 'bright' | 'dark' }> = [];

  for (const polarity of ['bright', 'dark'] as const) {
    const mask = new Uint8Array(width * height);
    for (let index = 0; index < mask.length; index += 1) {
      const value = luminanceValues[index] ?? background;
      const active = polarity === 'bright' ? value >= background + delta : value <= background - delta;
      if (active) mask[index] = 1;
    }
    for (const component of connectedComponents(mask, width, height)) {
      const score = componentScore(component, width, height, polarity);
      if (score >= 0) plans.push({ component, score, polarity });
    }
  }

  const best = plans.sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < 0.52) return fallback;
  const padX = Math.max(2, Math.round(width * 0.035));
  const padY = Math.max(2, Math.round(height * 0.035));
  const left = Math.max(0, best.component.minX - padX);
  const top = Math.max(0, best.component.minY - padY);
  const right = Math.min(width - 1, best.component.maxX + padX);
  const bottom = Math.min(height - 1, best.component.maxY + padY);
  const retainedWidth = (right - left + 1) / width;
  const retainedHeight = (bottom - top + 1) / height;
  const retainedArea = retainedWidth * retainedHeight;
  if (retainedWidth < 0.12 || retainedHeight < 0.18 || retainedArea < 0.025 || retainedArea > 0.78) return fallback;

  return {
    applied: true,
    leftRatio: left / width,
    topRatio: top / height,
    rightRatio: (right + 1) / width,
    bottomRatio: (bottom + 1) / height,
    confidence: clamp01(best.score),
    polarity: best.polarity,
  };
}

/**
 * Recovery-only second stage that works inside an already detected paper region.
 * It looks for a late cluster of unusually strong/tall text bands. A single tall
 * band (for example a barcode or bold total) is not enough: at least three nearby
 * strong bands are required before the trailing region can be excluded.
 *
 * This helper is intentionally geometry-only and merchant-agnostic. It never runs
 * OCR and never searches for receipt/slogan words.
 */
export function planReceiptFiscalSubregionCrop(
  sampleWidth: number,
  sampleHeight: number,
  luminanceValues: readonly number[],
): ReceiptFiscalSubregionPlan {
  const width = Math.max(1, Math.round(sampleWidth));
  const height = Math.max(1, Math.round(sampleHeight));
  const fallback: ReceiptFiscalSubregionPlan = {
    applied: false,
    leftRatio: 0,
    topRatio: 0,
    rightRatio: 1,
    bottomRatio: 1,
    confidence: 0,
    marketingTailDetected: false,
  };
  if (luminanceValues.length !== width * height || width < 24 || height < 48) return fallback;

  const rowEdges = new Float64Array(height);
  for (let y = 0; y < height; y += 1) {
    let edges = 0;
    const rowOffset = y * width;
    for (let x = 1; x < width; x += 1) {
      const left = luminanceValues[rowOffset + x - 1] ?? 255;
      const right = luminanceValues[rowOffset + x] ?? 255;
      if (Math.abs(right - left) >= 18) edges += 1;
    }
    rowEdges[y] = edges;
  }

  const smoothed = new Float64Array(height);
  for (let y = 0; y < height; y += 1) {
    const previous = rowEdges[Math.max(0, y - 1)] ?? 0;
    const current = rowEdges[y] ?? 0;
    const next = rowEdges[Math.min(height - 1, y + 1)] ?? 0;
    smoothed[y] = (previous + current + next) / 3;
  }

  const strongThreshold = Math.max(3, width * 0.18);
  const active = new Uint8Array(height);
  for (let y = 0; y < height; y += 1) {
    if ((smoothed[y] ?? 0) >= strongThreshold) active[y] = 1;
  }
  // Bridge only a one-row hole so anti-aliased strokes stay one band without
  // merging distinct text lines into a synthetic block.
  for (let y = 1; y < height - 1; y += 1) {
    if (!active[y] && active[y - 1] && active[y + 1]) active[y] = 1;
  }

  interface StrongBand {
    start: number;
    end: number;
    height: number;
    peak: number;
  }
  const bands: StrongBand[] = [];
  for (let y = 0; y < height;) {
    if (!active[y]) {
      y += 1;
      continue;
    }
    const start = y;
    let peak = smoothed[y] ?? 0;
    while (y + 1 < height && active[y + 1]) {
      y += 1;
      peak = Math.max(peak, smoothed[y] ?? 0);
    }
    bands.push({ start, end: y, height: y - start + 1, peak });
    y += 1;
  }

  const minClusterStart = height * 0.58;
  const maxBandGap = Math.max(3, height * 0.08);
  const maxClusterSpan = height * 0.25;
  const tallBandHeight = Math.max(3, height * 0.022);
  let winningCluster: StrongBand[] | undefined;

  for (let index = 0; index < bands.length; index += 1) {
    const first = bands[index]!;
    if (first.start < minClusterStart) continue;
    const cluster: StrongBand[] = [first];
    for (let cursor = index + 1; cursor < bands.length; cursor += 1) {
      const next = bands[cursor]!;
      const previous = cluster[cluster.length - 1]!;
      if (next.start - previous.end > maxBandGap) break;
      if (next.end - first.start > maxClusterSpan) break;
      cluster.push(next);
    }
    const tallBands = cluster.filter((band) => band.height >= tallBandHeight).length;
    const totalBandHeight = cluster.reduce((sum, band) => sum + band.height, 0);
    const threeBandCluster = cluster.length >= 3 && tallBands >= 2 && totalBandHeight >= height * 0.055;
    // On the bounded 192px analysis grid two adjacent large marketing lines can
    // collapse into one band. Permit a two-band tail only when it starts very
    // late and occupies a substantial vertical share; two ordinary bold totals
    // remain far below this threshold.
    const compactTwoBandTail = cluster.length >= 2
      && first.start >= height * 0.66
      && tallBands >= 2
      && totalBandHeight >= height * 0.11;
    if (threeBandCluster || compactTwoBandTail) {
      winningCluster = cluster;
      break;
    }
  }

  if (!winningCluster) return fallback;
  const firstMarketingBand = winningCluster[0]!;
  const pad = Math.max(2, Math.round(height * 0.015));
  const bottom = Math.max(Math.round(height * 0.55), firstMarketingBand.start - pad);
  const bottomRatio = clamp01(bottom / height);
  const removedRatio = 1 - bottomRatio;
  if (bottomRatio < 0.55 || bottomRatio > 0.86 || removedRatio < 0.14) return fallback;

  const peakStrength = winningCluster.reduce((sum, band) => sum + band.peak / strongThreshold, 0) / winningCluster.length;
  const confidence = clamp01(0.48 + Math.min(0.24, (winningCluster.length - 3) * 0.06) + Math.min(0.18, (peakStrength - 1) * 0.12) + Math.min(0.10, removedRatio * 0.25));

  return {
    applied: true,
    leftRatio: 0,
    topRatio: 0,
    rightRatio: 1,
    bottomRatio,
    confidence,
    marketingTailDetected: true,
  };
}

export function chooseReceiptDeskewAngle(candidates: readonly ReceiptDeskewCandidate[]): number {
  const zero = candidates.find((candidate) => Math.abs(candidate.angle) < 0.001);
  if (!zero || !Number.isFinite(zero.score) || zero.score <= 0) return 0;
  const best = candidates
    .filter((candidate) => Number.isFinite(candidate.score) && Math.abs(candidate.angle) <= 5)
    .sort((a, b) => b.score - a.score || Math.abs(a.angle) - Math.abs(b.angle))[0];
  if (!best || Math.abs(best.angle) < 0.5) return 0;
  if (best.score < zero.score * 1.08) return 0;
  return Math.max(-5, Math.min(5, best.angle));
}
