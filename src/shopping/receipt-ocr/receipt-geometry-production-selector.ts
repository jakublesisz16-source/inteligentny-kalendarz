import { reconcileReceiptFinancials } from './receipt-financial-reconciliation';
import type {
  ReceiptGeometryReconstructionResult,
  ReceiptGeometryStructuredCandidateAssessment,
} from './receipt-geometry-reconstruction';
import type { ParsedReceiptDraft, ReceiptParseWarning } from './receipt-ocr.types';
import type {
  ReceiptValueColumnRecoveryDelta,
  ReceiptValueColumnRecoveryPlan,
} from './receipt-value-column-recovery';

export type ReceiptGeometryProductionDecision = 'SELECT_RECOVERY' | 'SELECT_STRUCTURED_GEOMETRY' | 'KEEP_PRIMARY';

export type ReceiptGeometryProductionReason =
  | 'selected-recovery'
  | 'selected-structured-geometry'
  | 'primary-missing'
  | 'geometry-missing'
  | 'recovery-not-attempted'
  | 'recovery-pass-missing'
  | 'recovery-pass-count-unsafe'
  | 'recovery-not-used'
  | 'recovery-money-evidence-missing'
  | 'recovery-delta-missing'
  | 'recovery-not-material'
  | 'recovery-regressed'
  | 'candidate-rejected'
  | 'candidate-unresolved'
  | 'candidate-quantity-unresolved'
  | 'candidate-discount-unresolved'
  | 'candidate-item-amount-missing'
  | 'candidate-item-total-mismatch'
  | 'candidate-not-better'
  | 'candidate-item-growth-unsafe'
  | 'candidate-structure-mismatch'
  | 'candidate-source-row-reuse'
  | 'financial-evidence-insufficient'
  | 'financial-mismatch'
  | 'primary-metadata-regression'
  | 'merge-failed';

export interface ReceiptGeometryProductionRecoveryEvidence {
  attempted: boolean;
  passCount: number;
  used: boolean;
  eligiblePlanCount: number;
  usableTokenCount: number;
  recoveryTokenCount: number;
  deltas: ReceiptValueColumnRecoveryDelta[];
  plans: ReceiptValueColumnRecoveryPlan[];
}

export interface ReceiptGeometryProductionSelectionInput {
  primary: ParsedReceiptDraft | undefined;
  geometryCandidate: ParsedReceiptDraft | undefined;
  reconstruction: ReceiptGeometryReconstructionResult | undefined;
  structuredAssessment: ReceiptGeometryStructuredCandidateAssessment | undefined;
  recovery: ReceiptGeometryProductionRecoveryEvidence;
}

export interface ReceiptGeometryProductionSelectionResult {
  decision: ReceiptGeometryProductionDecision;
  reason: ReceiptGeometryProductionReason;
  primaryItemCount: number;
  geometryItemCount: number;
  completeBefore: number;
  completeAfter: number;
  recoveredCompleteGroups: number;
  financiallyConsistent: boolean;
}

type SelectionState = Omit<ReceiptGeometryProductionSelectionResult, 'decision' | 'reason'>;

function keep(
  reason: Exclude<ReceiptGeometryProductionReason, 'selected-recovery' | 'selected-structured-geometry'>,
  state: SelectionState,
): ReceiptGeometryProductionSelectionResult {
  return { decision: 'KEEP_PRIMARY', reason, ...state };
}

function aggregateRecoveryDeltas(deltas: readonly ReceiptValueColumnRecoveryDelta[]): ReceiptValueColumnRecoveryDelta | undefined {
  if (!deltas.length) return undefined;
  return deltas.reduce<ReceiptValueColumnRecoveryDelta>((sum, delta) => ({
    completeBefore: sum.completeBefore + delta.completeBefore,
    completeAfter: sum.completeAfter + delta.completeAfter,
    unresolvedBefore: sum.unresolvedBefore + delta.unresolvedBefore,
    unresolvedAfter: sum.unresolvedAfter + delta.unresolvedAfter,
    recoveredGrossCells: sum.recoveredGrossCells + delta.recoveredGrossCells,
    recoveredDiscountCells: sum.recoveredDiscountCells + delta.recoveredDiscountCells,
    recoveredNetCells: sum.recoveredNetCells + delta.recoveredNetCells,
    recoveredCompleteGroups: sum.recoveredCompleteGroups + delta.recoveredCompleteGroups,
  }), {
    completeBefore: 0,
    completeAfter: 0,
    unresolvedBefore: 0,
    unresolvedAfter: 0,
    recoveredGrossCells: 0,
    recoveredDiscountCells: 0,
    recoveredNetCells: 0,
    recoveredCompleteGroups: 0,
  });
}

function validPositiveAmount(value: number | undefined): boolean {
  return value !== undefined && Number.isSafeInteger(value) && value > 0;
}

function selectionState(
  primary: ParsedReceiptDraft | undefined,
  geometryCandidate: ParsedReceiptDraft | undefined,
  delta: ReceiptValueColumnRecoveryDelta | undefined,
  financiallyConsistent = false,
): SelectionState {
  return {
    primaryItemCount: primary?.items.length ?? 0,
    geometryItemCount: geometryCandidate?.items.length ?? 0,
    completeBefore: delta?.completeBefore ?? 0,
    completeAfter: delta?.completeAfter ?? 0,
    recoveredCompleteGroups: delta?.recoveredCompleteGroups ?? 0,
    financiallyConsistent,
  };
}

function structuredValueCoverageIsComplete(recovery: ReceiptGeometryProductionRecoveryEvidence): boolean {
  if (recovery.attempted || recovery.used || recovery.passCount !== 0 || recovery.eligiblePlanCount !== 0) return false;
  if (recovery.usableTokenCount !== 0 || recovery.recoveryTokenCount !== 0 || recovery.deltas.length !== 0) return false;
  const itemPlans = recovery.plans.filter((plan) => plan.itemGroupCount > 0);
  if (!itemPlans.length) return false;
  return itemPlans.every((plan) => plan.eligible === false
    && plan.reason === 'value-coverage-sufficient'
    && plan.primaryMissingValueItemCount === 0
    && plan.primaryExplicitValueItemCount === plan.itemGroupCount
    && Math.abs(plan.primaryValueCoverageRatio - 1) <= Number.EPSILON);
}

function sourceRowsAreUniquelyOwned(reconstruction: ReceiptGeometryReconstructionResult): boolean {
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

function validateCandidateStructure(
  primary: ParsedReceiptDraft,
  geometryCandidate: ParsedReceiptDraft,
  reconstruction: ReceiptGeometryReconstructionResult,
  structuredAssessment: ReceiptGeometryStructuredCandidateAssessment | undefined,
  state: SelectionState,
  requireDiscountResolved: boolean,
): ReceiptGeometryProductionSelectionResult | undefined {
  if (!structuredAssessment?.accepted) return keep('candidate-rejected', state);
  const unresolvedItems = reconstruction.items.filter((item) => item.finalAmountMinor === undefined);
  if (unresolvedItems.length > 0) return keep('candidate-unresolved', state);
  if (reconstruction.items.some((item) => item.unresolvedReason === 'quantity-unresolved')) {
    return keep('candidate-quantity-unresolved', state);
  }
  if (requireDiscountResolved && reconstruction.items.some((item) => item.unresolvedReason === 'discount-unresolved')) {
    return keep('candidate-discount-unresolved', state);
  }
  if (geometryCandidate.items.some((item) => !validPositiveAmount(item.amountMinor))) {
    return keep('candidate-item-amount-missing', state);
  }
  if (Math.abs(geometryCandidate.detectedItemsTotalMinor - reconstruction.itemsTotalMinor) > 1) {
    return keep('candidate-item-total-mismatch', state);
  }

  const geometryItemCount = geometryCandidate.items.length;
  if (geometryItemCount <= primary.items.length) return keep('candidate-not-better', state);
  if (geometryItemCount > reconstruction.completeItemCount || geometryItemCount > reconstruction.items.length) {
    return keep('candidate-item-growth-unsafe', state);
  }
  if (geometryItemCount !== reconstruction.completeItemCount || reconstruction.completeItemCount <= 0) {
    return keep('candidate-structure-mismatch', state);
  }
  if (requireDiscountResolved && !sourceRowsAreUniquelyOwned(reconstruction)) {
    return keep('candidate-source-row-reuse', state);
  }
  return undefined;
}


function rowContainsMinor(text: string, expectedMinor: number): boolean {
  for (const match of text.matchAll(/-?\d{1,7}[,.]\d{2}/gu)) {
    const value = Number((match[0] ?? '').replace(',', '.'));
    if (Number.isFinite(value) && Math.round(value * 100) === expectedMinor) return true;
  }
  return false;
}

function hasIndependentGeometryFooterPair(
  reconstruction: ReceiptGeometryReconstructionResult,
  geometryCandidate: ParsedReceiptDraft,
): boolean {
  const finalTotalMinor = geometryCandidate.finalPayableMinor ?? geometryCandidate.declaredTotalMinor;
  const paymentTotalMinor = geometryCandidate.paymentTotalMinor;
  if (finalTotalMinor === undefined || paymentTotalMinor === undefined) return false;

  const itemRows = new Set<string>();
  for (const item of reconstruction.items) {
    for (const rowIndex of new Set(item.sourceRowIndices)) itemRows.add(`${item.page}:${rowIndex}`);
  }
  let finalSeen = false;
  let paymentSeen = false;
  reconstruction.rows.forEach((row, rowIndex) => {
    if (itemRows.has(`${row.page}:${rowIndex}`)) return;
    const normalized = row.text.replace(/[Łł]/gu, 'L').toLocaleUpperCase('pl-PL');
    if (/\bSUMA\s+PLN\b/u.test(normalized) && rowContainsMinor(row.text, finalTotalMinor)) finalSeen = true;
    if (/\bKARTA\s+PLATNICZA\b/u.test(normalized) && rowContainsMinor(row.text, paymentTotalMinor)) paymentSeen = true;
  });
  return finalSeen && paymentSeen;
}

function financialConsensus(
  primary: ParsedReceiptDraft,
  geometryCandidate: ParsedReceiptDraft,
  reconstruction: ReceiptGeometryReconstructionResult,
): { financiallyConsistent: boolean; hasIndependentEvidence: boolean } {
  const primaryFinalTotalMinor = primary.finalPayableMinor ?? primary.declaredTotalMinor;
  const geometryFinalTotalMinor = geometryCandidate.finalPayableMinor ?? geometryCandidate.declaredTotalMinor;
  const finalTotalMinor = primaryFinalTotalMinor ?? geometryFinalTotalMinor;
  const ocrSubtotalMinor = primary.ocrSubtotalMinor ?? geometryCandidate.ocrSubtotalMinor;
  const paymentTotalMinor = primary.paymentTotalMinor ?? geometryCandidate.paymentTotalMinor;

  // If production must rely on the structured candidate for footer evidence,
  // require an independent final+payment pair. The footer may validate item
  // selection but is never copied into the primary draft by the item-only merge.
  const usingGeometryFooter = primaryFinalTotalMinor === undefined && primary.ocrSubtotalMinor === undefined;
  if (usingGeometryFooter) {
    if (geometryFinalTotalMinor === undefined || geometryCandidate.paymentTotalMinor === undefined
      || !hasIndependentGeometryFooterPair(reconstruction, geometryCandidate)) {
      return { financiallyConsistent: false, hasIndependentEvidence: false };
    }
    // A geometry-only deposit would require a footer merge, which FIX1 forbids.
    if (primary.depositTotalMinor === undefined && (geometryCandidate.depositTotalMinor ?? 0) > 0) {
      return { financiallyConsistent: false, hasIndependentEvidence: false };
    }
  }

  const hasIndependentEvidence = finalTotalMinor !== undefined || ocrSubtotalMinor !== undefined;
  if (!hasIndependentEvidence) return { financiallyConsistent: false, hasIndependentEvidence: false };

  const financial = reconcileReceiptFinancials({
    itemsTotalMinor: geometryCandidate.detectedItemsTotalMinor,
    ...(ocrSubtotalMinor === undefined ? {} : { ocrSubtotalMinor }),
    ...(primary.depositTotalMinor === undefined ? {} : { depositTotalMinor: primary.depositTotalMinor }),
    ...(finalTotalMinor === undefined ? {} : { finalTotalMinor }),
    ...(paymentTotalMinor === undefined ? {} : { paymentTotalMinor }),
  });
  const independentResolution = financial.subtotalResolution !== undefined && financial.subtotalResolution !== 'items-only';
  return {
    financiallyConsistent: financial.financiallyConsistent && independentResolution,
    hasIndependentEvidence,
  };
}

/**
 * Runtime-only, fail-closed production selector. The validated DEV4-A recovery
 * path remains primary. DEV4-B adds a second narrow path for already-complete
 * structured geometry when no value-column OCR pass is needed and independent
 * footer evidence confirms the selected item block.
 */
export function decideReceiptGeometryProductionSelection(
  input: ReceiptGeometryProductionSelectionInput,
): ReceiptGeometryProductionSelectionResult {
  const { primary, geometryCandidate, reconstruction, structuredAssessment, recovery } = input;
  const delta = aggregateRecoveryDeltas(recovery.deltas);
  let state = selectionState(primary, geometryCandidate, delta);

  if (!primary) return keep('primary-missing', state);
  if (!geometryCandidate || !reconstruction) return keep('geometry-missing', state);

  if (!recovery.attempted) {
    if (!structuredValueCoverageIsComplete(recovery)) return keep('recovery-not-attempted', state);
    const structuralFailure = validateCandidateStructure(
      primary,
      geometryCandidate,
      reconstruction,
      structuredAssessment,
      state,
      true,
    );
    if (structuralFailure) return structuralFailure;
    const financial = financialConsensus(primary, geometryCandidate, reconstruction);
    if (!financial.hasIndependentEvidence) return keep('financial-evidence-insufficient', state);
    state = selectionState(primary, geometryCandidate, delta, financial.financiallyConsistent);
    if (!state.financiallyConsistent) return keep('financial-mismatch', state);
    return { decision: 'SELECT_STRUCTURED_GEOMETRY', reason: 'selected-structured-geometry', ...state };
  }

  // Existing DEV4-A recovery contract remains unchanged.
  if (recovery.passCount < 1 || recovery.eligiblePlanCount < 1) return keep('recovery-pass-missing', state);
  if (recovery.passCount !== recovery.eligiblePlanCount) return keep('recovery-pass-count-unsafe', state);
  if (!recovery.used) return keep('recovery-not-used', state);
  if (recovery.usableTokenCount < 1 || recovery.recoveryTokenCount < 1) return keep('recovery-money-evidence-missing', state);
  if (!delta) return keep('recovery-delta-missing', state);
  if (delta.completeAfter <= delta.completeBefore || delta.recoveredCompleteGroups <= 0) return keep('recovery-not-material', state);
  if (delta.completeAfter < delta.completeBefore || delta.unresolvedAfter > delta.unresolvedBefore) return keep('recovery-regressed', state);

  const structuralFailure = validateCandidateStructure(
    primary,
    geometryCandidate,
    reconstruction,
    structuredAssessment,
    state,
    false,
  );
  if (structuralFailure) return structuralFailure;
  if (delta.unresolvedAfter > 0) return keep('candidate-unresolved', state);

  const financial = financialConsensus(primary, geometryCandidate, reconstruction);
  if (!financial.hasIndependentEvidence) return keep('financial-evidence-insufficient', state);
  state = selectionState(primary, geometryCandidate, delta, financial.financiallyConsistent);
  if (!state.financiallyConsistent) return keep('financial-mismatch', state);

  return { decision: 'SELECT_RECOVERY', reason: 'selected-recovery', ...state };
}

const ITEM_BLOCK_WARNING_CODES = new Set<ReceiptParseWarning['code']>([
  'item-price-missing',
  'no-items',
  'sum-mismatch',
]);

/**
 * Applies only the validated item-block improvement. Header/footer evidence stays
 * primary-first. Derived reconciliation fields are recomputed from the selected
 * items against the unchanged primary footer evidence.
 */
export function applySelectedReceiptGeometryItems(
  primary: ParsedReceiptDraft,
  geometryCandidate: ParsedReceiptDraft,
): ParsedReceiptDraft {
  const finalTotalMinor = primary.finalPayableMinor ?? primary.declaredTotalMinor;
  const financial = reconcileReceiptFinancials({
    itemsTotalMinor: geometryCandidate.detectedItemsTotalMinor,
    ...(primary.ocrSubtotalMinor === undefined ? {} : { ocrSubtotalMinor: primary.ocrSubtotalMinor }),
    ...(primary.depositTotalMinor === undefined ? {} : { depositTotalMinor: primary.depositTotalMinor }),
    ...(finalTotalMinor === undefined ? {} : { finalTotalMinor }),
    ...(primary.paymentTotalMinor === undefined ? {} : { paymentTotalMinor: primary.paymentTotalMinor }),
  });
  const warnings = primary.warnings.filter((warning) => !ITEM_BLOCK_WARNING_CODES.has(warning.code));
  if (!financial.financiallyConsistent) {
    warnings.push({
      code: 'sum-mismatch',
      message: 'Suma rozpoznanych pozycji różni się od sumy odczytanej z paragonu po uwzględnieniu kaucji.',
    });
  }

  const merged: ParsedReceiptDraft = {
    ...primary,
    items: geometryCandidate.items.map((item) => {
      const selected = { ...item, warnings: [...item.warnings] };
      delete selected.suggestedCategoryId;
      return selected;
    }),
    detectedItemsTotalMinor: geometryCandidate.detectedItemsTotalMinor,
    warnings,
  };

  if (financial.reconciledSubtotalMinor === undefined) delete merged.declaredSubtotalMinor;
  else merged.declaredSubtotalMinor = financial.reconciledSubtotalMinor;
  if (financial.subtotalResolution === undefined) delete merged.subtotalResolution;
  else merged.subtotalResolution = financial.subtotalResolution;
  if (financial.unexplainedDifferenceMinor === undefined) delete merged.unexplainedDifferenceMinor;
  else merged.unexplainedDifferenceMinor = financial.unexplainedDifferenceMinor;

  return merged;
}


export function preservesReceiptPrimaryMetadata(
  primary: ParsedReceiptDraft,
  merged: ParsedReceiptDraft,
): boolean {
  return primary.merchant === merged.merchant
    && primary.merchantConfidence === merged.merchantConfidence
    && primary.date === merged.date
    && primary.dateConfidence === merged.dateConfidence
    && primary.declaredTotalMinor === merged.declaredTotalMinor
    && primary.ocrSubtotalMinor === merged.ocrSubtotalMinor
    && primary.taxTotalMinor === merged.taxTotalMinor
    && primary.depositTotalMinor === merged.depositTotalMinor
    && primary.finalPayableMinor === merged.finalPayableMinor
    && primary.paymentTotalMinor === merged.paymentTotalMinor
    && primary.declaredDiscountTotalMinor === merged.declaredDiscountTotalMinor
    && JSON.stringify(primary.adjustments) === JSON.stringify(merged.adjustments);
}
