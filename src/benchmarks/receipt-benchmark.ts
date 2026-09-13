import type { ParsedReceiptDraft, ReceiptOcrConfidence } from '../shopping/receipt-ocr/receipt-ocr.types';

export type BenchmarkSourceType = 'photo-good' | 'photo-poor' | 'pdf-digital' | 'pdf-image' | 'pdf-multipage';
export type BenchmarkLayoutType = 'linear' | 'columnar' | 'hybrid' | 'marketing-tail' | 'unknown';

export interface ReceiptBenchmarkCase {
  id: string;
  title: string;
  sourceFile: string;
  rawOcrFile: string;
  sourceType: BenchmarkSourceType;
  layoutType: BenchmarkLayoutType;
  merchantClass?: string;
  groundTruthFile: string;
  tags: string[];
  private: true;
  groundTruthVerified: true;
}

export interface ReceiptGroundTruthItem {
  name: string;
  quantity?: number;
  unit?: string;
  unitPriceMinor?: number;
  grossBeforeDiscountMinor?: number;
  discountMinor?: number;
  finalAmountMinor: number;
  category?: string;
}

export interface ReceiptGroundTruth {
  private: true;
  groundTruthVerified: true;
  merchant?: {
    displayName?: string;
    legalName?: string;
    acceptedIdentityNames?: string[];
  };
  date?: string;
  items: ReceiptGroundTruthItem[];
  discountsTotalMinor?: number;
  depositsTotalMinor?: number;
  goodsTotalMinor?: number;
  taxTotalMinor?: number;
  finalTotalMinor?: number;
  paymentTotalMinor?: number;
}

export interface BenchmarkDetectedItem {
  name: string;
  finalAmountMinor?: number;
  category?: string;
}

export interface BenchmarkDetectedReceipt {
  merchant?: string;
  merchantConfidence?: ReceiptOcrConfidence;
  date?: string;
  dateConfidence?: ReceiptOcrConfidence;
  items: BenchmarkDetectedItem[];
  goodsTotalMinor?: number;
  discountsTotalMinor?: number;
  depositsTotalMinor?: number;
  finalTotalMinor?: number;
  paymentTotalMinor?: number;
  reviewReconciled: boolean;
}

export type BenchmarkErrorClass =
  | 'OCR_TEXT_LOSS'
  | 'OCR_DIGIT_ERROR'
  | 'MERCHANT_RESOLUTION'
  | 'DATE_RESOLUTION'
  | 'ITEM_MISSED'
  | 'ITEM_FALSE_POSITIVE'
  | 'ITEM_COLUMN_MISALIGNMENT'
  | 'ITEM_AMOUNT_WRONG'
  | 'QUANTITY_WRONG'
  | 'DISCOUNT_WRONG'
  | 'DEPOSIT_WRONG'
  | 'TOTAL_WRONG'
  | 'PAYMENT_WRONG'
  | 'FALSE_RECONCILIATION'
  | 'CATEGORY_WRONG'
  | 'UNKNOWN';

export interface BenchmarkItemMatch {
  groundTruthIndex: number;
  detectedIndex: number;
  score: number;
  nameSimilarity: number;
  amountCorrect: boolean;
}

export interface ReceiptBenchmarkMetrics {
  merchantIdentityCorrect?: boolean;
  merchantDisplayCorrect?: boolean;
  wrongConfidentMerchant: boolean;
  dateCorrect?: boolean;
  wrongConfidentDate: boolean;
  itemRecall: number;
  itemPrecision: number;
  itemF1: number;
  itemAmountAccuracy?: number;
  quantityAccuracy?: number;
  unitPriceAccuracy?: number;
  goodsCorrect?: boolean;
  discountsCorrect?: boolean;
  depositsCorrect?: boolean;
  finalTotalCorrect?: boolean;
  paymentCorrect?: boolean;
  categoryAccuracy?: number;
  categoryCoverage?: number;
  falseReconciled: boolean;
  receiptNoEdit: boolean;
  receiptLightReview: boolean;
}

export interface ReceiptBenchmarkResult {
  caseId: string;
  title: string;
  sourceType: BenchmarkSourceType;
  layoutType: BenchmarkLayoutType;
  expectedItemCount: number;
  detected: BenchmarkDetectedReceipt;
  metrics: ReceiptBenchmarkMetrics;
  matches: BenchmarkItemMatch[];
  errors: BenchmarkErrorClass[];
}

export interface BenchmarkAggregateMetrics {
  cases: number;
  merchantIdentityAccuracy?: number;
  merchantDisplayAccuracy?: number;
  wrongConfidentMerchantRate: number;
  dateAccuracy?: number;
  wrongConfidentDateRate: number;
  itemRecall: number;
  itemPrecision: number;
  itemF1: number;
  itemAmountAccuracy?: number;
  quantityAccuracy?: number;
  unitPriceAccuracy?: number;
  goodsAccuracy?: number;
  discountAccuracy?: number;
  depositAccuracy?: number;
  finalTotalAccuracy?: number;
  paymentAccuracy?: number;
  categoryAccuracy?: number;
  categoryCoverage?: number;
  falseReconciledRate: number;
  receiptNoEditRate: number;
  receiptLightReviewRate: number;
}

export interface BenchmarkAggregateReport {
  overall: BenchmarkAggregateMetrics;
  bySourceType: Record<string, BenchmarkAggregateMetrics>;
  byLayoutType: Record<string, BenchmarkAggregateMetrics>;
  failureClasses: Array<{ error: BenchmarkErrorClass; count: number }>;
}

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '');
}

export function normalizeBenchmarkText(value: string): string {
  return stripDiacritics(value.replace(/[łŁ]/gu, 'l'))
    .toLocaleLowerCase('pl-PL')
    .replace(/[|!]/gu, 'l')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

function bigrams(value: string): Set<string> {
  const compact = normalizeBenchmarkText(value).replace(/\s+/gu, '');
  if (compact.length < 2) return new Set(compact ? [compact] : []);
  const result = new Set<string>();
  for (let index = 0; index < compact.length - 1; index += 1) result.add(compact.slice(index, index + 2));
  return result;
}

export function benchmarkNameSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeBenchmarkText(left);
  const normalizedRight = normalizeBenchmarkText(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
    return Math.min(normalizedLeft.length, normalizedRight.length) / Math.max(normalizedLeft.length, normalizedRight.length) * 0.92;
  }
  const leftBigrams = bigrams(normalizedLeft);
  const rightBigrams = bigrams(normalizedRight);
  if (!leftBigrams.size || !rightBigrams.size) return 0;
  let intersection = 0;
  for (const token of leftBigrams) if (rightBigrams.has(token)) intersection += 1;
  return (2 * intersection) / (leftBigrams.size + rightBigrams.size);
}

function itemPairScore(
  expected: ReceiptGroundTruthItem,
  detected: BenchmarkDetectedItem,
  expectedIndex: number,
  detectedIndex: number,
  expectedCount: number,
  detectedCount: number,
): { score: number; nameSimilarity: number; amountCorrect: boolean } {
  const nameSimilarity = benchmarkNameSimilarity(expected.name, detected.name);
  const amountCorrect = detected.finalAmountMinor !== undefined && detected.finalAmountMinor === expected.finalAmountMinor;
  const amountNear = detected.finalAmountMinor !== undefined && Math.abs(detected.finalAmountMinor - expected.finalAmountMinor) <= 2;
  const normalizedPositionDistance = Math.abs(
    expectedIndex / Math.max(1, expectedCount - 1) - detectedIndex / Math.max(1, detectedCount - 1),
  );
  const orderScore = Math.max(0, 1 - normalizedPositionDistance) * 0.5;
  return {
    score: (amountCorrect ? 5 : amountNear ? 2.5 : 0) + nameSimilarity * 4 + orderScore,
    nameSimilarity,
    amountCorrect,
  };
}

export function matchBenchmarkItems(
  expectedItems: readonly ReceiptGroundTruthItem[],
  detectedItems: readonly BenchmarkDetectedItem[],
): BenchmarkItemMatch[] {
  const candidates: BenchmarkItemMatch[] = [];
  expectedItems.forEach((expected, expectedIndex) => {
    detectedItems.forEach((detected, detectedIndex) => {
      const pair = itemPairScore(expected, detected, expectedIndex, detectedIndex, expectedItems.length, detectedItems.length);
      const acceptable = pair.amountCorrect
        ? pair.nameSimilarity >= 0.08 || expectedItems.length === 1
        : pair.nameSimilarity >= 0.55;
      if (!acceptable || pair.score < 2.2) return;
      candidates.push({
        groundTruthIndex: expectedIndex,
        detectedIndex,
        score: pair.score,
        nameSimilarity: pair.nameSimilarity,
        amountCorrect: pair.amountCorrect,
      });
    });
  });
  candidates.sort((a, b) => b.score - a.score || a.groundTruthIndex - b.groundTruthIndex || a.detectedIndex - b.detectedIndex);
  const usedExpected = new Set<number>();
  const usedDetected = new Set<number>();
  const matches: BenchmarkItemMatch[] = [];
  for (const candidate of candidates) {
    if (usedExpected.has(candidate.groundTruthIndex) || usedDetected.has(candidate.detectedIndex)) continue;
    usedExpected.add(candidate.groundTruthIndex);
    usedDetected.add(candidate.detectedIndex);
    matches.push(candidate);
  }
  return matches.sort((a, b) => a.groundTruthIndex - b.groundTruthIndex);
}

function exactOptional(expected: number | undefined, detected: number | undefined): boolean | undefined {
  return expected === undefined ? undefined : detected === expected;
}

function averageBooleans(values: Array<boolean | undefined>): number | undefined {
  const known = values.filter((value): value is boolean => value !== undefined);
  if (!known.length) return undefined;
  return known.filter(Boolean).length / known.length;
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : numerator === 0 ? 1 : 0;
}

function merchantIdentityCandidates(groundTruth: ReceiptGroundTruth): string[] {
  const merchant = groundTruth.merchant;
  if (!merchant) return [];
  return [merchant.displayName, merchant.legalName, ...(merchant.acceptedIdentityNames ?? [])]
    .filter((value): value is string => Boolean(value?.trim()));
}

function matchesMerchantIdentity(value: string | undefined, expected: string | undefined): boolean | undefined {
  if (!expected) return undefined;
  if (!value) return false;
  const actualNormalized = normalizeBenchmarkText(value);
  const expectedNormalized = normalizeBenchmarkText(expected);
  return actualNormalized === expectedNormalized
    || actualNormalized.includes(expectedNormalized)
    || expectedNormalized.includes(actualNormalized);
}

function matchesMerchantDisplay(value: string | undefined, expected: string | undefined): boolean | undefined {
  if (!expected) return undefined;
  if (!value) return false;
  return normalizeBenchmarkText(value) === normalizeBenchmarkText(expected);
}

export function detectedReceiptFromParsed(parsed: ParsedReceiptDraft): BenchmarkDetectedReceipt {
  const declared = parsed.finalPayableMinor ?? parsed.declaredTotalMinor;
  const reviewDifference = declared === undefined
    ? undefined
    : parsed.detectedItemsTotalMinor + (parsed.depositTotalMinor ?? 0) - declared;
  return {
    ...(parsed.merchant === undefined ? {} : { merchant: parsed.merchant }),
    merchantConfidence: parsed.merchantConfidence,
    ...(parsed.date === undefined ? {} : { date: parsed.date }),
    dateConfidence: parsed.dateConfidence,
    items: parsed.items.map((item) => ({
      name: item.name,
      ...(item.amountMinor === undefined ? {} : { finalAmountMinor: item.amountMinor }),
      ...(item.suggestedCategoryId === undefined ? {} : { category: item.suggestedCategoryId }),
    })),
    goodsTotalMinor: parsed.detectedItemsTotalMinor,
    ...(parsed.declaredDiscountTotalMinor === undefined ? {} : { discountsTotalMinor: Math.abs(parsed.declaredDiscountTotalMinor) }),
    ...(parsed.depositTotalMinor === undefined ? {} : { depositsTotalMinor: parsed.depositTotalMinor }),
    ...(declared === undefined ? {} : { finalTotalMinor: declared }),
    ...(parsed.paymentTotalMinor === undefined ? {} : { paymentTotalMinor: parsed.paymentTotalMinor }),
    reviewReconciled: reviewDifference !== undefined && Math.abs(reviewDifference) <= 1,
  };
}

export function evaluateReceiptBenchmarkCase(
  benchmarkCase: ReceiptBenchmarkCase,
  groundTruth: ReceiptGroundTruth,
  detected: BenchmarkDetectedReceipt,
): ReceiptBenchmarkResult {
  const matches = matchBenchmarkItems(groundTruth.items, detected.items);
  const itemRecall = safeRatio(matches.length, groundTruth.items.length);
  const itemPrecision = safeRatio(matches.length, detected.items.length);
  const itemF1 = itemRecall + itemPrecision > 0 ? 2 * itemRecall * itemPrecision / (itemRecall + itemPrecision) : 0;
  const matchedAmountResults = matches.map((match) => match.amountCorrect);
  const itemAmountAccuracy = matchedAmountResults.length ? matchedAmountResults.filter(Boolean).length / matchedAmountResults.length : undefined;

  const identityCandidates = merchantIdentityCandidates(groundTruth);
  const merchantIdentityCorrect = identityCandidates.length
    ? identityCandidates.some((expected) => matchesMerchantIdentity(detected.merchant, expected))
    : undefined;
  const merchantDisplayCorrect = matchesMerchantDisplay(detected.merchant, groundTruth.merchant?.displayName);
  const merchantKnownWrong = merchantIdentityCorrect === false && Boolean(detected.merchant?.trim());
  const wrongConfidentMerchant = merchantKnownWrong && detected.merchantConfidence === 'high';
  const dateCorrect = groundTruth.date === undefined ? undefined : detected.date === groundTruth.date;
  const wrongConfidentDate = dateCorrect === false && Boolean(detected.date) && detected.dateConfidence === 'high';

  const goodsCorrect = exactOptional(groundTruth.goodsTotalMinor, detected.goodsTotalMinor);
  const discountsCorrect = exactOptional(groundTruth.discountsTotalMinor, detected.discountsTotalMinor);
  const depositsCorrect = exactOptional(groundTruth.depositsTotalMinor, detected.depositsTotalMinor);
  const finalTotalCorrect = exactOptional(groundTruth.finalTotalMinor, detected.finalTotalMinor);
  const paymentCorrect = exactOptional(groundTruth.paymentTotalMinor, detected.paymentTotalMinor);

  const categorizedGroundTruth = groundTruth.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => Boolean(item.category));
  let categoryCorrectCount = 0;
  let categoryDetectedCount = 0;
  for (const { item, index } of categorizedGroundTruth) {
    const match = matches.find((candidate) => candidate.groundTruthIndex === index);
    if (!match) continue;
    const detectedCategory = detected.items[match.detectedIndex]?.category;
    if (!detectedCategory) continue;
    categoryDetectedCount += 1;
    if (detectedCategory === item.category) categoryCorrectCount += 1;
  }
  const categoryAccuracy = categoryDetectedCount ? categoryCorrectCount / categoryDetectedCount : undefined;
  const categoryCoverage = categorizedGroundTruth.length ? categoryDetectedCount / categorizedGroundTruth.length : undefined;

  const structurallyCorrect = itemRecall === 1 && itemPrecision === 1 && (itemAmountAccuracy ?? 1) === 1;
  const criticalFinancialCorrect = [finalTotalCorrect, paymentCorrect, depositsCorrect]
    .filter((value): value is boolean => value !== undefined)
    .every(Boolean);
  const falseReconciled = detected.reviewReconciled && (!structurallyCorrect || !criticalFinancialCorrect);
  const merchantSafe = merchantIdentityCorrect !== false || !detected.merchant || detected.merchantConfidence !== 'high';
  const receiptNoEdit = (merchantIdentityCorrect ?? true)
    && (dateCorrect ?? true)
    && structurallyCorrect
    && criticalFinancialCorrect
    && !falseReconciled;
  const receiptLightReview = merchantSafe
    && (dateCorrect ?? true)
    && groundTruth.items.length === detected.items.length
    && (itemAmountAccuracy ?? 1) === 1
    && criticalFinancialCorrect
    && !falseReconciled;

  const errors = new Set<BenchmarkErrorClass>();
  if (merchantIdentityCorrect === false) errors.add('MERCHANT_RESOLUTION');
  if (dateCorrect === false) errors.add('DATE_RESOLUTION');
  if (itemRecall < 1) errors.add('ITEM_MISSED');
  if (itemPrecision < 1) errors.add('ITEM_FALSE_POSITIVE');
  if (itemAmountAccuracy !== undefined && itemAmountAccuracy < 1) errors.add('ITEM_AMOUNT_WRONG');
  if (groundTruth.items.length > 1 && detected.items.length > 0 && itemRecall < 0.5 && detected.items.some((item) => item.finalAmountMinor !== undefined)) {
    errors.add('ITEM_COLUMN_MISALIGNMENT');
  }
  if (discountsCorrect === false) errors.add('DISCOUNT_WRONG');
  if (depositsCorrect === false) errors.add('DEPOSIT_WRONG');
  if (finalTotalCorrect === false) errors.add('TOTAL_WRONG');
  if (paymentCorrect === false) errors.add('PAYMENT_WRONG');
  if (falseReconciled) errors.add('FALSE_RECONCILIATION');
  if (categoryAccuracy !== undefined && categoryAccuracy < 1) errors.add('CATEGORY_WRONG');
  if (!errors.size && !receiptNoEdit) errors.add('UNKNOWN');

  return {
    caseId: benchmarkCase.id,
    title: benchmarkCase.title,
    sourceType: benchmarkCase.sourceType,
    layoutType: benchmarkCase.layoutType,
    expectedItemCount: groundTruth.items.length,
    detected,
    metrics: {
      ...(merchantIdentityCorrect === undefined ? {} : { merchantIdentityCorrect }),
      ...(merchantDisplayCorrect === undefined ? {} : { merchantDisplayCorrect }),
      wrongConfidentMerchant,
      ...(dateCorrect === undefined ? {} : { dateCorrect }),
      wrongConfidentDate,
      itemRecall,
      itemPrecision,
      itemF1,
      ...(itemAmountAccuracy === undefined ? {} : { itemAmountAccuracy }),
      ...(goodsCorrect === undefined ? {} : { goodsCorrect }),
      ...(discountsCorrect === undefined ? {} : { discountsCorrect }),
      ...(depositsCorrect === undefined ? {} : { depositsCorrect }),
      ...(finalTotalCorrect === undefined ? {} : { finalTotalCorrect }),
      ...(paymentCorrect === undefined ? {} : { paymentCorrect }),
      ...(categoryAccuracy === undefined ? {} : { categoryAccuracy }),
      ...(categoryCoverage === undefined ? {} : { categoryCoverage }),
      falseReconciled,
      receiptNoEdit,
      receiptLightReview,
    },
    matches,
    errors: [...errors],
  };
}

function aggregateGroup(results: readonly ReceiptBenchmarkResult[]): BenchmarkAggregateMetrics {
  const expectedItems = results.reduce((sum, result) => sum + result.expectedItemCount, 0);
  const detectedItems = results.reduce((sum, result) => sum + result.detected.items.length, 0);
  const matchedItems = results.reduce((sum, result) => sum + result.matches.length, 0);
  const itemRecall = expectedItems > 0 ? matchedItems / expectedItems : 1;
  const itemPrecision = detectedItems > 0 ? matchedItems / detectedItems : matchedItems === 0 ? 1 : 0;
  const itemF1 = itemRecall + itemPrecision > 0 ? 2 * itemRecall * itemPrecision / (itemRecall + itemPrecision) : 0;
  const itemAmountValues = results.flatMap((result) => result.matches.map((match) => match.amountCorrect));
  const categoryAccuracyValues = results.map((result) => result.metrics.categoryAccuracy).filter((value): value is number => value !== undefined);
  const categoryCoverageValues = results.map((result) => result.metrics.categoryCoverage).filter((value): value is number => value !== undefined);
  return {
    cases: results.length,
    ...(averageBooleans(results.map((result) => result.metrics.merchantIdentityCorrect)) === undefined ? {} : { merchantIdentityAccuracy: averageBooleans(results.map((result) => result.metrics.merchantIdentityCorrect))! }),
    ...(averageBooleans(results.map((result) => result.metrics.merchantDisplayCorrect)) === undefined ? {} : { merchantDisplayAccuracy: averageBooleans(results.map((result) => result.metrics.merchantDisplayCorrect))! }),
    wrongConfidentMerchantRate: safeRatio(results.filter((result) => result.metrics.wrongConfidentMerchant).length, results.length),
    ...(averageBooleans(results.map((result) => result.metrics.dateCorrect)) === undefined ? {} : { dateAccuracy: averageBooleans(results.map((result) => result.metrics.dateCorrect))! }),
    wrongConfidentDateRate: safeRatio(results.filter((result) => result.metrics.wrongConfidentDate).length, results.length),
    itemRecall,
    itemPrecision,
    itemF1,
    ...(itemAmountValues.length ? { itemAmountAccuracy: itemAmountValues.filter(Boolean).length / itemAmountValues.length } : {}),
    ...(averageBooleans(results.map((result) => result.metrics.goodsCorrect)) === undefined ? {} : { goodsAccuracy: averageBooleans(results.map((result) => result.metrics.goodsCorrect))! }),
    ...(averageBooleans(results.map((result) => result.metrics.discountsCorrect)) === undefined ? {} : { discountAccuracy: averageBooleans(results.map((result) => result.metrics.discountsCorrect))! }),
    ...(averageBooleans(results.map((result) => result.metrics.depositsCorrect)) === undefined ? {} : { depositAccuracy: averageBooleans(results.map((result) => result.metrics.depositsCorrect))! }),
    ...(averageBooleans(results.map((result) => result.metrics.finalTotalCorrect)) === undefined ? {} : { finalTotalAccuracy: averageBooleans(results.map((result) => result.metrics.finalTotalCorrect))! }),
    ...(averageBooleans(results.map((result) => result.metrics.paymentCorrect)) === undefined ? {} : { paymentAccuracy: averageBooleans(results.map((result) => result.metrics.paymentCorrect))! }),
    ...(categoryAccuracyValues.length ? { categoryAccuracy: categoryAccuracyValues.reduce((sum, value) => sum + value, 0) / categoryAccuracyValues.length } : {}),
    ...(categoryCoverageValues.length ? { categoryCoverage: categoryCoverageValues.reduce((sum, value) => sum + value, 0) / categoryCoverageValues.length } : {}),
    falseReconciledRate: safeRatio(results.filter((result) => result.metrics.falseReconciled).length, results.length),
    receiptNoEditRate: safeRatio(results.filter((result) => result.metrics.receiptNoEdit).length, results.length),
    receiptLightReviewRate: safeRatio(results.filter((result) => result.metrics.receiptLightReview).length, results.length),
  };
}

export function aggregateReceiptBenchmark(results: readonly ReceiptBenchmarkResult[]): BenchmarkAggregateReport {
  const group = <K extends string>(getter: (result: ReceiptBenchmarkResult) => K): Record<string, BenchmarkAggregateMetrics> => {
    const map = new Map<string, ReceiptBenchmarkResult[]>();
    for (const result of results) {
      const key = getter(result);
      map.set(key, [...(map.get(key) ?? []), result]);
    }
    return Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, values]) => [key, aggregateGroup(values)]));
  };
  const failures = new Map<BenchmarkErrorClass, number>();
  for (const result of results) for (const error of result.errors) failures.set(error, (failures.get(error) ?? 0) + 1);
  return {
    overall: aggregateGroup(results),
    bySourceType: group((result) => result.sourceType),
    byLayoutType: group((result) => result.layoutType),
    failureClasses: [...failures.entries()]
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count || a.error.localeCompare(b.error)),
  };
}


export function validateReceiptGroundTruth(groundTruth: ReceiptGroundTruth): string[] {
  const errors: string[] = [];
  if (groundTruth.private !== true) errors.push('ground truth private must be true');
  if (groundTruth.groundTruthVerified !== true) errors.push('ground truth must be verified');
  if (!Array.isArray(groundTruth.items)) errors.push('ground truth items must be an array');
  groundTruth.items.forEach((item, index) => {
    if (!item.name?.trim()) errors.push(`item ${index + 1}: name is empty`);
    if (!Number.isSafeInteger(item.finalAmountMinor) || item.finalAmountMinor <= 0) errors.push(`item ${index + 1}: invalid finalAmountMinor`);
  });
  if (groundTruth.date && !/^\d{4}-\d{2}-\d{2}$/u.test(groundTruth.date)) errors.push('ground truth date must use YYYY-MM-DD');
  return errors;
}

export function validateReceiptBenchmarkManifest(cases: readonly ReceiptBenchmarkCase[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const benchmarkCase of cases) {
    if (!benchmarkCase.id.trim()) errors.push('case id is empty');
    if (ids.has(benchmarkCase.id)) errors.push(`duplicate case id: ${benchmarkCase.id}`);
    ids.add(benchmarkCase.id);
    if (benchmarkCase.private !== true) errors.push(`${benchmarkCase.id}: private must be true`);
    if (benchmarkCase.groundTruthVerified !== true) errors.push(`${benchmarkCase.id}: ground truth must be verified`);
    if (!benchmarkCase.sourceFile || !benchmarkCase.rawOcrFile || !benchmarkCase.groundTruthFile) errors.push(`${benchmarkCase.id}: required file path missing`);
  }
  return errors;
}
