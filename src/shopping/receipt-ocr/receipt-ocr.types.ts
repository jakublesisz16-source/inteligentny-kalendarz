import type { ReceiptDraft } from '../expenses.types';

export type ReceiptOcrConfidence = 'high' | 'medium' | 'low';
export type ReceiptOcrSourceType = 'photo' | 'pdf';
export type ReceiptSourceQualityLevel = 'high' | 'medium' | 'low' | 'very-low';
export type ReceiptOcrStage = 'preparing' | 'recognizing' | 'parsing';

export interface ReceiptParseWarning {
  code:
    | 'merchant-uncertain'
    | 'date-missing'
    | 'date-ambiguous'
    | 'total-missing'
    | 'discount-detected'
    | 'item-price-missing'
    | 'no-items'
    | 'sum-mismatch'
    | 'discount-summary-mismatch'
    | 'degraded-source'
    | 'partial-recovery';
  message: string;
  line?: string;
}

export interface ParsedReceiptItem {
  rawText: string;
  name: string;
  amountMinor?: number;
  baseAmountMinor?: number;
  discountMinor?: number;
  taxMarker?: string;
  financialResolution?: 'explicit-line-total' | 'quantity-unit-total-consensus' | 'quantity-unit-recovery' | 'fallback';
  suggestedCategoryId?: string;
  confidence: ReceiptOcrConfidence;
  warnings: string[];
}

export interface ReceiptAdjustmentDraft {
  rawText: string;
  amountMinor?: number;
  kind: 'discount';
}

export interface ParsedReceiptDraft {
  merchant?: string;
  merchantConfidence: ReceiptOcrConfidence;
  date?: string;
  dateConfidence: ReceiptOcrConfidence;
  items: ParsedReceiptItem[];
  declaredTotalMinor?: number;
  ocrSubtotalMinor?: number;
  taxTotalMinor?: number;
  declaredSubtotalMinor?: number;
  depositTotalMinor?: number;
  finalPayableMinor?: number;
  paymentTotalMinor?: number;
  unexplainedDifferenceMinor?: number;
  subtotalResolution?: 'items-final-consensus' | 'ocr-items-consensus' | 'ocr-final-consensus' | 'ocr-unconfirmed' | 'final-minus-deposit' | 'items-only';
  declaredDiscountTotalMinor?: number;
  detectedItemsTotalMinor: number;
  adjustments: ReceiptAdjustmentDraft[];
  warnings: ReceiptParseWarning[];
}

export interface ReceiptReviewItem {
  localId: string;
  name: string;
  categoryId: string;
  amountText: string;
  baseAmountMinor?: number;
  discountMinor?: number;
  confidence: ReceiptOcrConfidence;
  warnings: string[];
}

export interface ReceiptReviewDraft {
  merchant: string;
  merchantConfidence: ReceiptOcrConfidence;
  date: string;
  dateConfidence: ReceiptOcrConfidence;
  items: ReceiptReviewItem[];
  declaredTotalMinor?: number;
  ocrSubtotalMinor?: number;
  declaredSubtotalMinor?: number;
  depositTotalMinor?: number;
  paymentTotalMinor?: number;
  unexplainedDifferenceMinor?: number;
  declaredDiscountTotalMinor?: number;
  parserWarnings: ReceiptParseWarning[];
  adjustments: ReceiptAdjustmentDraft[];
}

export interface OcrProgress {
  stage: ReceiptOcrStage;
  progress?: number;
  label: string;
}

export type ReceiptOcrGeometrySource =
  | 'primary'
  | 'single-block-recovery'
  | 'fiscal-region-recovery'
  | 'fiscal-threshold-recovery'
  | 'header-recovery'
  | 'value-column-recovery'
  | 'local-numeric-verification'
  | 'snapshot';

export interface ReceiptOcrBoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ReceiptOcrToken {
  text: string;
  confidence?: number;
  bbox: ReceiptOcrBoundingBox;
  page: number;
  chunkIndex?: number;
  blockIndex?: number;
  paragraphIndex?: number;
  lineIndex?: number;
  wordIndex?: number;
  source?: ReceiptOcrGeometrySource;
}

export interface ReceiptOcrGeometry {
  source: ReceiptOcrGeometrySource;
  imageWidth: number;
  imageHeight: number;
  tokens: ReceiptOcrToken[];
}

export interface OcrRecognitionResult {
  text: string;
  confidence?: number;
  geometry?: ReceiptOcrGeometry;
}

export interface ReceiptOcrChunk {
  blob: Blob;
  index: number;
  startY: number;
  endY: number;
  page?: number;
  width?: number;
  height?: number;
  offsetX?: number;
  overlapTop?: number;
  overlapBottom?: number;
}

export interface ReceiptSourceQuality {
  level: ReceiptSourceQualityLevel;
  score: number;
  warnings: string[];
}

export interface ReceiptOcrQuality {
  sourceType: ReceiptOcrSourceType;
  score: number;
  textScore: number;
  financialScore: number;
  level: ReceiptOcrConfidence;
  suspiciousFinancialLines: number;
  consistentFinancialLines: number;
  suspiciousTokens: number;
  productLikeLines: number;
  headerSignals: number;
  discountSequences: number;
  suspiciousDiscountSequences: number;
  warnings: string[];
}


export interface ReceiptOcrCandidateDiagnostic {
  source: 'primary' | 'single-block-recovery' | 'fiscal-region-recovery' | 'fiscal-threshold-recovery';
  ocrConfidence?: number;
  qualityScore: number;
  financialScore: number;
  structuralScore: number;
  candidateScore: number;
  itemsCount: number;
  itemsTotalMinor: number;
  declaredTotalMinor?: number;
  paymentTotalMinor?: number;
  differenceMinor?: number;
  hasFiscalMarker: boolean;
  hasDate: boolean;
  hasMerchantEvidence: boolean;
  goodsReconcile: boolean;
  paymentReconciles: boolean;
  selected: boolean;
}

export type ReceiptMerchantEvidenceKind = 'plain' | 'legal' | 'domain' | 'descriptor' | 'context' | 'consensus' | 'none';
export type ReceiptMerchantDecision = 'accepted' | 'rejected' | 'unresolved';
export type ReceiptMerchantRejectReason = 'unconfirmed-plain' | 'address-only' | 'low-evidence' | 'conflict' | 'gibberish' | 'footer-position' | 'none';

export interface ReceiptOcrDiagnostics {
  sourceType: ReceiptOcrSourceType;
  sourceQuality: ReceiptSourceQuality;
  pageCount: number;
  pagesProcessed: number;
  sourceWidth: number;
  sourceHeight: number;
  processedWidth: number;
  processedHeight: number;
  scale: number;
  inverted: boolean;
  chunkCount: number;
  cropApplied: boolean;
  cropConfidence: number;
  fiscalRecoveryCropAvailable?: boolean;
  fiscalRecoveryCropConfidence?: number;
  fiscalRecoverySubregionApplied?: boolean;
  fiscalRecoveryCropLeftRatio?: number;
  fiscalRecoveryCropTopRatio?: number;
  fiscalRecoveryCropRightRatio?: number;
  fiscalRecoveryCropBottomRatio?: number;
  fiscalRecoveryAttempted?: boolean;
  fiscalRecoverySelected?: boolean;
  fiscalThresholdRecoveryAttempted?: boolean;
  fiscalThresholdRecoverySelected?: boolean;
  merchantHeaderAttempted?: boolean;
  dateRecoverySource?: 'primary' | 'single-block-recovery' | 'fiscal-region-recovery' | 'fiscal-threshold-recovery' | 'unresolved';
  dateDecision?: 'accepted' | 'rejected' | 'unresolved';
  dateRejectReason?: 'none' | 'missing' | 'out-of-range' | 'invalid-calendar' | 'outside-fiscal-window' | 'ambiguous';
  itemBlockSource?: 'primary' | 'single-block-recovery' | 'fiscal-region-recovery' | 'fiscal-threshold-recovery' | 'geometry-value-recovery' | 'geometry-structured-consensus' | 'unresolved';
  marketingTailDetected?: boolean;
  footerContaminationDetected?: boolean;
  merchantRecoverySource?: 'primary' | 'single-block-recovery' | 'fiscal-region-recovery' | 'fiscal-threshold-recovery' | 'header' | 'unresolved';
  merchantCandidate?: string;
  merchantEvidence?: ReceiptMerchantEvidenceKind;
  merchantDecision?: ReceiptMerchantDecision;
  merchantRejectReason?: ReceiptMerchantRejectReason;
  candidateDiagnostics?: ReceiptOcrCandidateDiagnostic[];
  fullOcrPasses?: number;
  fiscalOcrPasses?: number;
  headerOcrPasses?: number;
  geometryAvailable?: boolean;
  geometrySource?: ReceiptOcrGeometrySource;
  geometryTokenCount?: number;
  geometryInvalidTokenCount?: number;
  geometryRowCount?: number;
  geometryColumnSource?: 'header' | 'numeric-clusters' | 'none';
  geometryColumnConfidence?: number;
  geometryReconstructedItemCount?: number;
  geometryReconstructedCompleteItemCount?: number;
  geometryReconstructedGrossTotalMinor?: number;
  geometryReconstructedDiscountTotalMinor?: number;
  geometryReconstructedItemsTotalMinor?: number;
  geometryReconstructedUnresolvedItemCount?: number;
  geometryReconstructedDiscountUnresolvedCount?: number;
  geometryReconstructedQuantityUnresolvedCount?: number;
  geometryRowMajorParsedItemCount?: number;
  geometryRowMajorParsedItemsTotalMinor?: number;
  geometryParsedItemCount?: number;
  geometryParsedItemsTotalMinor?: number;
  geometryParsedFinalTotalMinor?: number;
  geometryParsedPaymentTotalMinor?: number;
  geometryStructuredTextGenerated?: boolean;
  geometryStructuredTextApplied?: boolean;
  geometryStructuredCandidateAccepted?: boolean;
  geometryStructuredCandidateRejectionReasons?: string[];
  valueColumnRecoveryAttempted?: boolean;
  valueColumnRecoveryPasses?: number;
  valueColumnRecoveryUsed?: boolean;
  valueColumnRecoveryCropX0?: number;
  valueColumnRecoveryCropY0?: number;
  valueColumnRecoveryCropX1?: number;
  valueColumnRecoveryCropY1?: number;
  valueColumnRecoveryCropPixels?: number;
  valueColumnRecoveryTokenCount?: number;
  valueColumnRecoveryUsableTokenCount?: number;
  valueColumnRecoveryRecoveredGrossCells?: number;
  valueColumnRecoveryRecoveredDiscountCells?: number;
  valueColumnRecoveryRecoveredNetCells?: number;
  valueColumnRecoveryRecoveredCompleteGroups?: number;
  geometrySelected?: boolean;
  geometrySelectionDecision?: 'SELECT_RECOVERY' | 'SELECT_STRUCTURED_GEOMETRY' | 'KEEP_PRIMARY';
  geometrySelectionReason?: string;
  numericVerificationTriggered?: boolean;
  numericVerificationPasses?: number;
  numericVerificationSuspectCellCount?: number;
  numericVerificationAcceptedShadowReplacements?: number;
  numericVerificationShadowFinanciallyConsistent?: boolean;
  deskewDegrees: number;
}

export interface ProcessedReceiptImage {
  chunks: ReceiptOcrChunk[];
  fiscalRecoveryChunk?: ReceiptOcrChunk;
  fiscalThresholdRecoveryChunk?: ReceiptOcrChunk;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  diagnostics: ReceiptOcrDiagnostics;
}

export interface ReceiptReviewSaveResult {
  draft: ReceiptDraft;
  significantMismatch: boolean;
}
