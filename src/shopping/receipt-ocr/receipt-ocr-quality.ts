import { parseReceiptPriceMinor, parseReceiptText } from './receipt-parser';
import { reconstructColumnarReceiptText } from './receipt-columnar-reconstruction';
import type { ReceiptOcrQuality, ReceiptOcrSourceType } from './receipt-ocr.types';

interface FinancialLine {
  index: number;
  quantity: number;
  unitMinor: number;
  totalMinor: number;
  consistent: boolean;
}

function collapse(value: string): string {
  return value.replace(/[\t\u00a0]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function parseQuantity(value: string): number | undefined {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 10000 ? parsed : undefined;
}

function parseMoneyToken(value: string): number | undefined {
  return parseReceiptPriceMinor(value.replace(/[ABCĆXx€%|]+$/u, ''));
}

function parseProductFinancialLine(line: string, index: number): FinancialLine | undefined {
  const normalized = collapse(line).replace(/×/gu, 'x');
  const match = /(\d+(?:[,.]\d{1,3})?)\s*(?:KG|MG|ML|CL|DL|G|L|SZT\.?)?\s*[xX*="”]\s*(\d+[,.][0-9OIl]{2})\s*(?:[ABCĆXx€%Il|])?\s+(\d+[,.][0-9OIl]{2})\s*(?:[ABCĆXx€%Il|])?\s*$/iu.exec(normalized);
  if (!match) return undefined;
  const quantity = parseQuantity(match[1] ?? '');
  const unitMinor = parseMoneyToken(match[2] ?? '');
  const totalMinor = parseMoneyToken(match[3] ?? '');
  if (quantity === undefined || unitMinor === undefined || totalMinor === undefined || unitMinor <= 0 || totalMinor <= 0) return undefined;
  const expected = Math.round(quantity * unitMinor);
  return {
    index,
    quantity,
    unitMinor,
    totalMinor,
    consistent: Math.abs(expected - totalMinor) <= 1,
  };
}

function discountMinor(line: string): number | undefined {
  const normalized = collapse(line);
  if (/ŁĄCZNIE|LACZNIE/iu.test(normalized)) return undefined;
  if (!/(?:RAB[AO]T|OPUST|BONUS|KUPON|PROMOCJ|OBNI[ŻZ]K|DISCOUNT)\w*/iu.test(normalized)) return undefined;
  const match = /[-−]\s*(\d+[,.][0-9OIl]{2})/u.exec(normalized);
  if (!match) return undefined;
  const amount = parseMoneyToken(match[1] ?? '');
  return amount === undefined ? undefined : -Math.abs(amount);
}

function standalonePositiveMinor(line: string): number | undefined {
  const normalized = collapse(line);
  const match = /^(\d+[,.][0-9OIl]{2})(?:[ABCĆXx€%Il|])?$/u.exec(normalized);
  if (!match) return undefined;
  const amount = parseMoneyToken(match[1] ?? '');
  return amount !== undefined && amount > 0 ? amount : undefined;
}

function suspiciousMoneyTokens(line: string): number {
  const normalized = collapse(line).replace(/×/gu, 'x');
  let scope = normalized;
  const discountMatch = /(?:RAB[AO]T|OPUST|BONUS|KUPON|PROMOCJ|OBNI[ŻZ]K|DISCOUNT)\w*/iu.exec(normalized);
  if (discountMatch) scope = normalized.slice(discountMatch.index + discountMatch[0].length);
  else {
    const multiplyIndex = normalized.search(/\s[xX*="”]\s*/u);
    if (multiplyIndex >= 0) scope = normalized.slice(multiplyIndex + 1);
  }

  const tokens = scope.match(/[-−]?\d[0-9OIl.,\/]*[ABCabcĆćXx€%Il|]?/gu) ?? [];
  let suspicious = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const raw = tokens[index]!;
    const token = raw.replace(/[−–—]/gu, '-');
    if (token.includes('/')) {
      suspicious += 1;
      continue;
    }
    const withoutSuffix = token.replace(/[ABCabcĆćXx€%Il|]$/u, '');
    const decimal = /[,.]([0-9OIl]+)$/u.exec(withoutSuffix)?.[1];
    if (!decimal) {
      if (index > 0 && /^\d{3,6}$/u.test(withoutSuffix)) suspicious += 1;
      continue;
    }
    if (decimal.length !== 2 || /[OIl]/u.test(decimal)) suspicious += 1;
  }
  return suspicious;
}

function hasDiscountLabel(line: string): boolean {
  const normalized = collapse(line);
  if (/ŁĄCZNIE|LACZNIE/iu.test(normalized)) return false;
  if (/^(?:WYKORZYSTAN[EY]|AKTYWNE|DOST[ĘE]PNE)\s+KUPON(?:Y|ÓW|OW)?$/iu.test(normalized)) return false;
  return /(?:RAB[AO]T|OPUST|BONUS|KUPON|PROMOCJ|OBNI[ŻZ]K|DISCOUNT)\w*/iu.test(normalized);
}

function lastMoneyMinor(line: string): number | undefined {
  const matches = [...collapse(line).matchAll(/(\d+[,.][0-9OIl]{2})(?:\s*(?:PLN|Z[ŁL]))?(?:[ABCĆXx€%Il|])?/giu)];
  const raw = matches.at(-1)?.[1];
  return raw ? parseMoneyToken(raw) : undefined;
}

function declaredFinalMinor(lines: string[]): number | undefined {
  let strongFallback: number | undefined;
  let genericFallback: number | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const normalized = collapse(line).normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLocaleUpperCase('pl-PL');
    const amount = lastMoneyMinor(line);
    if (amount === undefined) continue;
    if (/^DO\s+ZAPL+ATY\b/u.test(normalized)) return amount;
    if (/^RAZEM(?:\s+PLN)?\b/u.test(normalized)) {
      strongFallback = amount;
      continue;
    }
    if (/^SUMA\s+(?:PTU|VAT)\b/u.test(normalized)) continue;
    if (/^SUMA\s+PLN\b/u.test(normalized)) {
      genericFallback = amount;
      continue;
    }
    if (/^SUMA\b/u.test(normalized)) {
      const context = lines.slice(Math.max(0, index - 3), index)
        .map((entry) => collapse(entry).normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLocaleUpperCase('pl-PL'));
      const taxScoped = context.some((entry) => /(?:\bPTU\b|\bVAT\b|KWOTA\s+[A-G]\b.*%|SPRZEDA.{0,4}\s+OPODATKOWANA)/u.test(entry));
      if (!taxScoped) genericFallback = amount;
    }
  }
  return strongFallback ?? genericFallback;
}

function paymentTotalMinor(lines: string[]): number | undefined {
  let total = 0;
  let found = 0;
  for (const line of lines) {
    const normalized = collapse(line).normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLocaleUpperCase('pl-PL');
    if (!/^(?:PLATNOSC\s+)?(?:(?:ZAPLACONO\s+)?KARTA|KARTA\s+PLATNICZA|(?:INNA\s+)?BON|GOTOWKA)\b/u.test(normalized)) continue;
    const amount = lastMoneyMinor(line);
    if (amount === undefined || amount < 0) continue;
    total += amount;
    found += 1;
  }
  return found ? total : undefined;
}

function aggregateDiscountMinor(lines: string[]): number | undefined {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const normalized = collapse(line).normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLocaleUpperCase('pl-PL');
    const aggregateLabel = /(?:OPUSTY\s+LACZNIE|UDZIELONO\s+LACZNIE\s+OPUSTOW|ZAOSZCZEDZONO|OSZCZEDNOSC)/u.test(normalized);
    if (!aggregateLabel) continue;
    const amount = lastMoneyMinor(line);
    if (amount !== undefined) return Math.abs(amount);
    for (let offset = 1; offset <= 2; offset += 1) {
      const next = lines[index + offset];
      if (!next) break;
      const nextAmount = lastMoneyMinor(next);
      if (nextAmount !== undefined) return Math.abs(nextAmount);
    }
  }
  return undefined;
}

function qualityLevel(score: number): ReceiptOcrQuality['level'] {
  if (score >= 75) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

export function analyzeReceiptOcrQuality(
  text: string,
  sourceType: ReceiptOcrSourceType,
  ocrConfidence?: number,
): ReceiptOcrQuality {
  const reconstructed = reconstructColumnarReceiptText(text);
  const financialText = reconstructed.applied ? reconstructed.text : text;
  const lines = financialText.split(/\r?\n/gu).map(collapse).filter(Boolean);
  const financialLines = lines
    .map((line, index) => parseProductFinancialLine(line, index))
    .filter((line): line is FinancialLine => Boolean(line));

  let consistentFinancialLines = financialLines.filter((line) => line.consistent).length;
  let suspiciousFinancialLines = financialLines.filter((line) => !line.consistent).length;
  let discountSequences = 0;
  let suspiciousDiscountSequences = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const currentLine = lines[index] ?? '';
    if (!hasDiscountLabel(currentLine)) continue;
    const discount = discountMinor(currentLine);
    const previous = [...financialLines].reverse().find((line) => line.index < index);
    const finalMinor = standalonePositiveMinor(lines[index + 1] ?? '');
    if (discount === undefined || !previous) {
      suspiciousDiscountSequences += 1;
      continue;
    }
    const expected = previous.totalMinor + discount;
    if (expected <= 0) {
      suspiciousDiscountSequences += 1;
      suspiciousFinancialLines += 1;
      continue;
    }
    if (finalMinor === undefined || Math.abs(expected - finalMinor) <= 1) {
      // Many receipts print only the negative coupon amount and no separate
      // post-discount item total. In that case the arithmetic remains usable.
      discountSequences += 1;
      consistentFinancialLines += 1;
    } else {
      suspiciousDiscountSequences += 1;
      suspiciousFinancialLines += 1;
    }
  }

  const suspiciousTokens = lines.reduce((sum, line) => sum + suspiciousMoneyTokens(line), 0);
  const headerPatterns = [
    /PARAGON/iu,
    /\bNAZWA\b/iu,
    /\b(?:ILO[ŚS][ĆC]|CENA|WARTO[ŚS][ĆC])\b/iu,
    /(?:SUMA(?:\s+PLN)?|DO\s+ZAP[ŁL]ATY|RAZEM(?:\s+PLN)?)/iu,
  ];
  const headerSignals = headerPatterns.filter((pattern) => lines.some((line) => pattern.test(line))).length;
  const parsedReceipt = parseReceiptText(text);
  const productLikeLines = Math.max(financialLines.length, parsedReceipt.items.length);

  const declaredMinor = declaredFinalMinor(lines);
  const paidMinor = paymentTotalMinor(lines);
  const aggregateDiscount = aggregateDiscountMinor(lines);
  const hasDiscounts = lines.some((line) => hasDiscountLabel(line));
  const lineTotalsMinor = financialLines.reduce((sum, line) => sum + line.totalMinor, 0);
  const totalsReconcile = !hasDiscounts && declaredMinor !== undefined && financialLines.length > 0
    && Math.abs(lineTotalsMinor - declaredMinor) <= 1;
  const paymentReconciles = declaredMinor !== undefined && paidMinor !== undefined && Math.abs(declaredMinor - paidMinor) <= 1;
  const discountAdjustedTotalsReconcile = declaredMinor !== undefined && aggregateDiscount !== undefined && financialLines.length > 0
    && Math.abs(lineTotalsMinor - aggregateDiscount - declaredMinor) <= 1;

  const parsedDeclaredMinor = parsedReceipt.declaredTotalMinor ?? declaredMinor;
  const parsedItemsMinor = parsedReceipt.detectedItemsTotalMinor;
  const parsedGoodsTargetMinor = parsedReceipt.declaredSubtotalMinor
    ?? (parsedDeclaredMinor !== undefined && parsedReceipt.depositTotalMinor !== undefined
      ? parsedDeclaredMinor - parsedReceipt.depositTotalMinor
      : parsedDeclaredMinor);
  const parsedCoreReconciles = parsedGoodsTargetMinor !== undefined && parsedReceipt.items.length > 0
    && Math.abs(parsedItemsMinor - parsedGoodsTargetMinor) <= 1;
  const parsedSavingsMinor = parsedReceipt.items.reduce((sum, item) => {
    const base = item.baseAmountMinor ?? item.amountMinor ?? 0;
    const final = item.amountMinor ?? base;
    return sum + Math.max(0, base - final);
  }, 0);
  const declaredSavingsMinor = parsedReceipt.declaredDiscountTotalMinor === undefined
    ? aggregateDiscount
    : Math.abs(parsedReceipt.declaredDiscountTotalMinor);
  const parsedDiscountsReconcile = declaredSavingsMinor !== undefined
    && Math.abs(parsedSavingsMinor - declaredSavingsMinor) <= 1;
  const parsedPaymentReconciles = parsedDeclaredMinor !== undefined && paidMinor !== undefined
    && Math.abs(parsedDeclaredMinor - paidMinor) <= 1;
  const unresolvedFinancialWarnings = parsedReceipt.warnings.filter((warning) => (
    warning.code === 'item-price-missing'
    || warning.code === 'sum-mismatch'
    || warning.code === 'discount-summary-mismatch'
    || warning.code === 'total-missing'
  )).length;
  const recoveredOrAnomalousItems = parsedReceipt.items.filter((item) => item.confidence !== 'high' || item.warnings.length > 0).length;

  // Financial reliability follows the parsed financial equations first. Raw OCR
  // character noise and VAT outliers remain useful warnings, but they cannot make
  // an exactly reconciled item-total/payment receipt look financially unreliable.
  let financialScore = parsedReceipt.items.length ? 30 : 10;
  if (parsedCoreReconciles) financialScore += 45;
  else if (parsedDeclaredMinor !== undefined && parsedReceipt.items.length > 0) financialScore -= 15;
  if (parsedPaymentReconciles || paymentReconciles) financialScore += 20;
  if (parsedDiscountsReconcile) financialScore += 10;
  else if (declaredSavingsMinor !== undefined && parsedSavingsMinor > 0) financialScore -= 8;
  if (totalsReconcile || discountAdjustedTotalsReconcile) financialScore += 5;
  if (unresolvedFinancialWarnings === 0 && parsedReceipt.items.length > 0) financialScore += 5;
  else financialScore -= Math.min(20, unresolvedFinancialWarnings * 7);
  if (recoveredOrAnomalousItems > 0) financialScore -= Math.min(10, recoveredOrAnomalousItems * 2);
  const rawPenalty = Math.min(parsedCoreReconciles ? 10 : 25, suspiciousFinancialLines * 4 + suspiciousDiscountSequences * 3);
  financialScore -= rawPenalty;
  financialScore = Math.max(0, Math.min(100, Math.round(financialScore)));

  let textScore = lines.length ? 35 : 0;
  textScore += Math.min(25, headerSignals * 6);
  textScore += Math.min(20, productLikeLines * 3);
  textScore -= Math.min(30, suspiciousTokens * 4);
  if (typeof ocrConfidence === 'number') {
    if (ocrConfidence >= 85) textScore += 15;
    else if (ocrConfidence >= 70) textScore += 8;
    else if (ocrConfidence < 45) textScore -= 10;
  }
  textScore = Math.max(0, Math.min(100, Math.round(textScore)));

  let score = Math.round(financialScore * 0.65 + textScore * 0.35);
  if (!lines.length) score = 0;

  const warnings: string[] = [];
  if (suspiciousFinancialLines > 0) {
    warnings.push(suspiciousFinancialLines === 1
      ? 'Wykryto 1 niespójny wiersz finansowy.'
      : `Wykryto ${suspiciousFinancialLines} niespójne wiersze finansowe.`);
  }
  if (suspiciousDiscountSequences > 0) {
    warnings.push(suspiciousDiscountSequences === 1
      ? 'Wykryto 1 niepewną sekwencję rabatową.'
      : `Wykryto ${suspiciousDiscountSequences} niepewne sekwencje rabatowe.`);
  }
  if (suspiciousTokens > 0) warnings.push('Część tokenów kwotowych wygląda na uszkodzone przez OCR.');
  if (productLikeLines === 0) warnings.push('OCR nie rozpoznał wiarygodnych wierszy produktów.');

  let level = qualityLevel(score);
  if (suspiciousFinancialLines >= 3) level = 'low';
  else if (suspiciousFinancialLines > 0) level = 'medium';
  if (!parsedCoreReconciles && suspiciousDiscountSequences >= 2) level = 'low';

  return {
    sourceType,
    score,
    textScore,
    financialScore,
    level,
    suspiciousFinancialLines,
    consistentFinancialLines,
    suspiciousTokens,
    productLikeLines,
    headerSignals,
    discountSequences,
    suspiciousDiscountSequences,
    warnings,
  };
}
