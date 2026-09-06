import { analyzeReceiptOcrQuality } from './receipt-ocr-quality';
import { parseReceiptText } from './receipt-parser';
import type { ParsedReceiptDraft, ReceiptOcrCandidateDiagnostic, ReceiptOcrQuality, ReceiptOcrSourceType, ReceiptSourceQuality } from './receipt-ocr.types';

export type ReceiptOcrProfile = 'primary' | 'single-block-recovery' | 'fiscal-region-recovery' | 'fiscal-threshold-recovery';

export interface ReceiptOcrCandidateAssessment {
  profile: ReceiptOcrProfile;
  text: string;
  confidence?: number;
  parsed: ParsedReceiptDraft;
  quality: ReceiptOcrQuality;
  score: number;
  structuralScore: number;
  goodsReconcile: boolean;
  paymentReconciles: boolean;
  finalStructureReconciles: boolean;
  hasFiscalMarker: boolean;
}

function goodsTargetMinor(parsed: ParsedReceiptDraft): number | undefined {
  if (parsed.declaredSubtotalMinor !== undefined) return parsed.declaredSubtotalMinor;
  if (parsed.declaredTotalMinor !== undefined && parsed.depositTotalMinor !== undefined) {
    return parsed.declaredTotalMinor - parsed.depositTotalMinor;
  }
  return parsed.declaredTotalMinor;
}

function hasWarning(parsed: ParsedReceiptDraft, code: ParsedReceiptDraft['warnings'][number]['code']): boolean {
  return parsed.warnings.some((warning) => warning.code === code);
}

function confidenceBonus(confidence?: number): number {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return 0;
  return Math.round(Math.max(0, Math.min(100, confidence)) / 20);
}

function normalizedReceiptText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleUpperCase('pl-PL');
}

function hasStrongFiscalMarker(text: string): boolean {
  return /PARAGON\s+(?:NIE)?FISKALNY/u.test(normalizedReceiptText(text));
}

function fiscalStructureSignals(text: string): number {
  const normalized = normalizedReceiptText(text);
  const signals = [
    /PARAGON\s+(?:NIE)?FISKALNY/u,
    /SUMA\s+(?:PLN|PTU|VAT)\b/u,
    /(?:DO|D0|0O|00)\s+ZAPLATY\b/u,
    /\bPTU\b|\bVAT\b/u,
    /ZAPLACONO|PLATNOSC|KARTA\s+PLATNICZA/u,
  ];
  return signals.reduce((sum, pattern) => sum + Number(pattern.test(normalized)), 0);
}

function repeatedAmountPenalty(parsed: ParsedReceiptDraft): number {
  if (parsed.items.length < 3) return 0;
  const counts = new Map<number, number>();
  for (const item of parsed.items) {
    if (item.amountMinor === undefined) continue;
    counts.set(item.amountMinor, (counts.get(item.amountMinor) ?? 0) + 1);
  }
  const highest = Math.max(0, ...counts.values());
  if (highest < 3) return 0;
  if (parsed.declaredTotalMinor === undefined) return 22;
  return highest >= parsed.items.length - 1 ? 12 : 0;
}

export function assessReceiptOcrCandidate(
  profile: ReceiptOcrProfile,
  text: string,
  sourceType: ReceiptOcrSourceType,
  confidence?: number,
): ReceiptOcrCandidateAssessment {
  const parsed = parseReceiptText(text);
  const quality = analyzeReceiptOcrQuality(text, sourceType, confidence);
  const target = goodsTargetMinor(parsed);
  const goodsReconcile = target !== undefined
    && parsed.items.length > 0
    && Math.abs(parsed.detectedItemsTotalMinor - target) <= 1;
  const finalStructureReconciles = parsed.declaredSubtotalMinor !== undefined
    && parsed.depositTotalMinor !== undefined
    && parsed.declaredTotalMinor !== undefined
    && Math.abs(parsed.declaredSubtotalMinor + parsed.depositTotalMinor - parsed.declaredTotalMinor) <= 1;

  const paymentReconciles = parsed.declaredTotalMinor !== undefined
    && parsed.paymentTotalMinor !== undefined
    && Math.abs(parsed.declaredTotalMinor - parsed.paymentTotalMinor) <= 1;
  const hasFiscalMarker = hasStrongFiscalMarker(text);
  let structuralScore = 0;
  structuralScore += Math.min(28, parsed.items.length * 7);
  structuralScore += Math.min(15, fiscalStructureSignals(text) * 3);
  if (goodsReconcile) structuralScore += 38;
  else if (target !== undefined && parsed.items.length > 0) structuralScore -= 28;
  if (paymentReconciles) structuralScore += 18;
  if (finalStructureReconciles) structuralScore += 14;
  if (parsed.date) structuralScore += 5;
  if (parsed.merchant) structuralScore += 4;
  if (hasWarning(parsed, 'sum-mismatch')) structuralScore -= 26;
  if (hasWarning(parsed, 'no-items')) structuralScore -= 30;
  if (hasWarning(parsed, 'total-missing')) structuralScore -= 12;
  if (parsed.items.length === 0 && parsed.declaredTotalMinor !== undefined) structuralScore -= 18;
  structuralScore -= repeatedAmountPenalty(parsed);
  const score = quality.score + structuralScore + confidenceBonus(confidence);

  return {
    profile,
    text,
    ...(confidence === undefined ? {} : { confidence }),
    parsed,
    quality,
    score,
    structuralScore,
    goodsReconcile,
    paymentReconciles,
    finalStructureReconciles,
    hasFiscalMarker,
  };
}

export function describeReceiptOcrCandidate(
  candidate: ReceiptOcrCandidateAssessment,
  selected = false,
): ReceiptOcrCandidateDiagnostic {
  return {
    source: candidate.profile,
    ...(candidate.confidence === undefined ? {} : { ocrConfidence: candidate.confidence }),
    qualityScore: candidate.quality.score,
    financialScore: candidate.quality.financialScore,
    structuralScore: candidate.structuralScore,
    candidateScore: candidate.score,
    itemsCount: candidate.parsed.items.length,
    itemsTotalMinor: candidate.parsed.detectedItemsTotalMinor,
    ...(candidate.parsed.declaredTotalMinor === undefined ? {} : { declaredTotalMinor: candidate.parsed.declaredTotalMinor }),
    ...(candidate.parsed.paymentTotalMinor === undefined ? {} : { paymentTotalMinor: candidate.parsed.paymentTotalMinor }),
    ...(candidate.parsed.unexplainedDifferenceMinor === undefined ? {} : { differenceMinor: candidate.parsed.unexplainedDifferenceMinor }),
    hasFiscalMarker: candidate.hasFiscalMarker,
    hasDate: Boolean(candidate.parsed.date),
    hasMerchantEvidence: Boolean(candidate.parsed.merchant),
    goodsReconcile: candidate.goodsReconcile,
    paymentReconciles: candidate.paymentReconciles,
    selected,
  };
}

export function shouldRecoverReceiptFiscalRegion(
  candidate: ReceiptOcrCandidateAssessment,
  sourceQuality: ReceiptSourceQuality | undefined,
  cropAvailable: boolean,
): boolean {
  if (!cropAvailable || !sourceQuality) return false;
  if (sourceQuality.level === 'very-low' || sourceQuality.score < 55) return false;
  const parsed = candidate.parsed;
  const finalKnown = parsed.declaredTotalMinor !== undefined;
  const paymentConsistent = parsed.paymentTotalMinor === undefined || (
    finalKnown && Math.abs(parsed.paymentTotalMinor - parsed.declaredTotalMinor!) <= 1
  );
  if (candidate.goodsReconcile && finalKnown && paymentConsistent && !hasWarning(parsed, 'sum-mismatch')) return false;
  if (parsed.items.length === 0) return true;
  if (!finalKnown) return true;
  if (candidate.quality.textScore < 35 && candidate.quality.financialScore < 55) return true;
  if (hasWarning(parsed, 'sum-mismatch') && candidate.quality.level === 'low') return true;
  return false;
}

export function shouldRetryReceiptOcr(candidate: ReceiptOcrCandidateAssessment): boolean {
  if (candidate.profile !== 'primary') return false;
  const parsed = candidate.parsed;
  const target = goodsTargetMinor(parsed);
  if (!candidate.text.trim()) return true;
  if (parsed.items.length === 0) return true;
  if (hasWarning(parsed, 'sum-mismatch')) return true;
  if (target !== undefined && !candidate.goodsReconcile) return true;
  if (candidate.quality.level === 'low' || candidate.score < 55) return true;
  if (candidate.quality.suspiciousFinancialLines >= 2) return true;
  return false;
}

function compareCandidateQuality(left: ReceiptOcrCandidateAssessment, right: ReceiptOcrCandidateAssessment): number {
  if (left.goodsReconcile !== right.goodsReconcile) return left.goodsReconcile ? 1 : -1;
  if (left.paymentReconciles !== right.paymentReconciles) return left.paymentReconciles ? 1 : -1;
  if (left.finalStructureReconciles !== right.finalStructureReconciles) return left.finalStructureReconciles ? 1 : -1;
  if (left.score !== right.score) return left.score > right.score ? 1 : -1;
  if (left.parsed.items.length !== right.parsed.items.length) return left.parsed.items.length > right.parsed.items.length ? 1 : -1;
  if (left.quality.score !== right.quality.score) return left.quality.score > right.quality.score ? 1 : -1;
  const leftConfidence = left.confidence ?? -1;
  const rightConfidence = right.confidence ?? -1;
  if (leftConfidence !== rightConfidence) return leftConfidence > rightConfidence ? 1 : -1;
  return 0;
}

export function chooseReceiptOcrCandidate(
  primary: ReceiptOcrCandidateAssessment,
  recovery?: ReceiptOcrCandidateAssessment,
): ReceiptOcrCandidateAssessment {
  if (!recovery) return primary;
  if ((recovery.profile === 'fiscal-region-recovery' || recovery.profile === 'fiscal-threshold-recovery')
      && !recovery.goodsReconcile
      && !recovery.paymentReconciles
      && recovery.score < primary.score + 12) {
    // A fiscal crop is a bounded rescue path, not an automatic replacement.
    // When neither candidate reconciles financially, require a material score
    // improvement before replacing the primary result with another weak guess.
    return primary;
  }
  return compareCandidateQuality(recovery, primary) > 0 ? recovery : primary;
}

export function shouldRetryReceiptFiscalThreshold(
  fiscal: ReceiptOcrCandidateAssessment,
  selected: ReceiptOcrCandidateAssessment,
  thresholdAvailable: boolean,
): boolean {
  if (!thresholdAvailable || fiscal.profile !== 'fiscal-region-recovery') return false;
  if (fiscal.goodsReconcile && (fiscal.paymentReconciles || fiscal.parsed.paymentTotalMinor === undefined)) return false;
  if (selected.goodsReconcile && selected.paymentReconciles && !hasWarning(selected.parsed, 'sum-mismatch')) return false;
  return fiscal.quality.financialScore < 55
    || fiscal.quality.textScore < 35
    || fiscal.score < 55
    || hasWarning(fiscal.parsed, 'sum-mismatch')
    || fiscal.parsed.items.length === 0;
}

export function shouldRecoverMerchantHeader(
  parsed: ParsedReceiptDraft,
  sourceType: ReceiptOcrSourceType,
): boolean {
  if (sourceType !== 'photo') return false;
  if (parsed.merchantConfidence === 'high') return false;
  if (!parsed.items.length || parsed.declaredTotalMinor === undefined) return false;
  if (parsed.unexplainedDifferenceMinor === undefined || Math.abs(parsed.unexplainedDifferenceMinor) > 1) return false;
  if (parsed.paymentTotalMinor !== undefined && Math.abs(parsed.paymentTotalMinor - parsed.declaredTotalMinor) > 1) return false;
  return true;
}
