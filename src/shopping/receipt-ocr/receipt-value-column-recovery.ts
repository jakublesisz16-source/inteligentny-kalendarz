import type { ReceiptOcrGeometry, ReceiptOcrToken } from './receipt-ocr.types';
import type { ReceiptGeometryReconstructionResult } from './receipt-geometry-reconstruction';

export interface ReceiptValueColumnRecoveryCrop {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type ReceiptValueColumnRecoverySkipReason =
  | 'geometry-source'
  | 'columns-missing'
  | 'column-confidence'
  | 'too-few-items'
  | 'value-coverage-sufficient'
  | 'item-section-missing'
  | 'crop-invalid'
  | 'crop-too-large';

export interface ReceiptValueColumnRecoveryPlan {
  eligible: boolean;
  page: number;
  crop?: ReceiptValueColumnRecoveryCrop;
  pixelCount?: number;
  valueAnchor?: number;
  unitPriceAnchor?: number;
  itemGroupCount: number;
  primaryExplicitValueItemCount: number;
  primaryMissingValueItemCount: number;
  primaryValueCoverageRatio: number;
  reason?: ReceiptValueColumnRecoverySkipReason;
}

export interface ReceiptValueColumnRecoveryDelta {
  completeBefore: number;
  completeAfter: number;
  unresolvedBefore: number;
  unresolvedAfter: number;
  recoveredGrossCells: number;
  recoveredDiscountCells: number;
  recoveredNetCells: number;
  recoveredCompleteGroups: number;
}

export const MAX_RECEIPT_VALUE_RECOVERY_PIXELS = 1_500_000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizedText(value: string): string {
  return value
    .replace(/[−–—]/gu, '-')
    .replace(/\s+/gu, '')
    .toLocaleLowerCase('pl-PL');
}

function tokenCenter(token: ReceiptOcrToken): { x: number; y: number } {
  return {
    x: (token.bbox.x0 + token.bbox.x1) / 2,
    y: (token.bbox.y0 + token.bbox.y1) / 2,
  };
}

function approximateDuplicate(left: ReceiptOcrToken, right: ReceiptOcrToken): boolean {
  if (left.page !== right.page) return false;
  if (normalizedText(left.text) !== normalizedText(right.text)) return false;
  const lc = tokenCenter(left);
  const rc = tokenCenter(right);
  const height = Math.max(6, left.bbox.y1 - left.bbox.y0, right.bbox.y1 - right.bbox.y0);
  return Math.abs(lc.x - rc.x) <= height * 0.65 && Math.abs(lc.y - rc.y) <= height * 0.65;
}

export function mergeReceiptOcrGeometryEvidence(
  primary: ReceiptOcrGeometry,
  recovery: ReceiptOcrGeometry,
): ReceiptOcrGeometry {
  const tokens = [...primary.tokens];
  for (const token of recovery.tokens) {
    if (tokens.some((existing) => approximateDuplicate(existing, token))) continue;
    tokens.push(token);
  }
  tokens.sort((left, right) => left.page - right.page
    || left.bbox.y0 - right.bbox.y0
    || left.bbox.x0 - right.bbox.x0
    || left.text.localeCompare(right.text, 'pl'));
  return {
    source: primary.source,
    imageWidth: Math.max(primary.imageWidth, recovery.imageWidth),
    imageHeight: Math.max(primary.imageHeight, recovery.imageHeight),
    tokens,
  };
}

export function isReceiptValueRecoveryMoneyToken(token: ReceiptOcrToken): boolean {
  const value = token.text
    .replace(/[−–—]/gu, '-')
    .replace(/\s+/gu, '')
    .replace(/[Oo]/gu, '0')
    .replace(/[Il|]/gu, '1');
  return /^-?\d{1,6}[,.]\d{2}$/u.test(value);
}

export function countUsableReceiptValueRecoveryTokens(geometry: ReceiptOcrGeometry | undefined): number {
  if (!geometry) return 0;
  return geometry.tokens.filter(isReceiptValueRecoveryMoneyToken).length;
}

export function selectUsableReceiptValueRecoveryGeometry(geometry: ReceiptOcrGeometry | undefined): ReceiptOcrGeometry | undefined {
  if (!geometry) return undefined;
  const tokens = geometry.tokens.filter((token) => isReceiptValueRecoveryMoneyToken(token)
    && (token.confidence === undefined || token.confidence >= 20));
  if (!tokens.length) return undefined;
  return { ...geometry, tokens };
}

function itemRows(reconstruction: ReceiptGeometryReconstructionResult): number[] {
  return reconstruction.items.flatMap((item) => item.sourceRowIndices);
}

export function planReceiptValueColumnRecovery(
  geometry: ReceiptOcrGeometry,
  reconstruction: ReceiptGeometryReconstructionResult,
): ReceiptValueColumnRecoveryPlan {
  const itemGroupCount = reconstruction.items.length;
  const primaryExplicitValueItemCount = reconstruction.items.filter((item) => item.evidence.includes('value-column')).length;
  const primaryMissingValueItemCount = Math.max(0, itemGroupCount - primaryExplicitValueItemCount);
  const primaryValueCoverageRatio = itemGroupCount ? primaryExplicitValueItemCount / itemGroupCount : 0;
  const page = reconstruction.items[0]?.page ?? geometry.tokens[0]?.page ?? 1;
  const base = {
    eligible: false,
    page,
    itemGroupCount,
    primaryExplicitValueItemCount,
    primaryMissingValueItemCount,
    primaryValueCoverageRatio,
  } satisfies ReceiptValueColumnRecoveryPlan;

  if (geometry.source !== 'primary' && geometry.source !== 'snapshot') return { ...base, reason: 'geometry-source' };
  const columns = reconstruction.columns;
  const valueAnchor = columns?.anchors.value;
  const unitPriceAnchor = columns?.anchors.unitPrice;
  if (!columns || valueAnchor === undefined) return { ...base, reason: 'columns-missing' };
  if (columns.confidence < 0.72) return { ...base, valueAnchor, ...(unitPriceAnchor === undefined ? {} : { unitPriceAnchor }), reason: 'column-confidence' };
  if (itemGroupCount < 4) return { ...base, valueAnchor, ...(unitPriceAnchor === undefined ? {} : { unitPriceAnchor }), reason: 'too-few-items' };
  const missingThreshold = Math.max(2, Math.ceil(itemGroupCount * 0.30));
  if (primaryMissingValueItemCount < missingThreshold || primaryValueCoverageRatio >= 0.72) {
    return { ...base, valueAnchor, ...(unitPriceAnchor === undefined ? {} : { unitPriceAnchor }), reason: 'value-coverage-sufficient' };
  }

  const relevantRows = itemRows(reconstruction);
  if (!relevantRows.length) return { ...base, valueAnchor, ...(unitPriceAnchor === undefined ? {} : { unitPriceAnchor }), reason: 'item-section-missing' };
  const rowStartIndex = Math.min(...relevantRows);
  const startRow = reconstruction.rows[rowStartIndex];
  const lastItemRowIndex = Math.max(...relevantRows);
  const lastItemRow = reconstruction.rows[lastItemRowIndex];
  const boundaryRow = reconstruction.itemSectionEndRowIndex === undefined
    ? undefined
    : reconstruction.rows[reconstruction.itemSectionEndRowIndex];
  if (!startRow || !lastItemRow) return { ...base, valueAnchor, ...(unitPriceAnchor === undefined ? {} : { unitPriceAnchor }), reason: 'item-section-missing' };

  const medianHeight = Math.max(8, reconstruction.medianTokenHeight || startRow.medianHeight || 24);
  const horizontalGap = unitPriceAnchor === undefined ? medianHeight * 5 : Math.max(medianHeight * 2.5, valueAnchor - unitPriceAnchor);
  const inferredLeft = unitPriceAnchor === undefined
    ? valueAnchor - horizontalGap * 0.55
    : (unitPriceAnchor + valueAnchor) / 2 - medianHeight * 0.45;
  const inferredRight = valueAnchor + Math.max(medianHeight * 3.5, horizontalGap * 0.82);
  const x0 = Math.floor(clamp(inferredLeft, 0, geometry.imageWidth - 1));
  const x1 = Math.ceil(clamp(inferredRight, x0 + 1, geometry.imageWidth));
  const y0 = Math.floor(clamp(startRow.bbox.y0 - medianHeight * 0.55, 0, geometry.imageHeight - 1));
  const inferredBottom = boundaryRow && boundaryRow.page === page
    ? boundaryRow.bbox.y0 - medianHeight * 0.20
    : lastItemRow.bbox.y1 + medianHeight * 0.75;
  const y1 = Math.ceil(clamp(inferredBottom, y0 + 1, geometry.imageHeight));
  const width = x1 - x0;
  const height = y1 - y0;
  const pixelCount = width * height;
  if (width < medianHeight * 2 || height < medianHeight * 3) {
    return { ...base, valueAnchor, ...(unitPriceAnchor === undefined ? {} : { unitPriceAnchor }), reason: 'crop-invalid' };
  }
  if (!Number.isFinite(pixelCount) || pixelCount <= 0 || pixelCount > MAX_RECEIPT_VALUE_RECOVERY_PIXELS) {
    return { ...base, valueAnchor, ...(unitPriceAnchor === undefined ? {} : { unitPriceAnchor }), pixelCount, reason: 'crop-too-large' };
  }

  return {
    ...base,
    eligible: true,
    valueAnchor,
    ...(unitPriceAnchor === undefined ? {} : { unitPriceAnchor }),
    crop: { x0, y0, x1, y1 },
    pixelCount,
  };
}

function normalizedItemName(value: string): string {
  return value
    .replace(/[Łł]/gu, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('pl-PL')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

function matchingItem(reconstruction: ReceiptGeometryReconstructionResult, name: string) {
  const target = normalizedItemName(name);
  return reconstruction.items.find((item) => normalizedItemName(item.name) === target);
}

export function compareReceiptValueColumnRecovery(
  before: ReceiptGeometryReconstructionResult,
  after: ReceiptGeometryReconstructionResult,
): ReceiptValueColumnRecoveryDelta {
  let recoveredGrossCells = 0;
  let recoveredDiscountCells = 0;
  let recoveredNetCells = 0;
  let recoveredCompleteGroups = 0;
  for (const afterItem of after.items) {
    const beforeItem = matchingItem(before, afterItem.name);
    if (!beforeItem) continue;
    if (!beforeItem.evidence.includes('value-column') && afterItem.evidence.includes('value-column')) recoveredGrossCells += 1;
    if (beforeItem.discountMinor === undefined && afterItem.discountMinor !== undefined) recoveredDiscountCells += 1;
    if (!beforeItem.evidence.includes('net-confirmation') && afterItem.evidence.includes('net-confirmation')) recoveredNetCells += 1;
    if (beforeItem.finalAmountMinor === undefined && afterItem.finalAmountMinor !== undefined) recoveredCompleteGroups += 1;
  }
  return {
    completeBefore: before.completeItemCount,
    completeAfter: after.completeItemCount,
    unresolvedBefore: before.items.length - before.completeItemCount,
    unresolvedAfter: after.items.length - after.completeItemCount,
    recoveredGrossCells,
    recoveredDiscountCells,
    recoveredNetCells,
    recoveredCompleteGroups,
  };
}
