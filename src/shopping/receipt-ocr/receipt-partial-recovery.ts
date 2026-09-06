import { analyzeReceiptStructuralRegions, parseReceiptPriceMinor } from './receipt-parser';
import type {
  ParsedReceiptDraft,
  ParsedReceiptItem,
  ReceiptOcrConfidence,
  ReceiptOcrQuality,
  ReceiptParseWarning,
  ReceiptSourceQuality,
} from './receipt-ocr.types';

function collapse(value: string): string {
  return value.replace(/[\t\u00a0]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function normalizeForMatch(value: string): string {
  return collapse(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleUpperCase('pl-PL');
}

function sumItems(items: readonly ParsedReceiptItem[]): number {
  return items.reduce((sum, item) => sum + (item.amountMinor ?? 0), 0);
}

function removeWarnings(warnings: readonly ReceiptParseWarning[], codes: ReadonlySet<string>): ReceiptParseWarning[] {
  return warnings.filter((warning) => !codes.has(warning.code));
}

function addWarningOnce(warnings: readonly ReceiptParseWarning[], warning: ReceiptParseWarning): ReceiptParseWarning[] {
  return warnings.some((entry) => entry.code === warning.code && entry.message === warning.message)
    ? [...warnings]
    : [...warnings, warning];
}

function parseAnchoredMinorToken(value: string): number | undefined {
  const trimmed = collapse(value)
    .replace(/^[=:;,.\-–—]+\s*/u, '')
    .replace(/\s*(?:PLN|Z[ŁL])\b.*$/iu, '')
    .trim();

  const decimal = /^(\d{1,7}[,.][0-9OIl]{2})(?:[^\d].*)?$/u.exec(trimmed)?.[1];
  if (decimal) return parseReceiptPriceMinor(decimal);

  const spaced = /^(\d{1,6})\s+([0-9OIl]{2})(?:[^\d].*)?$/u.exec(trimmed);
  if (spaced) {
    const whole = Number(spaced[1]);
    const cents = Number((spaced[2] ?? '').replace(/[Oo]/gu, '0').replace(/[Il]/gu, '1'));
    if (Number.isSafeInteger(whole) && Number.isSafeInteger(cents) && cents >= 0 && cents <= 99) return whole * 100 + cents;
  }

  const compact = /^(\d{3,8})(?:[^\d].*)?$/u.exec(trimmed)?.[1];
  if (compact) {
    const digits = Number(compact);
    if (Number.isSafeInteger(digits) && digits > 0) return digits;
  }

  return undefined;
}

interface AnchoredTotalCandidate {
  amountMinor: number;
  priority: number;
}

function recoverAnchoredTotal(lines: readonly string[]): number | undefined {
  const candidates: AnchoredTotalCandidate[] = [];

  for (const rawLine of lines) {
    const line = collapse(rawLine);
    const normalized = normalizeForMatch(line);
    if (/^SUMA\s+(?:PTU|VAT)\b/u.test(normalized)) continue;
    if (/^SPRZEDAZ\s+OPODATKOWANA\b/u.test(normalized)) continue;

    let priority = -1;
    let rest = '';
    const payable = /^DO\s+ZAPL+ATY\b(.*)$/u.exec(normalized);
    const sumPln = /^SUMA\s+PLN\b(.*)$/u.exec(normalized);
    const sum = /^SUMA\b(.*)$/u.exec(normalized);
    if (payable) {
      priority = 3;
      rest = line.slice(line.length - (payable[1]?.length ?? 0));
    } else if (sumPln) {
      priority = 2;
      rest = line.slice(line.length - (sumPln[1]?.length ?? 0));
    } else if (sum) {
      priority = 1;
      rest = line.slice(line.length - (sum[1]?.length ?? 0));
    } else {
      continue;
    }

    const amountMinor = parseAnchoredMinorToken(rest);
    if (amountMinor === undefined || amountMinor <= 0 || amountMinor > 100_000_000) continue;
    candidates.push({ amountMinor, priority });
  }

  if (!candidates.length) return undefined;
  const bestPriority = Math.max(...candidates.map((candidate) => candidate.priority));
  const best = candidates.filter((candidate) => candidate.priority === bestPriority);
  const values = [...new Set(best.map((candidate) => candidate.amountMinor))];
  return values.length === 1 ? values[0] : undefined;
}

function parseValidDate(year: number, month: number, day: number): string | undefined {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return undefined;
  if (year < 2020 || year > 2035) return undefined;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return undefined;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function recoverDate(lines: readonly string[]): string | undefined {
  const dates = new Set<string>();
  const regions = analyzeReceiptStructuralRegions(lines);
  for (let lineIndex = regions.dateWindowStartIndex; lineIndex < regions.dateWindowEndIndex; lineIndex += 1) {
    const line = lines[lineIndex] ?? '';
    for (const match of line.matchAll(/\b(?:(\d{2})[.\-/](\d{2})[.\-/](\d{4})|(\d{4})-(\d{2})-(\d{2}))\b/gu)) {
      const year = Number(match[4] ?? match[3]);
      const month = Number(match[5] ?? match[2]);
      const day = Number(match[6] ?? match[1]);
      const date = parseValidDate(year, month, day);
      if (date) dates.add(date);
    }
  }
  return dates.size === 1 ? [...dates][0] : undefined;
}

type MerchantEvidenceKind = 'legal' | 'domain' | 'descriptor';

interface MerchantEvidence {
  display: string;
  key: string;
  kind: MerchantEvidenceKind;
  index: number;
}

function cleanMerchant(value: string): string {
  return collapse(value)
    .replace(/^["'`~_.,:;()\[\]{}\-\s]+|["'`~_.,:;()\[\]{}\-\s]+$/gu, '')
    .replace(/\s{2,}/gu, ' ')
    .trim();
}

function cleanLegalSuffix(value: string): string {
  return cleanMerchant(value.replace(/\b(?:S\.?\s*A\.?|SP\.?\s+Z\s+O\.?\s*O\.?|SP\.?\s*K\.?|S\.?\s*C\.?)\s*$/iu, ''));
}

function merchantKey(value: string): string {
  return normalizeForMatch(cleanLegalSuffix(value))
    .replace(/[^A-Z0-9]+/gu, '')
    .trim();
}

function compatibleMerchantKeys(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  return shorter.length >= 2 && longer.length - shorter.length <= 1 && longer.startsWith(shorter);
}

function merchantEvidence(lines: readonly string[]): MerchantEvidence[] {
  const result: MerchantEvidence[] = [];
  const paragonIndex = lines.findIndex((line) => /PARAGON\s+(?:NIE)?FISKALNY/iu.test(normalizeForMatch(line)));
  const header = lines.slice(0, paragonIndex >= 0 ? Math.min(paragonIndex, 16) : Math.min(lines.length, 12));

  header.forEach((line, index) => {
    const collapsed = collapse(line);
    const normalized = normalizeForMatch(collapsed);

    const domain = /(?:WWW\s*\.\s*)?([A-Z0-9-]{2,})\s*\.\s*(?:PL|EU|COM|NET|ORG)(?:\s*\.\s*[A-Z]{2})?/iu.exec(normalized)?.[1];
    if (domain) {
      const display = cleanMerchant(domain);
      const key = merchantKey(display);
      if (key.length >= 2) result.push({ display, key, kind: 'domain', index });
    }

    const descriptor = /(?:^|\s)(?:SALON\s+FIRMOWY|SALON|PUNKT\s+SPRZEDAZY)\s+([A-Z0-9][A-Z0-9-]{1,29})\b/iu.exec(normalized)?.[1];
    if (descriptor) {
      const display = cleanMerchant(descriptor);
      const key = merchantKey(display);
      if (key.length >= 2) result.push({ display, key, kind: 'descriptor', index });
    }

    const legal = /([A-ZĄĆĘŁŃÓŚŹŻ][A-Z0-9ĄĆĘŁŃÓŚŹŻ .&'\-]{1,54}?\b(?:S\.?\s*A\.?|SP\.?\s+Z\s+O\.?\s*O\.?|SP\.?\s*K\.?|S\.?\s*C\.?))/iu.exec(normalized)?.[1];
    if (legal) {
      const display = cleanLegalSuffix(legal);
      const key = merchantKey(display);
      if (key.length >= 2 && !/^(?:SKLEP|SALON|PUNKT)$/u.test(key)) result.push({ display, key, kind: 'legal', index });
    }
  });

  return result;
}

function recoverMerchant(lines: readonly string[]): { merchant?: string; confidence: ReceiptOcrConfidence } {
  const evidence = merchantEvidence(lines);
  if (!evidence.length) return { confidence: 'low' };

  const groups: MerchantEvidence[][] = [];
  for (const candidate of evidence) {
    const group = groups.find((entries) => entries.some((entry) => compatibleMerchantKeys(entry.key, candidate.key)));
    if (group) group.push(candidate);
    else groups.push([candidate]);
  }

  const consensus = groups
    .map((group) => ({
      group,
      kinds: new Set(group.map((entry) => entry.kind)),
      longest: group.slice().sort((a, b) => b.key.length - a.key.length || a.index - b.index)[0]!,
    }))
    .filter((entry) => entry.kinds.size >= 2)
    .sort((a, b) => b.kinds.size - a.kinds.size || b.longest.key.length - a.longest.key.length)[0];

  if (consensus) {
    const preferred = consensus.group.slice().sort((a, b) => {
      const rank = (entry: MerchantEvidence) => entry.kind === 'domain' ? 3 : entry.kind === 'legal' ? 2 : 1;
      return b.key.length - a.key.length || rank(b) - rank(a) || a.index - b.index;
    })[0]!;
    return { merchant: cleanLegalSuffix(preferred.display), confidence: preferred.key.length >= 3 ? 'high' : 'medium' };
  }

  const legal = evidence
    .filter((entry) => entry.kind === 'legal' && entry.key.length >= 3)
    .sort((a, b) => b.key.length - a.key.length || a.index - b.index)[0];
  return legal ? { merchant: cleanLegalSuffix(legal.display), confidence: 'medium' } : { confidence: 'low' };
}

function rawItemEquationIsStrong(item: ParsedReceiptItem): boolean {
  const firstLine = collapse(item.rawText.split(/\r?\n/gu)[0] ?? item.rawText).replace(/×/gu, 'x');
  const match = /(\d+(?:[,.]\d{1,3})?)\s*[xX*]\s*(\d+[,.][0-9OIl]{2})(?:[A-GĆXx€%Il|])?\s+(\d+[,.][0-9OIl]{2}|\d{2,8})(?:[A-GĆXx€%Il|])?\s*$/u.exec(firstLine);
  if (!match) return false;
  const quantity = Number((match[1] ?? '').replace(',', '.'));
  const unitMinor = parseReceiptPriceMinor(match[2] ?? '');
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000 || unitMinor === undefined || unitMinor <= 0) return false;
  const expected = Math.round(quantity * unitMinor);
  const rawTotal = match[3] ?? '';
  const parsedTotal = /[,.]/u.test(rawTotal) ? parseReceiptPriceMinor(rawTotal) : Number(rawTotal.replace(/[Oo]/gu, '0').replace(/[Il|]/gu, '1'));
  return parsedTotal !== undefined && Number.isSafeInteger(parsedTotal) && parsedTotal > 0 && Math.abs(expected - parsedTotal) <= 1;
}

function isStructurallyStrongItem(item: ParsedReceiptItem): boolean {
  if (item.amountMinor === undefined || item.amountMinor <= 0) return false;
  if (item.financialResolution !== 'quantity-unit-total-consensus' && item.financialResolution !== 'quantity-unit-recovery') return false;
  if (!rawItemEquationIsStrong(item)) return false;
  if (item.warnings.some((warning) => /Niepewna ilość/iu.test(warning))) return false;
  if (item.discountMinor !== undefined && item.discountMinor > 0) {
    if (item.baseAmountMinor === undefined || item.baseAmountMinor < item.amountMinor) return false;
    if (Math.abs(item.baseAmountMinor - item.amountMinor - item.discountMinor) > 1) return false;
  }
  return true;
}

function partialRecoveryItem(item: ParsedReceiptItem): ParsedReceiptItem {
  const warning = 'Pozycja odzyskana z niskiej jakości OCR na podstawie spójnej ilości, ceny i wartości. Sprawdź ją przed zapisem.';
  return {
    ...item,
    confidence: 'medium',
    warnings: item.warnings.includes(warning) ? [...item.warnings] : [...item.warnings, warning],
  };
}

function mergeRecoveredItems(original: ParsedReceiptDraft, safe: ParsedReceiptDraft): ParsedReceiptItem[] {
  const strong = original.items.filter(isStructurallyStrongItem).map(partialRecoveryItem);
  if (strong.length <= safe.items.length) return safe.items;
  return strong;
}

function shouldRunRecovery(
  safe: ParsedReceiptDraft,
  sourceQuality: ReceiptSourceQuality | undefined,
  quality: ReceiptOcrQuality,
): boolean {
  return sourceQuality?.level === 'very-low'
    || quality.level === 'low'
    || safe.items.length === 0
    || safe.declaredTotalMinor === undefined
    || safe.merchantConfidence !== 'high'
    || safe.dateConfidence === 'low';
}

/**
 * Conservative field-level recovery for incomplete/degraded OCR. It never lowers
 * confidence thresholds globally and never fabricates balancing data. Strong raw
 * anchors and already parsed structural item equations may restore fields that the
 * all-or-nothing degraded safety path would otherwise discard.
 */
export function applyReceiptPartialRecovery(
  rawText: string,
  originalParsed: ParsedReceiptDraft,
  safeParsed: ParsedReceiptDraft,
  sourceQuality: ReceiptSourceQuality | undefined,
  quality: ReceiptOcrQuality,
): ParsedReceiptDraft {
  if (!shouldRunRecovery(safeParsed, sourceQuality, quality)) return safeParsed;

  const lines = rawText.split(/\r?\n/gu).map(collapse).filter(Boolean);
  const veryLow = sourceQuality?.level === 'very-low';
  let next: ParsedReceiptDraft = { ...safeParsed, items: [...safeParsed.items], warnings: [...safeParsed.warnings] };
  let recoveredAnything = false;

  // A syntactically valid date from a very-low source may be useful, but it is
  // still review-only evidence rather than an automatic OK field.
  if (veryLow && next.date && next.dateConfidence === 'high') {
    next = { ...next, dateConfidence: 'medium' };
  }
  if (veryLow && next.merchant && next.merchantConfidence === 'high') {
    next = { ...next, merchantConfidence: 'medium' };
  }

  if (next.declaredTotalMinor === undefined) {
    const recoveredTotal = recoverAnchoredTotal(lines);
    if (recoveredTotal !== undefined) {
      next = { ...next, declaredTotalMinor: recoveredTotal };
      next.warnings = removeWarnings(next.warnings, new Set(['total-missing']));
      recoveredAnything = true;
    }
  }

  if (!next.date || next.dateConfidence === 'low') {
    const recovered = recoverDate(lines);
    if (recovered) {
      next = { ...next, date: recovered, dateConfidence: veryLow ? 'medium' : 'high' };
      next.warnings = removeWarnings(next.warnings, new Set(['date-missing']));
      recoveredAnything = true;
    }
  }

  if (!next.merchant || next.merchantConfidence !== 'high') {
    const recovered = recoverMerchant(lines);
    if (recovered.merchant) {
      const confidence: ReceiptOcrConfidence = veryLow ? 'medium' : recovered.confidence;
      const existingKey = next.merchant ? merchantKey(next.merchant) : '';
      const recoveredKey = merchantKey(recovered.merchant);
      const stronger = !next.merchant
        || next.merchantConfidence === 'low'
        || recovered.confidence === 'high'
        || (compatibleMerchantKeys(existingKey, recoveredKey) && recoveredKey.length > existingKey.length);
      if (stronger) {
        next = { ...next, merchant: recovered.merchant, merchantConfidence: confidence };
        next.warnings = removeWarnings(next.warnings, new Set(['merchant-uncertain']));
        if (confidence !== 'high') {
          next.warnings = addWarningOnce(next.warnings, {
            code: 'merchant-uncertain',
            message: 'Sprawdź rozpoznaną nazwę sklepu.',
          });
        }
        recoveredAnything = true;
      }
    }
  }

  if (veryLow || next.items.length === 0) {
    const recoveredItems = mergeRecoveredItems(originalParsed, next);
    if (recoveredItems.length > next.items.length) {
      next = {
        ...next,
        items: recoveredItems,
        detectedItemsTotalMinor: sumItems(recoveredItems),
      };
      next.warnings = removeWarnings(next.warnings, new Set(['no-items']));
      recoveredAnything = true;
    }
  }

  if (recoveredAnything) {
    next.warnings = addWarningOnce(next.warnings, {
      code: 'partial-recovery',
      message: 'Odczytano część danych z niskiej jakości lub niepełnego OCR. Sprawdź zaznaczone pola przed zapisem.',
    });
  }

  return next;
}
