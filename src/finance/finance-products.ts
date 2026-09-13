import type { ExpenseProduct, Receipt, ReceiptItemUnit } from '../shopping/expenses.types';
import { normalizeExpenseProductKey } from '../shopping/expenses.utils';

export interface ExpenseProductOccurrence {
  productId: string;
  receiptId: string;
  itemId: string;
  date: string;
  merchant: string;
  rawName: string;
  categoryId: string;
  amountMinor: number;
  quantity?: number;
  unit?: ReceiptItemUnit;
  unitPriceMinor?: number;
  receiptCreatedAt: string;
}

export interface ExpenseProductAnalytics {
  product: ExpenseProduct;
  occurrences: ExpenseProductOccurrence[];
  occurrenceCount: number;
  merchantCount: number;
  totalMinor: number;
  averageMinor: number;
  minimumMinor: number;
  maximumMinor: number;
  lastAmountMinor: number;
  lastDate: string;
  lastMerchant: string;
}

export function buildExpenseProductAnalytics(
  receipts: Receipt[],
  products: ExpenseProduct[],
): ExpenseProductAnalytics[] {
  const productByKey = new Map(products.map((product) => [product.normalizedKey, product]));
  const occurrencesByProduct = new Map<string, ExpenseProductOccurrence[]>();

  for (const receipt of receipts) {
    for (const item of receipt.items) {
      const product = productByKey.get(normalizeExpenseProductKey(item.name));
      if (!product) continue;
      const list = occurrencesByProduct.get(product.id) ?? [];
      list.push({
        productId: product.id,
        receiptId: receipt.id,
        itemId: item.id,
        date: receipt.date,
        merchant: receipt.merchant,
        rawName: item.name,
        categoryId: item.categoryId,
        amountMinor: item.amountMinor,
        ...(item.quantity === undefined ? {} : { quantity: item.quantity }),
        ...(item.unit === undefined ? {} : { unit: item.unit }),
        ...(item.unitPriceMinor === undefined ? {} : { unitPriceMinor: item.unitPriceMinor }),
        receiptCreatedAt: receipt.createdAt,
      });
      occurrencesByProduct.set(product.id, list);
    }
  }

  return products.flatMap((product) => {
    const occurrences = [...(occurrencesByProduct.get(product.id) ?? [])].sort((a, b) =>
      b.date.localeCompare(a.date)
      || b.receiptCreatedAt.localeCompare(a.receiptCreatedAt)
      || b.receiptId.localeCompare(a.receiptId)
      || b.itemId.localeCompare(a.itemId));
    if (!occurrences.length) return [];
    const totalMinor = occurrences.reduce((sum, occurrence) => sum + occurrence.amountMinor, 0);
    const values = occurrences.map((occurrence) => occurrence.amountMinor);
    const last = occurrences[0]!;
    return [{
      product,
      occurrences,
      occurrenceCount: occurrences.length,
      merchantCount: new Set(occurrences.map((occurrence) => occurrence.merchant.trim().toLocaleLowerCase('pl-PL'))).size,
      totalMinor,
      averageMinor: Math.round(totalMinor / occurrences.length),
      minimumMinor: Math.min(...values),
      maximumMinor: Math.max(...values),
      lastAmountMinor: last.amountMinor,
      lastDate: last.date,
      lastMerchant: last.merchant,
    } satisfies ExpenseProductAnalytics];
  }).sort((a, b) =>
    b.totalMinor - a.totalMinor
    || b.occurrenceCount - a.occurrenceCount
    || a.product.name.localeCompare(b.product.name, 'pl-PL'));
}

export function filterExpenseProductAnalytics(
  analytics: ExpenseProductAnalytics[],
  query: string,
): ExpenseProductAnalytics[] {
  const normalized = query.trim().toLocaleLowerCase('pl-PL');
  if (!normalized) return analytics;
  return analytics.filter((entry) => {
    const haystack = [
      entry.product.name,
      entry.product.originalName,
      ...entry.occurrences.flatMap((occurrence) => [occurrence.rawName, occurrence.merchant]),
    ].join(' ').toLocaleLowerCase('pl-PL');
    return haystack.includes(normalized);
  });
}

export interface ExpenseUnitPriceSummary {
  unit: ReceiptItemUnit;
  occurrences: ExpenseProductOccurrence[];
  occurrenceCount: number;
  merchantCount: number;
  latest: ExpenseProductOccurrence;
  previous?: ExpenseProductOccurrence;
  lowest: ExpenseProductOccurrence;
}

export function buildExpenseUnitPriceSummaries(
  occurrences: ExpenseProductOccurrence[],
): ExpenseUnitPriceSummary[] {
  const byUnit = new Map<ReceiptItemUnit, ExpenseProductOccurrence[]>();
  for (const occurrence of occurrences) {
    if (!occurrence.unit || occurrence.unitPriceMinor === undefined || occurrence.unitPriceMinor <= 0) continue;
    const list = byUnit.get(occurrence.unit) ?? [];
    list.push(occurrence);
    byUnit.set(occurrence.unit, list);
  }

  return [...byUnit.entries()].map(([unit, entries]) => {
    const sorted = [...entries].sort((a, b) =>
      b.date.localeCompare(a.date)
      || b.receiptCreatedAt.localeCompare(a.receiptCreatedAt)
      || b.receiptId.localeCompare(a.receiptId)
      || b.itemId.localeCompare(a.itemId));
    const latest = sorted[0]!;
    const lowest = sorted.reduce((best, current) =>
      (current.unitPriceMinor ?? Number.MAX_SAFE_INTEGER) < (best.unitPriceMinor ?? Number.MAX_SAFE_INTEGER) ? current : best, latest);
    const previous = sorted[1];
    return {
      unit,
      occurrences: sorted,
      occurrenceCount: sorted.length,
      merchantCount: new Set(sorted.map((entry) => entry.merchant.trim().toLocaleLowerCase('pl-PL'))).size,
      latest,
      ...(previous ? { previous } : {}),
      lowest,
    } satisfies ExpenseUnitPriceSummary;
  }).sort((a, b) =>
    b.latest.date.localeCompare(a.latest.date)
    || b.latest.receiptCreatedAt.localeCompare(a.latest.receiptCreatedAt)
    || b.occurrenceCount - a.occurrenceCount
    || a.unit.localeCompare(b.unit, 'pl-PL'));
}

export type ExpenseNonessentialGroup = 'sweets' | 'soda-energy' | 'snacks' | 'other';

export const EXPENSE_NONESSENTIAL_GROUP_LABELS: Record<ExpenseNonessentialGroup, string> = {
  sweets: 'Słodycze',
  'soda-energy': 'Napoje gazowane / energetyczne',
  snacks: 'Przekąski',
  other: 'Inne zbędne',
};

export function classifyNonessentialExpenseGroup(value: string): ExpenseNonessentialGroup {
  const key = normalizeExpenseProductKey(value);
  if (!key) return 'other';
  if (['slodycz', 'czekolad', 'baton', 'cukierk', 'zelk', 'ciastk', 'wafel', 'wafl', 'lody', 'lodow']
    .some((hint) => key.includes(hint))) return 'sweets';
  if (['cola', 'pepsi', 'fanta', 'sprite', 'oranzad', 'gazowan', 'energet', 'energy', 'monster', 'red bull']
    .some((hint) => key.includes(hint))) return 'soda-energy';
  if (['chips', 'chrupk', 'popcorn', 'przekask', 'palusz', 'krakers']
    .some((hint) => key.includes(hint))) return 'snacks';
  return 'other';
}
