import type {
  OcrRecognitionResult,
  ParsedReceiptDraft,
  ReceiptOcrGeometry,
  ReceiptOcrToken,
} from './receipt-ocr.types';
import type {
  ReceiptGeometryReconstructionResult,
  ReceiptGeometryStructuredCandidateAssessment,
} from './receipt-geometry-reconstruction';
import { reconstructReceiptTextFromGeometry } from './receipt-geometry-reconstruction';
import { applySelectedReceiptGeometryItems, preservesReceiptPrimaryMetadata } from './receipt-geometry-production-selector';

export const MAX_RECEIPT_LOCAL_NUMERIC_VERIFICATION_CELLS = 2;
export const MIN_RECEIPT_LOCAL_NUMERIC_VERIFICATION_CONFIDENCE = 65;
export const MIN_RECEIPT_LOCAL_NUMERIC_CONFIDENCE_GAIN = 8;

export type ReceiptLocalNumericVerificationSkipReason =
  | 'production-path-selected'
  | 'recovery-already-used'
  | 'geometry-source'
  | 'structured-candidate-rejected'
  | 'columns-missing'
  | 'column-confidence'
  | 'reconstruction-incomplete'
  | 'structure-not-competitive'
  | 'independent-goods-total-missing'
  | 'financially-consistent'
  | 'source-row-reuse'
  | 'no-localized-suspect'
  | 'too-many-suspects';

export interface ReceiptLocalNumericVerificationCrop {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ReceiptLocalNumericVerificationCellPlan {
  id: string;
  page: number;
  itemIndex: number;
  itemName: string;
  rowIndex: number;
  role: 'value';
  primaryRaw: string;
  primaryMinor: number;
  primaryConfidence: number;
  tokenBbox: { x0: number; y0: number; x1: number; y1: number };
  crop: ReceiptLocalNumericVerificationCrop;
  pixelCount: number;
}

export interface ReceiptLocalNumericVerificationPlan {
  eligible: boolean;
  reason?: ReceiptLocalNumericVerificationSkipReason;
  independentGoodsTotalMinor?: number;
  beforeItemsTotalMinor: number;
  beforeDifferenceMinor?: number;
  suspectCellCount: number;
  cells: ReceiptLocalNumericVerificationCellPlan[];
}

export interface ReceiptLocalNumericCandidate {
  raw: string;
  minor: number;
  confidence: number;
  ambiguous: boolean;
}

export interface ReceiptLocalNumericVerificationEvidence {
  cellId: string;
  rawText: string;
  recognitionConfidence?: number;
  candidate?: ReceiptLocalNumericCandidate;
}

export type ReceiptLocalNumericVerificationCellDecision =
  | 'accepted-shadow'
  | 'no-candidate'
  | 'ambiguous-candidate'
  | 'same-as-primary'
  | 'local-evidence-not-stronger'
  | 'replacement-token-missing'
  | 'reconstruction-regressed'
  | 'financial-mismatch-not-improved';

export interface ReceiptLocalNumericVerificationCellResult {
  id: string;
  page: number;
  itemName: string;
  role: 'value';
  primaryRaw: string;
  primaryMinor: number;
  primaryConfidence: number;
  crop: ReceiptLocalNumericVerificationCrop;
  localRaw?: string;
  localMinor?: number;
  localConfidence?: number;
  decision: ReceiptLocalNumericVerificationCellDecision;
  shadowAccepted: boolean;
}

export interface ReceiptLocalNumericVerificationShadowResult {
  experiment: true;
  triggered: boolean;
  reason: string;
  suspectCellCount: number;
  passBudget: number;
  cells: ReceiptLocalNumericVerificationCellResult[];
  before: {
    itemsTotalMinor: number;
    independentGoodsTotalMinor?: number;
    differenceMinor?: number;
    financiallyConsistent: boolean;
  };
  afterShadow: {
    itemsTotalMinor: number;
    independentGoodsTotalMinor?: number;
    differenceMinor?: number;
    financiallyConsistent: boolean;
  };
  acceptedReplacementCount: number;
  productionApplied: false;
  shadowGeometry?: ReceiptOcrGeometry;
  shadowReconstruction?: ReceiptGeometryReconstructionResult;
}

export interface PlanReceiptLocalNumericVerificationInput {
  geometry: ReceiptOcrGeometry;
  reconstruction: ReceiptGeometryReconstructionResult;
  geometryCandidate: ParsedReceiptDraft;
  structuredAssessment: ReceiptGeometryStructuredCandidateAssessment | undefined;
  primaryItemCount: number;
  productionDecision: 'SELECT_RECOVERY' | 'SELECT_STRUCTURED_GEOMETRY' | 'KEEP_PRIMARY';
  recoveryAttempted: boolean;
  recoveryUsed: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function tokenCenterX(token: ReceiptOcrToken): number {
  return (token.bbox.x0 + token.bbox.x1) / 2;
}

function parsePositiveMoneyMinor(raw: string): number | undefined {
  const compact = raw.trim().replace(/\s+/gu, '');
  const match = /^(\d{1,6})[,.](\d{2})$/u.exec(compact);
  if (!match?.[1] || !match[2]) return undefined;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const value = major * 100 + minor;
  return Number.isSafeInteger(value) && value > 0 && value <= 10_000_000 ? value : undefined;
}

function sourceRowsAreUnique(reconstruction: ReceiptGeometryReconstructionResult): boolean {
  const owned = new Set<string>();
  for (const item of reconstruction.items) {
    for (const rowIndex of new Set(item.sourceRowIndices)) {
      const key = `${item.page}:${rowIndex}`;
      if (owned.has(key)) return false;
      owned.add(key);
    }
  }
  return true;
}

function independentGoodsTotal(parsed: ParsedReceiptDraft): number | undefined {
  // Deliberately prefer a separately OCR'd goods subtotal. Do not use detectedItemsTotalMinor
  // or an items-only subtotal because that would let the candidate self-validate.
  if (parsed.ocrSubtotalMinor !== undefined && Number.isSafeInteger(parsed.ocrSubtotalMinor) && parsed.ocrSubtotalMinor > 0) {
    return parsed.ocrSubtotalMinor;
  }
  if (parsed.finalPayableMinor !== undefined
    && parsed.depositTotalMinor !== undefined
    && Number.isSafeInteger(parsed.finalPayableMinor)
    && Number.isSafeInteger(parsed.depositTotalMinor)
    && parsed.finalPayableMinor > parsed.depositTotalMinor) {
    return parsed.finalPayableMinor - parsed.depositTotalMinor;
  }
  return undefined;
}

function valueTokenForItem(
  geometry: ReceiptOcrGeometry,
  reconstruction: ReceiptGeometryReconstructionResult,
  itemIndex: number,
): ReceiptOcrToken | undefined {
  const item = reconstruction.items[itemIndex];
  const valueAnchor = reconstruction.columns?.anchors.value;
  if (!item || valueAnchor === undefined) return undefined;
  const row = reconstruction.rows[item.rowIndex];
  if (!row || row.page !== item.page) return undefined;
  const unitPriceAnchor = reconstruction.columns?.anchors.unitPrice;
  const anchorGap = unitPriceAnchor === undefined
    ? Math.max(80, reconstruction.medianTokenHeight * 5)
    : Math.abs(valueAnchor - unitPriceAnchor);
  const maxDistance = Math.max(reconstruction.medianTokenHeight * 2.8, anchorGap * 0.42);
  return row.tokens
    .filter((token) => token.page === item.page && parsePositiveMoneyMinor(token.text) !== undefined)
    .map((token) => ({ token, distance: Math.abs(tokenCenterX(token) - valueAnchor) }))
    .filter((entry) => entry.distance <= maxDistance)
    .sort((left, right) => left.distance - right.distance
      || (right.token.confidence ?? 0) - (left.token.confidence ?? 0))[0]?.token;
}

function buildCellCrop(
  geometry: ReceiptOcrGeometry,
  reconstruction: ReceiptGeometryReconstructionResult,
  token: ReceiptOcrToken,
  itemIndex: number,
): ReceiptLocalNumericVerificationCrop {
  const item = reconstruction.items[itemIndex]!;
  const medianHeight = Math.max(12, reconstruction.medianTokenHeight || (token.bbox.y1 - token.bbox.y0));
  const horizontalPadding = Math.max(12, Math.round(medianHeight * 0.85));
  const verticalPadding = Math.max(8, Math.round(medianHeight * 0.65));
  const boundary = reconstruction.itemSectionEndRowIndex === undefined
    ? undefined
    : reconstruction.rows[reconstruction.itemSectionEndRowIndex];
  const bottomLimit = boundary && boundary.page === item.page
    ? Math.max(token.bbox.y1 + 1, boundary.bbox.y0 - Math.round(medianHeight * 0.2))
    : geometry.imageHeight;
  return {
    x0: Math.floor(clamp(token.bbox.x0 - horizontalPadding, 0, geometry.imageWidth - 1)),
    y0: Math.floor(clamp(token.bbox.y0 - verticalPadding, 0, geometry.imageHeight - 1)),
    x1: Math.ceil(clamp(token.bbox.x1 + horizontalPadding, token.bbox.x0 + 1, geometry.imageWidth)),
    y1: Math.ceil(clamp(token.bbox.y1 + verticalPadding, token.bbox.y0 + 1, bottomLimit)),
  };
}

function skipped(
  reason: ReceiptLocalNumericVerificationSkipReason,
  reconstruction: ReceiptGeometryReconstructionResult,
  independentGoodsTotalMinor?: number,
): ReceiptLocalNumericVerificationPlan {
  return {
    eligible: false,
    reason,
    ...(independentGoodsTotalMinor === undefined ? {} : { independentGoodsTotalMinor }),
    beforeItemsTotalMinor: reconstruction.itemsTotalMinor,
    ...(independentGoodsTotalMinor === undefined ? {} : { beforeDifferenceMinor: reconstruction.itemsTotalMinor - independentGoodsTotalMinor }),
    suspectCellCount: 0,
    cells: [],
  };
}

export function planReceiptLocalNumericVerification(
  input: PlanReceiptLocalNumericVerificationInput,
): ReceiptLocalNumericVerificationPlan {
  const { geometry, reconstruction, geometryCandidate, structuredAssessment } = input;
  if (input.productionDecision !== 'KEEP_PRIMARY') return skipped('production-path-selected', reconstruction);
  if (input.recoveryAttempted || input.recoveryUsed) return skipped('recovery-already-used', reconstruction);
  if (geometry.source !== 'primary' && geometry.source !== 'snapshot') return skipped('geometry-source', reconstruction);
  if (!structuredAssessment?.accepted) return skipped('structured-candidate-rejected', reconstruction);
  const columns = reconstruction.columns;
  if (!columns?.anchors.value) return skipped('columns-missing', reconstruction);
  if (columns.confidence < 0.72) return skipped('column-confidence', reconstruction);
  if (!reconstruction.items.length
    || reconstruction.completeItemCount !== reconstruction.items.length
    || reconstruction.items.some((item) => item.finalAmountMinor === undefined || item.unresolvedReason !== undefined)) {
    return skipped('reconstruction-incomplete', reconstruction);
  }
  if (geometryCandidate.items.length < input.primaryItemCount) return skipped('structure-not-competitive', reconstruction);
  if (!sourceRowsAreUnique(reconstruction)) return skipped('source-row-reuse', reconstruction);

  const independentGoodsTotalMinor = independentGoodsTotal(geometryCandidate);
  if (independentGoodsTotalMinor === undefined) return skipped('independent-goods-total-missing', reconstruction);
  const beforeDifferenceMinor = reconstruction.itemsTotalMinor - independentGoodsTotalMinor;
  if (Math.abs(beforeDifferenceMinor) <= 1) return skipped('financially-consistent', reconstruction, independentGoodsTotalMinor);

  const cells: ReceiptLocalNumericVerificationCellPlan[] = [];
  reconstruction.items.forEach((item, itemIndex) => {
    const token = valueTokenForItem(geometry, reconstruction, itemIndex);
    if (!token) return;
    const primaryMinor = parsePositiveMoneyMinor(token.text);
    if (primaryMinor === undefined) return;
    const confidence = token.confidence ?? 0;
    const localizableConflict = item.evidence.includes('quantity-unit-gross-conflict');
    if (confidence > 80 && !(localizableConflict && confidence <= 90)) return;
    const crop = buildCellCrop(geometry, reconstruction, token, itemIndex);
    const width = crop.x1 - crop.x0;
    const height = crop.y1 - crop.y0;
    if (width <= 0 || height <= 0) return;
    cells.push({
      id: `${item.page}:${item.rowIndex}:value`,
      page: item.page,
      itemIndex,
      itemName: item.name,
      rowIndex: item.rowIndex,
      role: 'value',
      primaryRaw: token.text,
      primaryMinor,
      primaryConfidence: confidence,
      tokenBbox: { ...token.bbox },
      crop,
      pixelCount: width * height,
    });
  });

  cells.sort((left, right) => left.primaryConfidence - right.primaryConfidence
    || left.page - right.page
    || left.rowIndex - right.rowIndex);
  if (!cells.length) return skipped('no-localized-suspect', reconstruction, independentGoodsTotalMinor);
  if (cells.length > MAX_RECEIPT_LOCAL_NUMERIC_VERIFICATION_CELLS) {
    return {
      eligible: false,
      reason: 'too-many-suspects',
      independentGoodsTotalMinor,
      beforeItemsTotalMinor: reconstruction.itemsTotalMinor,
      beforeDifferenceMinor,
      suspectCellCount: cells.length,
      cells: [],
    };
  }
  return {
    eligible: true,
    independentGoodsTotalMinor,
    beforeItemsTotalMinor: reconstruction.itemsTotalMinor,
    beforeDifferenceMinor,
    suspectCellCount: cells.length,
    cells,
  };
}

export function extractReceiptLocalNumericCandidate(result: OcrRecognitionResult): ReceiptLocalNumericCandidate | undefined {
  const rawCandidates: Array<{ raw: string; minor: number; confidence: number }> = [];
  for (const token of result.geometry?.tokens ?? []) {
    const minor = parsePositiveMoneyMinor(token.text);
    if (minor === undefined) continue;
    rawCandidates.push({ raw: token.text, minor, confidence: token.confidence ?? result.confidence ?? 0 });
  }
  if (!rawCandidates.length) {
    for (const match of result.text.matchAll(/\b\d{1,6}[,.]\d{2}\b/gu)) {
      const raw = match[0] ?? '';
      const minor = parsePositiveMoneyMinor(raw);
      if (minor !== undefined) rawCandidates.push({ raw, minor, confidence: result.confidence ?? 0 });
    }
  }
  if (!rawCandidates.length) return undefined;

  const bestByMinor = new Map<number, { raw: string; minor: number; confidence: number }>();
  for (const candidate of rawCandidates) {
    const current = bestByMinor.get(candidate.minor);
    if (!current || candidate.confidence > current.confidence) bestByMinor.set(candidate.minor, candidate);
  }
  const ranked = [...bestByMinor.values()].sort((left, right) => right.confidence - left.confidence || left.minor - right.minor);
  const best = ranked[0];
  if (!best) return undefined;
  const runnerUp = ranked[1];
  const ambiguous = Boolean(runnerUp && best.confidence - runnerUp.confidence < 10);
  return { ...best, ambiguous };
}

function sameToken(token: ReceiptOcrToken, cell: ReceiptLocalNumericVerificationCellPlan): boolean {
  return token.page === cell.page
    && token.text === cell.primaryRaw
    && token.bbox.x0 === cell.tokenBbox.x0
    && token.bbox.y0 === cell.tokenBbox.y0
    && token.bbox.x1 === cell.tokenBbox.x1
    && token.bbox.y1 === cell.tokenBbox.y1;
}

function replaceCellToken(
  geometry: ReceiptOcrGeometry,
  cell: ReceiptLocalNumericVerificationCellPlan,
  candidate: ReceiptLocalNumericCandidate,
): ReceiptOcrGeometry | undefined {
  let replaced = false;
  const tokens = geometry.tokens.map((token) => {
    if (replaced || !sameToken(token, cell)) return token;
    replaced = true;
    return { ...token, text: candidate.raw, confidence: candidate.confidence };
  });
  return replaced ? { ...geometry, tokens } : undefined;
}

export function evaluateReceiptLocalNumericVerificationShadow(
  geometry: ReceiptOcrGeometry,
  reconstruction: ReceiptGeometryReconstructionResult,
  plan: ReceiptLocalNumericVerificationPlan,
  evidence: readonly ReceiptLocalNumericVerificationEvidence[],
): ReceiptLocalNumericVerificationShadowResult {
  const independent = plan.independentGoodsTotalMinor;
  const beforeDifference = independent === undefined ? undefined : reconstruction.itemsTotalMinor - independent;
  const base = {
    experiment: true as const,
    triggered: plan.eligible,
    reason: plan.eligible ? 'financial-mismatch-with-localized-suspects' : plan.reason ?? 'not-eligible',
    suspectCellCount: plan.suspectCellCount,
    passBudget: MAX_RECEIPT_LOCAL_NUMERIC_VERIFICATION_CELLS,
    before: {
      itemsTotalMinor: reconstruction.itemsTotalMinor,
      ...(independent === undefined ? {} : { independentGoodsTotalMinor: independent }),
      ...(beforeDifference === undefined ? {} : { differenceMinor: beforeDifference }),
      financiallyConsistent: beforeDifference !== undefined && Math.abs(beforeDifference) <= 1,
    },
    productionApplied: false as const,
  };
  if (!plan.eligible || independent === undefined) {
    return {
      ...base,
      cells: [],
      afterShadow: { ...base.before },
      acceptedReplacementCount: 0,
    };
  }

  let currentGeometry = geometry;
  let currentReconstruction = reconstruction;
  let currentDifferenceAbs = Math.abs(reconstruction.itemsTotalMinor - independent);
  const results: ReceiptLocalNumericVerificationCellResult[] = [];

  for (const cell of plan.cells) {
    const local = evidence.find((entry) => entry.cellId === cell.id);
    const candidate = local?.candidate;
    let decision: ReceiptLocalNumericVerificationCellDecision = 'no-candidate';
    let accepted = false;

    if (candidate?.ambiguous) decision = 'ambiguous-candidate';
    else if (candidate && candidate.minor === cell.primaryMinor) decision = 'same-as-primary';
    else if (candidate && (candidate.confidence < MIN_RECEIPT_LOCAL_NUMERIC_VERIFICATION_CONFIDENCE
      || candidate.confidence < cell.primaryConfidence + MIN_RECEIPT_LOCAL_NUMERIC_CONFIDENCE_GAIN)) {
      decision = 'local-evidence-not-stronger';
    } else if (candidate) {
      const proposedGeometry = replaceCellToken(currentGeometry, cell, candidate);
      if (!proposedGeometry) decision = 'replacement-token-missing';
      else {
        const proposed = reconstructReceiptTextFromGeometry(proposedGeometry);
        const structuralRegression = proposed.items.length !== currentReconstruction.items.length
          || proposed.completeItemCount !== currentReconstruction.completeItemCount
          || proposed.items.some((item) => item.finalAmountMinor === undefined || item.unresolvedReason !== undefined);
        if (structuralRegression) decision = 'reconstruction-regressed';
        else {
          const proposedDifferenceAbs = Math.abs(proposed.itemsTotalMinor - independent);
          if (proposedDifferenceAbs >= currentDifferenceAbs) decision = 'financial-mismatch-not-improved';
          else {
            decision = 'accepted-shadow';
            accepted = true;
            currentGeometry = proposedGeometry;
            currentReconstruction = proposed;
            currentDifferenceAbs = proposedDifferenceAbs;
          }
        }
      }
    }

    results.push({
      id: cell.id,
      page: cell.page,
      itemName: cell.itemName,
      role: cell.role,
      primaryRaw: cell.primaryRaw,
      primaryMinor: cell.primaryMinor,
      primaryConfidence: cell.primaryConfidence,
      crop: { ...cell.crop },
      ...(candidate ? {
        localRaw: candidate.raw,
        localMinor: candidate.minor,
        localConfidence: candidate.confidence,
      } : {}),
      decision,
      shadowAccepted: accepted,
    });
  }

  const afterDifference = currentReconstruction.itemsTotalMinor - independent;
  return {
    ...base,
    cells: results,
    afterShadow: {
      itemsTotalMinor: currentReconstruction.itemsTotalMinor,
      independentGoodsTotalMinor: independent,
      differenceMinor: afterDifference,
      financiallyConsistent: Math.abs(afterDifference) <= 1,
    },
    acceptedReplacementCount: results.filter((entry) => entry.shadowAccepted).length,
    shadowGeometry: currentGeometry,
    shadowReconstruction: currentReconstruction,
  };
}


export type ReceiptLocalNumericVerificationProductionReason =
  | 'applied'
  | 'not-triggered'
  | 'production-path-selected'
  | 'pass-count-unsafe'
  | 'partial-replacement'
  | 'shadow-financial-mismatch'
  | 'shadow-reconstruction-missing'
  | 'shadow-reconstruction-regressed'
  | 'shadow-source-row-reuse'
  | 'shadow-item-ownership-regression'
  | 'shadow-candidate-missing'
  | 'footer-evidence-regression'
  | 'full-financial-evidence-missing'
  | 'full-financial-mismatch'
  | 'primary-metadata-regression'
  | 'merge-failed';

export interface PromoteReceiptLocalNumericVerificationInput {
  primary: ParsedReceiptDraft;
  preShadowCandidate: ParsedReceiptDraft;
  originalReconstruction: ReceiptGeometryReconstructionResult;
  shadowCandidate: ParsedReceiptDraft | undefined;
  plan: ReceiptLocalNumericVerificationPlan;
  shadow: ReceiptLocalNumericVerificationShadowResult;
  passCount: number;
  productionDecision: 'SELECT_RECOVERY' | 'SELECT_STRUCTURED_GEOMETRY' | 'KEEP_PRIMARY';
}

export interface ReceiptLocalNumericVerificationProductionResult {
  productionApplied: boolean;
  reason: ReceiptLocalNumericVerificationProductionReason;
  parsed?: ParsedReceiptDraft;
  verifiedItemsTotalMinor?: number;
  depositTotalMinor?: number;
  finalPayableMinor?: number;
  paymentTotalMinor?: number;
  unexplainedDifferenceMinor?: number;
}

function sameOptionalNumber(left: number | undefined, right: number | undefined): boolean {
  return left === right;
}

function sameFooterEvidence(before: ParsedReceiptDraft, after: ParsedReceiptDraft): boolean {
  return before.merchant === after.merchant
    && before.merchantConfidence === after.merchantConfidence
    && before.date === after.date
    && before.dateConfidence === after.dateConfidence
    && sameOptionalNumber(before.declaredTotalMinor, after.declaredTotalMinor)
    && sameOptionalNumber(before.ocrSubtotalMinor, after.ocrSubtotalMinor)
    && sameOptionalNumber(before.taxTotalMinor, after.taxTotalMinor)
    && sameOptionalNumber(before.depositTotalMinor, after.depositTotalMinor)
    && sameOptionalNumber(before.finalPayableMinor, after.finalPayableMinor)
    && sameOptionalNumber(before.paymentTotalMinor, after.paymentTotalMinor)
    && sameOptionalNumber(before.declaredDiscountTotalMinor, after.declaredDiscountTotalMinor)
    && JSON.stringify(before.adjustments) === JSON.stringify(after.adjustments);
}

function shadowOwnershipIsSafe(
  before: ReceiptGeometryReconstructionResult,
  after: ReceiptGeometryReconstructionResult,
  plan: ReceiptLocalNumericVerificationPlan,
  shadow: ReceiptLocalNumericVerificationShadowResult,
): boolean {
  if (before.items.length !== after.items.length || before.completeItemCount !== after.completeItemCount) return false;
  if (!sourceRowsAreUnique(after)) return false;
  const acceptedByItem = new Map<number, number>();
  for (const cell of plan.cells) {
    const result = shadow.cells.find((entry) => entry.id === cell.id);
    if (!result?.shadowAccepted || result.localMinor === undefined) return false;
    acceptedByItem.set(cell.itemIndex, result.localMinor);
  }
  for (let index = 0; index < before.items.length; index += 1) {
    const previous = before.items[index];
    const next = after.items[index];
    if (!previous || !next) return false;
    if (previous.name !== next.name
      || previous.taxMarker !== next.taxMarker
      || previous.quantity !== next.quantity
      || previous.unitPriceMinor !== next.unitPriceMinor
      || previous.discountMinor !== next.discountMinor
      || previous.page !== next.page
      || previous.rowIndex !== next.rowIndex
      || JSON.stringify(previous.sourceRowIndices) !== JSON.stringify(next.sourceRowIndices)) return false;
    const acceptedMinor = acceptedByItem.get(index);
    if (acceptedMinor === undefined) {
      if (previous.grossBeforeDiscountMinor !== next.grossBeforeDiscountMinor
        || previous.finalAmountMinor !== next.finalAmountMinor) return false;
    } else if (next.finalAmountMinor !== acceptedMinor) return false;
  }
  return true;
}

function productionFailure(reason: ReceiptLocalNumericVerificationProductionReason): ReceiptLocalNumericVerificationProductionResult {
  return { productionApplied: false, reason };
}

/**
 * GATE1 promotion is intentionally separate from local OCR evidence evaluation.
 * Footer totals validate the already selected local candidates but never generate them.
 */
export function promoteReceiptLocalNumericVerification(
  input: PromoteReceiptLocalNumericVerificationInput,
): ReceiptLocalNumericVerificationProductionResult {
  const { plan, shadow } = input;
  if (input.productionDecision !== 'KEEP_PRIMARY') return productionFailure('production-path-selected');
  if (!plan.eligible || !shadow.triggered) return productionFailure('not-triggered');
  if (plan.suspectCellCount < 1
    || plan.suspectCellCount > MAX_RECEIPT_LOCAL_NUMERIC_VERIFICATION_CELLS
    || input.passCount !== plan.suspectCellCount
    || input.passCount > MAX_RECEIPT_LOCAL_NUMERIC_VERIFICATION_CELLS) return productionFailure('pass-count-unsafe');
  if (shadow.acceptedReplacementCount !== plan.suspectCellCount
    || shadow.cells.length !== plan.suspectCellCount
    || shadow.cells.some((cell) => !cell.shadowAccepted)) return productionFailure('partial-replacement');
  if (!shadow.afterShadow.financiallyConsistent
    || shadow.afterShadow.differenceMinor === undefined
    || Math.abs(shadow.afterShadow.differenceMinor) > 1) return productionFailure('shadow-financial-mismatch');
  const reconstruction = shadow.shadowReconstruction;
  if (!reconstruction) return productionFailure('shadow-reconstruction-missing');
  if (!reconstruction.items.length
    || reconstruction.completeItemCount !== reconstruction.items.length
    || reconstruction.items.some((item) => item.finalAmountMinor === undefined || item.unresolvedReason !== undefined)) {
    return productionFailure('shadow-reconstruction-regressed');
  }
  if (!sourceRowsAreUnique(reconstruction)) return productionFailure('shadow-source-row-reuse');
  if (!shadowOwnershipIsSafe(input.originalReconstruction, reconstruction, plan, shadow)) {
    return productionFailure('shadow-item-ownership-regression');
  }
  const candidate = input.shadowCandidate;
  if (!candidate) return productionFailure('shadow-candidate-missing');
  if (!sameFooterEvidence(input.preShadowCandidate, candidate)) return productionFailure('footer-evidence-regression');

  const goods = candidate.ocrSubtotalMinor;
  const finalPayable = candidate.finalPayableMinor;
  const payment = candidate.paymentTotalMinor;
  if (goods === undefined || finalPayable === undefined || payment === undefined) {
    return productionFailure('full-financial-evidence-missing');
  }
  const expectedDeposit = input.preShadowCandidate.depositTotalMinor ?? input.primary.depositTotalMinor;
  if (expectedDeposit !== undefined && candidate.depositTotalMinor !== expectedDeposit) {
    return productionFailure('full-financial-evidence-missing');
  }
  const deposit = candidate.depositTotalMinor ?? 0;
  const unexplained = candidate.unexplainedDifferenceMinor;
  if (Math.abs(candidate.detectedItemsTotalMinor - goods) > 1
    || Math.abs(goods + deposit - finalPayable) > 1
    || Math.abs(payment - finalPayable) > 1
    || unexplained === undefined
    || Math.abs(unexplained) > 1) return productionFailure('full-financial-mismatch');

  try {
    const merged = applySelectedReceiptGeometryItems(input.primary, candidate);
    if (!preservesReceiptPrimaryMetadata(input.primary, merged)) return productionFailure('primary-metadata-regression');
    if (merged.unexplainedDifferenceMinor === undefined || Math.abs(merged.unexplainedDifferenceMinor) > 1) {
      return productionFailure('full-financial-mismatch');
    }
    return {
      productionApplied: true,
      reason: 'applied',
      parsed: merged,
      verifiedItemsTotalMinor: candidate.detectedItemsTotalMinor,
      ...(candidate.depositTotalMinor === undefined ? {} : { depositTotalMinor: candidate.depositTotalMinor }),
      finalPayableMinor: finalPayable,
      paymentTotalMinor: payment,
      unexplainedDifferenceMinor: merged.unexplainedDifferenceMinor,
    };
  } catch {
    return productionFailure('merge-failed');
  }
}
