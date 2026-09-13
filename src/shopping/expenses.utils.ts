import type { ExpenseCategory, ExpenseNecessity, FinanceCurrencyCode, Receipt, ReceiptItemUnit, ReceiptSource } from './expenses.types';

export const DEFAULT_EXPENSE_CATEGORY_DEFINITIONS = [
  { id: 'expense-category-food', name: 'Jedzenie' },
  { id: 'expense-category-drinks', name: 'Napoje' },
  { id: 'expense-category-home', name: 'Dom / Chemia' },
  { id: 'expense-category-hygiene', name: 'Higiena / Kosmetyki' },
  { id: 'expense-category-health', name: 'Zdrowie' },
  { id: 'expense-category-clothes', name: 'Ubrania' },
  { id: 'expense-category-electronics', name: 'Elektronika' },
  { id: 'expense-category-transport', name: 'Transport' },
  { id: 'expense-category-entertainment', name: 'Rozrywka' },
  { id: 'expense-category-deposit', name: 'Kaucja / opakowania zwrotne' },
  { id: 'expense-category-other', name: 'Inne' },
] as const;

export interface MonthExpenseSummary {
  totalMinor: number;
  receiptCount: number;
  averageReceiptMinor: number;
  largestReceipt: Receipt | null;
}

export interface MonthExpenseComparison {
  currentTotalMinor: number;
  previousTotalMinor: number;
  differenceMinor: number;
  percentageChange: number | null;
  state: 'empty' | 'no-comparison' | 'comparable';
}

export interface ExpenseTrendPoint {
  monthKey: string;
  label: string;
  totalMinor: number;
}

export interface CategoryExpenseAggregate {
  categoryId: string;
  name: string;
  totalMinor: number;
  itemCount: number;
  sharePercent: number;
  sortOrder: number;
}

export interface MerchantExpenseAggregate {
  key: string;
  name: string;
  totalMinor: number;
  receiptCount: number;
  averageReceiptMinor: number;
}

export interface ProductExpenseAggregate {
  key: string;
  name: string;
  totalMinor: number;
  occurrenceCount: number;
}

export interface ReceiptHistoryFilters {
  query?: string;
  categoryId?: string;
  categoryIds?: string[];
  merchantKey?: string;
  source?: ReceiptSource | 'legacy';
}

export interface CategoryTreeExpenseAggregate extends CategoryExpenseAggregate {
  children: CategoryExpenseAggregate[];
}


export function expenseCategoryParentId(category: ExpenseCategory): string | null {
  return category.parentId?.trim() || null;
}

export function expenseCategoryRoots(categories: ExpenseCategory[]): ExpenseCategory[] {
  const ids = new Set(categories.map((category) => category.id));
  return categories
    .filter((category) => {
      const parentId = expenseCategoryParentId(category);
      return !parentId || !ids.has(parentId);
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pl-PL'));
}

export function expenseCategoryChildren(categories: ExpenseCategory[], parentId: string): ExpenseCategory[] {
  return categories
    .filter((category) => expenseCategoryParentId(category) === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pl-PL'));
}

export function expenseCategoryDescendantIds(categories: ExpenseCategory[], categoryId: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const queue = [categoryId];
  while (queue.length) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    result.push(current);
    for (const child of expenseCategoryChildren(categories, current)) queue.push(child.id);
  }
  return result;
}

export function expenseCategoryPath(categories: ExpenseCategory[], categoryId: string): string {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const category = byId.get(categoryId);
  if (!category) return 'Nieznana kategoria';
  const parentId = expenseCategoryParentId(category);
  const parent = parentId ? byId.get(parentId) : undefined;
  return parent ? `${parent.name} - ${category.name}` : category.name;
}

export function aggregateExpensesByCategoryTree(
  receipts: Receipt[],
  categories: ExpenseCategory[],
  monthKey: string,
): CategoryTreeExpenseAggregate[] {
  const selected = receiptsForMonth(receipts, monthKey);
  const monthTotalMinor = totalReceiptsMinor(selected);
  const byId = new Map(categories.map((category) => [category.id, category]));
  const directTotals = new Map<string, { totalMinor: number; itemCount: number }>();
  const rootTotals = new Map<string, { totalMinor: number; itemCount: number }>();

  for (const receipt of selected) {
    for (const item of receipt.items) {
      const category = byId.get(item.categoryId);
      if (!category) continue;
      const direct = directTotals.get(category.id) ?? { totalMinor: 0, itemCount: 0 };
      direct.totalMinor += item.amountMinor;
      direct.itemCount += 1;
      directTotals.set(category.id, direct);

      const parentId = expenseCategoryParentId(category);
      const root = parentId && byId.has(parentId) ? byId.get(parentId)! : category;
      const aggregate = rootTotals.get(root.id) ?? { totalMinor: 0, itemCount: 0 };
      aggregate.totalMinor += item.amountMinor;
      aggregate.itemCount += 1;
      rootTotals.set(root.id, aggregate);
    }
  }

  return expenseCategoryRoots(categories)
    .map((root) => {
      const rootValue = rootTotals.get(root.id) ?? { totalMinor: 0, itemCount: 0 };
      const children = expenseCategoryChildren(categories, root.id)
        .map((child) => {
          const value = directTotals.get(child.id) ?? { totalMinor: 0, itemCount: 0 };
          return {
            categoryId: child.id,
            name: child.name,
            totalMinor: value.totalMinor,
            itemCount: value.itemCount,
            sharePercent: monthTotalMinor ? Math.round((value.totalMinor / monthTotalMinor) * 1000) / 10 : 0,
            sortOrder: child.sortOrder,
          };
        })
        .filter((entry) => entry.totalMinor > 0);
      return {
        categoryId: root.id,
        name: root.name,
        totalMinor: rootValue.totalMinor,
        itemCount: rootValue.itemCount,
        sharePercent: monthTotalMinor ? Math.round((rootValue.totalMinor / monthTotalMinor) * 1000) / 10 : 0,
        sortOrder: root.sortOrder,
        children,
      };
    })
    .filter((entry) => entry.totalMinor > 0)
    .sort((a, b) => b.totalMinor - a.totalMinor || a.sortOrder - b.sortOrder || a.categoryId.localeCompare(b.categoryId));
}

export function normalizeExpenseText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeExpenseLabel(value: string): string {
  return normalizeExpenseText(value).toLocaleLowerCase('pl-PL');
}

export function normalizeExpenseProductKey(value: string): string {
  return normalizeExpenseText(value)
    .toLocaleLowerCase('pl-PL')
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Presentation-only cleanup for compact OCR names. The stored source value is
 * never rewritten. We only add safe separators and remove trailing OCR noise.
 */
export function formatExpenseProductDisplayName(value: string): string {
  return normalizeExpenseText(value)
    .replace(/[!|]+$/gu, '')
    .replace(/[_]+/gu, ' ')
    .replace(/([a-ząćęłńóśźż])([A-ZĄĆĘŁŃÓŚŹŻ])/gu, '$1 $2')
    .replace(/([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż])(\d+(?:[.,]\d+)?)(?=(?:kg|g|ml|l|szt|pus|op)\b|$)/giu, '$1 $2')
    .replace(/(\d+(?:[.,]\d+)?)(kg|g|ml|l|szt|pus|op)(?=\b|$)/giu, '$1 $2')
    .replace(/\s*[-–—]\s*/gu, ' - ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * UI aliasing only. Raw merchant text stays on the receipt for auditability.
 */
export function formatExpenseMerchantDisplayName(value: string): string {
  const key = normalizeExpenseProductKey(value);
  if (key.includes('jeronimo martins polska')) return 'Biedronka';
  return normalizeExpenseText(value);
}

const NONESSENTIAL_EXPENSE_PRODUCT_HINTS = [
  'slodycz', 'czekolad', 'baton', 'cukierk', 'zelk', 'ciastk', 'chips', 'chrupk', 'popcorn',
  'przekask', 'cola', 'pepsi', 'fanta', 'sprite', 'oranzad', 'napoj gazowan', 'napoj energet',
  'energet', 'energy drink', 'monster', 'red bull',
] as const;

const ESSENTIAL_EXPENSE_PRODUCT_HINTS = [
  'mleko', 'chleb', 'bulka', 'jajk', 'jaja', 'maslo', 'ryz', 'makaron', 'ziemniak', 'warzyw', 'owoc',
  'woda', 'papier toalet', 'plyn do naczyn', 'proszek do pran', 'kapsulk do pran', 'mydlo', 'pasta do zeb', 'szampon',
] as const;

export function inferExpenseNecessity(value: string): ExpenseNecessity {
  const key = normalizeExpenseProductKey(value);
  if (!key) return 'unknown';
  if (NONESSENTIAL_EXPENSE_PRODUCT_HINTS.some((hint) => key.includes(hint))) return 'nonessential';
  if (ESSENTIAL_EXPENSE_PRODUCT_HINTS.some((hint) => key.includes(hint))) return 'essential';
  return 'unknown';
}

export function expenseNecessityLabel(value: ExpenseNecessity | undefined): string {
  if (value === 'essential') return 'Niezbędne';
  if (value === 'nonessential') return 'Zbędne';
  return 'Do oceny';
}

export function expenseCategoryNameKey(value: string): string {
  return normalizeExpenseLabel(value);
}

export function isDepositExpenseCategoryName(value: string): boolean {
  const normalized = expenseCategoryNameKey(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return normalized === 'kaucja'
    || normalized === 'opakowania zwrotne'
    || normalized === 'kaucja opakowania zwrotne';
}

export function parseMoneyToMinor(value: string): number | null {
  const normalized = value.trim().replace(/[\s\u00a0]/g, '').replace(/zł$/iu, '');
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(normalized)) return null;
  const [wholeText, decimalText = ''] = normalized.replace(',', '.').split('.');
  const whole = Number(wholeText);
  if (!Number.isSafeInteger(whole)) return null;
  const cents = Number(decimalText.padEnd(2, '0'));
  const total = whole * 100 + cents;
  return Number.isSafeInteger(total) ? total : null;
}

export const FINANCE_CURRENCIES: readonly FinanceCurrencyCode[] = ['PLN', 'EUR', 'HUF', 'CZK', 'GBP', 'USD', 'CHF', 'RON', 'DKK', 'SEK', 'NOK', 'TRY', 'JPY'];

export function isFinanceCurrencyCode(value: unknown): value is FinanceCurrencyCode {
  return typeof value === 'string' && FINANCE_CURRENCIES.includes(value as FinanceCurrencyCode);
}

export function parseCurrencyAmountToMinor(value: string): number | null {
  const normalized = value.trim().replace(/[\s\u00a0]/g, '');
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(normalized)) return null;
  const [wholeText, decimalText = ''] = normalized.replace(',', '.').split('.');
  const whole = Number(wholeText);
  if (!Number.isSafeInteger(whole)) return null;
  const cents = Number(decimalText.padEnd(2, '0'));
  const total = whole * 100 + cents;
  return Number.isSafeInteger(total) ? total : null;
}

export function formatCurrencyAmountMinor(value: number, currency: FinanceCurrencyCode): string {
  if (!Number.isSafeInteger(value)) return `0 ${currency}`;
  const amount = value / 100;
  try {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
      minimumFractionDigits: currency === 'HUF' || currency === 'JPY' ? 0 : 2,
      maximumFractionDigits: currency === 'HUF' || currency === 'JPY' ? 0 : 2,
    }).format(amount).replace(/\s+/gu, '\u00a0');
  } catch {
    return `${moneyMinorToInput(value)} ${currency}`;
  }
}

export function parseExchangeRateToPln(value: string): number | null {
  const normalized = value.trim().replace(/[\s\u00a0]/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,8})?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100000) return null;
  return Math.round(parsed * 100000000) / 100000000;
}

export function formatExchangeRate(value: number, currency: FinanceCurrencyCode): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  const formatted = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(value);
  return `1 ${currency} = ${formatted} zł`;
}

export function convertForeignMinorToPlnMinor(amountMinor: number, ratePlnPerUnit: number): number | null {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !Number.isFinite(ratePlnPerUnit) || ratePlnPerUnit <= 0) return null;
  const converted = Math.round(amountMinor * ratePlnPerUnit);
  return Number.isSafeInteger(converted) && converted > 0 ? converted : null;
}

export function formatMoneyMinor(value: number): string {
  if (!Number.isSafeInteger(value)) return '0,00 zł';
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / 100);
  const cents = String(absolute % 100).padStart(2, '0');
  const groupedWhole = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return `${sign}${groupedWhole},${cents} zł`;
}

export function moneyMinorToInput(value: number): string {
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / 100);
  const cents = String(absolute % 100).padStart(2, '0');
  return `${value < 0 ? '-' : ''}${whole},${cents}`;
}

export function parseReceiptQuantity(value: string): number | null {
  const normalized = value.trim().replace(/[\s\u00a0]/g, '').replace(',', '.');
  if (!/^\d{1,5}(?:\.\d{1,3})?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 10000) return null;
  return Math.round(parsed * 1000) / 1000;
}

export function receiptQuantityToInput(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded).replace('.', ',');
}

export function receiptItemUnitLabel(unit: ReceiptItemUnit | undefined): string {
  if (!unit) return '';
  return unit === 'op' ? 'op.' : unit;
}

export function formatReceiptQuantity(value: number, unit?: ReceiptItemUnit): string {
  const quantity = receiptQuantityToInput(value);
  const label = receiptItemUnitLabel(unit);
  return label ? `${quantity} ${label}` : quantity;
}

export function monthKeyFromDateKey(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : '';
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const absoluteMonth = Number(match[1]) * 12 + (Number(match[2]) - 1) + delta;
  const year = Math.floor(absoluteMonth / 12);
  const monthIndex = ((absoluteMonth % 12) + 12) % 12;
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  const formatted = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(date);
  return formatted.charAt(0).toLocaleUpperCase('pl-PL') + formatted.slice(1);
}

export function formatShortMonthLabel(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const labels = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
  return labels[Number(match[2]) - 1] ?? monthKey;
}

export function receiptsForMonth(receipts: Receipt[], monthKey: string): Receipt[] {
  return receipts.filter((receipt) => monthKeyFromDateKey(receipt.date) === monthKey);
}

export function totalReceiptsMinor(receipts: Receipt[]): number {
  return receipts.reduce((sum, receipt) => sum + receipt.totalMinor, 0);
}

export function aggregateReceiptsByCategory(receipts: Receipt[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const receipt of receipts) {
    for (const item of receipt.items) {
      totals.set(item.categoryId, (totals.get(item.categoryId) ?? 0) + item.amountMinor);
    }
  }
  return totals;
}

export function sortReceiptsNewestFirst(receipts: Receipt[]): Receipt[] {
  return [...receipts].sort((a, b) =>
    b.date.localeCompare(a.date)
    || b.createdAt.localeCompare(a.createdAt)
    || a.id.localeCompare(b.id));
}

export function getMonthExpenseSummary(receipts: Receipt[], monthKey: string): MonthExpenseSummary {
  const selected = receiptsForMonth(receipts, monthKey);
  const totalMinor = totalReceiptsMinor(selected);
  const receiptCount = selected.length;
  const largestReceipt = [...selected].sort((a, b) =>
    b.totalMinor - a.totalMinor
    || b.date.localeCompare(a.date)
    || a.id.localeCompare(b.id))[0] ?? null;
  return {
    totalMinor,
    receiptCount,
    averageReceiptMinor: receiptCount ? Math.round(totalMinor / receiptCount) : 0,
    largestReceipt,
  };
}

export function compareMonthExpenses(receipts: Receipt[], monthKey: string): MonthExpenseComparison {
  const currentTotalMinor = totalReceiptsMinor(receiptsForMonth(receipts, monthKey));
  const previousTotalMinor = totalReceiptsMinor(receiptsForMonth(receipts, shiftMonthKey(monthKey, -1)));
  const differenceMinor = currentTotalMinor - previousTotalMinor;
  if (currentTotalMinor === 0 && previousTotalMinor === 0) {
    return { currentTotalMinor, previousTotalMinor, differenceMinor, percentageChange: null, state: 'empty' };
  }
  if (previousTotalMinor === 0) {
    return { currentTotalMinor, previousTotalMinor, differenceMinor, percentageChange: null, state: 'no-comparison' };
  }
  return {
    currentTotalMinor,
    previousTotalMinor,
    differenceMinor,
    percentageChange: Math.round((differenceMinor / previousTotalMinor) * 1000) / 10,
    state: 'comparable',
  };
}

export function getSixMonthTrend(receipts: Receipt[], monthKey: string): ExpenseTrendPoint[] {
  return Array.from({ length: 6 }, (_, index) => {
    const pointMonthKey = shiftMonthKey(monthKey, index - 5);
    return {
      monthKey: pointMonthKey,
      label: formatShortMonthLabel(pointMonthKey),
      totalMinor: totalReceiptsMinor(receiptsForMonth(receipts, pointMonthKey)),
    };
  });
}

export function aggregateExpensesByCategory(
  receipts: Receipt[],
  categories: ExpenseCategory[],
  monthKey: string,
): CategoryExpenseAggregate[] {
  const selected = receiptsForMonth(receipts, monthKey);
  const monthTotalMinor = totalReceiptsMinor(selected);
  const totals = new Map<string, { totalMinor: number; itemCount: number }>();
  for (const receipt of selected) {
    for (const item of receipt.items) {
      const current = totals.get(item.categoryId) ?? { totalMinor: 0, itemCount: 0 };
      current.totalMinor += item.amountMinor;
      current.itemCount += 1;
      totals.set(item.categoryId, current);
    }
  }
  return categories
    .map((category) => {
      const value = totals.get(category.id) ?? { totalMinor: 0, itemCount: 0 };
      return {
        categoryId: category.id,
        name: category.name,
        totalMinor: value.totalMinor,
        itemCount: value.itemCount,
        sharePercent: monthTotalMinor ? Math.round((value.totalMinor / monthTotalMinor) * 1000) / 10 : 0,
        sortOrder: category.sortOrder,
      };
    })
    .filter((entry) => entry.totalMinor > 0)
    .sort((a, b) => b.totalMinor - a.totalMinor || a.sortOrder - b.sortOrder || a.categoryId.localeCompare(b.categoryId));
}

export function aggregateExpensesByMerchant(receipts: Receipt[], monthKey: string): MerchantExpenseAggregate[] {
  const selected = sortReceiptsNewestFirst(receiptsForMonth(receipts, monthKey));
  const groups = new Map<string, { name: string; totalMinor: number; receiptCount: number }>();
  for (const receipt of selected) {
    const name = normalizeExpenseText(receipt.merchant);
    const key = normalizeExpenseLabel(name);
    if (!key) continue;
    const current = groups.get(key) ?? { name, totalMinor: 0, receiptCount: 0 };
    current.totalMinor += receipt.totalMinor;
    current.receiptCount += 1;
    groups.set(key, current);
  }
  return [...groups.entries()]
    .map(([key, value]) => ({
      key,
      name: value.name,
      totalMinor: value.totalMinor,
      receiptCount: value.receiptCount,
      averageReceiptMinor: value.receiptCount ? Math.round(value.totalMinor / value.receiptCount) : 0,
    }))
    .sort((a, b) => b.totalMinor - a.totalMinor || b.receiptCount - a.receiptCount || a.key.localeCompare(b.key, 'pl'));
}

export function aggregateExpensesByProduct(receipts: Receipt[], monthKey: string): ProductExpenseAggregate[] {
  const selected = sortReceiptsNewestFirst(receiptsForMonth(receipts, monthKey));
  const groups = new Map<string, { name: string; totalMinor: number; occurrenceCount: number }>();
  for (const receipt of selected) {
    for (const item of receipt.items) {
      const name = normalizeExpenseText(item.name);
      const key = normalizeExpenseLabel(name);
      if (!key) continue;
      const current = groups.get(key) ?? { name, totalMinor: 0, occurrenceCount: 0 };
      current.totalMinor += item.amountMinor;
      current.occurrenceCount += 1;
      groups.set(key, current);
    }
  }
  return [...groups.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.totalMinor - a.totalMinor || b.occurrenceCount - a.occurrenceCount || a.key.localeCompare(b.key, 'pl'));
}

export function rankProductsByFrequency(products: ProductExpenseAggregate[]): ProductExpenseAggregate[] {
  return [...products].sort((a, b) =>
    b.occurrenceCount - a.occurrenceCount
    || b.totalMinor - a.totalMinor
    || a.key.localeCompare(b.key, 'pl'));
}

export function filterReceiptHistory(receipts: Receipt[], filters: ReceiptHistoryFilters): Receipt[] {
  const query = normalizeExpenseLabel(filters.query ?? '');
  const categoryId = filters.categoryId?.trim() ?? '';
  const categoryIds = new Set((filters.categoryIds ?? []).filter(Boolean));
  const merchantKey = normalizeExpenseLabel(filters.merchantKey ?? '');
  return receipts.filter((receipt) => {
    if (merchantKey && normalizeExpenseLabel(receipt.merchant) !== merchantKey) return false;
    if (filters.source === 'legacy' && receipt.source) return false;
    if (filters.source && filters.source !== 'legacy' && receipt.source !== filters.source) return false;
    if (categoryIds.size && !receipt.items.some((item) => categoryIds.has(item.categoryId))) return false;
    if (!categoryIds.size && categoryId && !receipt.items.some((item) => item.categoryId === categoryId)) return false;
    if (!query) return true;
    if (normalizeExpenseLabel(receipt.merchant).includes(query)) return true;
    return receipt.items.some((item) => normalizeExpenseLabel(item.name).includes(query));
  });
}

