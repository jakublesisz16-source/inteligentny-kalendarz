import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { toLocalDateKey } from '../calendar/date.utils';
import {
  createExpenseCategory,
  createFinanceTrip,
  createReceipt,
  deleteExpenseCategory,
  deleteFinanceTrip,
  deleteReceipt,
  listExpenseCategories,
  listFinanceTrips,
  listReceipts,
  restoreDeletedReceipt,
  syncExpenseProductsFromReceipts,
  updateExpenseCategory,
  updateExpenseProduct,
  updateFinanceTripCurrency,
  updateReceipt,
  updateReceiptItemCategory,
} from '../storage/database';
import { ExpenseCategoryIcon } from '../shopping/ExpenseCategoryIcon';
import type { ExpenseCategory, ExpenseNecessity, ExpenseProduct, FinanceCurrencyCode, FinanceTrip, Receipt, ReceiptDraft, ReceiptItemUnit, ReceiptSource } from '../shopping/expenses.types';
import {
  aggregateExpensesByCategoryTree,
  compareMonthExpenses,
  convertForeignMinorToPlnMinor,
  expenseCategoryChildren,
  expenseCategoryDescendantIds,
  expenseCategoryPath,
  expenseNecessityLabel,
  expenseCategoryRoots,
  FINANCE_CURRENCIES,
  formatCurrencyAmountMinor,
  formatExchangeRate,
  formatMoneyMinor,
  formatExpenseMerchantDisplayName,
  formatExpenseProductDisplayName,
  formatMonthLabel,
  formatReceiptQuantity,
  getMonthExpenseSummary,
  moneyMinorToInput,
  normalizeExpenseProductKey,
  parseCurrencyAmountToMinor,
  parseMoneyToMinor,
  receiptItemUnitLabel,
  receiptsForMonth,
  shiftMonthKey,
  sortReceiptsNewestFirst,
} from '../shopping/expenses.utils';
import { ReceiptScanFlow } from '../shopping/receipt-ocr/ReceiptScanFlow';
import { suggestCategoryId } from '../shopping/receipt-ocr/category-suggestions';
import { Modal } from '../ui/Modal';
import { FinanceQuickExpenseModal, type AutomaticRateStatus, type QuickExpenseForm } from './FinanceQuickExpenseModal';
import { fetchCurrentPlnRate, type CurrentPlnRate } from './exchange-rates';
import { convertForeignReceiptDraftToPln } from './foreign-receipt';
import {
  buildExpenseProductAnalytics,
  buildExpenseUnitPriceSummaries,
  type ExpenseProductAnalytics,
} from './finance-products';

interface ReceiptEditItemForm {
  id?: string;
  name: string;
  categoryId: string;
  amountText: string;
  originalAmountMinor?: number;
  quantity?: number;
  unit?: ReceiptItemUnit;
  unitPriceMinor?: number;
}

interface ReceiptEditForm {
  id: string;
  date: string;
  merchant: string;
  source?: ReceiptSource;
  tripName?: string;
  items: ReceiptEditItemForm[];
}

type FinanceScope = 'MONTH' | 'TRIPS';
type FinanceExpenseListMode = 'TRANSACTIONS' | 'ITEMS';

interface ProductEditForm {
  id: string;
  name: string;
  categoryId: string;
  necessity: ExpenseNecessity;
}

function currentMonthKey(): string {
  return toLocalDateKey(new Date()).slice(0, 7);
}

function firstCategoryId(categories: ExpenseCategory[]): string {
  return expenseCategoryRoots(categories)[0]?.id ?? categories[0]?.id ?? '';
}

function emptyQuickExpense(
  categories: ExpenseCategory[],
  monthKey: string,
  currency: FinanceCurrencyCode = 'PLN',
): QuickExpenseForm {
  const today = toLocalDateKey(new Date());
  return {
    date: today.startsWith(`${monthKey}-`) ? today : `${monthKey}-01`,
    merchant: '',
    name: '',
    categoryId: firstCategoryId(categories),
    amountText: '',
    currency,
  };
}

function receiptEditForm(receipt: Receipt): ReceiptEditForm {
  return {
    id: receipt.id,
    date: receipt.date,
    merchant: receipt.merchant,
    ...(receipt.source ? { source: receipt.source } : {}),
    ...(receipt.tripName ? { tripName: receipt.tripName } : {}),
    items: receipt.items.map((item) => ({
      id: item.id,
      name: item.name,
      categoryId: item.categoryId,
      amountText: moneyMinorToInput(item.amountMinor),
      originalAmountMinor: item.amountMinor,
      ...(item.quantity === undefined ? {} : { quantity: item.quantity }),
      ...(item.unit === undefined ? {} : { unit: item.unit }),
      ...(item.unitPriceMinor === undefined ? {} : { unitPriceMinor: item.unitPriceMinor }),
    })),
  };
}

function pluralizeTransactions(count: number): string {
  if (count === 1) return 'transakcja';
  const lastTwo = count % 100;
  const last = count % 10;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? 'transakcje' : 'transakcji';
}

function polishCountLabel(count: number, one: string, few: string, many: string): string {
  if (count === 1) return one;
  const lastTwo = count % 100;
  const last = count % 10;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? few : many;
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

function formatShortDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const month = POLISH_MONTH_SHORT[Number(match[2]) - 1] ?? '';
  return `${Number(match[3])} ${month}`;
}

const POLISH_MONTH_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

function parseDateParts(value: string | undefined): { year: string; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  return { year: match[1]!, month: Number(match[2]), day: Number(match[3]) };
}

function formatTripDateRange(firstDate: string | undefined, lastDate: string | undefined): string {
  const first = parseDateParts(firstDate);
  const last = parseDateParts(lastDate);
  if (!first || !last) return '';
  const firstMonth = POLISH_MONTH_SHORT[first.month - 1] ?? '';
  const lastMonth = POLISH_MONTH_SHORT[last.month - 1] ?? '';
  if (first.year === last.year && first.month === last.month && first.day === last.day) return `${first.day} ${firstMonth} ${first.year}`;
  if (first.year === last.year && first.month === last.month) return `${first.day}-${last.day} ${firstMonth} ${first.year}`;
  if (first.year === last.year) return `${first.day} ${firstMonth} - ${last.day} ${lastMonth} ${first.year}`;
  return `${first.day} ${firstMonth} ${first.year} - ${last.day} ${lastMonth} ${last.year}`;
}

function receiptExpenseTitle(receipt: Receipt): string {
  const names = receipt.items.map((item) => formatExpenseProductDisplayName(item.name)).filter(Boolean);
  if (!names.length) return formatExpenseMerchantDisplayName(receipt.merchant);
  return names.length === 1 ? names[0]! : `${names[0]} +${names.length - 1}`;
}

function normalizeTripName(value: string | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function tripIdentity(value: string | undefined): string {
  return normalizeTripName(value).toLocaleLowerCase('pl-PL');
}

function tripCurrency(trip: FinanceTrip | null | undefined): FinanceCurrencyCode {
  return trip?.currency ?? 'PLN';
}

function receiptOriginalAmount(receipt: Receipt): string {
  return receipt.originalCurrency && receipt.originalAmountMinor !== undefined
    ? formatCurrencyAmountMinor(receipt.originalAmountMinor, receipt.originalCurrency)
    : '';
}

function receiptUnitDetails(item: { quantity?: number; unit?: ReceiptItemUnit; unitPriceMinor?: number }): string {
  if (item.quantity === undefined || item.unitPriceMinor === undefined) return '';
  const unitLabel = receiptItemUnitLabel(item.unit);
  const price = `${formatMoneyMinor(item.unitPriceMinor)}${unitLabel ? `/${unitLabel}` : ''}`;
  return `${formatReceiptQuantity(item.quantity, item.unit)} × ${price}`;
}

function formatUnitPrice(amountMinor: number, unit: ReceiptItemUnit): string {
  return `${formatMoneyMinor(amountMinor)}/${receiptItemUnitLabel(unit)}`;
}

function unitPriceChangeCopy(latestMinor: number, previousMinor: number, unit: ReceiptItemUnit): { value: string; detail: string } {
  const difference = latestMinor - previousMinor;
  if (difference === 0) return { value: 'Bez zmiany', detail: `Poprzednio ${formatUnitPrice(previousMinor, unit)}` };
  return {
    value: `${difference > 0 ? '+' : '-'}${formatUnitPrice(Math.abs(difference), unit)}`,
    detail: `Poprzednio ${formatUnitPrice(previousMinor, unit)}`,
  };
}

function comparisonCopy(comparison: ReturnType<typeof compareMonthExpenses>): { value: string; detail: string } {
  if (comparison.state === 'empty') return { value: '0,00 zł', detail: 'Brak wydatków w obu miesiącach' };
  if (comparison.state === 'no-comparison') {
    return {
      value: formatMoneyMinor(Math.abs(comparison.differenceMinor)),
      detail: 'Brak wydatków w poprzednim miesiącu',
    };
  }
  const percentage = Math.abs(comparison.percentageChange ?? 0).toFixed(1).replace('.', ',');
  if (comparison.differenceMinor === 0) return { value: '0,00 zł', detail: 'Bez zmiany względem poprzedniego miesiąca' };
  return {
    value: formatMoneyMinor(Math.abs(comparison.differenceMinor)),
    detail: comparison.differenceMinor < 0 ? `${percentage}% mniej` : `${percentage}% więcej`,
  };
}

function receiptSourceLabel(receipt: Pick<Receipt, 'source'>): string {
  if (receipt.source === 'manual') return 'Ręcznie';
  if (receipt.source === 'receipt') return 'Skan paragonu';
  return 'Starszy zapis';
}

function CategoryOptions({ categories }: { categories: ExpenseCategory[] }) {
  const roots = expenseCategoryRoots(categories);
  return (
    <>
      {roots.flatMap((root) => [
        <option key={root.id} value={root.id}>{root.name}</option>,
        ...expenseCategoryChildren(categories, root.id).map((child) => (
          <option key={child.id} value={child.id}>{root.name} - {child.name}</option>
        )),
      ])}
    </>
  );
}

export function FinanceDashboardView() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [products, setProducts] = useState<ExpenseProduct[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [tripDefinitions, setTripDefinitions] = useState<FinanceTrip[]>([]);
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [financeScope, setFinanceScope] = useState<FinanceScope>('MONTH');
  const [expenseListMode, setExpenseListMode] = useState<FinanceExpenseListMode>('TRANSACTIONS');
  const [activeTripName, setActiveTripName] = useState('');
  const [newTripOpen, setNewTripOpen] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [newTripCurrency, setNewTripCurrency] = useState<FinanceCurrencyCode>('PLN');
  const [tripCurrencyEdit, setTripCurrencyEdit] = useState<FinanceCurrencyCode | null>(null);
  const [receiptScanOpen, setReceiptScanOpen] = useState(false);
  const [quickExpense, setQuickExpense] = useState<QuickExpenseForm | null>(null);
  const [automaticRate, setAutomaticRate] = useState<CurrentPlnRate | null>(null);
  const [automaticRateStatus, setAutomaticRateStatus] = useState<AutomaticRateStatus>('idle');
  const [detailReceipt, setDetailReceipt] = useState<Receipt | null>(null);
  const [editReceipt, setEditReceipt] = useState<ReceiptEditForm | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [categoryEditMode, setCategoryEditMode] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [activeNecessity, setActiveNecessity] = useState<ExpenseNecessity | ''>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [selectedPurchaseKeys, setSelectedPurchaseKeys] = useState<Set<string>>(() => new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [autoReviewReceiptId, setAutoReviewReceiptId] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<ProductEditForm | null>(null);
  const [deletedReceipt, setDeletedReceipt] = useState<{ receipt: Receipt; expiresAt: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const purchasesRef = useRef<HTMLElement | null>(null);
  const automaticRateAbortRef = useRef<AbortController | null>(null);
  const quickExpenseCurrency = quickExpense?.currency;
  const activeTripDefinition = useMemo(() => tripDefinitions.find((trip) => tripIdentity(trip.name) === tripIdentity(activeTripName)) ?? null, [tripDefinitions, activeTripName]);

  useEffect(() => {
    void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : 'Nie udało się wczytać finansów.'));
  }, []);

  useEffect(() => {
    if (!deletedReceipt) return;
    const remaining = Math.max(0, deletedReceipt.expiresAt - Date.now());
    const timer = window.setTimeout(() => {
      setDeletedReceipt((current) => current?.receipt.id === deletedReceipt.receipt.id ? null : current);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [deletedReceipt]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3600);
    return () => window.clearTimeout(timer);
  }, [message]);

  const activeTripFixedRate = quickExpenseCurrency && quickExpenseCurrency !== 'PLN'
    && financeScope === 'TRIPS'
    && activeTripDefinition?.currency === quickExpenseCurrency
    ? activeTripDefinition.exchangeRatePlnPerUnit ?? null
    : null;

  useEffect(() => {
    automaticRateAbortRef.current?.abort();
    if (!quickExpenseCurrency || quickExpenseCurrency === 'PLN') {
      automaticRateAbortRef.current = null;
      setAutomaticRate(null);
      setAutomaticRateStatus('idle');
      return;
    }
    if (activeTripFixedRate) {
      automaticRateAbortRef.current = null;
      setAutomaticRate(null);
      setAutomaticRateStatus('ready');
      return;
    }
    const controller = new AbortController();
    automaticRateAbortRef.current = controller;
    setAutomaticRate(null);
    setAutomaticRateStatus('loading');
    void fetchCurrentPlnRate(quickExpenseCurrency as Exclude<FinanceCurrencyCode, 'PLN'>, controller.signal)
      .then((rate) => {
        if (controller.signal.aborted) return;
        setAutomaticRate(rate);
        setAutomaticRateStatus('ready');
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setAutomaticRate(null);
        setAutomaticRateStatus('error');
      });
    return () => controller.abort();
  }, [quickExpenseCurrency, activeTripFixedRate]);

  async function refresh() {
    const [nextCategories, nextReceipts, nextTrips] = await Promise.all([listExpenseCategories(), listReceipts(), listFinanceTrips()]);
    const nextProducts = await syncExpenseProductsFromReceipts();
    const otherCategoryId = nextCategories.find((category) => category.name.trim().toLocaleLowerCase('pl-PL') === 'inne')?.id;
    const repairs = otherCategoryId ? nextProducts.filter((product) => product.categoryId === otherCategoryId && product.updatedAt === product.createdAt).map((product) => {
      const suggestedCategoryId = suggestCategoryId(product.originalName, nextReceipts, nextCategories, nextProducts);
      return suggestedCategoryId && suggestedCategoryId !== otherCategoryId
        ? updateExpenseProduct(product.id, { name: product.name, categoryId: suggestedCategoryId, ...(product.necessity ? { necessity: product.necessity } : {}) })
        : Promise.resolve(product);
    }) : [];
    const repairedProducts = repairs.length ? await Promise.all(repairs) : nextProducts;
    const productsById = new Map(repairedProducts.map((product) => [product.id, product]));
    setCategories(nextCategories);
    setProducts(nextProducts.map((product) => productsById.get(product.id) ?? product));
    setReceipts(nextReceipts);
    setTripDefinitions(nextTrips);
  }

  function clearFeedback() {
    setError('');
    setMessage('');
  }

  function openCategoryOverview() {
    clearFeedback();
    setCategoryEditMode(false);
    setExpandedCategoryId(null);
    setEditingCategoryId(null);
    setEditingCategoryName('');
    setShowCategoryManager(true);
  }

  const monthReceipts = useMemo(
    () => sortReceiptsNewestFirst(receiptsForMonth(receipts, monthKey)),
    [receipts, monthKey],
  );
  const monthSummary = useMemo(() => getMonthExpenseSummary(receipts, monthKey), [receipts, monthKey]);
  const comparison = useMemo(() => compareMonthExpenses(receipts, monthKey), [receipts, monthKey]);
  const comparisonText = useMemo(() => comparisonCopy(comparison), [comparison]);
  const productCategoryByKey = useMemo(() => new Map(products.map((product) => [product.normalizedKey, product.categoryId])), [products]);
  const categorizedReceipts = useMemo(() => receipts.map((receipt) => ({
    ...receipt,
    items: receipt.items.map((item) => ({
      ...item,
      categoryId: productCategoryByKey.get(normalizeExpenseProductKey(item.name)) ?? item.categoryId,
    })),
  })), [receipts, productCategoryByKey]);
  const categoryAnalytics = useMemo(
    () => aggregateExpensesByCategoryTree(categorizedReceipts, categories, monthKey),
    [categorizedReceipts, categories, monthKey],
  );
  const rootCategories = useMemo(() => expenseCategoryRoots(categories), [categories]);
  const otherCategoryId = useMemo(
    () => rootCategories.find((category) => category.name.trim().toLocaleLowerCase('pl-PL') === 'inne')?.id ?? '',
    [rootCategories],
  );
  const categoryOverviewRows = useMemo(() => {
    const byId = new Map(categoryAnalytics.map((entry) => [entry.categoryId, entry]));
    return rootCategories.map((category) => {
      const aggregate = byId.get(category.id);
      return {
        category,
        totalMinor: aggregate?.totalMinor ?? 0,
        itemCount: aggregate?.itemCount ?? 0,
        sharePercent: aggregate?.sharePercent ?? 0,
        isOther: category.name.trim().toLocaleLowerCase('pl-PL') === 'inne',
      };
    }).sort((left, right) => {
      const leftNeedsReview = left.isOther && left.totalMinor > 0 ? 1 : 0;
      const rightNeedsReview = right.isOther && right.totalMinor > 0 ? 1 : 0;
      return rightNeedsReview - leftNeedsReview
        || right.totalMinor - left.totalMinor
        || left.category.sortOrder - right.category.sortOrder
        || left.category.name.localeCompare(right.category.name, 'pl-PL');
    });
  }, [categoryAnalytics, rootCategories]);
  const activeCategoryIds = useMemo(
    () => activeCategoryId ? expenseCategoryDescendantIds(categories, activeCategoryId) : [],
    [categories, activeCategoryId],
  );
  const productAnalytics = useMemo(() => buildExpenseProductAnalytics(receipts, products), [receipts, products]);
  const productByKey = useMemo(() => new Map(products.map((product) => [product.normalizedKey, product])), [products]);
  const tripSummaries = useMemo(() => {
    const grouped = new Map<string, { name: string; definitionId?: string; currency?: FinanceCurrencyCode; receipts: Receipt[]; totalMinor: number; firstDate?: string; lastDate?: string; sortKey: string }>();
    for (const trip of tripDefinitions) {
      const name = normalizeTripName(trip.name);
      if (!name) continue;
      grouped.set(tripIdentity(name), { name, definitionId: trip.id, currency: tripCurrency(trip), receipts: [], totalMinor: 0, sortKey: trip.updatedAt });
    }
    for (const receipt of sortReceiptsNewestFirst(receipts)) {
      const name = normalizeTripName(receipt.tripName);
      if (!name) continue;
      const key = tripIdentity(name);
      const current = grouped.get(key);
      if (current) {
        current.receipts.push(receipt);
        current.totalMinor += receipt.totalMinor;
        if (!current.firstDate || receipt.date < current.firstDate) current.firstDate = receipt.date;
        if (!current.lastDate || receipt.date > current.lastDate) current.lastDate = receipt.date;
        if (receipt.date > current.sortKey) current.sortKey = receipt.date;
      } else {
        grouped.set(key, { name, receipts: [receipt], totalMinor: receipt.totalMinor, firstDate: receipt.date, lastDate: receipt.date, sortKey: receipt.date });
      }
    }
    return [...grouped.values()].sort((left, right) => right.sortKey.localeCompare(left.sortKey) || left.name.localeCompare(right.name, 'pl-PL'));
  }, [receipts, tripDefinitions]);
  const activeTripReceipts = useMemo(() => {
    const key = tripIdentity(activeTripName);
    return key ? sortReceiptsNewestFirst(receipts.filter((receipt) => tripIdentity(receipt.tripName) === key)) : [];
  }, [receipts, activeTripName]);
  const activeTripTotalMinor = useMemo(() => activeTripReceipts.reduce((sum, receipt) => sum + receipt.totalMinor, 0), [activeTripReceipts]);
  const activeTripOriginalTotals = useMemo(() => {
    const totals = new Map<FinanceCurrencyCode, number>();
    for (const receipt of activeTripReceipts) {
      if (!receipt.originalCurrency || receipt.originalAmountMinor === undefined) continue;
      totals.set(receipt.originalCurrency, (totals.get(receipt.originalCurrency) ?? 0) + receipt.originalAmountMinor);
    }
    return [...totals.entries()].map(([currency, amountMinor]) => ({ currency, amountMinor }));
  }, [activeTripReceipts]);
  const activeTripCategoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const receipt of activeTripReceipts) {
      for (const item of receipt.items) {
        const categoryId = productCategoryByKey.get(normalizeExpenseProductKey(item.name)) ?? item.categoryId;
        totals.set(categoryId, (totals.get(categoryId) ?? 0) + item.amountMinor);
      }
    }
    return [...totals.entries()]
      .map(([categoryId, totalMinor]) => ({
        categoryId,
        category: categories.find((category) => category.id === categoryId) ?? { id: categoryId, name: 'Inne', sortOrder: 999, createdAt: '', updatedAt: '' },
        totalMinor,
      }))
      .sort((left, right) => right.totalMinor - left.totalMinor || left.category.name.localeCompare(right.category.name, 'pl-PL'))
      .slice(0, 4);
  }, [activeTripReceipts, categories, productCategoryByKey]);
  const productAnalyticsById = useMemo(() => new Map(productAnalytics.map((entry) => [entry.product.id, entry])), [productAnalytics]);
  const editedProductAnalytics = useMemo(
    () => editProduct ? productAnalyticsById.get(editProduct.id) ?? null : null,
    [editProduct, productAnalyticsById],
  );
  const editedProductPriceSummaries = useMemo(
    () => editedProductAnalytics ? buildExpenseUnitPriceSummaries(editedProductAnalytics.occurrences) : [],
    [editedProductAnalytics],
  );
  const editedProductPriceSummary = editedProductPriceSummaries[0] ?? null;
  const editedProductPriceChange = editedProductPriceSummary?.previous?.unitPriceMinor !== undefined
    && editedProductPriceSummary.latest.unitPriceMinor !== undefined
    ? unitPriceChangeCopy(editedProductPriceSummary.latest.unitPriceMinor, editedProductPriceSummary.previous.unitPriceMinor, editedProductPriceSummary.unit)
    : null;

  const monthPurchaseRows = useMemo(() => monthReceipts.flatMap((receipt) => receipt.items.map((item) => {
    const product = productByKey.get(normalizeExpenseProductKey(item.name));
    return {
      key: `${receipt.id}-${item.id}`,
      receipt,
      item,
      product,
      canonicalName: product?.name ?? item.name,
      effectiveCategoryId: product?.categoryId ?? item.categoryId,
      categoryPath: expenseCategoryPath(categories, product?.categoryId ?? item.categoryId),
      necessity: product?.necessity ?? 'unknown',
      productAnalytics: product ? productAnalyticsById.get(product.id) ?? null : null,
    };
  })), [monthReceipts, productByKey, categories, productAnalyticsById]);

  const hasQuantityData = useMemo(
    () => monthPurchaseRows.some((row) => row.item.quantity !== undefined && row.item.unitPriceMinor !== undefined),
    [monthPurchaseRows],
  );

  const necessityTotals = useMemo(() => monthPurchaseRows.reduce<Record<ExpenseNecessity, number>>((totals, row) => {
    totals[row.necessity] += row.item.amountMinor;
    return totals;
  }, { essential: 0, nonessential: 0, unknown: 0 }), [monthPurchaseRows]);

  const reviewPurchaseRows = useMemo(
    () => monthPurchaseRows.filter((row) => (otherCategoryId && row.effectiveCategoryId === otherCategoryId) || row.necessity === 'unknown'),
    [monthPurchaseRows, otherCategoryId],
  );
  const reviewTotalMinor = useMemo(
    () => reviewPurchaseRows.reduce((sum, row) => sum + row.item.amountMinor, 0),
    [reviewPurchaseRows],
  );
  const otherReviewCount = useMemo(
    () => otherCategoryId ? monthPurchaseRows.filter((row) => row.effectiveCategoryId === otherCategoryId).length : 0,
    [monthPurchaseRows, otherCategoryId],
  );
  const unknownReviewCount = useMemo(
    () => monthPurchaseRows.filter((row) => row.necessity === 'unknown').length,
    [monthPurchaseRows],
  );

  const filteredPurchaseRows = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('pl-PL');
    return monthPurchaseRows.filter((row) => {
      if (reviewOnly && !((otherCategoryId && row.effectiveCategoryId === otherCategoryId) || row.necessity === 'unknown')) return false;
      if (activeCategoryId && !activeCategoryIds.includes(row.effectiveCategoryId)) return false;
      if (activeNecessity && row.necessity !== activeNecessity) return false;
      if (!query) return true;
      const haystack = [row.canonicalName, row.item.name, row.receipt.merchant, row.categoryPath, expenseNecessityLabel(row.necessity)]
        .join(' ')
        .toLocaleLowerCase('pl-PL');
      return haystack.includes(query);
    });
  }, [monthPurchaseRows, searchQuery, activeCategoryId, activeCategoryIds, activeNecessity, reviewOnly, otherCategoryId]);

  const hasTableFilters = Boolean(searchQuery.trim() || activeCategoryId || activeNecessity || reviewOnly);
  const bulkReviewMode = Boolean(reviewOnly || (otherCategoryId && activeCategoryId === otherCategoryId));
  const selectedPurchaseRows = useMemo(
    () => filteredPurchaseRows.filter((row) => selectedPurchaseKeys.has(row.key)),
    [filteredPurchaseRows, selectedPurchaseKeys],
  );
  const allVisiblePurchaseRowsSelected = Boolean(bulkReviewMode && filteredPurchaseRows.length && filteredPurchaseRows.every((row) => selectedPurchaseKeys.has(row.key)));
  useEffect(() => {
    const visibleKeys = new Set(filteredPurchaseRows.map((row) => row.key));
    setSelectedPurchaseKeys((current) => {
      let changed = false;
      const next = new Set<string>();
      for (const key of current) {
        if (visibleKeys.has(key)) next.add(key);
        else changed = true;
      }
      if (!bulkReviewMode && next.size) {
        changed = true;
        next.clear();
      }
      return changed ? next : current;
    });
    if (!bulkReviewMode) setBulkCategoryId('');
  }, [filteredPurchaseRows, bulkReviewMode]);

  useEffect(() => {
    if (!autoReviewReceiptId) return;
    const savedRows = monthPurchaseRows.filter((row) => row.receipt.id === autoReviewReceiptId);
    if (!savedRows.length) return;
    const rowsToReview = savedRows.filter((row) => (otherCategoryId && row.effectiveCategoryId === otherCategoryId) || row.necessity === 'unknown');
    setAutoReviewReceiptId(null);
    if (rowsToReview.length) {
      setExpenseListMode('ITEMS');
      setReviewOnly(true);
      setActiveCategoryId('');
      setActiveNecessity('');
      setMessage(`Paragon zapisany. ${rowsToReview.length} ${polishCountLabel(rowsToReview.length, 'pozycja wymaga', 'pozycje wymagają', 'pozycji wymaga')} szybkiego sprawdzenia.`);
      window.requestAnimationFrame(() => purchasesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } else {
      setMessage('Paragon zapisany. Wszystkie pozycje są przypisane.');
    }
  }, [autoReviewReceiptId, monthPurchaseRows, otherCategoryId]);

  function selectTrip(name: string) {
    clearFeedback();
    setFinanceScope('TRIPS');
    setActiveTripName(normalizeTripName(name));
    setNewTripOpen(false);
    setNewTripName('');
    setNewTripCurrency('PLN');
    setTripCurrencyEdit(null);
  }

  async function createTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = normalizeTripName(newTripName);
    if (!name || busy) {
      if (!name) setError('Wpisz nazwę wyjazdu.');
      return;
    }
    clearFeedback();
    setBusy(true);
    try {
      const saved = await createFinanceTrip(name, { currency: newTripCurrency });
      setTripDefinitions((current) => current.some((trip) => trip.id === saved.id) ? current : [saved, ...current]);
      selectTrip(saved.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się utworzyć wyjazdu.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteEmptyActiveTrip() {
    if (busy || activeTripReceipts.length || !activeTripDefinition) return;
    clearFeedback();
    setBusy(true);
    try {
      await deleteFinanceTrip(activeTripDefinition.id);
      setTripDefinitions((current) => current.filter((trip) => trip.id !== activeTripDefinition.id));
      setActiveTripName('');
      setNewTripOpen(false);
      setNewTripName('');
      setNewTripCurrency('PLN');
      setTripCurrencyEdit(null);
      setMessage('Pusty wyjazd został usunięty.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się usunąć wyjazdu.');
    } finally {
      setBusy(false);
    }
  }

  function openTripList() {
    clearFeedback();
    setFinanceScope('TRIPS');
    setActiveTripName('');
    setNewTripOpen(false);
    setNewTripName('');
    setNewTripCurrency('PLN');
    setTripCurrencyEdit(null);
  }

  function openQuickExpense() {
    clearFeedback();
    setReceiptScanOpen(false);
    const defaultCurrency = financeScope === 'TRIPS' && activeTripName ? tripCurrency(activeTripDefinition) : 'PLN';
    setQuickExpense(emptyQuickExpense(categories, monthKey, defaultCurrency));
  }

  async function openTripCurrencySettings() {
    if (!activeTripName || busy) return;
    clearFeedback();
    setBusy(true);
    try {
      const definition = activeTripDefinition ?? await createFinanceTrip(activeTripName, { currency: 'PLN' });
      if (!activeTripDefinition) setTripDefinitions((current) => current.some((trip) => trip.id === definition.id) ? current : [definition, ...current]);
      setTripCurrencyEdit(tripCurrency(definition));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się otworzyć ustawień waluty.');
    } finally {
      setBusy(false);
    }
  }

  async function saveTripCurrencySettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeTripDefinition || !tripCurrencyEdit || busy) return;
    clearFeedback();
    setBusy(true);
    try {
      const preservedRate = tripCurrencyEdit === activeTripDefinition.currency ? activeTripDefinition.exchangeRatePlnPerUnit : undefined;
      const updated = await updateFinanceTripCurrency(activeTripDefinition.id, tripCurrencyEdit, preservedRate);
      setTripDefinitions((current) => current.map((trip) => trip.id === updated.id ? updated : trip));
      setTripCurrencyEdit(null);
      setMessage(updated.currency === 'PLN'
        ? 'Waluta wyjazdu ustawiona na PLN.'
        : `Waluta wyjazdu ustawiona na ${updated.currency}. Lokalny kurs orientacyjny zostanie podstawiony automatycznie przy pierwszym wydatku.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać waluty wyjazdu.');
    } finally {
      setBusy(false);
    }
  }

  function openReceiptScan() {
    clearFeedback();
    setQuickExpense(null);
    setReceiptScanOpen(true);
  }

  async function saveScannedReceipt(draft: ReceiptDraft) {
    clearFeedback();
    const tripName = financeScope === 'TRIPS' ? normalizeTripName(activeTripName) : '';
    let receiptDraft: ReceiptDraft = { ...draft, source: 'receipt', ...(tripName ? { tripName } : {}) };
    let fetchedTripRate: number | null = null;

    if (tripName) {
      const currency = tripCurrency(activeTripDefinition);
      if (currency !== 'PLN') {
        let rate = activeTripDefinition?.exchangeRatePlnPerUnit ?? null;
        if (rate === null) {
          const fetched = await fetchCurrentPlnRate(currency);
          rate = fetched.ratePlnPerUnit;
          fetchedTripRate = rate;
        }
        receiptDraft = convertForeignReceiptDraftToPln(receiptDraft, currency, rate);
      }
    }

    const savedReceipt = await createReceipt(receiptDraft);
    if (tripName && activeTripDefinition && fetchedTripRate && !activeTripDefinition.exchangeRatePlnPerUnit) {
      const updatedTrip = await updateFinanceTripCurrency(activeTripDefinition.id, activeTripDefinition.currency ?? 'PLN', fetchedTripRate);
      setTripDefinitions((current) => current.map((trip) => trip.id === updatedTrip.id ? updatedTrip : trip));
    }
    setReceiptScanOpen(false);
    if (tripName) {
      setAutoReviewReceiptId(null);
      setMessage(`Paragon dodany do wyjazdu ${tripName}.`);
    } else {
      setAutoReviewReceiptId(savedReceipt.id);
      setMonthKey(draft.date.slice(0, 7));
    }
    await refresh();
  }

  async function saveQuickExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quickExpense || busy) return;
    clearFeedback();

    const originalAmountMinor = parseCurrencyAmountToMinor(quickExpense.amountText);
    if (originalAmountMinor === null || originalAmountMinor <= 0) {
      setError('Wpisz prawidłową kwotę wydatku.');
      return;
    }
    const expenseName = quickExpense.name.trim();
    if (!expenseName) {
      setError('Wpisz nazwę lub krótki opis wydatku.');
      return;
    }
    if (!quickExpense.categoryId) {
      setError('Wybierz kategorię wydatku.');
      return;
    }

    let amountMinor = originalAmountMinor;
    let exchangeRatePlnPerUnit: number | undefined;

    if (quickExpense.currency !== 'PLN') {
      let rate = activeTripFixedRate ?? (
        automaticRate && automaticRate.currency === quickExpense.currency
          ? automaticRate.ratePlnPerUnit
          : null
      );
      if (rate === null) {
        setBusy(true);
        setAutomaticRateStatus('loading');
        try {
          const fetched = await fetchCurrentPlnRate(quickExpense.currency as Exclude<FinanceCurrencyCode, 'PLN'>);
          setAutomaticRate(fetched);
          setAutomaticRateStatus('ready');
          rate = fetched.ratePlnPerUnit;
        } catch {
          setAutomaticRateStatus('error');
          setError('Brak lokalnego kursu dla wybranej waluty.');
          setBusy(false);
          return;
        }
      }
      const converted = convertForeignMinorToPlnMinor(originalAmountMinor, rate);
      if (converted === null) {
        setError('Nie udało się przeliczyć kwoty na PLN.');
        setBusy(false);
        return;
      }
      amountMinor = converted;
      exchangeRatePlnPerUnit = rate;
    }

    setBusy(true);
    try {
      await createReceipt({
        date: quickExpense.date,
        merchant: quickExpense.merchant.trim() || expenseName,
        source: 'manual',
        ...(financeScope === 'TRIPS' && normalizeTripName(activeTripName) ? { tripName: normalizeTripName(activeTripName) } : {}),
        ...(quickExpense.currency !== 'PLN' && exchangeRatePlnPerUnit ? {
          originalCurrency: quickExpense.currency,
          originalAmountMinor,
          exchangeRatePlnPerUnit,
          conversionSource: 'rate' as const,
        } : {}),
        items: [{
          name: expenseName,
          categoryId: quickExpense.categoryId,
          amountMinor,
        }],
      });
      const savedMonth = quickExpense.date.slice(0, 7);
      const tripName = financeScope === 'TRIPS' ? normalizeTripName(activeTripName) : '';
      if (tripName && activeTripDefinition && quickExpense.currency === activeTripDefinition.currency && quickExpense.currency !== 'PLN' && exchangeRatePlnPerUnit && !activeTripDefinition.exchangeRatePlnPerUnit) {
        const updatedTrip = await updateFinanceTripCurrency(activeTripDefinition.id, activeTripDefinition.currency, exchangeRatePlnPerUnit);
        setTripDefinitions((current) => current.map((trip) => trip.id === updatedTrip.id ? updatedTrip : trip));
      }
      setQuickExpense(null);
      if (!tripName) setMonthKey(savedMonth);
      await refresh();
      setMessage(tripName ? `Wydatek dodany do wyjazdu ${tripName}.` : 'Wydatek został dodany.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać wydatku.');
    } finally {
      setBusy(false);
    }
  }


  function scrollToPurchases() {
    window.requestAnimationFrame(() => purchasesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function clearPurchaseFilters(clearSearch = false) {
    setReviewOnly(false);
    setActiveCategoryId('');
    setActiveNecessity('');
    if (clearSearch) setSearchQuery('');
  }

  function showTransactions() {
    clearPurchaseFilters(true);
    setFiltersOpen(false);
    setExpenseListMode('TRANSACTIONS');
    scrollToPurchases();
  }

  function showAllPurchases() {
    clearPurchaseFilters(true);
    setExpenseListMode('ITEMS');
    scrollToPurchases();
  }

  function showReviewPurchases() {
    setExpenseListMode('ITEMS');
    setReviewOnly(true);
    setActiveCategoryId('');
    setActiveNecessity('');
    scrollToPurchases();
  }

  function filterByCategory(categoryId: string) {
    setExpenseListMode('ITEMS');
    setReviewOnly(false);
    setActiveNecessity('');
    setActiveCategoryId((current) => current === categoryId ? '' : categoryId);
    scrollToPurchases();
  }

  function showCategoryPurchases(categoryId: string) {
    setExpenseListMode('ITEMS');
    setReviewOnly(false);
    setActiveNecessity('');
    setActiveCategoryId(categoryId);
    setShowCategoryManager(false);
    setCategoryEditMode(false);
    scrollToPurchases();
  }

  function filterByNecessity(necessity: ExpenseNecessity | '') {
    setExpenseListMode('ITEMS');
    setReviewOnly(false);
    setActiveCategoryId('');
    setActiveNecessity((current) => necessity && current === necessity ? '' : necessity);
    scrollToPurchases();
  }

  function togglePurchaseSelection(key: string) {
    setSelectedPurchaseKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllVisiblePurchaseRows() {
    setSelectedPurchaseKeys((current) => {
      const next = new Set(current);
      if (allVisiblePurchaseRowsSelected) {
        for (const row of filteredPurchaseRows) next.delete(row.key);
      } else {
        for (const row of filteredPurchaseRows) next.add(row.key);
      }
      return next;
    });
  }

  async function applyBulkCategory() {
    if (busy || !bulkCategoryId || !selectedPurchaseRows.length) return;
    setBusy(true);
    clearFeedback();
    try {
      for (const row of selectedPurchaseRows) {
        await updateReceiptItemCategory(row.receipt.id, row.item.id, bulkCategoryId);
      }
      const changedCount = selectedPurchaseRows.length;
      setSelectedPurchaseKeys(new Set());
      setBulkCategoryId('');
      await refresh();
      setMessage(`Zmieniono kategorię dla ${changedCount} ${polishCountLabel(changedCount, 'pozycji', 'pozycji', 'pozycji')}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zmienić kategorii zaznaczonych pozycji.');
    } finally {
      setBusy(false);
    }
  }

  function openReceiptEditor(receipt: Receipt) {
    clearFeedback();
    setDetailReceipt(null);
    setEditReceipt(receiptEditForm(receipt));
  }

  function updateEditItem(index: number, patch: Partial<ReceiptEditItemForm>) {
    setEditReceipt((current) => current ? {
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    } : current);
  }

  function addEditItem() {
    setEditReceipt((current) => current ? {
      ...current,
      items: [...current.items, {
        name: '',
        categoryId: firstCategoryId(categories),
        amountText: '',
      }],
    } : current);
  }

  function removeEditItem(index: number) {
    setEditReceipt((current) => current && current.items.length > 1 ? {
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    } : current);
  }

  async function saveReceiptEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editReceipt || busy) return;
    clearFeedback();
    const parsed = editReceipt.items.map((item) => ({ ...item, amountMinor: parseMoneyToMinor(item.amountText) }));
    const invalid = parsed.find((item) => !item.name.trim() || item.amountMinor === null || item.amountMinor <= 0 || !item.categoryId);
    if (invalid) {
      setError('Uzupełnij nazwę, kategorię i prawidłową kwotę każdej pozycji.');
      return;
    }
    setBusy(true);
    try {
      await updateReceipt(editReceipt.id, {
        date: editReceipt.date,
        merchant: editReceipt.merchant,
        ...(editReceipt.source ? { source: editReceipt.source } : {}),
        ...(normalizeTripName(editReceipt.tripName) ? { tripName: normalizeTripName(editReceipt.tripName) } : {}),
        items: parsed.map((item) => {
          const preserveUnitDetails = item.amountMinor === item.originalAmountMinor
            && item.quantity !== undefined
            && item.unitPriceMinor !== undefined;
          return {
            ...(item.id ? { id: item.id } : {}),
            name: item.name,
            categoryId: item.categoryId,
            amountMinor: item.amountMinor!,
            ...(preserveUnitDetails ? {
              quantity: item.quantity,
              unitPriceMinor: item.unitPriceMinor,
              ...(item.unit ? { unit: item.unit } : {}),
            } : {}),
          };
        }),
      });
      const savedMonth = editReceipt.date.slice(0, 7);
      setEditReceipt(null);
      setMonthKey(savedMonth);
      await refresh();
      setMessage('Zmiany transakcji zostały zapisane.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać zmian transakcji.');
    } finally {
      setBusy(false);
    }
  }

  async function removeReceipt(receipt: Receipt) {
    if (!window.confirm(`Usunąć transakcję ${receipt.merchant} z ${formatDate(receipt.date)}?`)) return;
    setBusy(true);
    clearFeedback();
    try {
      await deleteReceipt(receipt.id);
      setDetailReceipt(null);
      setEditReceipt(null);
      await refresh();
      setDeletedReceipt({ receipt: structuredClone(receipt), expiresAt: Date.now() + 8000 });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się usunąć transakcji.');
    } finally {
      setBusy(false);
    }
  }

  async function undoDeleteReceipt() {
    if (!deletedReceipt || busy) return;
    setBusy(true);
    clearFeedback();
    try {
      await restoreDeletedReceipt(deletedReceipt.receipt);
      setDeletedReceipt(null);
      await refresh();
      setMessage('Transakcja została przywrócona.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się przywrócić transakcji.');
    } finally {
      setBusy(false);
    }
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    clearFeedback();
    try {
      await createExpenseCategory(newCategoryName, null);
      setNewCategoryName('');
      await refresh();
      setMessage('Kategoria została dodana.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się dodać kategorii.');
    } finally {
      setBusy(false);
    }
  }

  async function addSubcategory(event: FormEvent<HTMLFormElement>, parentId: string) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    clearFeedback();
    try {
      await createExpenseCategory(newSubcategoryName, parentId);
      setNewSubcategoryName('');
      await refresh();
      setExpandedCategoryId(parentId);
      setMessage('Podkategoria została dodana.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się dodać podkategorii.');
    } finally {
      setBusy(false);
    }
  }

  function startCategoryEdit(category: ExpenseCategory) {
    clearFeedback();
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
  }

  function cancelCategoryEdit() {
    setEditingCategoryId(null);
    setEditingCategoryName('');
  }

  async function saveCategory(category: ExpenseCategory) {
    if (busy) return;
    setBusy(true);
    clearFeedback();
    try {
      await updateExpenseCategory(category.id, editingCategoryName);
      cancelCategoryEdit();
      await refresh();
      setMessage('Nazwa kategorii została zapisana.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać kategorii.');
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(category: ExpenseCategory) {
    if (!window.confirm(`Usunąć kategorię „${category.name}”?`)) return;
    setBusy(true);
    clearFeedback();
    try {
      await deleteExpenseCategory(category.id);
      if (activeCategoryId === category.id) setActiveCategoryId('');
      if (expandedCategoryId === category.id) setExpandedCategoryId(null);
      if (editingCategoryId === category.id) cancelCategoryEdit();
      await refresh();
      setMessage('Kategoria została usunięta.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się usunąć kategorii.');
    } finally {
      setBusy(false);
    }
  }

  function openProductEditor(entry: ExpenseProductAnalytics) {
    clearFeedback();
    setEditProduct({ id: entry.product.id, name: entry.product.name, categoryId: entry.product.categoryId, necessity: entry.product.necessity ?? 'unknown' });
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editProduct || busy) return;
    setBusy(true);
    clearFeedback();
    try {
      await updateExpenseProduct(editProduct.id, { name: editProduct.name, categoryId: editProduct.categoryId, necessity: editProduct.necessity });
      setEditProduct(null);
      await refresh();
      setMessage('Produkt został zapisany.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać produktu.');
    } finally {
      setBusy(false);
    }
  }

  async function changePurchaseCategory(receiptId: string, itemId: string, categoryId: string) {
    clearFeedback();
    try {
      const updated = await updateReceiptItemCategory(receiptId, itemId, categoryId);
      setReceipts((current) => current.map((receipt) => receipt.id === updated.receipt.id ? updated.receipt : receipt));
      if (updated.product) {
        setProducts((current) => current.map((product) => product.id === updated.product!.id ? updated.product! : product));
      } else {
        const nextProducts = await syncExpenseProductsFromReceipts();
        setProducts(nextProducts);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zmienić kategorii.');
    }
  }

  async function changeProductNecessity(product: ExpenseProduct, necessity: ExpenseNecessity) {
    clearFeedback();
    try {
      const updated = await updateExpenseProduct(product.id, {
        name: product.name,
        categoryId: product.categoryId,
        necessity,
      });
      setProducts((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zmienić typu wydatku.');
    }
  }

  const isEmptyMonth = financeScope === 'MONTH' && monthSummary.receiptCount === 0;
  const isEmptyActiveTrip = financeScope === 'TRIPS' && Boolean(activeTripName) && activeTripReceipts.length === 0;

  return (
    <div className={`finance-dashboard-v2 finance-core-flow${isEmptyMonth ? ' finance-month-is-empty' : ''}${isEmptyActiveTrip ? ' finance-trip-is-empty' : ''}`}>
      <div className="finance-dashboard-controls finance-core-controls finance-dashboard-controls-v1258">
        <div className="finance-scope-switch" aria-label="Widok finansów">
          <button type="button" className={financeScope === 'MONTH' ? 'is-active' : ''} onClick={() => { setFinanceScope('MONTH'); setActiveTripName(''); }}>Miesiąc</button>
          <button type="button" className={financeScope === 'TRIPS' ? 'is-active' : ''} onClick={openTripList}>Wyjazdy</button>
        </div>
        {financeScope === 'MONTH' ? (
          <div className="finance-month-switch" aria-label="Wybierz miesiąc finansów">
            <button type="button" className="icon-button" onClick={() => { clearPurchaseFilters(true); setMonthKey((current) => shiftMonthKey(current, -1)); }} aria-label="Poprzedni miesiąc">‹</button>
            <strong>{formatMonthLabel(monthKey)}</strong>
            <button type="button" className="icon-button" onClick={() => { clearPurchaseFilters(true); setMonthKey((current) => shiftMonthKey(current, 1)); }} aria-label="Następny miesiąc">›</button>
          </div>
        ) : activeTripName ? (
          <div className="finance-trip-current"><button type="button" className="text-button finance-trip-back" onClick={openTripList}>‹ Wyjazdy</button></div>
        ) : null}
        {financeScope === 'MONTH' ? (
          <div className="finance-dashboard-actions finance-core-actions">
            {!isEmptyMonth ? <button type="button" className="button button-primary finance-manual-expense" onClick={openQuickExpense}>+ Wydatek</button> : null}
            <button type="button" className="button button-secondary finance-scan-receipt" onClick={openReceiptScan}>Skanuj paragon</button>
          </div>
        ) : activeTripName && !isEmptyActiveTrip ? (
          <div className="finance-dashboard-actions finance-core-actions">
            <button type="button" className="button button-primary finance-manual-expense" onClick={openQuickExpense}>+ Wydatek</button>
          </div>
        ) : null}
      </div>

      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
      {message ? <div className="study-message success-message finance-feedback-toast" role="status">{message}</div> : null}
      {deletedReceipt ? (
        <div className="expense-undo-toast" role="status" aria-live="polite">
          <span>Transakcja usunięta.</span>
          <button type="button" className="text-button" disabled={busy} onClick={() => void undoDeleteReceipt()}>Cofnij</button>
        </div>
      ) : null}

      {financeScope === 'TRIPS' ? (
        activeTripName ? (
          <div className="finance-trip-view">
            <section className="panel finance-overview-summary-card finance-trip-summary finance-trip-summary-simple" aria-label={`Podsumowanie wyjazdu ${activeTripName}`}>
              <div className="finance-overview-summary-main finance-trip-summary-main">
                <div className="finance-overview-summary-copy finance-trip-summary-copy">
                  <span className="section-kicker">Wyjazd</span>
                  <h2>{activeTripName}</h2>
                  <div className="finance-overview-summary-meta finance-trip-summary-meta">
                    {activeTripReceipts.length ? <span>{formatTripDateRange(activeTripReceipts[activeTripReceipts.length - 1]!.date, activeTripReceipts[0]!.date)}</span> : <span>Brak wydatków</span>}
                    <span>{activeTripReceipts.length} {polishCountLabel(activeTripReceipts.length, 'wydatek', 'wydatki', 'wydatków')}</span>
                    <button type="button" className="finance-trip-currency-button" onClick={() => void openTripCurrencySettings()} disabled={busy} aria-label={`Waluta wyjazdu ${tripCurrency(activeTripDefinition)} - edytuj`}>{tripCurrency(activeTripDefinition)}</button>
                  </div>
                </div>
                <div className="finance-overview-summary-total finance-trip-summary-total">
                  <strong>{formatMoneyMinor(activeTripTotalMinor)}</strong>
                  {activeTripOriginalTotals.map((entry) => <small key={entry.currency}>{formatCurrencyAmountMinor(entry.amountMinor, entry.currency)}</small>)}
                </div>
              </div>
              {activeTripCategoryTotals.length ? <div className="finance-overview-category-strip finance-trip-category-strip" aria-label="Kategorie wydatków wyjazdu">
                <span className="finance-overview-category-manage finance-trip-category-label">Kategorie</span>
                {activeTripCategoryTotals.map((entry) => <span className="finance-overview-category-chip finance-trip-category-chip" key={entry.categoryId}>
                  <ExpenseCategoryIcon category={entry.category} />
                  <span>{entry.category.name}</span>
                  <strong>{formatMoneyMinor(entry.totalMinor)}</strong>
                </span>)}
              </div> : null}
            </section>

            {activeTripReceipts.length ? (
              <section className="panel finance-expense-list-card finance-trip-expenses" aria-label={`Wydatki - ${activeTripName}`}>
                <div className="finance-section-heading finance-section-heading-row finance-core-section-heading finance-expense-list-heading"><div><h2>Wydatki</h2></div><span>{activeTripReceipts.length} {polishCountLabel(activeTripReceipts.length, 'wydatek', 'wydatki', 'wydatków')}</span></div>
                <div className="finance-expense-list finance-trip-expense-list">
                  {activeTripReceipts.map((receipt) => {
                    const firstItem = receipt.items[0];
                    const firstProduct = firstItem ? productByKey.get(normalizeExpenseProductKey(firstItem.name)) : undefined;
                    const categoryId = firstItem ? firstProduct?.categoryId ?? firstItem.categoryId : '';
                    const category = categoryId ? categories.find((entry) => entry.id === categoryId) : undefined;
                    const categoryLabel = categoryId ? expenseCategoryPath(categories, categoryId) : '';
                    const secondary = [formatExpenseMerchantDisplayName(receipt.merchant), categoryLabel].filter(Boolean).join(' · ');
                    return <button type="button" key={receipt.id} className="finance-expense-row finance-trip-expense-row" onClick={() => setDetailReceipt(receipt)}>
                      <span className="finance-expense-date finance-trip-expense-date">{formatShortDate(receipt.date)}</span>
                      <span className="finance-expense-icon finance-trip-expense-icon">{categoryId ? <ExpenseCategoryIcon category={category ?? { id: categoryId }} /> : null}</span>
                      <span className="finance-expense-copy finance-trip-expense-copy"><strong>{receiptExpenseTitle(receipt)}</strong><small>{secondary}</small></span>
                      <span className="finance-expense-total finance-trip-expense-total">
                        {receiptOriginalAmount(receipt) ? <>
                          <strong>{receiptOriginalAmount(receipt)}</strong>
                          <small>{formatMoneyMinor(receipt.totalMinor)}</small>
                        </> : <strong>{formatMoneyMinor(receipt.totalMinor)}</strong>}
                      </span>
                      <span className="finance-expense-arrow" aria-hidden="true">›</span>
                    </button>;
                  })}
                </div>
              </section>
            ) : (
              <section className="panel finance-trip-empty"><h2>Dodaj pierwszy wydatek</h2><p>Wyjazd jest już zapisany. Wszystko dodane z tego widoku trafi do „{activeTripName}”.</p><div><button type="button" className="button button-primary" onClick={openQuickExpense}>+ Wydatek</button></div>{activeTripDefinition ? <button type="button" className="text-button finance-trip-delete-empty" disabled={busy} onClick={() => void deleteEmptyActiveTrip()}>Usuń pusty wyjazd</button> : null}</section>
            )}
          </div>
        ) : (
          <section className="panel finance-trips-overview" aria-label="Wyjazdy">
            <div className="finance-trips-heading">
              <h2>Wyjazdy</h2>
              <div className="finance-trips-heading-actions">
                <span>{tripSummaries.length} {polishCountLabel(tripSummaries.length, 'wyjazd', 'wyjazdy', 'wyjazdów')}</span>
                {!newTripOpen && tripSummaries.length ? <button type="button" className="button button-secondary button-small finance-new-trip-header-button" onClick={() => { clearFeedback(); setNewTripOpen(true); }}>+ Wyjazd</button> : null}
              </div>
            </div>
            {newTripOpen ? <form className="finance-new-trip-form" onSubmit={createTrip}><label className="field"><span>Nazwa wyjazdu</span><input data-modal-autofocus="true" value={newTripName} onChange={(event) => setNewTripName(event.target.value)} placeholder="Np. Budapeszt" autoFocus /></label><label className="field finance-new-trip-currency"><span>Waluta</span><select value={newTripCurrency} onChange={(event) => setNewTripCurrency(event.target.value as FinanceCurrencyCode)}>{FINANCE_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label><div><button type="button" className="button button-secondary" onClick={() => { setNewTripOpen(false); setNewTripName(''); setNewTripCurrency('PLN'); }}>Anuluj</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Zapisywanie...' : 'Utwórz'}</button></div></form> : null}
            {tripSummaries.length ? <div className="finance-trip-card-list">{tripSummaries.map((trip) => <button type="button" className="finance-trip-card" key={tripIdentity(trip.name)} onClick={() => selectTrip(trip.name)}><span><strong>{trip.name}</strong><small>{trip.receipts.length && trip.firstDate && trip.lastDate ? `${formatTripDateRange(trip.firstDate, trip.lastDate)} · ${trip.receipts.length} ${polishCountLabel(trip.receipts.length, 'wydatek', 'wydatki', 'wydatków')} · ${trip.currency ?? 'PLN'}` : `Brak wydatków · ${trip.currency ?? 'PLN'}`}</small></span><strong>{formatMoneyMinor(trip.totalMinor)}</strong><span aria-hidden="true">›</span></button>)}</div> : !newTripOpen ? <div className="finance-trip-empty-list"><h2>Brak wyjazdów</h2><p>Utwórz pierwszy wyjazd, a jego wydatki będą zebrane w jednym miejscu.</p><button type="button" className="button button-primary button-small" onClick={() => { clearFeedback(); setNewTripOpen(true); }}>+ Wyjazd</button></div> : null}
          </section>
        )
      ) : monthSummary.receiptCount === 0 ? (
        <div className="finance-month-empty-view">
          <section className="panel finance-overview-summary-card finance-month-summary-compact" aria-label="Podsumowanie pustego miesiąca">
            <div className="finance-overview-summary-main finance-month-summary-main">
              <div className="finance-overview-summary-copy finance-month-summary-copy">
                <span className="section-kicker">Miesiąc</span>
                <h2>{formatMonthLabel(monthKey)}</h2>
                <div className="finance-overview-summary-meta"><span>Brak wydatków</span></div>
              </div>
              <div className="finance-overview-summary-total"><strong>{formatMoneyMinor(0)}</strong></div>
            </div>
          </section>
          <section className="panel finance-trip-empty finance-month-empty" aria-label="Brak wydatków w wybranym miesiącu">
            <h2>Dodaj pierwszy wydatek</h2>
            <p>Po zapisie pojawią się tutaj podsumowanie, kategorie i lista wydatków.</p>
            <div><button type="button" className="button button-primary" onClick={openQuickExpense}>+ Wydatek</button></div>
          </section>
        </div>
      ) : (
        <>
          <section className="panel finance-overview-summary-card finance-month-summary-compact" aria-label="Podsumowanie miesiąca">
            <div className="finance-overview-summary-main finance-month-summary-main">
              <div className="finance-overview-summary-copy finance-month-summary-copy">
                <span className="section-kicker">Miesiąc</span>
                <h2>{formatMonthLabel(monthKey)}</h2>
                <div className="finance-overview-summary-meta finance-month-summary-meta" aria-label="Skróty podsumowania miesiąca">
                  <span>{monthReceipts.length} {polishCountLabel(monthReceipts.length, 'wydatek', 'wydatki', 'wydatków')}</span>
                  <button type="button" className={activeNecessity === 'essential' ? 'is-active' : ''} onClick={() => filterByNecessity('essential')} aria-pressed={activeNecessity === 'essential'}>
                    Niezbędne <strong>{formatMoneyMinor(necessityTotals.essential)}</strong>
                  </button>
                  <button type="button" className={activeNecessity === 'nonessential' ? 'is-active' : ''} onClick={() => filterByNecessity('nonessential')} aria-pressed={activeNecessity === 'nonessential'}>
                    Zbędne <strong>{formatMoneyMinor(necessityTotals.nonessential)}</strong>
                  </button>
                  <button type="button" className={`${reviewOnly ? 'is-active ' : ''}${reviewPurchaseRows.length ? 'has-review' : ''}`.trim()} onClick={reviewPurchaseRows.length ? showReviewPurchases : showAllPurchases} aria-pressed={reviewOnly}>
                    Do poprawy <strong>{reviewPurchaseRows.length}</strong>
                  </button>
                </div>
              </div>
              <button type="button" className="finance-overview-summary-total finance-month-summary-total" onClick={showTransactions} aria-label="Pokaż wszystkie transakcje miesiąca">
                <strong>{formatMoneyMinor(monthSummary.totalMinor)}</strong>
                <small>{comparison.state === 'comparable' ? `${comparison.differenceMinor > 0 ? '+' : comparison.differenceMinor < 0 ? '-' : ''}${formatMoneyMinor(Math.abs(comparison.differenceMinor))} vs poprzedni miesiąc` : comparisonText.detail}</small>
              </button>
            </div>
            <div className="finance-overview-category-strip finance-month-category-chips" aria-label="Najważniejsze kategorie miesiąca">
              <button type="button" className="finance-overview-category-manage finance-month-category-all" onClick={openCategoryOverview}>Kategorie</button>
              {categoryAnalytics.slice(0, 4).map((entry) => (
                <button
                  type="button"
                  className={`finance-overview-category-chip finance-month-category-chip${activeCategoryId === entry.categoryId ? ' is-active' : ''}`}
                  key={entry.categoryId}
                  onClick={() => filterByCategory(entry.categoryId)}
                  aria-pressed={activeCategoryId === entry.categoryId}
                >
                  <ExpenseCategoryIcon category={categories.find((category) => category.id === entry.categoryId) ?? { id: entry.categoryId }} />
                  <span>{entry.name}</span>
                  <strong>{formatMoneyMinor(entry.totalMinor)}</strong>
                </button>
              ))}
            </div>
          </section>

          <section ref={purchasesRef} className="panel finance-expense-list-card finance-purchases-section" aria-labelledby="finance-purchases-heading">
            <div className="finance-section-heading finance-section-heading-row finance-core-section-heading finance-expense-list-heading finance-expense-section-heading">
              <div>
                <h2 id="finance-purchases-heading">Wydatki</h2>
              </div>
              <div className="finance-expense-heading-tools">
                <div className="finance-expense-mode-switch" role="group" aria-label="Sposób wyświetlania wydatków">
                  <button type="button" className={expenseListMode === 'TRANSACTIONS' ? 'is-active' : ''} aria-pressed={expenseListMode === 'TRANSACTIONS'} onClick={showTransactions}>Transakcje</button>
                  <button type="button" className={expenseListMode === 'ITEMS' ? 'is-active' : ''} aria-pressed={expenseListMode === 'ITEMS'} onClick={() => setExpenseListMode('ITEMS')}>Pozycje</button>
                </div>
                <span>{expenseListMode === 'TRANSACTIONS' ? `${monthReceipts.length} ${polishCountLabel(monthReceipts.length, 'transakcja', 'transakcje', 'transakcji')}` : hasTableFilters ? `${filteredPurchaseRows.length} ${polishCountLabel(filteredPurchaseRows.length, 'wynik', 'wyniki', 'wyników')}` : `${monthPurchaseRows.length} ${polishCountLabel(monthPurchaseRows.length, 'pozycja', 'pozycje', 'pozycji')}`}</span>
              </div>
            </div>

            {expenseListMode === 'TRANSACTIONS' ? (
              <div className="finance-expense-list finance-month-transaction-list" aria-label="Transakcje w wybranym miesiącu">
                {monthReceipts.map((receipt) => {
                  const firstItem = receipt.items[0];
                  const firstProduct = firstItem ? productByKey.get(normalizeExpenseProductKey(firstItem.name)) : undefined;
                  const categoryId = firstItem ? firstProduct?.categoryId ?? firstItem.categoryId : '';
                  const category = categoryId ? categories.find((entry) => entry.id === categoryId) : undefined;
                  const categoryLabel = categoryId ? expenseCategoryPath(categories, categoryId) : '';
                  const secondary = [receipt.tripName, formatExpenseMerchantDisplayName(receipt.merchant), categoryLabel].filter(Boolean).join(' · ');
                  return <button type="button" key={receipt.id} className="finance-expense-row finance-month-transaction-row" onClick={() => setDetailReceipt(receipt)}>
                    <span className="finance-expense-date finance-month-transaction-date">{formatShortDate(receipt.date)}</span>
                    <span className="finance-expense-icon finance-month-transaction-icon">{categoryId ? <ExpenseCategoryIcon category={category ?? { id: categoryId }} /> : null}</span>
                    <span className="finance-expense-copy finance-month-transaction-copy">
                      <strong>{receiptExpenseTitle(receipt)}</strong>
                      <small>{secondary}</small>
                    </span>
                    <span className="finance-expense-total finance-month-transaction-total">
                      {receiptOriginalAmount(receipt) ? <>
                        <strong>{receiptOriginalAmount(receipt)}</strong>
                        <small>{formatMoneyMinor(receipt.totalMinor)}</small>
                      </> : <strong>{formatMoneyMinor(receipt.totalMinor)}</strong>}
                    </span>
                    <span className="finance-expense-arrow finance-month-transaction-arrow" aria-hidden="true">›</span>
                  </button>;
                })}
              </div>
            ) : (
              <>
                {reviewPurchaseRows.length ? (
                  <div className="finance-review-strip" role="status">
                    <div>
                      <strong>Do poprawy: {reviewPurchaseRows.length} {polishCountLabel(reviewPurchaseRows.length, 'pozycja', 'pozycje', 'pozycji')}</strong>
                      <span>{otherReviewCount} {polishCountLabel(otherReviewCount, 'pozycja', 'pozycje', 'pozycji')} w Inne · {unknownReviewCount} do oceny · {formatMoneyMinor(reviewTotalMinor)}</span>
                    </div>
                    <button type="button" className="text-button" onClick={showReviewPurchases}>Przejrzyj</button>
                  </div>
                ) : null}

                <div className="finance-purchase-tools finance-purchase-tools-compact">
                  <label className="finance-purchase-search">
                    <span className="visually-hidden">Szukaj</span>
                    <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Szukaj nazwy, miejsca lub kategorii" />
                  </label>
                  <button type="button" className={`button button-secondary button-small${filtersOpen ? ' is-active' : ''}`} onClick={() => setFiltersOpen((current) => !current)}>Filtry</button>
                </div>

                <div className="finance-quick-filters" role="toolbar" aria-label="Szybkie filtry wydatków">
                  <button type="button" className={!hasTableFilters ? 'is-active' : ''} aria-pressed={!hasTableFilters} onClick={showAllPurchases}>Wszystkie</button>
                  <button type="button" className={reviewOnly ? 'is-active is-review' : 'is-review'} aria-pressed={reviewOnly} onClick={showReviewPurchases}>Do poprawy <span>{reviewPurchaseRows.length}</span></button>
                  {otherCategoryId ? <button type="button" className={activeCategoryId === otherCategoryId ? 'is-active' : ''} aria-pressed={activeCategoryId === otherCategoryId} onClick={() => filterByCategory(otherCategoryId)}>Inne <span>{otherReviewCount}</span></button> : null}
                  <button type="button" className={activeNecessity === 'essential' ? 'is-active' : ''} aria-pressed={activeNecessity === 'essential'} onClick={() => filterByNecessity('essential')}>Niezbędne</button>
                  <button type="button" className={activeNecessity === 'nonessential' ? 'is-active' : ''} aria-pressed={activeNecessity === 'nonessential'} onClick={() => filterByNecessity('nonessential')}>Zbędne</button>
                  {activeCategoryId && activeCategoryId !== otherCategoryId ? (
                    <button type="button" className="is-active finance-filter-chip-dynamic" onClick={() => setActiveCategoryId('')}>{expenseCategoryPath(categories, activeCategoryId)} ×</button>
                  ) : null}
                  {activeNecessity === 'unknown' ? (
                    <button type="button" className="is-active finance-filter-chip-dynamic" onClick={() => setActiveNecessity('')}>Do oceny ×</button>
                  ) : null}
                </div>

                {filtersOpen ? (
                  <div className="finance-purchase-filter-panel">
                    <label className="field">
                      <span>Kategoria</span>
                      <select value={activeCategoryId} onChange={(event) => { setReviewOnly(false); setActiveCategoryId(event.target.value); }}>
                        <option value="">Wszystkie kategorie</option>
                        <CategoryOptions categories={categories} />
                      </select>
                    </label>
                    <label className="field">
                      <span>Typ</span>
                      <select value={activeNecessity} onChange={(event) => { setReviewOnly(false); setActiveNecessity(event.target.value as ExpenseNecessity | ''); }}>
                        <option value="">Wszystkie</option>
                        <option value="essential">Niezbędne</option>
                        <option value="nonessential">Zbędne</option>
                        <option value="unknown">Do oceny</option>
                      </select>
                    </label>
                    {hasTableFilters ? <button type="button" className="text-button" onClick={() => clearPurchaseFilters(true)}>Wyczyść</button> : null}
                  </div>
                ) : null}

                {bulkReviewMode && filteredPurchaseRows.length ? (
                  <div className="finance-bulk-review-bar">
                    <label className="finance-bulk-review-select-all">
                      <input type="checkbox" checked={allVisiblePurchaseRowsSelected} onChange={toggleAllVisiblePurchaseRows} />
                      <span>Zaznacz widoczne</span>
                    </label>
                    <span>{selectedPurchaseRows.length ? `${selectedPurchaseRows.length} zaznaczono` : 'Możesz poprawić kilka pozycji naraz'}</span>
                    <select value={bulkCategoryId} onChange={(event) => setBulkCategoryId(event.target.value)} aria-label="Kategoria dla zaznaczonych pozycji">
                      <option value="">Ustaw kategorię...</option>
                      <CategoryOptions categories={categories} />
                    </select>
                    <button type="button" className="button button-primary button-small" disabled={busy || !bulkCategoryId || !selectedPurchaseRows.length} onClick={() => void applyBulkCategory()}>Przypisz</button>
                  </div>
                ) : null}

                {filteredPurchaseRows.length ? (
                  <div className="finance-purchase-table-wrap">
                    <table className={`finance-purchase-table${hasQuantityData ? ' has-quantity' : ''}`}>
                      <thead>
                        <tr>
                          <th>
                            {bulkReviewMode ? (
                              <label className="finance-table-select-all">
                                <input type="checkbox" checked={allVisiblePurchaseRowsSelected} onChange={toggleAllVisiblePurchaseRows} />
                                <span>Produkt</span>
                              </label>
                            ) : 'Produkt'}
                          </th>
                          <th>Kategoria</th>
                          <th>Typ</th>
                          <th>Sklep</th>
                          {hasQuantityData ? <th className="finance-purchase-unit-column">Ilość × cena</th> : null}
                          <th className="finance-purchase-date-column">Data</th>
                          <th className="finance-purchase-money-column">Kwota</th>
                          <th><span className="visually-hidden">Szczegóły</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPurchaseRows.map((row) => (
                          <tr key={row.key} className={(otherCategoryId && row.effectiveCategoryId === otherCategoryId) || row.necessity === 'unknown' ? 'is-review-row' : undefined}>
                            <td>
                              <div className="finance-purchase-product-cell">
                                {bulkReviewMode ? (
                                  <input
                                    type="checkbox"
                                    checked={selectedPurchaseKeys.has(row.key)}
                                    onChange={() => togglePurchaseSelection(row.key)}
                                    aria-label={`Zaznacz: ${row.canonicalName}`}
                                  />
                                ) : null}
                                {row.productAnalytics ? (
                                  <button type="button" className="finance-purchase-product-button" onClick={() => openProductEditor(row.productAnalytics!)}>{formatExpenseProductDisplayName(row.canonicalName)}</button>
                                ) : <strong>{formatExpenseProductDisplayName(row.canonicalName)}</strong>}
                              </div>
                            </td>
                            <td>
                              <select
                                className={`finance-category-select${otherCategoryId && row.effectiveCategoryId === otherCategoryId ? ' is-review' : ''}`}
                                value={row.effectiveCategoryId}
                                aria-label={`Kategoria: ${row.canonicalName}`}
                                onChange={(event) => void changePurchaseCategory(row.receipt.id, row.item.id, event.target.value)}
                              >
                                <CategoryOptions categories={categories} />
                              </select>
                            </td>
                            <td>
                              {row.product ? (
                                <select
                                  className={`finance-necessity-select is-${row.necessity}${row.necessity === 'unknown' ? ' is-review' : ''}`}
                                  value={row.necessity}
                                  aria-label={`Typ wydatku: ${row.canonicalName}`}
                                  onChange={(event) => void changeProductNecessity(row.product!, event.target.value as ExpenseNecessity)}
                                >
                                  <option value="essential">Niezbędne</option>
                                  <option value="nonessential">Zbędne</option>
                                  <option value="unknown">Do oceny</option>
                                </select>
                              ) : <span>{expenseNecessityLabel(row.necessity)}</span>}
                            </td>
                            <td title={row.receipt.merchant}>{formatExpenseMerchantDisplayName(row.receipt.merchant)}</td>
                            {hasQuantityData ? <td className="finance-purchase-unit-column">{receiptUnitDetails(row.item) || '—'}</td> : null}
                            <td className="finance-purchase-date-column">{formatDate(row.receipt.date)}</td>
                            <td className="finance-purchase-money-column"><strong>{formatMoneyMinor(row.item.amountMinor)}</strong></td>
                            <td className="finance-purchase-details-column">
                              <button type="button" className="icon-button" aria-label={`Szczegóły: ${row.receipt.merchant}, ${row.canonicalName}`} onClick={() => setDetailReceipt(row.receipt)}>›</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="finance-empty-state">
                    <strong>Brak wydatków pasujących do wyszukiwania.</strong>
                    {hasTableFilters ? <button type="button" className="text-button" onClick={() => clearPurchaseFilters(true)}>Wyczyść filtry</button> : null}
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      {receiptScanOpen ? (
        <ReceiptScanFlow
          categories={categories}
          products={products}
          receipts={receipts}
          onSave={saveScannedReceipt}
          onClose={() => setReceiptScanOpen(false)}
          onManualAdd={openQuickExpense}
          {...(financeScope === 'TRIPS' && normalizeTripName(activeTripName) ? { tripName: normalizeTripName(activeTripName), displayCurrency: tripCurrency(activeTripDefinition) } : {})}
        />
      ) : null}

      {tripCurrencyEdit ? (
        <Modal title="Waluta wyjazdu" onClose={() => !busy && setTripCurrencyEdit(null)}>
          <form className="finance-trip-currency-form" onSubmit={(event) => void saveTripCurrencySettings(event)}>
            {error ? <div className="study-message error-message finance-form-message" role="alert">{error}</div> : null}
            <label className="field">
              <span>Domyślna waluta</span>
              <select value={tripCurrencyEdit} onChange={(event) => setTripCurrencyEdit(event.target.value as FinanceCurrencyCode)}>
                {FINANCE_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </label>
            {tripCurrencyEdit !== 'PLN' ? <div className="finance-trip-currency-auto-note">Przy dodawaniu wydatku aplikacja użyje lokalnego kursu orientacyjnego zapisanego w aplikacji.</div> : null}
            <div className="modal-actions split-actions">
              <button type="button" className="button button-secondary" onClick={() => setTripCurrencyEdit(null)} disabled={busy}>Anuluj</button>
              <button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Zapisywanie...' : 'Zapisz'}</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {quickExpense ? (
        <FinanceQuickExpenseModal
          form={quickExpense}
          categoryOptions={<CategoryOptions categories={categories} />}
          {...(financeScope === 'TRIPS' && activeTripName ? { tripName: activeTripName } : {})}
          showCurrencySelect={Boolean(financeScope === 'TRIPS' && activeTripName)}
          busy={busy}
          error={error}
          conversionRatePlnPerUnit={activeTripFixedRate ?? automaticRate?.ratePlnPerUnit ?? null}
          automaticRateStatus={automaticRateStatus}
          onChange={(patch) => setQuickExpense((current) => current ? { ...current, ...patch } : current)}
          onClose={() => setQuickExpense(null)}
          onSubmit={(event) => void saveQuickExpense(event)}
        />
      ) : null}


      {detailReceipt ? (
        <Modal title={detailReceipt.merchant} onClose={() => setDetailReceipt(null)}>
          <div className="finance-transaction-detail">
            <div className="finance-transaction-detail-meta">
              <div>
                <span>{formatDate(detailReceipt.date)}</span>
                <small>{receiptSourceLabel(detailReceipt)}{detailReceipt.tripName ? ` · ${detailReceipt.tripName}` : ''}</small>
              </div>
              <div className="finance-transaction-detail-total">
                {receiptOriginalAmount(detailReceipt) ? <>
                  <strong>{receiptOriginalAmount(detailReceipt)}</strong>
                  <span>{formatMoneyMinor(detailReceipt.totalMinor)}</span>
                </> : <strong>{formatMoneyMinor(detailReceipt.totalMinor)}</strong>}
              </div>
            </div>
            {detailReceipt.originalCurrency && detailReceipt.exchangeRatePlnPerUnit ? <div className="finance-currency-detail">
              <span>{detailReceipt.conversionSource === 'actual' ? 'Faktyczne obciążenie karty' : 'Przeliczenie według kursu'}</span>
              <strong>{formatExchangeRate(detailReceipt.exchangeRatePlnPerUnit, detailReceipt.originalCurrency)}</strong>
            </div> : null}
            <div className="finance-transaction-detail-items">
              {detailReceipt.items.map((item) => (
                <div key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{expenseCategoryPath(categories, item.categoryId)}</span>
                    {receiptUnitDetails(item) ? <small>{receiptUnitDetails(item)}</small> : null}
                  </div>
                  <strong>{formatMoneyMinor(item.amountMinor)}</strong>
                </div>
              ))}
            </div>
            <div className="modal-actions split-actions finance-detail-actions">
              <button type="button" className="button button-danger-ghost" disabled={busy} onClick={() => void removeReceipt(detailReceipt)}>Usuń</button>
              <div>
                <button type="button" className="button button-secondary" onClick={() => setDetailReceipt(null)}>Zamknij</button>
                <button type="button" className="button button-primary" onClick={() => openReceiptEditor(detailReceipt)}>Edytuj</button>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}

      {editReceipt ? (
        <Modal
          title="Edytuj transakcję"
          wide
          onClose={() => !busy && setEditReceipt(null)}
          headerActions={<button type="submit" form="finance-receipt-edit-form" className="button button-primary modal-mobile-header-save" disabled={busy}>{busy ? 'Zapisuję...' : 'Zapisz'}</button>}
        >
          <form id="finance-receipt-edit-form" className="finance-receipt-edit-form" onSubmit={(event) => void saveReceiptEdit(event)}>
            {error ? <div className="study-message error-message finance-form-message" role="alert">{error}</div> : null}
            <div className="finance-receipt-edit-head">
              <label className="field">
                <span>Miejsce / odbiorca</span>
                <input data-modal-autofocus="true" value={editReceipt.merchant} onChange={(event) => setEditReceipt((current) => current ? { ...current, merchant: event.target.value } : current)} />
              </label>
              <label className="field">
                <span>Data</span>
                <input type="date" value={editReceipt.date} onChange={(event) => setEditReceipt((current) => current ? { ...current, date: event.target.value } : current)} />
              </label>
              <label className="field">
                <span>Wyjazd <small>opcjonalnie</small></span>
                <input list="finance-trip-suggestions" value={editReceipt.tripName ?? ''} onChange={(event) => setEditReceipt((current) => current ? { ...current, tripName: event.target.value } : current)} placeholder="Np. Budapeszt" />
                <datalist id="finance-trip-suggestions">{tripSummaries.map((trip) => <option key={tripIdentity(trip.name)} value={trip.name} />)}</datalist>
              </label>
            </div>
            <div className="finance-receipt-edit-source">Źródło: <strong>{receiptSourceLabel(editReceipt)}</strong></div>
            <div className="finance-receipt-edit-items">
              {editReceipt.items.map((item, index) => (
                <div className="finance-receipt-edit-item" key={item.id ?? `new-${index}`}>
                  <label className="field finance-receipt-edit-name">
                    <span>Pozycja {index + 1}</span>
                    <input value={item.name} onChange={(event) => updateEditItem(index, { name: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Kategoria</span>
                    <select value={item.categoryId} onChange={(event) => updateEditItem(index, { categoryId: event.target.value })}>
                      <CategoryOptions categories={categories} />
                    </select>
                  </label>
                  <label className="field finance-receipt-edit-amount">
                    <span>Kwota</span>
                    <input inputMode="decimal" value={item.amountText} onChange={(event) => updateEditItem(index, { amountText: event.target.value })} />
                  </label>
                  <button type="button" className="icon-button finance-receipt-item-remove" disabled={busy || editReceipt.items.length <= 1} onClick={() => removeEditItem(index)} aria-label={`Usuń pozycję ${index + 1}`}>×</button>
                </div>
              ))}
            </div>
            <button type="button" className="button button-secondary button-small finance-add-item" onClick={addEditItem} disabled={busy}>+ Dodaj pozycję</button>
            <div className="modal-actions split-actions">
              <button type="button" className="button button-secondary" onClick={() => setEditReceipt(null)} disabled={busy}>Anuluj</button>
              <button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Zapisywanie...' : 'Zapisz zmiany'}</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {editProduct && editedProductAnalytics ? (
        <Modal
          title="Produkt"
          wide
          onClose={() => !busy && setEditProduct(null)}
          headerActions={<button type="submit" form="finance-product-editor-form" className="button button-primary modal-mobile-header-save" disabled={busy}>{busy ? 'Zapisuję...' : 'Zapisz'}</button>}
        >
          <form id="finance-product-editor-form" className="finance-product-editor" onSubmit={(event) => void saveProduct(event)}>
            {error ? <div className="study-message error-message finance-form-message" role="alert">{error}</div> : null}
            <div className="finance-product-editor-fields">
              <label className="field">
                <span>Nazwa ujednolicona</span>
                <input data-modal-autofocus="true" value={editProduct.name} onChange={(event) => setEditProduct((current) => current ? { ...current, name: event.target.value } : current)} />
              </label>
              <label className="field">
                <span>Domyślna kategoria</span>
                <select value={editProduct.categoryId} onChange={(event) => setEditProduct((current) => current ? { ...current, categoryId: event.target.value } : current)}>
                  <CategoryOptions categories={categories} />
                </select>
              </label>
              <label className="field">
                <span>Typ wydatku</span>
                <select value={editProduct.necessity} onChange={(event) => setEditProduct((current) => current ? { ...current, necessity: event.target.value as ExpenseNecessity } : current)}>
                  <option value="essential">Niezbędne</option>
                  <option value="nonessential">Zbędne</option>
                  <option value="unknown">Do oceny</option>
                </select>
              </label>
            </div>
            <div className="finance-product-original">
              <span>Oryginalna nazwa z historii</span>
              <strong>{editedProductAnalytics.product.originalName}</strong>
              <small>Zmiana nazwy ujednoliconej nie nadpisuje oryginalnych nazw zapisanych na paragonach.</small>
            </div>
            <div className="finance-product-stats">
              <div><span>Wystąpienia</span><strong>{editedProductAnalytics.occurrenceCount}</strong></div>
              <div><span>Wydano łącznie</span><strong>{formatMoneyMinor(editedProductAnalytics.totalMinor)}</strong></div>
              <div><span>Średnia wartość pozycji</span><strong>{formatMoneyMinor(editedProductAnalytics.averageMinor)}</strong></div>
              <div><span>Zakres wartości</span><strong>{formatMoneyMinor(editedProductAnalytics.minimumMinor)} - {formatMoneyMinor(editedProductAnalytics.maximumMinor)}</strong></div>
            </div>
            {editedProductPriceSummary && editedProductPriceSummary.latest.unitPriceMinor !== undefined ? (
              <div className="finance-product-price-snapshot">
                <div className="finance-product-price-heading">
                  <strong>Cena jednostkowa</strong>
                  <span>Porównanie tylko dla {receiptItemUnitLabel(editedProductPriceSummary.unit)}</span>
                </div>
                <div className="finance-product-price-cells">
                  <div>
                    <span>Ostatnia</span>
                    <strong>{formatUnitPrice(editedProductPriceSummary.latest.unitPriceMinor, editedProductPriceSummary.unit)}</strong>
                    <small>{formatDate(editedProductPriceSummary.latest.date)} · {editedProductPriceSummary.latest.merchant}</small>
                  </div>
                  {editedProductPriceChange ? (
                    <div>
                      <span>Zmiana</span>
                      <strong>{editedProductPriceChange.value}</strong>
                      <small>{editedProductPriceChange.detail}</small>
                    </div>
                  ) : null}
                  {editedProductPriceSummary.occurrenceCount > 1 && editedProductPriceSummary.lowest.unitPriceMinor !== undefined ? (
                    <div>
                      <span>Najniżej zapisane</span>
                      <strong>{formatUnitPrice(editedProductPriceSummary.lowest.unitPriceMinor, editedProductPriceSummary.unit)}</strong>
                      <small>{editedProductPriceSummary.lowest.merchant} · {formatDate(editedProductPriceSummary.lowest.date)}</small>
                    </div>
                  ) : (
                    <div className="finance-product-price-waiting">
                      <span>Porównanie</span>
                      <strong>Po kolejnym zakupie</strong>
                      <small>Nie dokładamy sztucznej analizy z jednego odczytu.</small>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
            <p className="finance-product-value-note">Kwota główna nadal oznacza wartość całej pozycji. Historia ceny pojawia się automatycznie tylko tam, gdzie paragon podał pewną jednostkę i cenę jednostkową.</p>
            <div className="finance-product-history">
              <div className="finance-product-history-heading">
                <strong>Historia zakupu</strong>
                <span>{editedProductAnalytics.merchantCount} {editedProductAnalytics.merchantCount === 1 ? 'miejsce' : 'miejsc'}</span>
              </div>
              {editedProductAnalytics.occurrences.slice(0, 20).map((occurrence) => (
                <div className="finance-product-history-row" key={`${occurrence.receiptId}-${occurrence.itemId}`}>
                  <span>{formatDate(occurrence.date)}</span>
                  <div><strong>{occurrence.merchant}</strong><small>{occurrence.rawName}{receiptUnitDetails(occurrence) ? ` · ${receiptUnitDetails(occurrence)}` : ''}</small></div>
                  <strong>{formatMoneyMinor(occurrence.amountMinor)}</strong>
                </div>
              ))}
            </div>
            <div className="modal-actions split-actions">
              <button type="button" className="button button-secondary" onClick={() => setEditProduct(null)} disabled={busy}>Anuluj</button>
              <button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Zapisywanie...' : 'Zapisz produkt'}</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {showCategoryManager ? (
        <Modal title="Kategorie" onClose={() => !busy && setShowCategoryManager(false)}>
          <div className="finance-category-manager finance-category-manager-simple">
            {error ? <div className="study-message error-message" role="alert">{error}</div> : null}

            {!categoryEditMode ? (
              <>
                <div className="finance-category-overview-intro">
                  <div>
                    <strong>{formatMonthLabel(monthKey)}</strong>
                    <span>{formatMoneyMinor(monthSummary.totalMinor)} łącznie</span>
                  </div>
                  <p>Kliknij kategorię, żeby od razu zobaczyć jej wydatki i szybko poprawić przypisania.</p>
                </div>
                <div className="finance-category-overview-list">
                  {categoryOverviewRows.map((entry) => (
                    <button
                      type="button"
                      className={`finance-category-overview-row${entry.isOther && entry.totalMinor > 0 ? ' is-review' : ''}`}
                      key={entry.category.id}
                      onClick={() => showCategoryPurchases(entry.category.id)}
                    >
                      <span className="finance-category-overview-name">
                        <ExpenseCategoryIcon category={entry.category} />
                        <span>
                          <strong>{entry.category.name}</strong>
                          <small>
                            {entry.itemCount ? `${entry.itemCount} ${polishCountLabel(entry.itemCount, 'pozycja', 'pozycje', 'pozycji')}` : 'Brak wydatków'}
                            {entry.isOther && entry.itemCount ? ' · do przejrzenia' : ''}
                          </small>
                        </span>
                      </span>
                      <span className="finance-category-overview-value">
                        <strong>{formatMoneyMinor(entry.totalMinor)}</strong>
                        {entry.totalMinor > 0 ? <small>{entry.sharePercent.toFixed(1).replace('.', ',')}%</small> : null}
                      </span>
                      <span className="finance-category-overview-arrow" aria-hidden="true">›</span>
                    </button>
                  ))}
                </div>
                <div className="modal-actions split-actions">
                  <button type="button" className="button button-secondary" onClick={() => setCategoryEditMode(true)}>Zarządzaj kategoriami</button>
                  <button type="button" className="button button-primary" onClick={() => setShowCategoryManager(false)}>Gotowe</button>
                </div>
              </>
            ) : (
              <>
                <div className="finance-category-edit-heading">
                  <button type="button" className="text-button" onClick={() => { setCategoryEditMode(false); cancelCategoryEdit(); setExpandedCategoryId(null); }}>‹ Podgląd kategorii</button>
                  <span>Zmiany nazw i nowych kategorii są potrzebne tylko od czasu do czasu.</span>
                </div>
                <form className="finance-category-add-form finance-category-add-form-simple" onSubmit={(event) => void addCategory(event)}>
                  <label className="field">
                    <span>Nowa kategoria</span>
                    <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Np. Zwierzęta" />
                  </label>
                  <button type="submit" className="button button-primary" disabled={busy}>Dodaj</button>
                </form>

                <div className="finance-category-simple-list">
                  {rootCategories.map((category) => {
                    const children = expenseCategoryChildren(categories, category.id);
                    const expanded = expandedCategoryId === category.id;
                    const editing = editingCategoryId === category.id;
                    return (
                      <div className="finance-category-simple-group" key={category.id}>
                        <div className="finance-category-simple-row">
                          {editing ? (
                            <label className="field finance-category-simple-edit">
                              <span>Nazwa kategorii</span>
                              <input value={editingCategoryName} onChange={(event) => setEditingCategoryName(event.target.value)} />
                            </label>
                          ) : (
                            <div className="finance-category-simple-name">
                              <strong>{category.name}</strong>
                              <span>{children.length ? `${children.length} ${polishCountLabel(children.length, 'podkategoria', 'podkategorie', 'podkategorii')}` : 'Kategoria główna'}</span>
                            </div>
                          )}
                          <div className="finance-category-simple-actions">
                            {editing ? (
                              <>
                                <button type="button" className="button button-primary button-small" disabled={busy} onClick={() => void saveCategory(category)}>Zapisz</button>
                                <button type="button" className="text-button" disabled={busy} onClick={cancelCategoryEdit}>Anuluj</button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="text-button"
                                  onClick={() => {
                                    setExpandedCategoryId((current) => current === category.id ? null : category.id);
                                    setNewSubcategoryName('');
                                  }}
                                >
                                  {expanded ? 'Zwiń podkategorie' : children.length ? `Podkategorie (${children.length})` : '+ Podkategoria'}
                                </button>
                                <button type="button" className="text-button" disabled={busy} onClick={() => startCategoryEdit(category)}>Edytuj</button>
                                <button type="button" className="text-button danger-text" disabled={busy} onClick={() => void removeCategory(category)}>Usuń</button>
                              </>
                            )}
                          </div>
                        </div>

                        {expanded ? (
                          <div className="finance-subcategory-manager">
                            {children.length ? (
                              <div className="finance-subcategory-manager-list">
                                {children.map((child) => {
                                  const childEditing = editingCategoryId === child.id;
                                  return (
                                    <div className="finance-subcategory-manager-row" key={child.id}>
                                      {childEditing ? (
                                        <label className="field finance-category-simple-edit">
                                          <span>Nazwa podkategorii</span>
                                          <input value={editingCategoryName} onChange={(event) => setEditingCategoryName(event.target.value)} />
                                        </label>
                                      ) : <strong>{child.name}</strong>}
                                      <div className="finance-category-simple-actions">
                                        {childEditing ? (
                                          <>
                                            <button type="button" className="button button-primary button-small" disabled={busy} onClick={() => void saveCategory(child)}>Zapisz</button>
                                            <button type="button" className="text-button" disabled={busy} onClick={cancelCategoryEdit}>Anuluj</button>
                                          </>
                                        ) : (
                                          <>
                                            <button type="button" className="text-button" disabled={busy} onClick={() => startCategoryEdit(child)}>Edytuj</button>
                                            <button type="button" className="text-button danger-text" disabled={busy} onClick={() => void removeCategory(child)}>Usuń</button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                            <form className="finance-subcategory-add-form" onSubmit={(event) => void addSubcategory(event, category.id)}>
                              <label className="field">
                                <span>Nowa podkategoria</span>
                                <input value={newSubcategoryName} onChange={(event) => setNewSubcategoryName(event.target.value)} placeholder="Opcjonalnie" />
                              </label>
                              <button type="submit" className="button button-secondary" disabled={busy}>Dodaj podkategorię</button>
                            </form>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="modal-actions">
                  <button type="button" className="button button-primary" onClick={() => { setCategoryEditMode(false); cancelCategoryEdit(); setExpandedCategoryId(null); }} disabled={busy}>Gotowe</button>
                </div>
              </>
            )}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
