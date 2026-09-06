import type { ReceiptOcrBoundingBox, ReceiptOcrGeometry, ReceiptOcrToken } from './receipt-ocr.types';

export interface ReceiptOcrRow {
  page: number;
  tokens: ReceiptOcrToken[];
  bbox: ReceiptOcrBoundingBox;
  medianHeight: number;
  text: string;
}

export type ReceiptGeometryColumnRole = 'name' | 'tax' | 'quantity' | 'unitPrice' | 'value';

export interface ReceiptGeometryColumns {
  source: 'header' | 'numeric-clusters';
  confidence: number;
  anchors: Partial<Record<ReceiptGeometryColumnRole, number>>;
  headerRowIndex?: number;
}

export interface GeometryReceiptItemCandidate {
  name: string;
  taxMarker?: string;
  quantity?: number;
  unitPriceMinor?: number;
  grossBeforeDiscountMinor?: number;
  discountMinor?: number;
  finalAmountMinor?: number;
  page: number;
  rowIndex: number;
  sourceRowIndices: number[];
  confidence: number;
  evidence: string[];
  unresolvedReason?: 'missing-gross' | 'discount-unresolved' | 'quantity-unresolved';
}

export interface ReceiptGeometryReconstructionResult {
  applied: boolean;
  /** Canonical geometry-aware text used only by the DEV4-A experimental parser path. */
  text: string;
  /** Pure row-major OCR text before structured value reconciliation. */
  rowMajorText: string;
  /** True when a structured candidate text could be generated from local geometry evidence. */
  structuredTextGenerated: boolean;
  rows: ReceiptOcrRow[];
  columns?: ReceiptGeometryColumns;
  items: GeometryReceiptItemCandidate[];
  rejectedRows: Array<{ page: number; rowIndex: number; text: string; reason: string }>;
  medianTokenHeight: number;
  validTokenCount: number;
  invalidTokenCount: number;
  completeItemCount: number;
  grossItemsTotalMinor: number;
  discountsTotalMinor: number;
  itemsTotalMinor: number;
  itemSectionStartRowIndex?: number;
  itemSectionEndRowIndex?: number;
}


export type ReceiptGeometryCandidateRejectionReason =
  | 'not-generated'
  | 'ambiguous-quantity'
  | 'item-outlier'
  | 'goods-mismatch'
  | 'low-completeness';

export interface ReceiptGeometryStructuredCandidateAssessment {
  generated: boolean;
  accepted: boolean;
  rejectionReasons: ReceiptGeometryCandidateRejectionReason[];
  completenessRatio: number;
  declaredGoodsSubtotalMinor?: number;
  candidateItemsTotalMinor?: number;
}

export interface ReceiptGeometryParsedFinancialSummary {
  declaredSubtotalMinor?: number;
  finalPayableMinor?: number;
  declaredTotalMinor?: number;
  depositTotalMinor?: number;
  detectedItemsTotalMinor?: number;
  subtotalResolution?: 'items-final-consensus' | 'ocr-items-consensus' | 'ocr-final-consensus' | 'ocr-unconfirmed' | 'final-minus-deposit' | 'items-only';
  items: Array<{ amountMinor?: number }>;
}

interface StructuredCells {
  nameTokens: ReceiptOcrToken[];
  taxTokens: ReceiptOcrToken[];
  quantityTokens: ReceiptOcrToken[];
  unitPriceTokens: ReceiptOcrToken[];
  valueTokens: ReceiptOcrToken[];
}

interface GeometryItemWorkingGroup {
  item: GeometryReceiptItemCandidate;
  hasDiscountSemantic: boolean;
  explicitDiscountMinor: number;
  positiveDiscountMagnitudes: number[];
  netConfirmationMinor?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function centerX(token: ReceiptOcrToken): number {
  return (token.bbox.x0 + token.bbox.x1) / 2;
}

function centerY(token: ReceiptOcrToken): number {
  return (token.bbox.y0 + token.bbox.y1) / 2;
}

function tokenHeight(token: ReceiptOcrToken): number {
  return token.bbox.y1 - token.bbox.y0;
}

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function normalize(value: string): string {
  return value
    .replace(/[Łł]/gu, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('pl-PL')
    .replace(/[^a-z0-9%]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

function validBbox(token: ReceiptOcrToken, geometry: ReceiptOcrGeometry): boolean {
  const { x0, y0, x1, y1 } = token.bbox;
  return Number.isFinite(x0) && Number.isFinite(y0) && Number.isFinite(x1) && Number.isFinite(y1)
    && x0 >= 0 && y0 >= 0 && x1 > x0 && y1 > y0
    && x1 <= geometry.imageWidth + 1
    && y1 <= geometry.imageHeight + 1;
}

export function validateReceiptOcrGeometry(geometry: ReceiptOcrGeometry): {
  valid: ReceiptOcrToken[];
  invalid: ReceiptOcrToken[];
} {
  const valid: ReceiptOcrToken[] = [];
  const invalid: ReceiptOcrToken[] = [];
  for (const token of geometry.tokens) {
    if (token.text.trim() && validBbox(token, geometry)) valid.push(token);
    else invalid.push(token);
  }
  return { valid, invalid };
}

export function calculateReceiptMedianTokenHeight(tokens: readonly ReceiptOcrToken[]): number {
  const heights = tokens
    .map(tokenHeight)
    .filter((height) => Number.isFinite(height) && height >= 2);
  if (!heights.length) return 0;
  const rough = median(heights);
  const stable = heights.filter((height) => height >= rough * 0.4 && height <= rough * 2.4);
  return median(stable.length >= 4 ? stable : heights);
}

function verticalOverlapRatio(left: ReceiptOcrToken, row: ReceiptOcrRow): number {
  const overlap = Math.max(0, Math.min(left.bbox.y1, row.bbox.y1) - Math.max(left.bbox.y0, row.bbox.y0));
  const denominator = Math.min(tokenHeight(left), row.bbox.y1 - row.bbox.y0);
  return denominator > 0 ? overlap / denominator : 0;
}

function hasExplicitLineConflict(token: ReceiptOcrToken, row: ReceiptOcrRow): boolean {
  if (token.blockIndex === undefined || token.paragraphIndex === undefined || token.lineIndex === undefined) return false;
  return row.tokens.some((existing) => {
    if (token.source !== undefined || existing.source !== undefined) {
      if (token.source !== existing.source) return false;
    }
    if (token.chunkIndex !== undefined && existing.chunkIndex !== undefined && token.chunkIndex !== existing.chunkIndex) return false;
    return existing.blockIndex === token.blockIndex
      && existing.paragraphIndex === token.paragraphIndex
      && existing.lineIndex !== undefined
      && existing.lineIndex !== token.lineIndex;
  });
}

function rowFromTokens(page: number, tokens: ReceiptOcrToken[]): ReceiptOcrRow {
  const sorted = [...tokens].sort((a, b) => a.bbox.x0 - b.bbox.x0 || a.bbox.y0 - b.bbox.y0 || a.text.localeCompare(b.text, 'pl'));
  return {
    page,
    tokens: sorted,
    bbox: {
      x0: Math.min(...sorted.map((token) => token.bbox.x0)),
      y0: Math.min(...sorted.map((token) => token.bbox.y0)),
      x1: Math.max(...sorted.map((token) => token.bbox.x1)),
      y1: Math.max(...sorted.map((token) => token.bbox.y1)),
    },
    medianHeight: calculateReceiptMedianTokenHeight(sorted),
    text: sorted.map((token) => token.text.trim()).filter(Boolean).join(' ').replace(/\s+/gu, ' ').trim(),
  };
}

export function clusterReceiptTokensIntoRows(tokens: readonly ReceiptOcrToken[]): ReceiptOcrRow[] {
  if (!tokens.length) return [];
  const documentMedianHeight = calculateReceiptMedianTokenHeight(tokens) || 12;
  const byPage = new Map<number, ReceiptOcrToken[]>();
  for (const token of tokens) {
    const pageTokens = byPage.get(token.page) ?? [];
    pageTokens.push(token);
    byPage.set(token.page, pageTokens);
  }

  const result: ReceiptOcrRow[] = [];
  for (const page of [...byPage.keys()].sort((a, b) => a - b)) {
    const pageTokens = [...(byPage.get(page) ?? [])].sort((a, b) => centerY(a) - centerY(b) || a.bbox.x0 - b.bbox.x0);
    const rows: ReceiptOcrRow[] = [];
    for (const token of pageTokens) {
      let bestIndex = -1;
      let bestScore = -Infinity;
      for (let index = Math.max(0, rows.length - 5); index < rows.length; index += 1) {
        const row = rows[index]!;
        const rowCenterY = (row.bbox.y0 + row.bbox.y1) / 2;
        const centerDistance = Math.abs(centerY(token) - rowCenterY);
        const localHeight = Math.max(documentMedianHeight, row.medianHeight || documentMedianHeight, tokenHeight(token));
        const overlap = verticalOverlapRatio(token, row);
        const explicitLineConflict = hasExplicitLineConflict(token, row);
        if (explicitLineConflict) {
          if (overlap < 0.55 && centerDistance > documentMedianHeight * 0.30) continue;
        } else if (overlap < 0.28 && centerDistance > localHeight * 0.62) continue;
        const score = overlap * 4 - centerDistance / Math.max(1, localHeight) - (explicitLineConflict ? 1.5 : 0);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      }
      if (bestIndex < 0) rows.push(rowFromTokens(page, [token]));
      else rows[bestIndex] = rowFromTokens(page, [...rows[bestIndex]!.tokens, token]);
    }
    rows.sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);
    result.push(...rows);
  }
  return result;
}

function normalizedToken(token: ReceiptOcrToken): string {
  return normalize(token.text).replace(/\s+/gu, '');
}

function findHeaderToken(row: ReceiptOcrRow, role: ReceiptGeometryColumnRole): ReceiptOcrToken | undefined {
  return row.tokens.find((token) => {
    const value = normalizedToken(token);
    if (role === 'name') return value === 'nazwa';
    if (role === 'tax') return value === 'ptu' || value === 'vat';
    if (role === 'quantity') return value === 'ilosc' || value === 'ilos';
    if (role === 'unitPrice') return value === 'cena';
    return value === 'wartosc' || value === 'wartos';
  });
}

function parseMoneyMinor(value: string): number | undefined {
  const normalized = value
    .replace(/[−–—]/gu, '-')
    .replace(/\s+/gu, '')
    .replace(/[Oo]/gu, '0')
    .replace(/[Il|]/gu, '1')
    .replace(/PLN|ZŁ|ZL/giu, '');
  const match = /^(-?)(\d{1,7})[,.](\d{2})$/u.exec(normalized);
  if (!match?.[2] || !match[3]) return undefined;
  const result = Number(match[2]) * 100 + Number(match[3]);
  return match[1] ? -result : result;
}

function exactMoneyFromTokens(tokens: readonly ReceiptOcrToken[]): number | undefined {
  for (const token of [...tokens].sort((a, b) => a.bbox.x0 - b.bbox.x0)) {
    const parsed = parseMoneyMinor(token.text);
    if (parsed !== undefined) return parsed;
  }
  const joined = tokens.map((token) => token.text.trim()).filter(Boolean).join(' ');
  return parseMoneyMinor(joined);
}

function recoverDigitsOnlyMoney(tokens: readonly ReceiptOcrToken[], expectedMinor: number | undefined): number | undefined {
  if (expectedMinor === undefined || expectedMinor <= 0) return undefined;
  const expected = String(expectedMinor);
  for (const token of tokens) {
    const digits = token.text
      .replace(/[Oo]/gu, '0')
      .replace(/[Il|]/gu, '1')
      .replace(/[^0-9]/gu, '');
    if (digits && digits === expected) return expectedMinor;
  }
  return undefined;
}

interface ParsedQuantityToken {
  quantity?: number;
  compact: string;
  kind: 'none' | 'explicit-integer' | 'explicit-decimal' | 'ambiguous-digits';
}

function parseQuantityToken(value: string): ParsedQuantityToken {
  const compact = value
    .replace(/×/gu, 'x')
    .replace(/[Oo]/gu, '0')
    .replace(/[Il|]/gu, '1')
    .replace(/\s+/gu, '');
  const decimalMatch = /^(\d+[,.]\d+)x$/iu.exec(compact);
  if (decimalMatch?.[1]) {
    const parsed = Number(decimalMatch[1].replace(',', '.'));
    return {
      compact,
      kind: 'explicit-decimal',
      ...(Number.isFinite(parsed) && parsed > 0 && parsed <= 10000 ? { quantity: parsed } : {}),
    };
  }
  const integerMatch = /^(\d+)x$/iu.exec(compact);
  if (!integerMatch?.[1]) return { compact, kind: 'none' };
  const digits = integerMatch[1];
  // Long digit-only quantities are ambiguous on weighted receipt rows because OCR may
  // drop a decimal separator. Never promote them without independent local value evidence.
  if (digits.length >= 4 || (digits.length >= 3 && digits.startsWith('0'))) {
    return { compact, kind: 'ambiguous-digits' };
  }
  const parsed = Number(digits);
  return {
    compact,
    kind: 'explicit-integer',
    ...(Number.isFinite(parsed) && parsed > 0 && parsed <= 10000 ? { quantity: parsed } : {}),
  };
}

function quantityTimesUnitMinor(quantity: number, unitPriceMinor: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0 || unitPriceMinor <= 0) return 0;
  return Math.round((Math.round(quantity * 1000) * unitPriceMinor) / 1000);
}

function recoverQuantityDecimalFromMath(
  parsed: ParsedQuantityToken,
  unitPriceMinor: number | undefined,
  explicitGrossMinor: number | undefined,
): number | undefined {
  if (parsed.kind !== 'ambiguous-digits') return parsed.quantity;
  if (unitPriceMinor === undefined || explicitGrossMinor === undefined || unitPriceMinor <= 0 || explicitGrossMinor <= 0) return undefined;
  const match = /^(\d{2,7})x$/iu.exec(parsed.compact);
  if (!match?.[1]) return undefined;
  const digits = match[1];
  const candidates = [1, 2, 3]
    .filter((decimals) => digits.length > decimals)
    .map((decimals) => Number(digits) / 10 ** decimals)
    .filter((quantity) => quantity > 0 && quantity <= 10000)
    .filter((quantity) => Math.abs(quantityTimesUnitMinor(quantity, unitPriceMinor) - explicitGrossMinor) <= 1);
  return candidates.length === 1 ? candidates[0] : undefined;
}

function clusterNumbers(values: readonly number[], tolerance: number): Array<{ center: number; values: number[] }> {
  const sorted = [...values].sort((a, b) => a - b);
  const clusters: Array<{ center: number; values: number[] }> = [];
  for (const value of sorted) {
    const current = clusters[clusters.length - 1];
    if (!current || Math.abs(value - current.center) > tolerance) {
      clusters.push({ center: value, values: [value] });
      continue;
    }
    current.values.push(value);
    current.center = current.values.reduce((sum, item) => sum + item, 0) / current.values.length;
  }
  return clusters;
}

export function inferReceiptColumns(rows: readonly ReceiptOcrRow[], imageWidth: number): ReceiptGeometryColumns | undefined {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]!;
    const name = findHeaderToken(row, 'name');
    const quantity = findHeaderToken(row, 'quantity');
    const unitPrice = findHeaderToken(row, 'unitPrice');
    const value = findHeaderToken(row, 'value');
    if (!name || !quantity || !unitPrice || !value) continue;
    const tax = findHeaderToken(row, 'tax');
    const anchors: Partial<Record<ReceiptGeometryColumnRole, number>> = {
      name: centerX(name),
      quantity: centerX(quantity),
      unitPrice: centerX(unitPrice),
      value: centerX(value),
      ...(tax ? { tax: centerX(tax) } : {}),
    };
    if (!(anchors.name! < anchors.quantity! && anchors.quantity! < anchors.unitPrice! && anchors.unitPrice! < anchors.value!)) continue;
    return { source: 'header', confidence: tax ? 1 : 0.92, anchors, headerRowIndex: rowIndex };
  }

  const quantityX: number[] = [];
  const moneyX: number[] = [];
  for (const row of rows) {
    for (const token of row.tokens) {
      if (parseQuantityToken(token.text).quantity !== undefined) quantityX.push(centerX(token));
      if (parseMoneyMinor(token.text) !== undefined) moneyX.push(centerX(token));
    }
  }
  if (quantityX.length < 3 || moneyX.length < 6) return undefined;
  const tolerance = Math.max(8, imageWidth * 0.025);
  const quantityClusters = clusterNumbers(quantityX, tolerance).filter((cluster) => cluster.values.length >= 2);
  const moneyClusters = clusterNumbers(moneyX, tolerance).filter((cluster) => cluster.values.length >= 3);
  if (!quantityClusters.length || moneyClusters.length < 2) return undefined;
  const moneyRight = [...moneyClusters].sort((a, b) => b.center - a.center);
  const value = moneyRight[0]!;
  const unitPrice = moneyRight.find((cluster) => cluster.center < value.center - tolerance);
  if (!unitPrice) return undefined;
  const quantity = [...quantityClusters].sort((a, b) => Math.abs(a.center - unitPrice.center) - Math.abs(b.center - unitPrice.center))
    .find((cluster) => cluster.center < unitPrice.center - tolerance * 0.25);
  if (!quantity) return undefined;
  return {
    source: 'numeric-clusters',
    confidence: clamp(Math.min(quantity.values.length / 5, unitPrice.values.length / 5, value.values.length / 5), 0.55, 0.9),
    anchors: { quantity: quantity.center, unitPrice: unitPrice.center, value: value.center },
  };
}

function isSectionBoundary(text: string): boolean {
  const value = normalize(text);
  return /\b(?:opusty lacznie|sprzedaz opodatkowana|suma ptu|suma vat|suma pln|razem|do zaplaty|rozliczenie platnosci|opakowania zwrotne)\b/u.test(value);
}

function isDiscountRow(text: string): boolean {
  const value = normalize(text);
  return /\b(?:opust|rabat|kupon|promocja|obnizka|discount)\b/u.test(value) && !/\blacznie\b/u.test(value);
}

function normalizedTaxMarker(value: string): string | undefined {
  const compact = value.trim().toLocaleUpperCase('pl-PL');
  const match = /^([A-G])\1?$/u.exec(compact);
  return match?.[1];
}

function isTaxMarker(value: string): boolean {
  return normalizedTaxMarker(value) !== undefined;
}

function structuredCells(row: ReceiptOcrRow, columns: ReceiptGeometryColumns): StructuredCells {
  const quantity = columns.anchors.quantity;
  const unitPrice = columns.anchors.unitPrice;
  const value = columns.anchors.value;
  if (quantity === undefined || unitPrice === undefined || value === undefined) {
    return { nameTokens: row.tokens, taxTokens: [], quantityTokens: [], unitPriceTokens: [], valueTokens: [] };
  }
  const tax = columns.anchors.tax;
  const quantityBoundary = (quantity + unitPrice) / 2;
  const priceBoundary = (unitPrice + value) / 2;
  const nameBoundary = tax !== undefined ? (tax + quantity) / 2 : quantity - Math.max(10, (unitPrice - quantity) * 0.55);
  const taxTolerance = tax === undefined ? 0 : Math.max(8, Math.min(quantity - tax, tax - (columns.anchors.name ?? 0)) * 0.42);
  const nameTokens: ReceiptOcrToken[] = [];
  const taxTokens: ReceiptOcrToken[] = [];
  const quantityTokens: ReceiptOcrToken[] = [];
  const unitPriceTokens: ReceiptOcrToken[] = [];
  const valueTokens: ReceiptOcrToken[] = [];
  for (const token of row.tokens) {
    const x = centerX(token);
    if (tax !== undefined && isTaxMarker(token.text) && Math.abs(x - tax) <= taxTolerance) {
      taxTokens.push(token);
    } else if (x < nameBoundary) {
      nameTokens.push(token);
    } else if (x < quantityBoundary) {
      quantityTokens.push(token);
    } else if (x < priceBoundary) {
      unitPriceTokens.push(token);
    } else {
      valueTokens.push(token);
    }
  }
  return { nameTokens, taxTokens, quantityTokens, unitPriceTokens, valueTokens };
}

function joinTokens(tokens: readonly ReceiptOcrToken[]): string {
  return tokens.map((token) => token.text.trim()).filter(Boolean).join(' ').replace(/\s+/gu, ' ').trim();
}

function taxMarkerFromCells(cells: StructuredCells, name: string): { name: string; taxMarker?: string } {
  const explicit = cells.taxTokens.map((token) => normalizedTaxMarker(token.text)).find((value): value is string => Boolean(value));
  if (explicit) return { name, taxMarker: explicit };
  const parts = name.split(/\s+/u);
  const tail = parts.at(-1) ?? '';
  if (!isTaxMarker(tail)) return { name };
  return { name: parts.slice(0, -1).join(' '), taxMarker: tail.toLocaleUpperCase('pl-PL') };
}

function productRowCandidate(row: ReceiptOcrRow, rowIndex: number, columns: ReceiptGeometryColumns, pendingName: string): GeometryReceiptItemCandidate | undefined {
  const cells = structuredCells(row, columns);
  let name = joinTokens(cells.nameTokens);
  const taxResolved = taxMarkerFromCells(cells, name);
  name = taxResolved.name;
  const hasName = /[\p{L}]{2}/u.test(name);
  const quantityText = joinTokens(cells.quantityTokens);
  const parsedQuantity = parseQuantityToken(quantityText);
  const explicitGross = exactMoneyFromTokens(cells.valueTokens);
  let unitPriceMinor = exactMoneyFromTokens(cells.unitPriceTokens);
  let quantity = recoverQuantityDecimalFromMath(parsedQuantity, unitPriceMinor, explicitGross === undefined ? undefined : Math.abs(explicitGross));
  const quantityWasRecovered = parsedQuantity.kind === 'ambiguous-digits' && quantity !== undefined;
  const quantityIsAmbiguous = parsedQuantity.kind === 'ambiguous-digits' && quantity === undefined;
  if (unitPriceMinor === undefined && quantity !== undefined && explicitGross !== undefined && explicitGross > 0) {
    const expectedUnit = Math.round(explicitGross / quantity);
    unitPriceMinor = recoverDigitsOnlyMoney(cells.unitPriceTokens, expectedUnit);
  }
  if (quantity === undefined && parsedQuantity.quantity !== undefined) quantity = parsedQuantity.quantity;
  const computedGross = quantity !== undefined && unitPriceMinor !== undefined ? quantityTimesUnitMinor(quantity, unitPriceMinor) : undefined;
  const explicitPositiveGross = explicitGross !== undefined && explicitGross > 0 ? explicitGross : undefined;
  const explicitNegativeMagnitude = explicitGross !== undefined && explicitGross < 0 ? Math.abs(explicitGross) : undefined;
  let grossBeforeDiscountMinor = explicitPositiveGross;
  const evidence: string[] = [];
  if (explicitPositiveGross !== undefined) evidence.push('value-column');
  if (quantity !== undefined) evidence.push('quantity-column');
  if (quantityWasRecovered) evidence.push('quantity-decimal-recovery');
  if (quantityIsAmbiguous) evidence.push('ambiguous-quantity');
  if (unitPriceMinor !== undefined) evidence.push('unit-price-column');
  if (columns.source === 'header') evidence.push('header-anchors');
  if (computedGross !== undefined) {
    if (grossBeforeDiscountMinor === undefined) {
      grossBeforeDiscountMinor = computedGross;
      evidence.push('quantity-unit-gross-recovery');
    } else if (Math.abs(grossBeforeDiscountMinor - computedGross) <= 1) {
      evidence.push('quantity-unit-gross-consensus');
    } else if (explicitNegativeMagnitude !== undefined && Math.abs(explicitNegativeMagnitude - computedGross) <= 1) {
      grossBeforeDiscountMinor = computedGross;
      evidence.push('ocr-dash-artifact-recovery');
    } else {
      evidence.push('quantity-unit-gross-conflict');
    }
  }
  const structured = quantity !== undefined || unitPriceMinor !== undefined || grossBeforeDiscountMinor !== undefined;
  if (!hasName && !pendingName && !structured) return undefined;
  if (!hasName && !pendingName) return undefined;
  name = [pendingName, name].filter(Boolean).join(' ').replace(/\s+/gu, ' ').trim();
  if (!/[\p{L}]{2}/u.test(name)) return undefined;
  const confidence = clamp(
    0.30
      + (grossBeforeDiscountMinor !== undefined ? 0.25 : 0)
      + (quantity !== undefined ? 0.12 : 0)
      + (unitPriceMinor !== undefined ? 0.12 : 0)
      + columns.confidence * 0.20
      + (evidence.includes('quantity-unit-gross-consensus') ? 0.08 : 0),
    0,
    1,
  );
  return {
    name,
    ...(taxResolved.taxMarker ? { taxMarker: taxResolved.taxMarker } : {}),
    ...(quantity === undefined ? {} : { quantity }),
    ...(unitPriceMinor === undefined ? {} : { unitPriceMinor }),
    ...(grossBeforeDiscountMinor === undefined ? {} : { grossBeforeDiscountMinor }),
    ...(grossBeforeDiscountMinor === undefined ? {} : { finalAmountMinor: grossBeforeDiscountMinor }),
    page: row.page,
    rowIndex,
    sourceRowIndices: [rowIndex],
    confidence,
    evidence,
    ...(quantityIsAmbiguous
      ? { unresolvedReason: 'quantity-unresolved' as const }
      : grossBeforeDiscountMinor === undefined
        ? { unresolvedReason: 'missing-gross' as const }
        : {}),
  };
}

function standalonePositiveValue(row: ReceiptOcrRow, columns: ReceiptGeometryColumns): number | undefined {
  const cells = structuredCells(row, columns);
  const name = joinTokens(cells.nameTokens);
  const quantity = joinTokens(cells.quantityTokens);
  const unit = joinTokens(cells.unitPriceTokens);
  if (/[\p{L}]{2}/u.test(name) || parseQuantityToken(quantity).quantity !== undefined || exactMoneyFromTokens(cells.unitPriceTokens) !== undefined) return undefined;
  const value = exactMoneyFromTokens(cells.valueTokens) ?? (row.tokens.length <= 2 ? exactMoneyFromTokens(row.tokens) : undefined);
  return value !== undefined && value > 0 ? value : undefined;
}

function discountAmounts(row: ReceiptOcrRow, columns: ReceiptGeometryColumns): { negative?: number; positiveMagnitude?: number } {
  const cells = structuredCells(row, columns);
  const candidates = [exactMoneyFromTokens(cells.valueTokens), exactMoneyFromTokens(row.tokens)].filter((value): value is number => value !== undefined);
  const negative = candidates.find((value) => value < 0);
  if (negative !== undefined) return { negative };
  const positive = candidates.find((value) => value > 0);
  return positive === undefined ? {} : { positiveMagnitude: positive };
}

function finalizeWorkingGroup(group: GeometryItemWorkingGroup): GeometryReceiptItemCandidate {
  const item = { ...group.item, evidence: [...group.item.evidence], sourceRowIndices: [...group.item.sourceRowIndices] };
  const gross = item.grossBeforeDiscountMinor;
  if (!group.hasDiscountSemantic) {
    if (gross !== undefined) item.finalAmountMinor = gross;
    return item;
  }

  // A local discount marker changes the item from "gross is final" to an
  // unresolved discount group until local monetary evidence proves the net.
  // Receipt-level discount totals are intentionally never consulted here.
  delete item.finalAmountMinor;
  delete item.discountMinor;
  let discount = group.explicitDiscountMinor < 0 ? group.explicitDiscountMinor : undefined;
  const net = group.netConfirmationMinor;
  if (gross !== undefined && net !== undefined && net > 0 && net <= gross) {
    const implied = net - gross;
    if (discount === undefined || Math.abs((gross + discount) - net) > 1) {
      if (implied < 0) {
        discount = implied;
        item.evidence.push('discount-from-net-confirmation');
      }
    } else {
      item.evidence.push('discount-net-consensus');
    }
    item.finalAmountMinor = net;
    item.evidence.push('net-confirmation');
  } else if (gross !== undefined && discount !== undefined && gross + discount > 0) {
    item.finalAmountMinor = gross + discount;
    item.evidence.push('gross-discount-net');
  } else if (gross !== undefined && group.positiveDiscountMagnitudes.length) {
    const totalMagnitude = group.positiveDiscountMagnitudes.reduce((sum, value) => sum + value, 0);
    if (net !== undefined && Math.abs((gross - totalMagnitude) - net) <= 1) {
      discount = -totalMagnitude;
      item.finalAmountMinor = net;
      item.evidence.push('unsigned-discount-math-recovery');
    }
  }
  if (discount !== undefined && discount < 0) item.discountMinor = discount;
  if (item.finalAmountMinor === undefined) item.unresolvedReason = 'discount-unresolved';
  else delete item.unresolvedReason;
  return item;
}

export function reconstructReceiptItemsFromGeometry(
  rows: readonly ReceiptOcrRow[],
  columns: ReceiptGeometryColumns | undefined,
): {
  items: GeometryReceiptItemCandidate[];
  rejectedRows: Array<{ page: number; rowIndex: number; text: string; reason: string }>;
  itemSectionStartRowIndex?: number;
  itemSectionEndRowIndex?: number;
} {
  if (!columns) return { items: [], rejectedRows: [] };
  const startIndex = columns.headerRowIndex === undefined ? 0 : columns.headerRowIndex + 1;
  const items: GeometryReceiptItemCandidate[] = [];
  const rejectedRows: Array<{ page: number; rowIndex: number; text: string; reason: string }> = [];
  let pendingName = '';
  let activePage = rows[startIndex]?.page;
  let active: GeometryItemWorkingGroup | undefined;
  let endIndex: number | undefined;

  const flushActive = (): void => {
    if (!active) return;
    const finalized = finalizeWorkingGroup(active);
    items.push(finalized);
    active = undefined;
  };

  for (let rowIndex = startIndex; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]!;
    if (activePage !== undefined && row.page !== activePage) {
      flushActive();
      pendingName = '';
    }
    activePage = row.page;
    if (isSectionBoundary(row.text)) {
      flushActive();
      endIndex = rowIndex;
      break;
    }

    if (isDiscountRow(row.text)) {
      if (!active) {
        rejectedRows.push({ page: row.page, rowIndex, text: row.text, reason: 'discount-without-product' });
        pendingName = '';
        continue;
      }
      active.hasDiscountSemantic = true;
      active.item.sourceRowIndices.push(rowIndex);
      const amounts = discountAmounts(row, columns);
      if (amounts.negative !== undefined) active.explicitDiscountMinor += amounts.negative;
      if (amounts.positiveMagnitude !== undefined) active.positiveDiscountMagnitudes.push(amounts.positiveMagnitude);
      active.item.evidence.push('discount-row');
      pendingName = '';
      continue;
    }

    if (active?.hasDiscountSemantic) {
      const confirmation = standalonePositiveValue(row, columns);
      if (confirmation !== undefined) {
        active.netConfirmationMinor = confirmation;
        active.item.sourceRowIndices.push(rowIndex);
        active.item.evidence.push('standalone-net-row');
        continue;
      }
    }

    const cells = structuredCells(row, columns);
    const rawName = joinTokens(cells.nameTokens);
    const hasName = /[\p{L}]{2}/u.test(rawName);
    const parsedRowQuantity = parseQuantityToken(joinTokens(cells.quantityTokens));
    const hasQuantity = parsedRowQuantity.quantity !== undefined || parsedRowQuantity.kind === 'ambiguous-digits';
    const hasUnitPrice = exactMoneyFromTokens(cells.unitPriceTokens) !== undefined;
    const hasValue = exactMoneyFromTokens(cells.valueTokens) !== undefined;
    const hasStructuredEvidence = hasQuantity || hasUnitPrice || hasValue;

    if (hasName && !hasStructuredEvidence) {
      if (active) flushActive();
      pendingName = pendingName ? `${pendingName} ${rawName}` : rawName;
      continue;
    }
    if (!hasName && !hasStructuredEvidence) continue;

    const candidate = productRowCandidate(row, rowIndex, columns, pendingName);
    if (!candidate) {
      if (hasStructuredEvidence) rejectedRows.push({ page: row.page, rowIndex, text: row.text, reason: 'unresolved-product-row' });
      pendingName = '';
      continue;
    }
    flushActive();
    active = {
      item: candidate,
      hasDiscountSemantic: false,
      explicitDiscountMinor: 0,
      positiveDiscountMagnitudes: [],
    };
    pendingName = '';
  }
  flushActive();

  for (const item of items) {
    if (item.finalAmountMinor === undefined) {
      rejectedRows.push({ page: item.page, rowIndex: item.rowIndex, text: item.name, reason: item.unresolvedReason ?? 'missing-final-item-value' });
    }
  }

  return {
    items,
    rejectedRows,
    itemSectionStartRowIndex: startIndex,
    ...(endIndex === undefined ? {} : { itemSectionEndRowIndex: endIndex }),
  };
}

function formatMoneyMinor(value: number): string {
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  return `${sign}${Math.floor(absolute / 100)},${String(absolute % 100).padStart(2, '0')}`;
}

function formatQuantity(quantity: number): string {
  if (Number.isInteger(quantity)) return `${quantity}x`;
  const text = quantity.toFixed(3).replace(/0+$/u, '').replace(/\.$/u, '').replace('.', ',');
  return `${text}x`;
}

function canonicalItemLines(item: GeometryReceiptItemCandidate): string[] {
  const gross = item.grossBeforeDiscountMinor;
  if (gross === undefined) return [];
  const parts = [item.name];
  if (item.taxMarker) parts.push(item.taxMarker);
  if (item.quantity !== undefined) parts.push(formatQuantity(item.quantity));
  if (item.unitPriceMinor !== undefined) parts.push(formatMoneyMinor(item.unitPriceMinor));
  parts.push(formatMoneyMinor(gross));
  const lines = [parts.join(' ')];
  if (item.discountMinor !== undefined && item.discountMinor < 0) {
    lines.push(`Opust ${formatMoneyMinor(item.discountMinor)}`);
    if (item.finalAmountMinor !== undefined) lines.push(formatMoneyMinor(item.finalAmountMinor));
  }
  return lines;
}

function buildCanonicalGeometryText(
  rows: readonly ReceiptOcrRow[],
  items: readonly GeometryReceiptItemCandidate[],
  startIndex: number | undefined,
  endIndex: number | undefined,
): { text: string; applied: boolean } {
  if (startIndex === undefined || !items.length) return { text: rows.map((row) => row.text).filter(Boolean).join('\n'), applied: false };
  const usableItems = items.filter((item) => item.grossBeforeDiscountMinor !== undefined && item.finalAmountMinor !== undefined);
  if (!usableItems.length) return { text: rows.map((row) => row.text).filter(Boolean).join('\n'), applied: false };
  const before = rows.slice(0, startIndex).map((row) => row.text).filter(Boolean);
  const headerIndex = Math.max(0, startIndex - 1);
  const header = rows[headerIndex]?.text;
  if (header && before.at(-1) !== header) before.push(header);
  const itemLines = usableItems.flatMap(canonicalItemLines);
  const after = rows.slice(endIndex ?? rows.length).map((row) => row.text).filter(Boolean);
  return { text: [...before, ...itemLines, ...after].join('\n'), applied: true };
}

export function reconstructReceiptTextFromGeometry(geometry: ReceiptOcrGeometry): ReceiptGeometryReconstructionResult {
  const validation = validateReceiptOcrGeometry(geometry);
  const medianTokenHeight = calculateReceiptMedianTokenHeight(validation.valid);
  const rows = clusterReceiptTokensIntoRows(validation.valid);
  const columns = inferReceiptColumns(rows, geometry.imageWidth);
  const itemResult = reconstructReceiptItemsFromGeometry(rows, columns);
  const rowMajorText = rows.map((row) => row.text).filter(Boolean).join('\n');
  const canonical = buildCanonicalGeometryText(rows, itemResult.items, itemResult.itemSectionStartRowIndex, itemResult.itemSectionEndRowIndex);
  const completeItems = itemResult.items.filter((item) => item.finalAmountMinor !== undefined);
  const grossItemsTotalMinor = itemResult.items.reduce((sum, item) => sum + (item.grossBeforeDiscountMinor ?? 0), 0);
  const discountsTotalMinor = itemResult.items.reduce((sum, item) => sum + (item.discountMinor ?? 0), 0);
  const itemsTotalMinor = completeItems.reduce((sum, item) => sum + (item.finalAmountMinor ?? 0), 0);
  return {
    applied: rows.length > 0 && validation.valid.length >= 3,
    text: canonical.text,
    rowMajorText,
    structuredTextGenerated: canonical.applied,
    rows,
    ...(columns ? { columns } : {}),
    items: itemResult.items,
    rejectedRows: itemResult.rejectedRows,
    medianTokenHeight,
    validTokenCount: validation.valid.length,
    invalidTokenCount: validation.invalid.length,
    completeItemCount: completeItems.length,
    grossItemsTotalMinor,
    discountsTotalMinor,
    itemsTotalMinor,
    ...(itemResult.itemSectionStartRowIndex === undefined ? {} : { itemSectionStartRowIndex: itemResult.itemSectionStartRowIndex }),
    ...(itemResult.itemSectionEndRowIndex === undefined ? {} : { itemSectionEndRowIndex: itemResult.itemSectionEndRowIndex }),
  };
}

function resolvedDeclaredGoodsSubtotal(parsed: ReceiptGeometryParsedFinancialSummary): number | undefined {
  // 'items-only' is a parser-derived convenience value, not independent receipt evidence.
  // Feeding it back into candidate safety would let a geometry candidate validate itself.
  if (
    parsed.declaredSubtotalMinor !== undefined
    && parsed.declaredSubtotalMinor > 0
    && parsed.subtotalResolution !== 'items-only'
  ) return parsed.declaredSubtotalMinor;
  const final = parsed.finalPayableMinor ?? parsed.declaredTotalMinor;
  if (final === undefined || final <= 0) return undefined;
  const deposit = parsed.depositTotalMinor ?? 0;
  const goods = final - deposit;
  return goods > 0 ? goods : undefined;
}

export function assessReceiptGeometryStructuredCandidate(
  reconstruction: ReceiptGeometryReconstructionResult,
  parsed: ReceiptGeometryParsedFinancialSummary,
): ReceiptGeometryStructuredCandidateAssessment {
  const rejectionReasons: ReceiptGeometryCandidateRejectionReason[] = [];
  const generated = reconstruction.structuredTextGenerated;
  const completenessRatio = reconstruction.items.length
    ? reconstruction.completeItemCount / reconstruction.items.length
    : 0;
  const declaredGoodsSubtotalMinor = resolvedDeclaredGoodsSubtotal(parsed);
  const candidateItemsTotalMinor = parsed.detectedItemsTotalMinor;

  if (!generated) rejectionReasons.push('not-generated');
  if (reconstruction.items.some((item) => item.unresolvedReason === 'quantity-unresolved')) {
    rejectionReasons.push('ambiguous-quantity');
  }
  // A geometry candidate should not replace uncertainty with apparent completeness.
  // This threshold is deliberately conservative and only gates the experimental
  // structured candidate; it never changes individual item values.
  if (reconstruction.items.length > 0 && completenessRatio < 0.75) {
    rejectionReasons.push('low-completeness');
  }
  if (declaredGoodsSubtotalMinor !== undefined && candidateItemsTotalMinor !== undefined) {
    const largestItem = parsed.items.reduce((max, item) => Math.max(max, Math.abs(item.amountMinor ?? 0)), 0);
    if (largestItem > declaredGoodsSubtotalMinor * 4) rejectionReasons.push('item-outlier');
    const relativeDifference = Math.abs(candidateItemsTotalMinor - declaredGoodsSubtotalMinor) / declaredGoodsSubtotalMinor;
    if (relativeDifference > 0.35) rejectionReasons.push('goods-mismatch');
  }

  return {
    generated,
    accepted: rejectionReasons.length === 0,
    rejectionReasons: [...new Set(rejectionReasons)],
    completenessRatio,
    ...(declaredGoodsSubtotalMinor === undefined ? {} : { declaredGoodsSubtotalMinor }),
    ...(candidateItemsTotalMinor === undefined ? {} : { candidateItemsTotalMinor }),
  };
}

