import type { ParsedReceiptDraft, ParsedReceiptItem, ReceiptAdjustmentDraft, ReceiptMerchantDecision, ReceiptMerchantEvidenceKind, ReceiptMerchantRejectReason, ReceiptParseWarning, ReceiptOcrConfidence } from './receipt-ocr.types';
import { reconcileReceiptFinancials } from './receipt-financial-reconciliation';
import { reconstructColumnarReceiptText } from './receipt-columnar-reconstruction';

const META_LINE = /(?:\[\[RECEIPT_PAGE_BREAK\]\]|PARAGON\s+(?:NIE)?FISKALNY|\bNIP\b|\bREGON\b|\bKASA\b|\bKASJER\b|NUMER\s+PARAGONU|\bPTU\b|\bVAT\b|SPRZEDA[ŻZ]\s+OPODATKOWANA|SUMA\s+PTU|\bKARTA\b|GOT[ÓO]WKA|RESZTA|AUTORYZACJA|TERMINAL|P[ŁL]ATNO[ŚS][ĆC])/iu;
const TOTAL_LINE = /(?:DO\s+ZAP[ŁL]ATY|RAZEM|SUMA(?:\s+PLN)?)/iu;
const DISCOUNT_LABEL = /\b(?:RAB[AO]T|OPUST|BONUS|KUPON|PROMOCJ(?:A|E|I)?|OBNI[ŻZ]K(?:A|I)?|DISCOUNT)\b/iu;
const ADDRESS_LINE = /(?:\bul\.|\bal\.|\bpl\.|\bos\.|\d{2}-\d{3}\b)/iu;
const DATE_TOKEN = /\b(?:(\d{2})[.\-/](\d{2})[.\-/](\d{4})|(\d{4})-(\d{2})-(\d{2}))\b/g;
const DATE_PRESENT = /\b(?:\d{2}[.\-/]\d{2}[.\-/]\d{4}|\d{4}-\d{2}-\d{2})\b/;
const POLISH_TEXT_DATE_TOKEN = /\b(\d{1,2})\.?\s+(STY(?:CZNIA)?|LUT(?:EGO)?|MAR(?:CA)?|KWI(?:ETNIA)?|MAJ(?:A)?|CZE(?:RWCA)?|LIP(?:CA)?|SIE(?:RPNIA)?|WRZ(?:ESNIA)?|PAZ(?:DZIERNIKA)?|LIS(?:TOPADA)?|GRU(?:DNIA)?)\s+(\d{4})\b/gu;
const POLISH_MONTH_MINOR: Readonly<Record<string, number>> = {
  STY: 1, STYCZNIA: 1,
  LUT: 2, LUTEGO: 2,
  MAR: 3, MARCA: 3,
  KWI: 4, KWIETNIA: 4,
  MAJ: 5, MAJA: 5,
  CZE: 6, CZERWCA: 6,
  LIP: 7, LIPCA: 7,
  SIE: 8, SIERPNIA: 8,
  WRZ: 9, WRZESNIA: 9,
  PAZ: 10, PAZDZIERNIKA: 10,
  LIS: 11, LISTOPADA: 11,
  GRU: 12, GRUDNIA: 12,
};

const MIN_RECEIPT_YEAR = 2020;
const MAX_RECEIPT_YEAR = 2035;
const PRICE_TOKEN = /(?<!\d)([-−]?\s*(?:\d{1,3}(?:[\s\u00a0]\d{3})+|\d+)[,.][0-9OIl]{2})(?:\s*(?:PLN|Z[ŁL]))?([ABC])?(?:[XĆ€%Il|])?(?!\d)/giu;
const STRUCTURED_PRICE_TOKEN = /(?<!\d)([-−]?\s*(?:\d{1,3}(?:[\s\u00a0]\d{3})+|\d+)[,.][0-9OIl]{2})(?:\s*(?:PLN|Z[ŁL]))?([ABC])?([XĆ€%Il|48])?(?!\d)/giu;
const UNIT_ONLY_LINE = /^(?:\d+(?:[,.]\d+)?\s*)?(?:kg|g|mg|l|ml|cl|dl|szt\.?|opak(?:owanie)?|op\.?|luz)$/iu;
const ITEM_DESCRIPTOR_CONTINUATION = /^(?:KAUCJA|DEPOZYT)$/iu;

function collapse(value: string): string {
  return value.replace(/[\t\u00a0]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeForMatch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('pl-PL');
}

function structuralPrefixLooksNoisy(prefix: string): boolean {
  const compact = collapse(prefix);
  if (!compact) return true;
  if (compact.length > 10) return false;
  const tokens = compact.split(/\s+/u).filter(Boolean);
  if (/^[\d\W_]+$/u.test(compact)) return true;
  const semanticTokens = tokens
    .map((token) => token.replace(/[^A-Z0-9]/gu, ''))
    .filter(Boolean);
  return semanticTokens.length <= 3 && semanticTokens.every((token) => token.length <= 4);
}

/**
 * Extracts a fiscal/payment structural line from behind a very short OCR-garbage
 * prefix. The returned view is parser-only: diagnostics keep the raw OCR text.
 * Strong marker shape is required, so ordinary product names containing words
 * such as "suma" are not trimmed.
 */
export function normalizeReceiptStructuralLine(line: string): string {
  let normalized = normalizeForMatch(collapse(line));
  normalized = normalized
    .replace(/\bPL(?:II|I1|1I|11)\b/gu, 'PLN')
    .replace(/\b(?:D0|0O|00)\s+ZAP[ŁL]ATY\b/gu, 'DO ZAPŁATY');

  const marker = /(?:PARAGON\s+(?:NIE)?FISKALNY\b|SUMA\s+(?:PTU|VAT|PLN)\b|SUMA\s+(?=[-−]?\s*\d+[,.]\d{2}\b)|DO\s+ZAP[ŁL]ATY\b|RAZEM(?:\s+PLN)?\b|S?P\.?\s*OP\.?\s*[A-G]?\b|SPRZEDA.{0,5}\s+OPODATKOWANA\b|PTU\s+[A-G]\b|VAT\s+[A-G]?\b|ROZLICZENIE\s+P[ŁL]ATNO[ŚS][ĆC]I\b|ZAP[ŁL]ACONO\s+(?:KARTA|GOT[ÓO]WKA|BON)\b|KARTA(?:\s+P[ŁL]ATNICZA)?\b|GOT[ÓO]WKA\b|BON\b)/u.exec(normalized);
  if (!marker || marker.index === 0) return normalized;
  const prefix = normalized.slice(0, marker.index).trim();
  return structuralPrefixLooksNoisy(prefix) ? normalized.slice(marker.index).trim() : normalized;
}

function hasDiscountLabel(line: string): boolean {
  const normalized = normalizeForMatch(collapse(line));
  return !/[ŁL]ACZNIE/u.test(normalized) && DISCOUNT_LABEL.test(normalized);
}

function isDiscountCandidateLine(line: string): boolean {
  if (!hasDiscountLabel(line)) return false;
  const prices = findPrices(line);
  if (prices.some((price) => price.amountMinor < 0)) return true;
  if (prices.length > 0) return false;
  const normalized = normalizeForMatch(collapse(line));
  // Keep percentage-only discounts visible as unresolved adjustments instead of
  // silently dropping them. Also admit a narrowly shaped damaged negative money
  // token so FIX1K-style recovery can validate it against an independently
  // printed final amount. Neither path invents a monetary value by itself.
  if (/\b\d{1,3}\s*%\s*$/u.test(normalized)) return true;
  if (/[-−]\s*[0-9OIL]+(?:[,.][0-9OIL\/]{1,4}|\/[0-9OIL]{1,4})(?:[ABCĆX€%IL|])?\s*$/u.test(normalized)) return true;
  return /(?:RAB[AO]T|OPUST|BONUS|KUPON|PROMOCJ(?:A|E|I)?|OBNIZK(?:A|I)?|DISCOUNT)[:;.\-]*$/u.test(normalized);
}

function calendarDate(year: number, month: number, day: number): string | undefined {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return undefined;
  if (year < MIN_RECEIPT_YEAR || year > MAX_RECEIPT_YEAR) return undefined;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return undefined;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDateCandidate(match: RegExpExecArray): string | undefined {
  const year = Number(match[4] ?? match[3]);
  const month = Number(match[5] ?? match[2]);
  const day = Number(match[6] ?? match[1]);
  return calendarDate(year, month, day);
}

function lineContainsReceiptDate(line: string): boolean {
  if (DATE_PRESENT.test(line)) return true;
  POLISH_TEXT_DATE_TOKEN.lastIndex = 0;
  return POLISH_TEXT_DATE_TOKEN.test(normalizeForMatch(collapse(line)));
}

export function parseReceiptPriceMinor(value: string): number | undefined {
  const compact = value
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/[\s\u00a0]/g, '')
    .replace(/[Oo]/g, '0')
    .replace(/[Il]/g, '1');
  const match = /^(-?)(\d+)[,.](\d{2})$/.exec(compact);
  if (!match) return undefined;
  const whole = Number(match[2]);
  const fraction = Number(match[3]);
  if (!Number.isSafeInteger(whole) || fraction > 99) return undefined;
  const minor = whole * 100 + fraction;
  return match[1] ? -minor : minor;
}

interface PriceHit {
  start: number;
  end: number;
  amountMinor: number;
  raw: string;
  taxMarker?: string;
}

function findPrices(line: string): PriceHit[] {
  const results: PriceHit[] = [];
  PRICE_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PRICE_TOKEN.exec(line))) {
    const amountMinor = parseReceiptPriceMinor(match[1]!);
    if (amountMinor === undefined) continue;
    results.push({
      start: match.index,
      end: PRICE_TOKEN.lastIndex,
      amountMinor,
      raw: match[0],
      ...(match[2] ? { taxMarker: match[2].toLocaleUpperCase('pl-PL') } : {}),
    });
  }
  return results;
}

function findStructuredPrices(line: string): PriceHit[] {
  const results: PriceHit[] = [];
  STRUCTURED_PRICE_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = STRUCTURED_PRICE_TOKEN.exec(line))) {
    const amountMinor = parseReceiptPriceMinor(match[1]!);
    if (amountMinor === undefined) continue;
    results.push({
      start: match.index,
      end: STRUCTURED_PRICE_TOKEN.lastIndex,
      amountMinor,
      raw: match[0],
      ...(match[2] ? { taxMarker: match[2].toLocaleUpperCase('pl-PL') } : {}),
    });
  }
  return results;
}

function isTaxSectionStart(line: string): boolean {
  const normalized = normalizeReceiptStructuralLine(line);
  return /^(?:S?P\.?\s*OP\.?|SPRZEDA.{0,4}\s+OPODATK|PTU\b|SUMA\s+PTU\b)/u.test(normalized);
}

function isMetadata(line: string): boolean {
  const normalized = normalizeReceiptStructuralLine(line);
  return META_LINE.test(normalized) || /^(?:FISKALNY|SPRZEDA[ŻZ]|NR\b|NR\.|S\/N\b)/iu.test(normalized);
}

function totalPriority(line: string): number {
  const normalized = normalizeReceiptStructuralLine(line);
  if (/SUMA\s+PTU|SUMA\s+VAT/u.test(normalized)) return -1;
  if (/DO\s+ZAP[ŁL]ATY/u.test(normalized)) return 100;
  if (/\bRAZEM\b/u.test(normalized)) return 90;
  if (/\bSUMA\s+PLN\b/u.test(normalized)) return 85;
  if (/\bSUMA\b/u.test(normalized)) return 80;
  return -1;
}

interface ReceiptTotals {
  declaredTotalMinor?: number;
  ocrSubtotalMinor?: number;
  taxTotalMinor?: number;
  depositTotalMinor?: number;
  finalPayableMinor?: number;
  paymentTotalMinor?: number;
}

function lastPositivePrice(line: string): number | undefined {
  const prices = findPrices(line).filter((price) => price.amountMinor >= 0);
  return prices.length ? prices[prices.length - 1]!.amountMinor : undefined;
}

function isTaxContextLine(line: string): boolean {
  const normalized = normalizeReceiptStructuralLine(line);
  return /(?:\bPTU\b|\bVAT\b|SPRZEDA.{0,4}\s+OPODATKOWANA|KWOTA\s+[A-G]\b.*%|SUMA\s+(?:PTU|VAT)\b)/u.test(normalized);
}

function genericSumLooksTaxScoped(lines: readonly string[], index: number, amountMinor: number): boolean {
  const previous = lines[index - 1] ?? '';
  const previousNormalized = normalizeReceiptStructuralLine(previous);
  // An explicit SUM(A) PTU/VAT line terminates the tax subtotal block. A later
  // plain SUMA is therefore allowed to be the receipt total again.
  if (/^SUMA?\s+(?:PTU|VAT)\b/u.test(previousNormalized)) return false;

  // A generic SUMA is tax-scoped only when its amount is explained by the local
  // percentage-bearing tax rows immediately above it. This keeps a local tax
  // subtotal out of final totals while avoiding the old global VAT-context
  // failure where a later receipt total could be lost.
  const from = Math.max(0, index - 8);
  let localTaxAmountMinor = 0;
  let taxAmountLines = 0;
  for (let cursor = index - 1; cursor >= from; cursor -= 1) {
    const line = lines[cursor] ?? '';
    const normalized = normalizeReceiptStructuralLine(line);
    if (/^(?:DO\s+ZAP[ŁL]ATY|RAZEM|SUMA\s+PLN)\b/u.test(normalized)) break;
    if (/%/u.test(normalized) && isTaxContextLine(line)) {
      const taxAmount = lastPositivePrice(line);
      if (taxAmount !== undefined) {
        localTaxAmountMinor += taxAmount;
        taxAmountLines += 1;
      }
      continue;
    }
    // Once we have captured tax-amount rows, a non-tax structural line ends the
    // local block; ordinary product/header lines above must not leak context.
    if (taxAmountLines > 0 && !isTaxContextLine(line)) break;
  }
  return taxAmountLines > 0 && Math.abs(localTaxAmountMinor - amountMinor) <= 1;
}

function isPaymentLine(normalized: string): boolean {
  return /^(?:P[ŁL]ATNO[ŚS][ĆC]\s+)?(?:(?:ZAP[ŁL]ACONO\s+)?KARTA(?:\s+P[ŁL]ATNICZA)?|GOT[ÓO]WKA|BON)\b/u.test(normalized);
}

function detectReceiptTotals(lines: string[]): ReceiptTotals {
  let subtotal: { amountMinor: number; index: number } | undefined;
  let genericTotal: { amountMinor: number; index: number } | undefined;
  let finalPayable: { amountMinor: number; index: number } | undefined;
  let depositTotal: { amountMinor: number; index: number } | undefined;
  let taxTotal: { amountMinor: number; index: number } | undefined;
  const strongFinals: { amountMinor: number; index: number; priority: number }[] = [];
  let paymentTotalMinor = 0;
  let paymentLines = 0;

  lines.forEach((line, index) => {
    const normalized = normalizeReceiptStructuralLine(line);
    const amountMinor = lastPositivePrice(line);
    if (amountMinor === undefined) return;

    if (isPaymentLine(normalized)) {
      paymentTotalMinor += amountMinor;
      paymentLines += 1;
      return;
    }
    if (/^DO\s+ZAP[ŁL]ATY\b/u.test(normalized)) {
      finalPayable = { amountMinor, index };
      strongFinals.push({ amountMinor, index, priority: 120 });
      return;
    }
    if (/^RAZEM(?:\s+PLN)?\b/u.test(normalized)) {
      strongFinals.push({ amountMinor, index, priority: /\bPLN\b/u.test(normalized) ? 112 : 108 });
      return;
    }
    if (/^OPAKOWANIA\s+ZWROTNE\s+SUMA\b/u.test(normalized)) {
      depositTotal = { amountMinor, index };
      return;
    }
    if (/^SUMA\s+(?:PTU|VAT)\b/u.test(normalized)) {
      taxTotal = { amountMinor, index };
      return;
    }
    if (/^SUMA\s+PLN\b/u.test(normalized)) {
      subtotal = { amountMinor, index };
      return;
    }
    if (/^SUMA\b/u.test(normalized)) {
      if (genericSumLooksTaxScoped(lines, index, amountMinor)) taxTotal = { amountMinor, index };
      else genericTotal = { amountMinor, index };
    }
  });

  const paymentTotal = paymentLines ? paymentTotalMinor : undefined;
  const genericAfterDeposit = depositTotal && genericTotal && genericTotal.index > depositTotal.index
    ? genericTotal
    : undefined;

  const rankedStrong = strongFinals.slice().sort((a, b) => b.priority - a.priority || b.index - a.index);
  let strongFinal = rankedStrong[0];
  if (paymentTotal !== undefined && rankedStrong.length >= 2) {
    const paymentConfirmed = rankedStrong.filter((candidate) => Math.abs(candidate.amountMinor - paymentTotal) <= 1);
    if (paymentConfirmed.length >= 2 || (paymentConfirmed.length >= 1 && new Set(rankedStrong.map((candidate) => candidate.amountMinor)).size === 1)) {
      strongFinal = paymentConfirmed.slice().sort((a, b) => b.priority - a.priority || b.index - a.index)[0];
    }
  }

  let resolvedFinal = finalPayable ?? strongFinal;
  if (!resolvedFinal && genericAfterDeposit) {
    const subtotalEvidence = subtotal?.amountMinor;
    const paymentConfirmsSubtotalPlusDeposit = paymentTotal !== undefined
      && subtotalEvidence !== undefined
      && depositTotal !== undefined
      && Math.abs(subtotalEvidence + depositTotal.amountMinor - paymentTotal) <= 1;
    const genericConflictsPayment = paymentTotal !== undefined
      && Math.abs(genericAfterDeposit.amountMinor - paymentTotal) > 1;
    // A damaged generic SUMA after the deposit section must not beat two
    // independent equations (subtotal + deposit and payment). Preserve the
    // generic value when it agrees with payment or when no stronger structure
    // exists.
    resolvedFinal = paymentConfirmsSubtotalPlusDeposit && genericConflictsPayment
      ? { amountMinor: paymentTotal!, index: lines.length }
      : genericAfterDeposit;
  }
  if (!resolvedFinal && depositTotal && paymentTotal !== undefined) {
    const subtotalEvidence = subtotal?.amountMinor;
    const paymentReconcilesStructure = subtotalEvidence !== undefined
      && Math.abs(subtotalEvidence + depositTotal.amountMinor - paymentTotal) <= 1;
    if (paymentReconcilesStructure || subtotalEvidence !== undefined) {
      resolvedFinal = { amountMinor: paymentTotal, index: lines.length };
    }
  }

  const declaredTotalMinor = resolvedFinal?.amountMinor
    ?? genericTotal?.amountMinor
    ?? subtotal?.amountMinor;

  return {
    ...(declaredTotalMinor === undefined ? {} : { declaredTotalMinor }),
    ...(subtotal === undefined ? {} : { ocrSubtotalMinor: subtotal.amountMinor }),
    ...(taxTotal === undefined ? {} : { taxTotalMinor: taxTotal.amountMinor }),
    ...(depositTotal ? { depositTotalMinor: depositTotal.amountMinor } : {}),
    ...(resolvedFinal ? { finalPayableMinor: resolvedFinal.amountMinor } : {}),
    ...(paymentTotal === undefined ? {} : { paymentTotalMinor: paymentTotal }),
  };
}

function detectAggregateDiscount(lines: string[]): number | undefined {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const normalized = normalizeForMatch(collapse(line));
    if (/(?:OPUSTY\s+[ŁL]ACZNIE|UDZIELONO\s+[ŁL]ACZNIE\s+OPUSTOW)/u.test(normalized)) {
      const negative = findPrices(line).find((price) => price.amountMinor < 0);
      if (negative) return negative.amountMinor;
      const positive = lastPositivePrice(line);
      if (positive !== undefined) return -Math.abs(positive);
    }
    if (!/(?:ZAOSZCZ[ĘE]DZONO|OSZCZ[ĘE]DNO[ŚS][ĆC])/u.test(normalized)) continue;
    const sameLine = lastPositivePrice(line);
    if (sameLine !== undefined) return -Math.abs(sameLine);
    for (let offset = 1; offset <= 2; offset += 1) {
      const next = lines[index + offset];
      if (!next) break;
      const positive = lastPositivePrice(next);
      if (positive !== undefined) return -Math.abs(positive);
      if (findStructuredPrices(next).length || isMetadata(next) || totalPriority(next) >= 0) break;
    }
  }
  return undefined;
}


export interface ReceiptStructuralRegions {
  fiscalMarkerIndex: number;
  fiscalStartIndex: number;
  itemStartIndex: number;
  itemEndIndex: number;
  paymentStartIndex: number;
  dateWindowStartIndex: number;
  dateWindowEndIndex: number;
  footerContaminationDetected: boolean;
}

function isFiscalCoreBoundary(line: string): boolean {
  const normalized = normalizeReceiptStructuralLine(line);
  return isTaxSectionStart(line)
    || isFinalPayableLine(line)
    || isPaymentOrFooterLine(line)
    || /^(?:SUMA\s+PLN\b|RAZEM(?:\s+PLN)?\b|DO\s+ZAP[ŁL]ATY\b)/u.test(normalized);
}

export function analyzeReceiptStructuralRegions(lines: readonly string[]): ReceiptStructuralRegions {
  const fiscalMarkerIndex = lines.findIndex((line) => /^PARAGON\s+(?:NIE)?FISKALNY\b/u.test(normalizeReceiptStructuralLine(line)));
  const fiscalStartIndex = fiscalMarkerIndex >= 0 ? fiscalMarkerIndex : 0;
  const itemStartIndex = fiscalMarkerIndex >= 0 ? Math.min(lines.length, fiscalMarkerIndex + 1) : 0;

  let itemEndIndex = lines.length;
  for (let index = itemStartIndex; index < lines.length; index += 1) {
    if (isFiscalCoreBoundary(lines[index] ?? '')) {
      itemEndIndex = index;
      break;
    }
  }

  let paymentStartIndex = lines.length;
  for (let index = Math.max(itemStartIndex, itemEndIndex); index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (isFinalPayableLine(line) || isPaymentOrFooterLine(line)) {
      paymentStartIndex = index;
      break;
    }
  }

  const dateWindowStartIndex = fiscalMarkerIndex >= 0 ? Math.max(0, fiscalMarkerIndex - 4) : 0;
  const dateWindowEndIndex = paymentStartIndex < lines.length
    ? Math.min(lines.length, paymentStartIndex + 14)
    : Math.min(lines.length, Math.max(itemEndIndex + 14, 18));

  const trailing = lines.slice(dateWindowEndIndex);
  const trailingVisible = trailing.filter((line) => /[\p{L}\p{N}]/u.test(line));
  const footerContaminationDetected = trailingVisible.length >= 3;

  return {
    fiscalMarkerIndex,
    fiscalStartIndex,
    itemStartIndex,
    itemEndIndex,
    paymentStartIndex,
    dateWindowStartIndex,
    dateWindowEndIndex,
    footerContaminationDetected,
  };
}

export function diagnoseReceiptStructuralText(rawText: string): ReceiptStructuralRegions {
  const reconstructed = reconstructColumnarReceiptText(rawText);
  const lines = reconstructed.text.split(/\r?\n/u).map(collapse).filter(Boolean);
  return analyzeReceiptStructuralRegions(lines);
}

export type ReceiptDateRejectReason = 'none' | 'missing' | 'out-of-range' | 'invalid-calendar' | 'outside-fiscal-window' | 'ambiguous';

export interface ReceiptDateDiagnostic {
  date?: string;
  decision: 'accepted' | 'rejected' | 'unresolved';
  rejectReason: ReceiptDateRejectReason;
}

function rawDateYear(match: RegExpExecArray): number {
  return Number(match[4] ?? match[3]);
}

interface ReceiptDateCandidate {
  date: string;
  lineIndex: number;
  kind: 'numeric' | 'text';
  score: number;
}

function detectDate(lines: string[], warnings: ReceiptParseWarning[]): { date?: string; confidence: ReceiptOcrConfidence } {
  const candidates: ReceiptDateCandidate[] = [];
  const regions = analyzeReceiptStructuralRegions(lines);
  const allowedStart = regions.dateWindowStartIndex;
  const allowedEnd = regions.dateWindowEndIndex;

  lines.forEach((line, lineIndex) => {
    if (lineIndex < allowedStart || lineIndex >= allowedEnd) return;

    DATE_TOKEN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = DATE_TOKEN.exec(line))) {
      const date = parseDateCandidate(match);
      if (date) candidates.push({
        date,
        lineIndex,
        kind: 'numeric',
        score: 50
          + (/:\d{2}(?::\d{2})?/u.test(line) ? 8 : 0)
          + (lineIndex >= regions.itemEndIndex ? 5 : 0)
          + Math.max(0, 8 - Math.abs(lineIndex - regions.itemEndIndex)),
      });
    }

    const normalized = normalizeForMatch(collapse(line));
    POLISH_TEXT_DATE_TOKEN.lastIndex = 0;
    while ((match = POLISH_TEXT_DATE_TOKEN.exec(normalized))) {
      const day = Number(match[1]);
      const month = POLISH_MONTH_MINOR[match[2] ?? ''];
      const year = Number(match[3]);
      if (month === undefined) continue;
      const date = calendarDate(year, month, day);
      if (date) candidates.push({
        date,
        lineIndex,
        kind: 'text',
        score: 58 + Math.max(0, 10 - Math.abs(lineIndex - regions.itemEndIndex)),
      });
    }
  });

  if (!candidates.length) {
    warnings.push({ code: 'date-missing', message: 'Nie rozpoznano wiarygodnej daty paragonu.' });
    return { confidence: 'low' };
  }

  const counts = new Map<string, number>();
  for (const candidate of candidates) counts.set(candidate.date, (counts.get(candidate.date) ?? 0) + 1);
  const ranked = candidates
    .map((candidate) => ({ ...candidate, score: candidate.score + Math.min(18, ((counts.get(candidate.date) ?? 1) - 1) * 9) }))
    .sort((a, b) => b.score - a.score || a.lineIndex - b.lineIndex || (a.kind === 'text' ? -1 : 1));
  const preferred = ranked[0]!;
  const unique = [...new Set(candidates.map((candidate) => candidate.date))];
  if (unique.length > 1) {
    warnings.push({ code: 'date-ambiguous', message: 'Wykryto kilka dat. Sprawdź datę sprzedaży.' });
    return { date: preferred.date, confidence: 'medium' };
  }
  return { date: preferred.date, confidence: 'high' };
}

export function diagnoseReceiptDateText(rawText: string): ReceiptDateDiagnostic {
  const reconstructed = reconstructColumnarReceiptText(rawText);
  const lines = reconstructed.text.split(/\r?\n/u).map(collapse).filter(Boolean);
  const parsedWarnings: ReceiptParseWarning[] = [];
  const detected = detectDate(lines, parsedWarnings);
  if (detected.date) {
    return {
      date: detected.date,
      decision: 'accepted',
      rejectReason: parsedWarnings.some((warning) => warning.code === 'date-ambiguous') ? 'ambiguous' : 'none',
    };
  }

  const regions = analyzeReceiptStructuralRegions(lines);
  let sawOutOfRange = false;
  let sawInvalidCalendar = false;
  let sawOutsideWindow = false;
  lines.forEach((line, lineIndex) => {
    DATE_TOKEN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = DATE_TOKEN.exec(line))) {
      const year = rawDateYear(match);
      const inWindow = lineIndex >= regions.dateWindowStartIndex && lineIndex < regions.dateWindowEndIndex;
      if (!inWindow) {
        sawOutsideWindow = true;
        continue;
      }
      if (year < MIN_RECEIPT_YEAR || year > MAX_RECEIPT_YEAR) {
        sawOutOfRange = true;
        continue;
      }
      if (!parseDateCandidate(match)) sawInvalidCalendar = true;
    }
  });

  const rejectReason: ReceiptDateRejectReason = sawOutOfRange
    ? 'out-of-range'
    : sawInvalidCalendar
      ? 'invalid-calendar'
      : sawOutsideWindow
        ? 'outside-fiscal-window'
        : 'missing';
  return { decision: rejectReason === 'missing' ? 'unresolved' : 'rejected', rejectReason };
}


function merchantHeaderWindow(lines: string[]): { start: number; end: number } {
  const paragonIndex = lines.findIndex((line) => /^PARAGON\s+(?:NIE)?FISKALNY\b/u.test(normalizeReceiptStructuralLine(line)));
  if (paragonIndex < 0) return { start: 0, end: Math.min(lines.length, 12) };
  return {
    start: Math.max(0, paragonIndex - 12),
    end: paragonIndex,
  };
}

function merchantReject(line: string): boolean {
  const collapsed = collapse(line);
  const normalized = normalizeForMatch(collapsed);
  const legalFragmentKey = normalized.replace(/[^A-Z]/gu, '');
  if (!collapsed || collapsed.length < 2 || collapsed.length > 100) return true;
  if (['ZOO', 'ZOOSPK', 'SPZOO', 'SPK', 'SA', 'SC'].includes(legalFragmentKey)) return true;
  if (isMetadata(collapsed) || TOTAL_LINE.test(normalized) || lineContainsReceiptDate(collapsed) || ADDRESS_LINE.test(collapsed) || findPrices(collapsed).length) return true;
  if (/\b(?:NIP|REGON|TEL|TELEFON|NR\.?\s*(?:DOK|SKLEPU)?|KASA|KASJER|BDO|EMV|TRANSAKCJ)\b/u.test(normalized) || /\bPOCZTA\s*:/u.test(normalized)) return true;
  if (/^\d+[\s/.-]*$/u.test(normalized)) return true;

  const visible = [...collapsed].filter((character) => !/\s/u.test(character));
  const letters = visible.filter((character) => /\p{L}/u.test(character));
  const digits = visible.filter((character) => /\d/u.test(character));
  const punctuation = visible.filter((character) => /[^\p{L}\p{N}.&'\-]/u.test(character));
  if (visible.length >= 5 && letters.length / visible.length < 0.55) return true;
  if (punctuation.length >= 3 && punctuation.length >= Math.max(3, Math.floor(letters.length / 3))) return true;
  if (digits.length > 0 && digits.length >= letters.length) return true;

  const words = collapsed.split(/\s+/u).filter(Boolean);
  const shortAlphabetic = words.filter((word) => /^\p{L}{1,2}$/u.test(word.replace(/[^\p{L}]/gu, ''))).length;
  if (words.length >= 4 && shortAlphabetic >= Math.ceil(words.length * 0.6)) return true;
  return false;
}

type MerchantCandidateKind = 'plain' | 'legal' | 'domain' | 'descriptor' | 'context';

interface MerchantCandidate {
  sourceLine: string;
  display: string;
  score: number;
  index: number;
  kind: MerchantCandidateKind;
  brandKey: string;
}

function cleanMerchantDisplay(value: string): string {
  return collapse(value)
    .replace(/^["'`~_.,:;()\[\]{}\-\s]+|["'`~_.,:;()\[\]{}\-\s]+$/gu, '')
    // A detached leading zero is a recurring logo/OCR residue (for example
    // "0 Brand"). Strip only the isolated digit 0 before an alphabetic
    // candidate; do not touch legitimate numbered brands such as "7 Eleven".
    .replace(/^0\s+(?=\p{L}{2})/u, '')
    .replace(/\s{2,}/gu, ' ')
    .trim();
}

function cleanMerchantAnchoredNoise(value: string): string {
  const cleaned = cleanMerchantDisplay(value);
  const normalized = normalizeForMatch(cleaned);
  const hasLegalForm = /\b(?:S\.?\s*A\.?|SP\.?\s+Z\s+[O0]\.?\s*[O0]\.?|SPO[LŁ]KA\s+Z\s+[O0]\.?\s*[O0]\.?|SP\.?\s*K\.?|S\.?\s*C\.?)\b/u.test(normalized);
  if (!hasLegalForm) return cleaned;
  return cleaned.replace(/^\p{L}\s+(?=\p{L}{3})/u, '').trim();
}


function merchantBrandKey(value: string): string {
  return normalizeForMatch(cleanMerchantDisplay(value))
    .replace(/\b(?:S\.?\s*A\.?|SP\.?\s+Z\s+[O0]\.?[O0]\.?|SPO[LŁ]KA\s+Z\s+[O0]\.?[O0]\.?|SP\.?\s*K\.?|S\.?\s*C\.?)\b/gu, ' ')
    .replace(/[^A-Z0-9]+/gu, '')
    .trim();
}

function merchantCandidatesCompatible(left: MerchantCandidate, right: MerchantCandidate): boolean {
  if (left.kind === right.kind) return left.brandKey === right.brandKey;
  const a = left.brandKey;
  const b = right.brandKey;
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (shorter.length >= 2 && longer.length - shorter.length <= 1 && longer.startsWith(shorter)) return true;
  if (a.length >= 4 && b.length >= 4 && Math.abs(a.length - b.length) <= 1) {
    let edits = 0;
    const length = Math.min(a.length, b.length);
    for (let index = 0; index < length; index += 1) if (a[index] !== b[index]) edits += 1;
    edits += Math.abs(a.length - b.length);
    return edits <= 1;
  }
  return false;
}

function cleanLegalMerchantDisplay(value: string): string {
  return cleanMerchantDisplay(value
    .replace(/\b(?:S\.?\s*A\.?|SP\.?\s+Z\s+[O0]\.?\s*[O0]\.?|SP[ÓO]ŁKA\s+Z\s+[O0]\.?\s*[O0]\.?|SP\.?\s*K\.?|S\.?\s*C\.?)\s*$/iu, '')
  );
}

function merchantLooksLikeSlogan(value: string): boolean {
  const normalized = normalizeForMatch(value);
  const words = normalized.split(/\s+/u).filter(Boolean);
  if (words.length < 2) return false;
  const genericMarketing = new Set([
    'CODZIENNIE', 'CENY', 'CENA', 'NISKIE', 'DOBRE', 'NAJTANSZE', 'PROMOCJE',
    'PROMOCJA', 'ZAPRASZAMY', 'DZIEKUJEMY', 'TANIEJ', 'JAKOSC', 'NAJWYZSZA',
  ]);
  return words.filter((word) => genericMarketing.has(word)).length >= Math.min(2, words.length);
}

function cleanMerchantContextBrand(value: string): string {
  let display = cleanMerchantDisplay(value)
    .replace(/^(?:Z|W|DLA)\s+/iu, '')
    .replace(/\b(?:PROGRAM|PROGRAMU|KLUB|CLUB|KARTA|CARD|APLIKACJA|APP|PLUS)\b/giu, ' ');
  display = cleanMerchantDisplay(display);
  if (!display || merchantReject(display) || merchantLooksLikeSlogan(display)) return '';
  const words = display.split(/\s+/u).filter(Boolean);
  if (words.length > 3) return '';
  if (!words.every((word) => /^[\p{L}][\p{L}\p{N}&'.-]{1,24}$/u.test(word))) return '';
  return display;
}

function merchantContextCandidates(lines: readonly string[]): MerchantCandidate[] {
  const candidates: MerchantCandidate[] = [];
  const regions = analyzeReceiptStructuralRegions(lines);
  const evidenceEnd = Math.max(
    regions.itemStartIndex,
    Math.min(lines.length, regions.itemEndIndex),
  );
  lines.slice(0, evidenceEnd).forEach((line, index) => {
    const collapsed = collapse(line);
    const normalized = normalizeForMatch(collapsed);

    // Legal evidence may sit on the same OCR line as registry/address noise.
    // Capture only the contiguous alphabetic brand phrase immediately before
    // a Polish company-form marker instead of accepting the whole noisy line.
    const embeddedLegal = /([\p{L}][\p{L}&'.-]{1,30}(?:\s+[\p{L}][\p{L}&'.-]{1,30}){0,2})\s+SP\.?(?=\s|$)/iu.exec(collapsed);
    if (embeddedLegal?.[1]) {
      const display = cleanMerchantDisplay(embeddedLegal[1]);
      if (display.length >= 2 && !merchantLooksLikeSlogan(display)) {
        candidates.push({ sourceLine: collapsed, display, score: 70 - Math.min(index, 20), index, kind: 'legal', brandKey: merchantBrandKey(display) });
      }
    }

    const discountMatch = DISCOUNT_LABEL.exec(normalized);
    if (discountMatch && discountMatch.index > 0) {
      const display = cleanMerchantContextBrand(collapsed.slice(0, discountMatch.index));
      if (display) candidates.push({ sourceLine: collapsed, display, score: 56 - Math.min(index, 24), index, kind: 'context', brandKey: merchantBrandKey(display) });
    }

    const savingsMatch = /(?:ZAOSZCZ[ĘE]DZONO|OSZCZ[ĘE]DNO[ŚS][ĆC])/iu.exec(normalized);
    if (savingsMatch && savingsMatch.index > 0) {
      const display = cleanMerchantContextBrand(collapsed.slice(0, savingsMatch.index));
      if (display) candidates.push({ sourceLine: collapsed, display, score: 58 - Math.min(index, 24), index, kind: 'context', brandKey: merchantBrandKey(display) });
    }
  });
  return candidates.filter((candidate) => candidate.brandKey.length >= 3);
}

function merchantConsensusCandidate(candidates: readonly MerchantCandidate[]): MerchantCandidate | undefined {
  const groups: MerchantCandidate[][] = [];
  for (const candidate of candidates) {
    const matching = groups.find((group) => group.some((entry) => merchantCandidatesCompatible(entry, candidate)));
    if (matching) matching.push(candidate);
    else groups.push([candidate]);
  }

  const ranked = groups
    .map((group) => ({
      key: group.slice().sort((a, b) => b.brandKey.length - a.brandKey.length)[0]?.brandKey ?? '',
      group,
      kinds: new Set(group.map((candidate) => candidate.kind)),
      score: group.reduce((sum, candidate) => sum + Math.max(0, candidate.score), 0),
    }))
    .filter((entry) => entry.kinds.size >= 2 || (entry.group.filter((candidate) => candidate.kind === 'context').length >= 2))
    .sort((a, b) => b.kinds.size - a.kinds.size || b.score - a.score || b.key.length - a.key.length);
  const winner = ranked[0];
  if (!winner) return undefined;

  // Prefer the most complete candidate inside the winning consensus group.
  // A legal/domain candidate can therefore restore a character that a store
  // descriptor lost in OCR, without inventing characters that occur nowhere.
  const preferred = winner.group.slice().sort((a, b) => {
    const rank = (candidate: MerchantCandidate) => candidate.kind === 'domain' ? 6 : candidate.kind === 'legal' ? 5 : candidate.kind === 'descriptor' ? 4 : candidate.kind === 'context' ? 3 : 2;
    return b.brandKey.length - a.brandKey.length || rank(b) - rank(a) || b.score - a.score || b.display.length - a.display.length;
  })[0]!;
  const cleanBrand = preferred.kind === 'legal' ? cleanLegalMerchantDisplay(preferred.display) : preferred.display;
  return { ...preferred, display: cleanBrand || preferred.display, score: preferred.score + 34 };
}

function merchantCandidateFromLine(line: string, index: number): MerchantCandidate | undefined {
  let original = cleanMerchantAnchoredNoise(collapse(line));
  const searchable = normalizeForMatch(original);
  const embeddedDomain = /(?:WWW\.)?([A-Z0-9-]{2,})\.(?:PL|EU|COM|NET|ORG)(?:\.[A-Z]{2})?/iu.exec(searchable);
  if (embeddedDomain?.[1]) {
    const display = cleanMerchantDisplay(embeddedDomain[1]);
    return {
      sourceLine: collapse(line),
      display,
      score: 64 - index * 2,
      index,
      kind: 'domain',
      brandKey: merchantBrandKey(display),
    };
  }

  // Receipts often OCR the legal entity and the street address as one physical
  // line. Preserve the legal prefix as merchant evidence instead of rejecting
  // the entire line because it also contains "ul." or a postal code.
  const legalPrefix = /^(.{2,60}?\b(?:S\.?\s*A\.?|SP\.?\s+Z\s+[O0]\.?\s*[O0]\.?|SP[ÓO]ŁKA\s+Z\s+[O0]\.?\s*[O0]\.?|SP\.?\s*K\.?|S\.?\s*C\.?))(?=\s+(?:UL\.?|AL\.?|PL\.?|OS\.?|\d{2}-\d{3}\b))/iu.exec(original);
  if (legalPrefix?.[1]) original = cleanMerchantDisplay(legalPrefix[1]);
  if (merchantReject(original)) return undefined;
  const normalized = normalizeForMatch(original);
  const letters = [...original].filter((character) => /[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/u.test(character));
  if (letters.length < 2) return undefined;

  let display = original;
  let brandBonus = 0;
  let kind: MerchantCandidateKind = 'plain';
  const descriptor = /^(?:SALON\s+FIRMOWY|SALON|PUNKT\s+SPRZEDA[ŻZ]Y)\s+(.+)$/iu.exec(original);
  if (descriptor?.[1]) {
    display = cleanMerchantDisplay(descriptor[1]);
    brandBonus += 28;
    kind = 'descriptor';
  } else {
    const shopDescriptor = /^SKLEP\s+(.+)$/iu.exec(original);
    if (shopDescriptor?.[1]) {
      const remainder = cleanMerchantDisplay(shopDescriptor[1]);
      const genericShopType = /^(?:SPO[ŻZ]YWCZY|TESTOWY|FIRMOWY|INTERNETOWY|MONOPOLOWY|ODZIE[ŻZ]OWY|OBUWNICZY|PRZEMYS[ŁL]OWY|WIELOBRAN[ŻZ]OWY)(?:\s|$)/u.test(normalizeForMatch(remainder));
      if (!genericShopType) {
        display = remainder;
        brandBonus += 24;
        kind = 'descriptor';
      }
    }
  }

  const mall = /^(.+?)\s+C\.?\s*H\.?\s+.+$/iu.exec(display);
  if (mall?.[1] && /[\p{L}]/u.test(mall[1])) {
    display = cleanMerchantDisplay(mall[1]);
    brandBonus += 24;
    kind = 'descriptor';
  }

  const domain = /^(?:WWW\.)?([A-Z0-9-]{2,})\.(?:PL|EU|COM|NET|ORG)(?:\.[A-Z]{2})?$/iu.exec(normalized);
  if (domain?.[1]) {
    display = domain[1];
    brandBonus += 20;
    kind = 'domain';
  }

  display = cleanMerchantDisplay(display);
  if (display.length < 2 || display.length > 60) return undefined;
  if (/\d{2}-\d{3}|\bUL\.?\b|\bAL\.?\b|\bPL\.?\b/u.test(normalizeForMatch(display))) return undefined;

  const displayLetters = [...display].filter((character) => /[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/u.test(character));
  if (displayLetters.length < 2) return undefined;
  const uppercase = displayLetters.filter((character) => character === character.toLocaleUpperCase('pl-PL')).length;
  const legal = /\b(?:S\.?\s*A\.?|SP\.?\s+Z\s+[O0]\.?[O0]\.?|SP[ÓO]ŁKA\s+Z\s+[O0]\.?[O0]\.?|SP\.?\s*K\.?|S\.?\s*C\.?)\b/iu.test(display);
  if (legal && kind === 'plain') kind = 'legal';
  const mostlyNumeric = [...display].filter((character) => /\d/u.test(character)).length > displayLetters.length;
  if (mostlyNumeric) return undefined;

  const score = 36 - index * 2
    + brandBonus
    + (kind === 'plain' && index <= 2 && /^\p{L}[\p{L}\p{N}-]{2,20}$/u.test(display) ? 12 : 0)
    + (display.length <= 24 ? 8 : 0)
    - (displayLetters.length <= 2 ? 16 : 0)
    + (uppercase / displayLetters.length > 0.75 ? 4 : 0)
    - (legal ? 6 : 0)
    - (merchantLooksLikeSlogan(display) ? 28 : 0)
    - (/\d/u.test(display) ? 8 : 0);
  return { sourceLine: original, display, score, index, kind, brandKey: merchantBrandKey(display) };
}

interface MerchantDetectionOptions {
  rejectUnconfirmedPlain?: boolean;
}

interface MerchantDetectionResult {
  merchant?: string;
  confidence: ReceiptOcrConfidence;
  candidate?: string;
  evidence: ReceiptMerchantEvidenceKind;
  decision: ReceiptMerchantDecision;
  rejectReason: ReceiptMerchantRejectReason;
}

function detectMerchant(
  lines: string[],
  warnings: ReceiptParseWarning[],
  options: MerchantDetectionOptions = {},
): MerchantDetectionResult {
  const window = merchantHeaderWindow(lines);
  const candidates = [
    ...lines.slice(window.start, window.end)
      .map((line, index) => merchantCandidateFromLine(line, index))
      .filter((entry): entry is MerchantCandidate => Boolean(entry)),
    ...merchantContextCandidates(lines),
  ].sort((a, b) => b.score - a.score || a.index - b.index || a.display.localeCompare(b.display, 'pl'));

  if (!candidates.length) {
    warnings.push({ code: 'merchant-uncertain', message: 'Nie rozpoznano nazwy sklepu.' });
    return { confidence: 'low', evidence: 'none', decision: 'unresolved', rejectReason: 'low-evidence' };
  }

  const consensus = merchantConsensusCandidate(candidates);
  if (consensus) {
    const hasSufficientBrandInformation = consensus.brandKey.length >= 3;
    const confidence: ReceiptOcrConfidence = hasSufficientBrandInformation ? 'high' : 'medium';
    if (confidence !== 'high') warnings.push({ code: 'merchant-uncertain', message: 'Sprawdź rozpoznaną nazwę sklepu.', line: consensus.sourceLine });
    return {
      merchant: consensus.display,
      confidence,
      candidate: consensus.display,
      evidence: 'consensus',
      decision: 'accepted',
      rejectReason: 'none',
    };
  }

  const legalFallback = candidates
    .filter((candidate) => candidate.kind === 'legal')
    .sort((a, b) => b.score - a.score || a.index - b.index)[0];
  const best = candidates[0]!;

  // A short/noisy plain token without independent evidence is not enough to
  // outrank a reliable legal entity. Keep this generic: no merchant names or
  // language dictionary are involved in the decision.
  const shortUnconfirmedPlain = best.kind === 'plain' && best.brandKey.length <= 3;
  const sloganLikePlain = best.kind === 'plain' && merchantLooksLikeSlogan(best.display);
  const noisyUnconfirmedPlain = best.kind === 'plain' && (
    /\d/u.test(best.display)
    || [...best.display].filter((character) => /[^\p{L}\p{N}\s]/u.test(character)).length >= 3
  );
  const selected = legalFallback && (shortUnconfirmedPlain || sloganLikePlain || noisyUnconfirmedPlain)
    ? { ...legalFallback, display: cleanLegalMerchantDisplay(legalFallback.display) || legalFallback.display }
    : best;

  if (options.rejectUnconfirmedPlain && selected.kind === 'plain') {
    warnings.push({ code: 'merchant-uncertain', message: 'Nie udało się potwierdzić nazwy sklepu z nagłówka OCR.', line: selected.sourceLine });
    return {
      confidence: 'low',
      candidate: selected.display,
      evidence: 'plain',
      decision: 'rejected',
      rejectReason: 'unconfirmed-plain',
    };
  }

  const confidence: ReceiptOcrConfidence = 'medium';
  warnings.push({ code: 'merchant-uncertain', message: 'Sprawdź rozpoznaną nazwę sklepu.', line: selected.sourceLine });
  return {
    merchant: selected.display,
    confidence,
    candidate: selected.display,
    evidence: selected.kind,
    decision: 'accepted',
    rejectReason: 'none',
  };
}

export interface ReceiptMerchantResolution {
  merchant?: string;
  confidence: ReceiptOcrConfidence;
  warnings: ReceiptParseWarning[];
  candidate?: string;
  evidence: ReceiptMerchantEvidenceKind;
  decision: ReceiptMerchantDecision;
  rejectReason: ReceiptMerchantRejectReason;
}

export function resolveReceiptMerchant(
  primaryText: string,
  supplementalHeaderText = '',
): ReceiptMerchantResolution {
  const primaryLines = primaryText.split(/\r?\n/u).map(collapse).filter(Boolean);
  const supplementalLines = supplementalHeaderText.split(/\r?\n/u).map(collapse).filter(Boolean);
  const lines = supplementalLines.length ? [...supplementalLines, ...primaryLines] : primaryLines;
  const warnings: ReceiptParseWarning[] = [];
  // Supplemental header OCR is intentionally conservative. A single plain token
  // is never enough to replace the primary merchant; legal/descriptor/domain
  // evidence or cross-source consensus can still be accepted.
  const resolved = detectMerchant(lines, warnings, { rejectUnconfirmedPlain: supplementalLines.length > 0 });
  return {
    ...(resolved.merchant === undefined ? {} : { merchant: resolved.merchant }),
    confidence: resolved.confidence,
    warnings,
    ...(resolved.candidate === undefined ? {} : { candidate: resolved.candidate }),
    evidence: resolved.evidence,
    decision: resolved.decision,
    rejectReason: resolved.rejectReason,
  };
}

function stripSkuPrefix(value: string): string {
  const match = /^(\S+)\s+(.+)$/u.exec(value);
  if (!match) return value;
  const token = match[1] ?? '';
  const rest = match[2] ?? '';
  const compact = token.replace(/[^\p{L}\p{N}]/gu, '');
  const looksLikeSku = compact.length >= 10
    && /\d/u.test(compact)
    && (/[\p{L}]/u.test(compact) || /[-_/]/u.test(token) || /^\d{10,}$/u.test(compact));
  if (!looksLikeSku || !/[\p{L}]{3}/u.test(rest)) return value;
  const withoutSecondaryCode = /^\d{1,6}\s+(.+)$/u.exec(rest)?.[1];
  return withoutSecondaryCode && /[\p{L}]{3}/u.test(withoutSecondaryCode) ? withoutSecondaryCode : rest;
}

function cleanItemName(value: string): string {
  const cleaned = collapse(value.replace(/[|_]{2,}/g, ' ').replace(/^[*#.:;\-\s]+|[*#.:;\-\s]+$/g, ''));
  return collapse(stripSkuPrefix(cleaned));
}

function itemNameLooksLikeOcrGarbage(value: string): boolean {
  const letters = [...value].filter((character) => /[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/u.test(character)).length;
  const visible = [...value].filter((character) => !/\s/u.test(character)).length;
  return letters < 2 || (letters <= 3 && visible >= letters * 2 + 1);
}

function isUnitOnlyLine(line: string): boolean {
  return UNIT_ONLY_LINE.test(collapse(line));
}

interface QuantityStructure {
  namePart: string;
  amountMinor: number;
  finalTaxMarker?: string;
  taxMarker?: string;
  quantity?: number;
  unitPriceMinor?: number;
  quantityAnomaly?: boolean;
  recoveredAmount?: boolean;
  resolutionReason: NonNullable<ParsedReceiptItem['financialResolution']>;
}

function isPriceArtifactOnly(value: string): boolean {
  const normalized = collapse(value);
  return !normalized || /^(?:[A-G]\s*)?(?:[_|:;=~*]+)?$/iu.test(normalized);
}

interface ParsedQuantityPrefix {
  namePart: string;
  quantity?: number;
  taxMarker?: string;
}

function quantityTimesUnitMinor(quantity: number, unitPriceMinor: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isSafeInteger(unitPriceMinor) || unitPriceMinor <= 0) return 0;
  // Receipt quantities are normally printed with up to three decimals. Normalizing
  // to thousandths keeps the final money calculation in integer minor units and
  // avoids using a raw binary floating-point product as the monetary result.
  const quantityThousandths = Math.round(quantity * 1000);
  return Math.round((quantityThousandths * unitPriceMinor) / 1000);
}

function parsedQuantityPrefix(prefix: string): ParsedQuantityPrefix | undefined {
  const strict = /^(.*?)(?:\s+([A-GĆ]))?\s+([0-9OIl]+(?:[,.][0-9OIl]+)?)\s*(?:(?:SZT\.?|OP\.?|OPAK(?:OWANIE)?)\s*)?[xX×*]\s*$/iu.exec(prefix);
  if (strict) {
    const name = cleanItemName(strict[1] ?? '');
    const quantityText = (strict[3] ?? '').replace(/[Oo]/gu, '0').replace(/[Il]/gu, '1').replace(',', '.');
    const quantity = Number(quantityText);
    const taxMarker = strict[2]?.toLocaleUpperCase('pl-PL');
    return name.length >= 2 ? {
      namePart: name,
      ...(Number.isFinite(quantity) && quantity > 0 ? { quantity } : {}),
      ...(taxMarker ? { taxMarker } : {}),
    } : undefined;
  }

  const loose = /^(.*?)(?:\s+([A-GĆ]))?\s+([^\s]{1,5}[xX×*])\s*$/iu.exec(prefix);
  if (!loose) return undefined;
  const quantityToken = loose[3] ?? '';
  if (!/[0-9OIlŁÓ.,]/iu.test(quantityToken)) return undefined;
  const name = cleanItemName(loose[1] ?? '');
  const taxMarker = loose[2]?.toLocaleUpperCase('pl-PL');
  return name.length >= 2 ? { namePart: name, ...(taxMarker ? { taxMarker } : {}) } : undefined;
}

function quantityNamePart(prefix: string): string | undefined {
  return parsedQuantityPrefix(prefix)?.namePart;
}

function quantityStructure(line: string): QuantityStructure | undefined {
  const prices = findStructuredPrices(line);
  if (prices.length < 2) return undefined;
  const unitPrice = prices[prices.length - 2]!;
  const finalPrice = prices[prices.length - 1]!;
  if (finalPrice.amountMinor <= 0) return undefined;
  const parsedPrefix = parsedQuantityPrefix(line.slice(0, unitPrice.start).trim());
  if (!parsedPrefix) return undefined;
  const expected = parsedPrefix.quantity === undefined ? undefined : quantityTimesUnitMinor(parsedPrefix.quantity, unitPrice.amountMinor);
  // OCR sometimes drops the decimal separator from the printed line value, e.g.
  // 0,110 x 9,99 1,10 -> "0,110 x 9,99 110". In that case the generic
  // money parser sees 110,00, while the raw digits still equal the expected
  // minor-unit amount (110). Quantity/unit math is strong enough to recover the
  // line value, but only when the raw token confirms the exact expected cents.
  const rawFinalConfirmsExpected = expected !== undefined
    && Math.abs(expected - finalPrice.amountMinor) > 1
    && noisyQuantityLineTotalConfirmsExpected(finalPrice.raw, expected);
  const resolvedAmountMinor = rawFinalConfirmsExpected ? expected : finalPrice.amountMinor;
  const quantityAnomaly = expected !== undefined && !rawFinalConfirmsExpected && Math.abs(expected - finalPrice.amountMinor) > 1;

  return {
    namePart: parsedPrefix.namePart,
    amountMinor: resolvedAmountMinor,
    ...(finalPrice.taxMarker ? { finalTaxMarker: finalPrice.taxMarker } : {}),
    ...(parsedPrefix.taxMarker ? { taxMarker: parsedPrefix.taxMarker } : {}),
    ...(parsedPrefix.quantity === undefined ? {} : { quantity: parsedPrefix.quantity }),
    unitPriceMinor: unitPrice.amountMinor,
    ...(quantityAnomaly ? { quantityAnomaly: true } : {}),
    ...(rawFinalConfirmsExpected ? { recoveredAmount: true } : {}),
    resolutionReason: rawFinalConfirmsExpected
      ? 'quantity-unit-recovery'
      : quantityAnomaly ? 'explicit-line-total' : 'quantity-unit-total-consensus',
  };
}

interface QuantityPrefix {
  namePart: string;
  quantity: number;
  taxMarker?: string;
}

function quantityPrefix(prefix: string): QuantityPrefix | undefined {
  const match = /^(.*?)(?:\s+([A-GĆ]))?\s+(\d+(?:[,.]\d+)?)\s*[xX×*]\s*$/iu.exec(prefix);
  if (!match) return undefined;
  const namePart = cleanItemName(match[1] ?? '');
  const quantity = Number((match[3] ?? '').replace(',', '.'));
  if (namePart.length < 2 || !Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) return undefined;
  const taxMarker = match[2]?.toLocaleUpperCase('pl-PL');
  return { namePart, quantity, ...(taxMarker ? { taxMarker } : {}) };
}

function noisyQuantityLineTotalConfirmsExpected(rawToken: string, expectedAmountMinor: number): boolean {
  if (noisyMoneyTokenConfirmsExpected(rawToken, expectedAmountMinor)) return true;
  let token = collapse(rawToken)
    .replace(/[ABCabcĆćXx€%Il|]$/u, '')
    .replace(/[Oo]/gu, '0')
    .replace(/[Il|]/gu, '1')
    .replace(/\s+/gu, '');
  return /^\d+$/u.test(token) && token === String(expectedAmountMinor);
}

function recoveredQuantityStructure(line: string): QuantityStructure | undefined {
  const prices = findStructuredPrices(line);
  if (prices.length !== 1) return undefined;
  const unitPrice = prices[0]!;
  if (unitPrice.amountMinor <= 0) return undefined;
  const prefix = quantityPrefix(line.slice(0, unitPrice.start).trim());
  if (!prefix) return undefined;
  const trailing = collapse(line.slice(unitPrice.end));
  if (!trailing) return undefined;
  const expectedAmountMinor = quantityTimesUnitMinor(prefix.quantity, unitPrice.amountMinor);
  if (expectedAmountMinor <= 0 || !noisyQuantityLineTotalConfirmsExpected(trailing, expectedAmountMinor)) return undefined;
  return {
    namePart: prefix.namePart,
    amountMinor: expectedAmountMinor,
    ...(unitPrice.taxMarker ? { finalTaxMarker: unitPrice.taxMarker } : {}),
    ...(prefix.taxMarker ? { taxMarker: prefix.taxMarker } : {}),
    quantity: prefix.quantity,
    unitPriceMinor: unitPrice.amountMinor,
    recoveredAmount: true,
    resolutionReason: 'quantity-unit-recovery',
  };
}

function singleUnitQuantityStructure(line: string): QuantityStructure | undefined {
  const prices = findStructuredPrices(line);
  if (prices.length !== 1) return undefined;
  const price = prices[0]!;
  if (price.amountMinor <= 0 || !isPriceArtifactOnly(line.slice(price.end))) return undefined;

  const beforePrice = line.slice(0, price.start).trim();
  const match = /^(.*?)(?:\s+([A-GĆ]))?\s+(1(?:[,.]0+)?)\s*(?:(?:SZT\.?|OP\.?|OPAK(?:OWANIE)?)\s*)?[xX×*]\s*$/iu.exec(beforePrice);
  if (!match) return undefined;
  const baseName = cleanItemName(match[1] ?? '');
  if (baseName.length < 2) return undefined;
  const taxMarker = match[2]?.toLocaleUpperCase('pl-PL');
  return {
    namePart: baseName,
    amountMinor: price.amountMinor,
    ...(price.taxMarker ? { finalTaxMarker: price.taxMarker } : {}),
    ...(taxMarker ? { taxMarker } : {}),
    quantity: 1,
    unitPriceMinor: price.amountMinor,
    resolutionReason: 'quantity-unit-total-consensus',
  };
}

/**
 * Recovers a weighted line when OCR kept the quantity and unit price but damaged
 * or entirely lost the printed line-total token. This is intentionally limited
 * to quantities below one unit: using quantity × unit-price for an arbitrary
 * multi-unit line could repeat the classic "4 × 229" OCR quantity failure.
 */
function weightedQuantityRecovery(line: string): QuantityStructure | undefined {
  const prices = findStructuredPrices(line);
  if (prices.length !== 1) return undefined;
  const unitPrice = prices[0]!;
  if (unitPrice.amountMinor <= 0) return undefined;
  const prefix = quantityPrefix(line.slice(0, unitPrice.start).trim());
  if (!prefix || prefix.quantity >= 1) return undefined;
  const expectedAmountMinor = quantityTimesUnitMinor(prefix.quantity, unitPrice.amountMinor);
  if (expectedAmountMinor <= 0 || expectedAmountMinor >= unitPrice.amountMinor) return undefined;

  return {
    namePart: prefix.namePart,
    amountMinor: expectedAmountMinor,
    ...(unitPrice.taxMarker ? { finalTaxMarker: unitPrice.taxMarker } : {}),
    ...(prefix.taxMarker ? { taxMarker: prefix.taxMarker } : {}),
    quantity: prefix.quantity,
    unitPriceMinor: unitPrice.amountMinor,
    recoveredAmount: true,
    resolutionReason: 'quantity-unit-recovery',
  };
}

/**
 * A common OCR failure leaves a damaged unit-price token immediately before a
 * still-readable final line value. Keep the explicit line value and use the
 * structural prefix only to clean the product name/tax marker.
 */
function damagedUnitPriceStructure(line: string): QuantityStructure | undefined {
  const prices = findStructuredPrices(line);
  if (prices.length !== 1) return undefined;
  const finalPrice = prices[0]!;
  if (finalPrice.amountMinor <= 0) return undefined;
  const beforeFinal = collapse(line.slice(0, finalPrice.start));
  const match = /^(.*?)(?:\s+([A-GĆ]))?\s+(\d+(?:[,.]\d+)?)\s*[xX×*]\s+([^\s]+)\s*$/iu.exec(beforeFinal);
  if (!match) return undefined;
  const quantity = Number((match[3] ?? '').replace(',', '.'));
  const noisyUnitPrice = match[4] ?? '';
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) return undefined;
  // A parseable unit price would have been found as a second price already.
  if (parseReceiptPriceMinor(noisyUnitPrice) !== undefined) return undefined;
  if (!/[\dOIlZSBG,.]/iu.test(noisyUnitPrice)) return undefined;
  const namePart = cleanItemName(match[1] ?? '');
  if (namePart.length < 2) return undefined;
  const taxMarker = match[2]?.toLocaleUpperCase('pl-PL');
  return {
    namePart,
    amountMinor: finalPrice.amountMinor,
    ...(finalPrice.taxMarker ? { finalTaxMarker: finalPrice.taxMarker } : {}),
    ...(taxMarker ? { taxMarker } : {}),
    quantity,
    resolutionReason: 'explicit-line-total',
    recoveredAmount: true,
  };
}

function quantityOnlyLine(line: string): { amountMinor: number; finalTaxMarker?: string; quantityAnomaly?: boolean; financialResolution: NonNullable<ParsedReceiptItem['financialResolution']> } | undefined {
  const normalized = line.replace(/×/g, 'x').trim();
  const prefix = /^(\d+(?:[,.]\d+)?)\s*(?:(?:kg|g|mg|l|ml|cl|dl)\s*)?(?:(?:SZT\.?|OP\.?|OPAK(?:OWANIE)?)\s*)?[xX*="”]\s*/iu.exec(normalized);
  const damagedPiecePrefix = /^[^\s]{1,8}\s+(?:T?SZT|TSZT|SZT)\s*[*xX]\s*/iu.test(normalized);
  if (!prefix && !damagedPiecePrefix) return undefined;
  const quantity = prefix ? Number((prefix[1] ?? '').replace(',', '.')) : Number.NaN;
  const prices = findStructuredPrices(normalized);
  if (!prices.length) return undefined;
  const finalPrice = prices[prices.length - 1]!;
  if (finalPrice.amountMinor <= 0) return undefined;
  const unitPrice = prices.length >= 2 ? prices[prices.length - 2] : undefined;
  const quantityAnomaly = unitPrice && Number.isFinite(quantity) && quantity > 0
    ? Math.abs(quantityTimesUnitMinor(quantity, unitPrice.amountMinor) - finalPrice.amountMinor) > 1
    : false;
  return {
    amountMinor: finalPrice.amountMinor,
    ...(finalPrice.taxMarker ? { finalTaxMarker: finalPrice.taxMarker } : {}),
    ...(quantityAnomaly ? { quantityAnomaly: true } : {}),
    financialResolution: quantityAnomaly ? 'explicit-line-total' : prices.length >= 2 ? 'quantity-unit-total-consensus' : 'fallback',
  };
}

function cleanPendingNameForQuantity(value: string, finalTaxMarker?: string): string {
  let cleaned = cleanItemName(value);
  // When the next OCR line is an explicit quantity/unit-price line, a terminal
  // token such as "1,51" can be the common glyph confusion "1,5l". Keep
  // this correction local to the quantity look-ahead path; never rewrite money
  // tokens globally.
  if (/[\p{L}]{2}/u.test(cleaned)) {
    cleaned = cleaned.replace(/(\b\d{1,2}[,.]\d)(?:1|I|\|)$/u, '$1 l');
  }
  const match = /^(.*)\s+([A-G])$/u.exec(cleaned);
  if (!match) return cleaned;
  const pendingMarker = match[2]!.toLocaleUpperCase('pl-PL');
  if (finalTaxMarker && pendingMarker !== finalTaxMarker) return cleaned;
  return cleanItemName(match[1]!);
}

function looksLikeDescriptorWithDamagedCapacity(line: string): boolean {
  if (isMetadata(line) || totalPriority(line) >= 0 || isDiscountCandidateLine(line) || ADDRESS_LINE.test(line) || lineContainsReceiptDate(line)) return false;
  if (!/[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]{2}/u.test(line)) return false;
  const prices = findStructuredPrices(line);
  if (prices.length !== 1) return false;
  const price = prices[0]!;
  const before = cleanItemName(line.slice(0, price.start));
  const trailing = collapse(line.slice(price.end));
  return before.length >= 2 && /^[.,;:|]+$/u.test(trailing);
}

function inlineItem(line: string): ParsedReceiptItem | undefined {
  if (isMetadata(line) || totalPriority(line) >= 0 || isDiscountCandidateLine(line)) return undefined;
  const prices = findStructuredPrices(line);
  if (!prices.length) return undefined;
  const finalPrice = prices[prices.length - 1]!;
  if (finalPrice.amountMinor <= 0) return undefined;

  const recoveredQuantity = recoveredQuantityStructure(line);
  const structured = quantityStructure(line)
    ?? singleUnitQuantityStructure(line)
    ?? recoveredQuantity
    ?? weightedQuantityRecovery(line)
    ?? damagedUnitPriceStructure(line);
  const name = structured?.namePart ?? cleanItemName(line.slice(0, finalPrice.start));
  if (name.length < 2 || !/[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/u.test(name)) return undefined;
  const amountMinor = structured?.amountMinor ?? finalPrice.amountMinor;
  const warnings: string[] = [];
  if (structured?.recoveredAmount || recoveredQuantity) warnings.push('Kwota pozycji została potwierdzona na podstawie ilości i ceny jednostkowej oraz struktury paragonu. Sprawdź.');
  if (structured?.quantityAnomaly) warnings.push('Niepewna ilość: OCR nie zgadza się z ceną jednostkową i wartością pozycji. Kwota pozycji została zachowana.');
  return {
    rawText: line,
    name,
    amountMinor,
    baseAmountMinor: amountMinor,
    discountMinor: 0,
    ...(structured?.taxMarker || structured?.finalTaxMarker || finalPrice.taxMarker
      ? { taxMarker: structured?.taxMarker ?? structured?.finalTaxMarker ?? finalPrice.taxMarker }
      : {}),
    financialResolution: structured?.resolutionReason ?? 'fallback',
    confidence: structured?.recoveredAmount || recoveredQuantity || structured?.quantityAnomaly || prices.length > 1 || /[XĆ€%Il|48]$/u.test(finalPrice.raw) ? 'medium' : 'high',
    warnings,
  };
}

function discountAdjustment(line: string): ReceiptAdjustmentDraft | undefined {
  const normalized = normalizeForMatch(collapse(line));
  if (!isDiscountCandidateLine(line) || /[ŁL]ACZNIE/u.test(normalized)) return undefined;
  const prices = findPrices(line);
  let negative: PriceHit | undefined;
  for (let index = prices.length - 1; index >= 0; index -= 1) {
    if (prices[index]!.amountMinor < 0) {
      negative = prices[index];
      break;
    }
  }
  return { rawText: line, ...(negative ? { amountMinor: negative.amountMinor } : {}), kind: 'discount' };
}

function standaloneSignedPrice(line: string, sign: 'positive' | 'negative'): PriceHit | undefined {
  const prices = findPrices(line);
  if (prices.length !== 1) return undefined;
  const price = prices[0]!;
  if (sign === 'positive' ? price.amountMinor <= 0 : price.amountMinor >= 0) return undefined;
  const remainder = `${line.slice(0, price.start)} ${line.slice(price.end)}`;
  if (!isPriceArtifactOnly(remainder)) return undefined;
  return price;
}

function standalonePositivePrice(line: string): PriceHit | undefined {
  return standaloneSignedPrice(line, 'positive');
}

function standaloneNegativePrice(line: string): PriceHit | undefined {
  return standaloneSignedPrice(line, 'negative');
}

function positivePriceOnDiscountLine(line: string): PriceHit | undefined {
  const positives = findPrices(line).filter((price) => price.amountMinor > 0);
  return positives.length ? positives[positives.length - 1] : undefined;
}

interface PendingDiscount {
  itemIndex: number;
  originalAmountCandidates: number[];
  adjustment: ReceiptAdjustmentDraft;
  extraAdjustments?: ReceiptAdjustmentDraft[];
  stage: 'discount-value' | 'final-amount';
  startLineIndex: number;
  noisyDiscountToken?: string;
  recoveredAdjustment?: boolean;
}

const DISCOUNT_LOOKAHEAD_LINES = 3;

function isBareDiscountLabel(line: string): boolean {
  const normalized = normalizeForMatch(collapse(line));
  if (!hasDiscountLabel(line) || findPrices(line).length > 0) return false;
  return /(?:RAB[AO]T|OPUST|BONUS|KUPON|PROMOCJ(?:A|E|I)?|OBNIZK(?:A|I)?|DISCOUNT)[:;.\-]*$/u.test(normalized);
}

function isDiscountBridgeLine(line: string): boolean {
  const normalized = collapse(line);
  return /^[ABCĆ]$/iu.test(normalized) || /^[_|:;=~*]+$/u.test(normalized);
}

function itemOriginalAmountCandidates(item: ParsedReceiptItem): number[] {
  const firstLine = item.rawText.split(/\r?\n/u)[0] ?? item.rawText;
  const linePrices = findStructuredPrices(firstLine)
    .map((price) => price.amountMinor)
    .filter((amount) => amount > 0);
  return [...new Set([...(item.amountMinor === undefined ? [] : [item.amountMinor]), ...linePrices])];
}

function pendingAdjustmentMinor(pending: PendingDiscount): number | undefined {
  const all = [pending.adjustment, ...(pending.extraAdjustments ?? [])];
  if (all.some((adjustment) => adjustment.amountMinor === undefined || adjustment.amountMinor >= 0)) return undefined;
  return all.reduce((sum, adjustment) => sum + (adjustment.amountMinor ?? 0), 0);
}

function implicitDiscountFinalAmount(pending: PendingDiscount, item: ParsedReceiptItem | undefined): number | undefined {
  if (!item) return undefined;
  const adjustmentMinor = pendingAdjustmentMinor(pending);
  const baseAmountMinor = item.baseAmountMinor ?? item.amountMinor;
  if (adjustmentMinor === undefined || baseAmountMinor === undefined) return undefined;
  const finalAmountMinor = baseAmountMinor + adjustmentMinor;
  if (!Number.isSafeInteger(finalAmountMinor) || finalAmountMinor <= 0 || finalAmountMinor >= baseAmountMinor) return undefined;
  return finalAmountMinor;
}

function impliedOriginalMatches(pending: PendingDiscount, finalAmountMinor: number, toleranceMinor = 1): boolean {
  const adjustmentMinor = pendingAdjustmentMinor(pending);
  if (adjustmentMinor === undefined || adjustmentMinor >= 0) return false;
  const impliedOriginal = finalAmountMinor - adjustmentMinor;
  return pending.originalAmountCandidates.some((candidate) => Math.abs(candidate - impliedOriginal) <= toleranceMinor);
}

function discountFinalAmount(pending: PendingDiscount, candidate: PriceHit | undefined): number | undefined {
  if (!candidate || candidate.amountMinor <= 0) return undefined;
  return impliedOriginalMatches(pending, candidate.amountMinor) ? candidate.amountMinor : undefined;
}

function normalizeOcrDigits(value: string): string | undefined {
  const repaired = value.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
  return /^\d+$/u.test(repaired) ? repaired : undefined;
}

function extractNoisyDiscountToken(line: string): string | undefined {
  const normalized = collapse(line);
  if (!isDiscountCandidateLine(line) || /L[ĄA]CZNIE/iu.test(normalized)) return undefined;
  const match = /[-−]\s*([0-9OIl]+(?:[,.][0-9OIl\/]{1,4}|\/[0-9OIl]{1,4}))(?:[ABCabcĆćXx€%Il|])?/u.exec(normalized);
  return match ? match[0] : undefined;
}

function expectedMoneyText(expectedAmountMinor: number): string {
  const whole = Math.floor(expectedAmountMinor / 100);
  const fraction = expectedAmountMinor % 100;
  return `${whole},${String(fraction).padStart(2, '0')}`;
}

/**
 * Confirms a damaged money token against an amount already proven by receipt structure.
 * It never invents a value on its own: slash removal/wildcard and a missing trailing zero
 * are accepted only when they reproduce the exact expected integer-minor-unit amount.
 */
function noisyMoneyTokenConfirmsExpected(rawToken: string, expectedAmountMinor: number): boolean {
  if (!Number.isSafeInteger(expectedAmountMinor) || expectedAmountMinor <= 0) return false;
  const hadSuffix = /[ABCabcĆćXx€%Il|]$/u.test(collapse(rawToken));
  let token = collapse(rawToken)
    .replace(/[−–—]/gu, '-')
    .replace(/^[-+]/u, '')
    .replace(/[ABCabcĆćXx€%Il|]$/u, '')
    .replace(/[Oo]/gu, '0')
    .replace(/[Il|]/gu, '1')
    .replace(/\./gu, ',')
    .replace(/\s+/gu, '');
  const expected = expectedMoneyText(expectedAmountMinor);
  if (token === expected) return true;

  if (token.includes('/')) {
    const withoutOneSlash = token.replace('/', '');
    if (withoutOneSlash === expected) return true;
    if (token.length === expected.length) {
      let wildcardMatches = true;
      let slashCount = 0;
      for (let index = 0; index < token.length; index += 1) {
        const actual = token[index]!;
        const wanted = expected[index]!;
        if (actual === '/') {
          slashCount += 1;
          if (wanted !== '7') wildcardMatches = false;
        } else if (actual !== wanted) {
          wildcardMatches = false;
        }
      }
      if (wildcardMatches && slashCount === 1) return true;
    }
  }

  // A lone missing hundredths zero is accepted only with a one-character OCR/VAT suffix,
  // e.g. 4.5A confirming the already-proven 4,50 final amount.
  if (hadSuffix && expected.endsWith('0') && token === expected.slice(0, -1)) return true;
  return false;
}

function recoverDiscountFromNoisyToken(pending: PendingDiscount, finalAmountMinor: number): number | undefined {
  if (pending.extraAdjustments?.length) return undefined;
  const token = pending.noisyDiscountToken;
  if (!token || finalAmountMinor <= 0) return undefined;
  for (const originalAmount of pending.originalAmountCandidates) {
    const discountMagnitude = originalAmount - finalAmountMinor;
    if (discountMagnitude <= 0) continue;
    if (noisyMoneyTokenConfirmsExpected(token, discountMagnitude)) return -discountMagnitude;
  }
  return undefined;
}

/**
 * Validate a noisy standalone final price against an amount already determined by
 * product price - discount. The expected integer-minor-unit result stays the source
 * of truth; the OCR token is only confirmation. This never runs for ordinary item
 * prices and therefore cannot globally rewrite digits in product names or amounts.
 */
function standaloneExpectedDiscountFinal(line: string, expectedAmountMinor: number): number | undefined {
  if (!Number.isSafeInteger(expectedAmountMinor) || expectedAmountMinor <= 0) return undefined;
  const normalized = collapse(line);
  if (noisyMoneyTokenConfirmsExpected(normalized, expectedAmountMinor)) return expectedAmountMinor;
  const match = /^[\s_|:;=~*]*([0-9OIl]{1,4})([,.]|\s+)([0-9OIl]{2})([ABCabcXxĆć€%Il|048])?[\s_|:;=~*]*$/u.exec(normalized);
  if (!match) return undefined;

  const wholeDigits = normalizeOcrDigits(match[1] ?? '');
  const fractionDigits = normalizeOcrDigits(match[3] ?? '');
  if (!wholeDigits || !fractionDigits) return undefined;

  const whole = Number(wholeDigits);
  const fraction = Number(fractionDigits);
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(fraction) || fraction > 99) return undefined;
  const parsed = whole * 100 + fraction;
  const suffix = match[4] ?? '';

  if (parsed === expectedAmountMinor) {
    // A third digit is accepted only for the two VAT-marker confusions already
    // covered by FIX1E. An arbitrary trailing 0 remains rejected.
    if (/^\d$/u.test(suffix) && !/[48]/u.test(suffix)) return undefined;
    return expectedAmountMinor;
  }

  // Narrow low-value fallback for a standalone OCR token where the cents match
  // exactly but OCR inserted one spurious leading digit and also left a one-char
  // suffix. The exact discount math and +/-1gr original-price tolerance still have
  // to select this expected amount before it can be used.
  if (expectedAmountMinor < 100 && fraction === expectedAmountMinor && whole !== 0 && suffix) {
    return expectedAmountMinor;
  }

  return undefined;
}

function noisyDiscountFinalAmount(pending: PendingDiscount, line: string): number | undefined {
  const adjustmentMinor = pendingAdjustmentMinor(pending);
  if (adjustmentMinor === undefined || adjustmentMinor >= 0) return undefined;

  for (const originalAmount of pending.originalAmountCandidates) {
    for (const correction of [0, -1, 1]) {
      const expected = originalAmount + correction + adjustmentMinor;
      if (expected <= 0) continue;
      if (standaloneExpectedDiscountFinal(line, expected) !== undefined && impliedOriginalMatches(pending, expected)) {
        return expected;
      }
    }
  }
  return undefined;
}

function unresolvedDiscountWarning(warnings: ReceiptParseWarning[], adjustment: ReceiptAdjustmentDraft): void {
  warnings.push({
    code: 'item-price-missing',
    message: 'Nie udało się jednoznacznie potwierdzić ceny końcowej po rabacie. Sprawdź tę pozycję.',
    line: adjustment.rawText,
  });
}

type ReceiptSection = 'items' | 'vat' | 'deposits' | 'payments' | 'footer';

interface DepositItemEvidenceState {
  active: boolean;
  totalMinor: number;
  validRowCount: number;
  ambiguous: boolean;
  sourceLineIndexes: Set<number>;
}

function emptyDepositItemEvidenceState(): DepositItemEvidenceState {
  return {
    active: false,
    totalMinor: 0,
    validRowCount: 0,
    ambiguous: false,
    sourceLineIndexes: new Set<number>(),
  };
}

function isReceiptPageBreak(line: string): boolean {
  return collapse(line) === '[[RECEIPT_PAGE_BREAK]]';
}

function depositEvidenceHasSubstantiveContent(line: string): boolean {
  return /[\p{L}\p{N}]/u.test(line);
}

function resolvedDepositTotalMinor(
  summaryDepositTotalMinor: number | undefined,
  evidence: DepositItemEvidenceState,
): number | undefined {
  if (summaryDepositTotalMinor !== undefined) return summaryDepositTotalMinor;
  if (evidence.ambiguous || evidence.validRowCount < 1) return undefined;
  if (!Number.isSafeInteger(evidence.totalMinor) || evidence.totalMinor <= 0) return undefined;
  return evidence.totalMinor;
}

function isDepositSectionStart(line: string): boolean {
  const normalized = normalizeReceiptStructuralLine(line);
  return /^OPAKOWANIA\s+ZWROTNE\s+WYDANIA\b/u.test(normalized);
}

function isDepositSectionSummary(line: string): boolean {
  const normalized = normalizeReceiptStructuralLine(line);
  return /^OPAKOWANIA\s+ZWROTNE\s+SUMA\b/u.test(normalized);
}

function isDamagedDepositSectionSummaryLike(line: string): boolean {
  const normalized = normalizeReceiptStructuralLine(line);
  const match = /^OPAKOWANIA\s+(ZW[RB]OTNE)\s+(S(?:U|II)MA)\b/u.exec(normalized);
  if (!match) return false;
  // This is a terminator-only OCR confusion class. A clean summary follows the
  // authoritative summary path above; a damaged marker never contributes money.
  return match[1] !== 'ZWROTNE' || match[2] !== 'SUMA';
}

function isFinalPayableLine(line: string): boolean {
  return /^DO\s+ZAP[ŁL]ATY\b/u.test(normalizeReceiptStructuralLine(line));
}

function isPaymentOrFooterLine(line: string): boolean {
  const normalized = normalizeReceiptStructuralLine(line);
  return /^(?:ROZLICZENIE\s+P[ŁL]ATNO[ŚS][ĆC]I\b|ZAP[ŁL]ACONO\b|P[ŁL]ATNO[ŚS][ĆC]\b|BON\b|KARTA\b|GOT[ÓO]WKA\b|RESZTA\b|NUMER\s+(?:TRANSAKCJI|KASY|KASJERA)\b|NUMER\b|UDZIELONO\b|PROMOCJE\b)/u.test(normalized);
}

function looksLikePreTaxClassificationLine(
  line: string,
  followingLines: readonly string[],
  previousItem: ParsedReceiptItem | undefined,
): boolean {
  if (!previousItem || previousItem.amountMinor === undefined) return false;
  if (!['quantity-unit-total-consensus', 'quantity-unit-recovery'].includes(previousItem.financialResolution ?? '')) return false;
  if (/[xX×*]\s*\d+[,.]\d{2}/u.test(line)) return false;
  const prices = findStructuredPrices(line).filter((price) => price.amountMinor > 0);
  if (prices.length !== 1 || Math.abs(prices[0]!.amountMinor - previousItem.amountMinor) > 1) return false;
  const price = prices[0]!;
  const descriptor = cleanItemName(line.slice(0, price.start));
  if (descriptor.length < 2 || descriptor.length > 48) return false;
  const trailing = collapse(line.slice(price.end));
  if (trailing && !isPriceArtifactOnly(trailing) && !/^[\d\W_]{1,6}$/u.test(trailing)) return false;
  return followingLines.slice(0, 2).some((candidate) => isTaxSectionStart(candidate));
}

function recoveredDiscountWarning(item: ParsedReceiptItem): void {
  const message = 'Kwota została potwierdzona na podstawie zgodności rabatu. Sprawdź.';
  if (!item.warnings.includes(message)) item.warnings.push(message);
  item.confidence = 'medium';
}

function detectTaxableSubtotals(lines: readonly string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const line of lines) {
    const normalized = normalizeReceiptStructuralLine(line);
    const match = /^SPRZEDA.{0,5}\s+OPODATKOWANA\s+([A-G])\b/u.exec(normalized);
    if (!match?.[1]) continue;
    const amountMinor = lastPositivePrice(line);
    if (amountMinor === undefined) continue;
    result.set(match[1], amountMinor);
  }
  return result;
}

/**
 * A VAT/taxable subtotal is secondary evidence, never the primary receipt total.
 * It can safely repair a tiny OCR error only when exactly one undiscounted item
 * carries that tax marker and that item was already marked as non-high confidence.
 */
function applyUniqueTaxSubtotalCorrections(
  items: ParsedReceiptItem[],
  lines: readonly string[],
): void {
  const subtotals = detectTaxableSubtotals(lines);
  for (const [taxMarker, subtotalMinor] of subtotals) {
    const matching = items.filter((item) => item.taxMarker === taxMarker);
    if (matching.length !== 1) continue;
    const item = matching[0]!;
    if (item.discountMinor && item.discountMinor > 0) continue;
    if (item.amountMinor === undefined || item.confidence === 'high') continue;
    const difference = Math.abs(item.amountMinor - subtotalMinor);
    if (difference === 0 || difference > 10) continue;
    item.amountMinor = subtotalMinor;
    item.baseAmountMinor = subtotalMinor;
    item.financialResolution = 'quantity-unit-recovery';
    item.confidence = 'medium';
    const warning = 'Kwota pozycji została potwierdzona przez zgodność z podsumowaniem podatkowym. Sprawdź.';
    if (!item.warnings.includes(warning)) item.warnings.push(warning);
  }
}

export function parseReceiptText(rawText: string): ParsedReceiptDraft {
  const reconstructed = reconstructColumnarReceiptText(rawText);
  const lines = reconstructed.text.split(/\r?\n/u).map(collapse).filter(Boolean);
  const warnings: ReceiptParseWarning[] = [];
  const adjustments: ReceiptAdjustmentDraft[] = [];
  const regions = analyzeReceiptStructuralRegions(lines);
  const merchant = detectMerchant(lines, warnings);
  const date = detectDate(lines, warnings);
  const totals = detectReceiptTotals(lines);
  const declaredTotalMinor = totals.declaredTotalMinor;
  const declaredDiscountTotalMinor = detectAggregateDiscount(lines);
  if (declaredTotalMinor === undefined) warnings.push({ code: 'total-missing', message: 'Nie rozpoznano sumy z paragonu.' });

  const items: ParsedReceiptItem[] = [];
  let pendingName: { text: string; lineIndex: number } | undefined;
  let pendingDiscount: PendingDiscount | undefined;
  let lastItemLineIndex = -100;
  let section: ReceiptSection = 'items';
  let detectedDepositItemsTotalMinor = 0;
  let depositItemEvidence = emptyDepositItemEvidenceState();
  let depositItemFallbackBlocked = false;

  const applyPendingDiscount = (
    pending: PendingDiscount,
    amountMinor: number,
    line: string | undefined,
    recovered: boolean,
  ): void => {
    const item = items[pending.itemIndex];
    if (!item) return;
    const baseAmountMinor = item.baseAmountMinor ?? item.amountMinor ?? pending.originalAmountCandidates[0];
    item.amountMinor = amountMinor;
    if (baseAmountMinor !== undefined && baseAmountMinor >= amountMinor) {
      item.baseAmountMinor = baseAmountMinor;
      item.discountMinor = baseAmountMinor - amountMinor;
    }
    const discountRaw = [pending.adjustment, ...(pending.extraAdjustments ?? [])].map((adjustment) => adjustment.rawText).join('\n');
    item.rawText = `${item.rawText}\n${discountRaw}\n${line}`;
    item.confidence = 'medium';
    if (recovered) recoveredDiscountWarning(item);
    lastItemLineIndex = pending.startLineIndex;
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!;

    if (isReceiptPageBreak(line)) {
      // BLOCKER1 fallback evidence is deliberately page-local. Keep the existing
      // parser section semantics untouched, but do not let a deposit marker on a
      // previous page authorize item-derived deposit evidence on this page.
      if (depositItemEvidence.active) depositItemFallbackBlocked = true;
      depositItemEvidence = emptyDepositItemEvidenceState();
      pendingName = undefined;
      continue;
    }

    if (lineIndex < regions.itemStartIndex) {
      pendingName = undefined;
      continue;
    }

    if (pendingDiscount) {
      const distance = lineIndex - pendingDiscount.startLineIndex;
      if (distance > DISCOUNT_LOOKAHEAD_LINES) {
        unresolvedDiscountWarning(warnings, pendingDiscount.adjustment);
        pendingDiscount = undefined;
      } else if (pendingDiscount.stage === 'discount-value') {
        const discountValue = standaloneNegativePrice(line);
        if (discountValue) {
          pendingDiscount.adjustment.amountMinor = discountValue.amountMinor;
          pendingDiscount.adjustment.rawText = `${pendingDiscount.adjustment.rawText}\n${line}`;
          pendingDiscount.stage = 'final-amount';
          continue;
        }
        if (isDiscountBridgeLine(line)) continue;
        unresolvedDiscountWarning(warnings, pendingDiscount.adjustment);
        pendingDiscount = undefined;
      } else {
        const additionalAdjustment = discountAdjustment(line);
        if (additionalAdjustment?.amountMinor !== undefined && additionalAdjustment.amountMinor < 0) {
          adjustments.push(additionalAdjustment);
          pendingDiscount.extraAdjustments = [...(pendingDiscount.extraAdjustments ?? []), additionalAdjustment];
          pendingDiscount.startLineIndex = lineIndex;
          warnings.push({ code: 'discount-detected', message: 'Wykryto rabat lub korektę. Nie zapisano jej jako osobnej pozycji.', line });
          continue;
        }
        const candidate = standalonePositivePrice(line);
        let adjustedAmount: number | undefined;
        let recovered = Boolean(pendingDiscount.recoveredAdjustment);

        if (pendingAdjustmentMinor(pendingDiscount) !== undefined) {
          adjustedAmount = discountFinalAmount(pendingDiscount, candidate);
          if (adjustedAmount === undefined) {
            adjustedAmount = noisyDiscountFinalAmount(pendingDiscount, line);
            if (adjustedAmount !== undefined) recovered = true;
          }
        } else if (candidate) {
          const recoveredAdjustment = recoverDiscountFromNoisyToken(pendingDiscount, candidate.amountMinor);
          if (recoveredAdjustment !== undefined) {
            pendingDiscount.adjustment.amountMinor = recoveredAdjustment;
            pendingDiscount.recoveredAdjustment = true;
            adjustedAmount = candidate.amountMinor;
            recovered = true;
          }
        }

        if (adjustedAmount !== undefined) {
          applyPendingDiscount(pendingDiscount, adjustedAmount, line, recovered);
          pendingDiscount = undefined;
          pendingName = undefined;
          continue;
        }
        if (isDiscountBridgeLine(line)) continue;
        const implicitAmount = implicitDiscountFinalAmount(pendingDiscount, items[pendingDiscount.itemIndex]);
        if (implicitAmount !== undefined) {
          applyPendingDiscount(pendingDiscount, implicitAmount, undefined, true);
          pendingDiscount = undefined;
          pendingName = undefined;
        } else {
          unresolvedDiscountWarning(warnings, pendingDiscount.adjustment);
          pendingDiscount = undefined;
        }
      }
    }

    if (isDepositSectionStart(line)) {
      section = 'deposits';
      if (depositItemEvidence.active && (depositItemEvidence.validRowCount > 0 || depositItemEvidence.ambiguous)) {
        // Multiple overlapping section starts make the item-derived fallback
        // structurally ambiguous. A printed summary, when present, remains the
        // independent source of truth.
        depositItemEvidence.ambiguous = true;
        depositItemFallbackBlocked = true;
      } else {
        depositItemEvidence.active = true;
      }
      pendingName = undefined;
      continue;
    }
    if (isDepositSectionSummary(line)) {
      depositItemEvidence.active = false;
      pendingName = undefined;
      continue;
    }
    if (section === 'deposits' && depositItemEvidence.active && isDamagedDepositSectionSummaryLike(line)) {
      // A narrowly recognized damaged structural summary ends the explicit
      // deposit section but never supplies an amount. Earlier clean item rows
      // remain the only fallback evidence.
      depositItemEvidence.active = false;
      pendingName = undefined;
      continue;
    }
    if (isFinalPayableLine(line)) {
      depositItemEvidence.active = false;
      section = 'payments';
      pendingName = undefined;
      continue;
    }
    if (isTaxSectionStart(line)) {
      depositItemEvidence.active = false;
      section = 'vat';
      pendingName = undefined;
      continue;
    }
    if (isPaymentOrFooterLine(line)) {
      depositItemEvidence.active = false;
      section = 'payments';
      pendingName = undefined;
      continue;
    }
    if (section === 'payments' || section === 'footer') {
      if (isPaymentOrFooterLine(line)) section = 'footer';
      continue;
    }
    if (section === 'vat') continue;

    if (section === 'deposits') {
      if (isPaymentOrFooterLine(line) || totalPriority(line) >= 0) {
        depositItemEvidence.active = false;
        continue;
      }
      const depositItem = inlineItem(line);
      const depositAmountMinor = depositItem?.amountMinor;
      if (depositItem && Number.isSafeInteger(depositAmountMinor) && (depositAmountMinor ?? 0) > 0) {
        detectedDepositItemsTotalMinor += depositAmountMinor ?? 0;
        if (depositItemEvidence.active) {
          if (depositItemEvidence.sourceLineIndexes.has(lineIndex)) {
            depositItemEvidence.ambiguous = true;
          } else {
            depositItemEvidence.sourceLineIndexes.add(lineIndex);
            depositItemEvidence.totalMinor += depositAmountMinor ?? 0;
            depositItemEvidence.validRowCount += 1;
          }
        }
        lastItemLineIndex = lineIndex;
      } else if (depositItemEvidence.active && depositEvidenceHasSubstantiveContent(line)) {
        // Do not accept a partial sum when any substantive row inside the
        // explicit deposit section cannot be parsed safely.
        depositItemEvidence.ambiguous = true;
        depositItemFallbackBlocked = true;
      }
      continue;
    }

    if (section === 'items' && lineIndex >= regions.itemEndIndex) {
      pendingName = undefined;
      continue;
    }

    if (looksLikePreTaxClassificationLine(
      line,
      lines.slice(lineIndex + 1, lineIndex + 3),
      items[items.length - 1],
    )) {
      pendingName = undefined;
      continue;
    }

    const adjustment = discountAdjustment(line);
    if (adjustment) {
      adjustments.push(adjustment);
      warnings.push({ code: 'discount-detected', message: 'Wykryto rabat lub korektę. Nie zapisano jej jako osobnej pozycji.', line });

      const previousItemIndex = items.length - 1;
      const previousItem = previousItemIndex >= 0 ? items[previousItemIndex] : undefined;
      if (!previousItem || previousItem.amountMinor === undefined) {
        unresolvedDiscountWarning(warnings, adjustment);
        pendingName = undefined;
        continue;
      }

      const originalAmountCandidates = itemOriginalAmountCandidates(previousItem);
      if (adjustment.amountMinor !== undefined && adjustment.amountMinor < 0) {
        const candidateOnSameLine = positivePriceOnDiscountLine(line);
        const sameLineAmount = discountFinalAmount({
          itemIndex: previousItemIndex,
          originalAmountCandidates,
          adjustment,
          stage: 'final-amount',
          startLineIndex: lineIndex,
        }, candidateOnSameLine);
        if (sameLineAmount !== undefined) {
          const baseAmountMinor = previousItem.baseAmountMinor ?? previousItem.amountMinor;
          previousItem.amountMinor = sameLineAmount;
          if (baseAmountMinor !== undefined && baseAmountMinor >= sameLineAmount) {
            previousItem.baseAmountMinor = baseAmountMinor;
            previousItem.discountMinor = baseAmountMinor - sameLineAmount;
          }
          previousItem.rawText = `${previousItem.rawText}\n${line}`;
          previousItem.confidence = 'medium';
          pendingName = undefined;
          continue;
        }
        pendingDiscount = {
          itemIndex: previousItemIndex,
          originalAmountCandidates,
          adjustment,
          stage: 'final-amount',
          startLineIndex: lineIndex,
        };
        pendingName = undefined;
        continue;
      }

      if (adjustment.amountMinor === undefined && isBareDiscountLabel(line)) {
        pendingDiscount = {
          itemIndex: previousItemIndex,
          originalAmountCandidates,
          adjustment,
          stage: 'discount-value',
          startLineIndex: lineIndex,
        };
        pendingName = undefined;
        continue;
      }

      const noisyDiscountToken = extractNoisyDiscountToken(line);
      if (adjustment.amountMinor === undefined && noisyDiscountToken) {
        pendingDiscount = {
          itemIndex: previousItemIndex,
          originalAmountCandidates,
          adjustment,
          stage: 'final-amount',
          startLineIndex: lineIndex,
          noisyDiscountToken,
          recoveredAdjustment: true,
        };
        pendingName = undefined;
        continue;
      }

      unresolvedDiscountWarning(warnings, adjustment);
      pendingName = undefined;
      continue;
    }

    if (isMetadata(line) || totalPriority(line) >= 0 || lineContainsReceiptDate(line)) {
      pendingName = undefined;
      continue;
    }

    if (ITEM_DESCRIPTOR_CONTINUATION.test(normalizeForMatch(line))) {
      if (pendingName && lineIndex - pendingName.lineIndex <= 1) {
        pendingName = { text: cleanItemName(`${pendingName.text} ${line}`), lineIndex };
      } else if (items.length && lineIndex - lastItemLineIndex <= 1) {
        const previousItem = items[items.length - 1]!;
        if (!normalizeForMatch(previousItem.name).includes(normalizeForMatch(line))) {
          previousItem.name = cleanItemName(`${previousItem.name} ${line}`);
        }
        previousItem.rawText = `${previousItem.rawText}\n${line}`;
        previousItem.confidence = previousItem.confidence === 'high' ? 'medium' : previousItem.confidence;
        lastItemLineIndex = lineIndex;
      }
      continue;
    }

    if (isUnitOnlyLine(line)) {
      if (pendingName) pendingName = { ...pendingName, lineIndex };
      else if (items.length && lineIndex - lastItemLineIndex <= 1) {
        const previousItem = items[items.length - 1]!;
        previousItem.rawText = `${previousItem.rawText}\n${line}`;
        lastItemLineIndex = lineIndex;
      }
      continue;
    }

    const quantityInfo = quantityOnlyLine(line);
    if (quantityInfo) {
      if (pendingName && lineIndex - pendingName.lineIndex <= 1) {
        items.push({
          rawText: `${pendingName.text}\n${line}`,
          name: cleanPendingNameForQuantity(pendingName.text, quantityInfo.finalTaxMarker),
          amountMinor: quantityInfo.amountMinor,
          baseAmountMinor: quantityInfo.amountMinor,
          discountMinor: 0,
          financialResolution: quantityInfo.financialResolution,
          confidence: 'medium',
          warnings: quantityInfo.quantityAnomaly
            ? ['Niepewna ilość: OCR nie zgadza się z ceną jednostkową i wartością pozycji. Kwota pozycji została zachowana.']
            : [],
        });
        lastItemLineIndex = lineIndex;
      }
      pendingName = undefined;
      continue;
    }

    const nextLine = lines[lineIndex + 1];
    if (nextLine && quantityOnlyLine(nextLine) && looksLikeDescriptorWithDamagedCapacity(line)) {
      pendingName = { text: line, lineIndex };
      continue;
    }

    const parsed = inlineItem(line);
    if (parsed) {
      if (pendingName && lineIndex - pendingName.lineIndex <= 1 && itemNameLooksLikeOcrGarbage(parsed.name)) {
        parsed.name = cleanItemName(pendingName.text);
        parsed.rawText = `${pendingName.text}\n${parsed.rawText}`;
        parsed.confidence = 'medium';
      }
      items.push(parsed);
      lastItemLineIndex = lineIndex;
      pendingName = undefined;
      continue;
    }

    if (!findStructuredPrices(line).length && !ADDRESS_LINE.test(line) && /[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]{2}/u.test(line) && line.length <= 80) {
      if (pendingName && ITEM_DESCRIPTOR_CONTINUATION.test(normalizeForMatch(line)) && lineIndex - pendingName.lineIndex <= 1) {
        pendingName = { text: cleanItemName(`${pendingName.text} ${line}`), lineIndex };
      } else {
        pendingName = { text: line, lineIndex };
      }
    } else {
      pendingName = undefined;
    }
  }

  if (pendingDiscount) {
    const implicitAmount = implicitDiscountFinalAmount(pendingDiscount, items[pendingDiscount.itemIndex]);
    if (implicitAmount !== undefined) applyPendingDiscount(pendingDiscount, implicitAmount, undefined, true);
    else unresolvedDiscountWarning(warnings, pendingDiscount.adjustment);
  }
  if (!items.length) warnings.push({ code: 'no-items', message: 'Nie udało się automatycznie rozpoznać pozycji. Możesz dodać je ręcznie na podstawie zdjęcia.' });

  applyUniqueTaxSubtotalCorrections(items, lines);

  const detectedItemsTotalMinor = items.reduce((sum, item) => sum + (item.amountMinor ?? 0), 0);
  const depositTotalMinor = resolvedDepositTotalMinor(totals.depositTotalMinor, depositItemEvidence);
  const financial = reconcileReceiptFinancials({
    itemsTotalMinor: detectedItemsTotalMinor,
    ...(totals.ocrSubtotalMinor === undefined ? {} : { ocrSubtotalMinor: totals.ocrSubtotalMinor }),
    ...(depositTotalMinor === undefined ? {} : { depositTotalMinor }),
    ...(declaredTotalMinor === undefined ? {} : { finalTotalMinor: declaredTotalMinor }),
    ...(totals.paymentTotalMinor === undefined ? {} : { paymentTotalMinor: totals.paymentTotalMinor }),
  });
  const reconciledSubtotalMinor = financial.reconciledSubtotalMinor;

  let totalsMismatch = financial.unexplainedDifferenceMinor !== undefined
    && Math.abs(financial.unexplainedDifferenceMinor) > 1;
  if (totals.depositTotalMinor === undefined && (depositItemEvidence.ambiguous || depositItemFallbackBlocked)) {
    totalsMismatch = true;
  }
  if (totals.depositTotalMinor !== undefined && detectedDepositItemsTotalMinor > 0) {
    totalsMismatch ||= Math.abs(detectedDepositItemsTotalMinor - totals.depositTotalMinor) > 1;
  }
  if (totalsMismatch) {
    warnings.push({ code: 'sum-mismatch', message: 'Suma rozpoznanych pozycji różni się od sumy odczytanej z paragonu po uwzględnieniu kaucji.' });
  }

  const appliedDiscountTotalMinor = adjustments.reduce((sum, adjustment) => (
    adjustment.amountMinor !== undefined && adjustment.amountMinor < 0 ? sum + adjustment.amountMinor : sum
  ), 0);
  if (declaredDiscountTotalMinor !== undefined && appliedDiscountTotalMinor !== declaredDiscountTotalMinor) {
    warnings.push({
      code: 'discount-summary-mismatch',
      message: 'Suma rozpoznanych rabatów różni się od łącznej wartości rabatów na paragonie.',
    });
  }

  return {
    ...(merchant.merchant === undefined ? {} : { merchant: merchant.merchant }),
    merchantConfidence: merchant.confidence,
    ...(date.date === undefined ? {} : { date: date.date }),
    dateConfidence: date.confidence,
    items,
    ...(declaredTotalMinor === undefined ? {} : { declaredTotalMinor }),
    ...(totals.ocrSubtotalMinor === undefined ? {} : { ocrSubtotalMinor: totals.ocrSubtotalMinor }),
    ...(totals.taxTotalMinor === undefined ? {} : { taxTotalMinor: totals.taxTotalMinor }),
    ...(reconciledSubtotalMinor === undefined ? {} : { declaredSubtotalMinor: reconciledSubtotalMinor }),
    ...(depositTotalMinor === undefined ? {} : { depositTotalMinor }),
    ...(totals.finalPayableMinor === undefined ? {} : { finalPayableMinor: totals.finalPayableMinor }),
    ...(totals.paymentTotalMinor === undefined ? {} : { paymentTotalMinor: totals.paymentTotalMinor }),
    ...(financial.unexplainedDifferenceMinor === undefined ? {} : { unexplainedDifferenceMinor: financial.unexplainedDifferenceMinor }),
    ...(financial.subtotalResolution === undefined ? {} : { subtotalResolution: financial.subtotalResolution }),
    ...(declaredDiscountTotalMinor === undefined ? {} : { declaredDiscountTotalMinor }),
    detectedItemsTotalMinor,
    adjustments,
    warnings,
  };
}

