import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  createExpenseCategory,
  createReceipt,
  deleteExpenseCategory,
  deleteReceipt,
  listExpenseCategories,
  listReceipts,
  restoreDeletedReceipt,
  updateExpenseCategory,
  updateReceipt,
} from '../storage/database';
import { toLocalDateKey } from '../calendar/date.utils';
import { Modal } from '../ui/Modal';
import type { ExpenseCategory, Receipt, ReceiptDraft } from './expenses.types';
import { ReceiptScanFlow } from './receipt-ocr/ReceiptScanFlow';
import { ExpenseCategoryIcon } from './ExpenseCategoryIcon';
import {
  aggregateExpensesByCategory,
  aggregateExpensesByMerchant,
  aggregateExpensesByProduct,
  compareMonthExpenses,
  formatMoneyMinor,
  filterReceiptHistory,
  formatMonthLabel,
  getMonthExpenseSummary,
  getSixMonthTrend,
  moneyMinorToInput,
  parseMoneyToMinor,
  rankProductsByFrequency,
  receiptsForMonth,
  shiftMonthKey,
  sortReceiptsNewestFirst,
} from './expenses.utils';

interface ReceiptItemForm {
  id?: string;
  name: string;
  categoryId: string;
  amountText: string;
}

interface ReceiptFormState {
  id?: string;
  merchant: string;
  date: string;
  items: ReceiptItemForm[];
}

function todayMonthKey(): string {
  return toLocalDateKey(new Date()).slice(0, 7);
}

function emptyReceiptForm(categories: ExpenseCategory[]): ReceiptFormState {
  return {
    merchant: '',
    date: toLocalDateKey(new Date()),
    items: [{ name: '', categoryId: categories[0]?.id ?? '', amountText: '' }],
  };
}

function formFromReceipt(receipt: Receipt): ReceiptFormState {
  return {
    id: receipt.id,
    merchant: receipt.merchant,
    date: receipt.date,
    items: receipt.items.map((item) => ({
      id: item.id,
      name: item.name,
      categoryId: item.categoryId,
      amountText: moneyMinorToInput(item.amountMinor),
    })),
  };
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

function formatSignedMoney(value: number): string {
  return `${value > 0 ? '+' : ''}${formatMoneyMinor(value)}`;
}

function formatSignedPercent(value: number): string {
  const normalized = Math.abs(value) < 0.05 ? 0 : value;
  return `${normalized > 0 ? '+' : ''}${normalized.toFixed(1).replace('.', ',')}%`;
}

function pluralizeReceipts(count: number): string {
  if (count === 1) return 'paragon';
  const lastTwo = count % 100;
  const last = count % 10;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? 'paragony' : 'paragonów';
}

function pluralizeItems(count: number): string {
  if (count === 1) return 'pozycja';
  const lastTwo = count % 100;
  const last = count % 10;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? 'pozycje' : 'pozycji';
}

function pluralizeEntries(count: number): string {
  if (count === 1) return 'wpis';
  const lastTwo = count % 100;
  const last = count % 10;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? 'wpisy' : 'wpisów';
}

function ExpenseTrendChart({ trend }: { trend: ReturnType<typeof getSixMonthTrend> }) {
  const [activeMonthKey, setActiveMonthKey] = useState<string | null>(null);
  const maxValue = Math.max(1, ...trend.map((point) => point.totalMinor));
  const chartBottom = 112;
  const maxBarHeight = 82;
  const barWidth = 56;
  const gap = 38;
  const startX = 24;
  const activePoint = trend.find((point) => point.monthKey === activeMonthKey) ?? null;
  const activeIndex = activePoint ? trend.findIndex((point) => point.monthKey === activePoint.monthKey) : -1;
  const activeHeight = activePoint && activePoint.totalMinor > 0 ? Math.max(4, Math.round((activePoint.totalMinor / maxValue) * maxBarHeight)) : 0;
  const activeCenterX = activeIndex >= 0 ? startX + activeIndex * (barWidth + gap) + barWidth / 2 : 0;
  const tooltipWidth = 166;
  const tooltipX = Math.max(6, Math.min(600 - tooltipWidth - 6, activeCenterX - tooltipWidth / 2));
  const tooltipY = activePoint ? Math.max(6, chartBottom - activeHeight - 42) : 0;

  function activate(monthKey: string) {
    setActiveMonthKey((current) => current === monthKey ? null : monthKey);
  }

  return (
    <>
      <div className="expense-trend-chart-wrap" onMouseLeave={() => setActiveMonthKey(null)}> 
        <svg className="expense-trend-chart" viewBox="0 0 600 148" preserveAspectRatio="xMidYMid meet" aria-label="Interaktywny wykres wydatków z ostatnich sześciu miesięcy">
          <line className="expense-chart-axis" x1="16" y1={chartBottom} x2="584" y2={chartBottom} />
          {trend.map((point, index) => {
            const height = point.totalMinor > 0 ? Math.max(4, Math.round((point.totalMinor / maxValue) * maxBarHeight)) : 0;
            const x = startX + index * (barWidth + gap);
            const y = chartBottom - height;
            const active = activeMonthKey === point.monthKey;
            return (
              <g
                key={point.monthKey}
                className={`expense-chart-point${active ? ' is-active' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`${formatMonthLabel(point.monthKey)}, wydatki ${formatMoneyMinor(point.totalMinor)}`}
                onMouseEnter={() => setActiveMonthKey(point.monthKey)}
                onFocus={() => setActiveMonthKey(point.monthKey)}
                onClick={() => activate(point.monthKey)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activate(point.monthKey);
                  }
                  if (event.key === 'Escape') setActiveMonthKey(null);
                }}
              >
                <rect className="expense-chart-hitbox" x={x - 8} y="20" width={barWidth + 16} height={chartBottom - 14} rx="12" />
                <rect className="expense-chart-bar" x={x} y={y} width={barWidth} height={height} rx="10" />
                <circle className="expense-chart-zero" cx={x + barWidth / 2} cy={chartBottom} r={point.totalMinor === 0 ? 3 : 0} />
                <text className="expense-chart-label" x={x + barWidth / 2} y="140" textAnchor="middle">{point.label}</text>
              </g>
            );
          })}
          {activePoint ? (
            <g className="expense-chart-tooltip" aria-hidden="true" pointerEvents="none">
              <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height="34" rx="9" />
              <text x={tooltipX + 10} y={tooltipY + 14}>{formatMonthLabel(activePoint.monthKey)}</text>
              <text className="expense-chart-tooltip-value" x={tooltipX + 10} y={tooltipY + 27}>{formatMoneyMinor(activePoint.totalMinor)}</text>
            </g>
          ) : null}
        </svg>
      </div>
      <ul className="expense-trend-values visually-hidden" aria-label="Wydatki w ostatnich sześciu miesiącach">
        {trend.map((point) => (
          <li key={point.monthKey}>
            <span>{formatMonthLabel(point.monthKey)}</span>
            <strong>{formatMoneyMinor(point.totalMinor)}</strong>
          </li>
        ))}
      </ul>
    </>
  );
}

export function ExpensesView() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [monthKey, setMonthKey] = useState(todayMonthKey);
  const [receiptForm, setReceiptForm] = useState<ReceiptFormState | null>(null);
  const [receiptScanOpen, setReceiptScanOpen] = useState(false);
  const [detailReceipt, setDetailReceipt] = useState<Receipt | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllReceipts, setShowAllReceipts] = useState(false);
  const [showAllMerchants, setShowAllMerchants] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [activeMerchantKey, setActiveMerchantKey] = useState('');
  const [deletedReceipt, setDeletedReceipt] = useState<{ receipt: Receipt; expiresAt: number } | null>(null);
  const historyRef = useRef<HTMLElement | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : 'Nie udało się wczytać wydatków.'));
  }, []);

  useEffect(() => {
    setShowAllCategories(false);
    setShowAllReceipts(false);
    setShowAllMerchants(false);
    setShowAllProducts(false);
  }, [monthKey]);

  useEffect(() => {
    if (!deletedReceipt) return;
    const remaining = Math.max(0, deletedReceipt.expiresAt - Date.now());
    const timer = window.setTimeout(() => {
      setDeletedReceipt((current) => current?.receipt.id === deletedReceipt.receipt.id ? null : current);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [deletedReceipt]);

  async function refresh() {
    const [nextCategories, nextReceipts] = await Promise.all([listExpenseCategories(), listReceipts()]);
    setCategories(nextCategories);
    setReceipts(nextReceipts);
    setCategoryDrafts(Object.fromEntries(nextCategories.map((category) => [category.id, category.name])));
  }

  const monthReceipts = useMemo(() => sortReceiptsNewestFirst(receiptsForMonth(receipts, monthKey)), [receipts, monthKey]);
  const monthSummary = useMemo(() => getMonthExpenseSummary(receipts, monthKey), [receipts, monthKey]);
  const comparison = useMemo(() => compareMonthExpenses(receipts, monthKey), [receipts, monthKey]);
  const trend = useMemo(() => getSixMonthTrend(receipts, monthKey), [receipts, monthKey]);
  const categoryAnalytics = useMemo(() => aggregateExpensesByCategory(receipts, categories, monthKey), [receipts, categories, monthKey]);
  const merchantAnalytics = useMemo(() => aggregateExpensesByMerchant(receipts, monthKey), [receipts, monthKey]);
  const productAnalytics = useMemo(() => aggregateExpensesByProduct(receipts, monthKey), [receipts, monthKey]);
  const frequentProducts = useMemo(() => rankProductsByFrequency(productAnalytics).slice(0, 5), [productAnalytics]);
  const filteredReceipts = useMemo(() => filterReceiptHistory(monthReceipts, {
    query: searchQuery,
    categoryId: activeCategoryId,
    merchantKey: activeMerchantKey,
  }), [monthReceipts, searchQuery, activeCategoryId, activeMerchantKey]);
  const hasReceiptFilters = Boolean(searchQuery.trim() || activeCategoryId || activeMerchantKey);
  const visibleCategories = showAllCategories ? categoryAnalytics : categoryAnalytics.slice(0, 4);
  const visibleReceipts = showAllReceipts || hasReceiptFilters ? filteredReceipts : filteredReceipts.slice(0, 3);
  const visibleMerchants = showAllMerchants ? merchantAnalytics : merchantAnalytics.slice(0, 3);
  const visibleProducts = productAnalytics.slice(0, showAllProducts ? 10 : 5);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const activeCategoryName = activeCategoryId ? categoryById.get(activeCategoryId)?.name ?? 'Kategoria' : '';
  const activeMerchantName = activeMerchantKey ? merchantAnalytics.find((merchant) => merchant.key === activeMerchantKey)?.name ?? activeMerchantKey : '';

  const receiptFormTotal = useMemo(() => {
    if (!receiptForm) return 0;
    return receiptForm.items.reduce((sum, item) => {
      const amount = parseMoneyToMinor(item.amountText);
      return sum + (amount && amount > 0 ? amount : 0);
    }, 0);
  }, [receiptForm]);

  function clearFeedback() {
    setError('');
    setMessage('');
  }

  function openNewReceipt() {
    clearFeedback();
    setReceiptScanOpen(false);
    setReceiptForm(emptyReceiptForm(categories));
  }

  function openReceiptScan() {
    clearFeedback();
    setReceiptForm(null);
    setReceiptScanOpen(true);
  }

  async function saveScannedReceipt(draft: ReceiptDraft) {
    clearFeedback();
    await createReceipt(draft);
    setReceiptScanOpen(false);
    await refresh();
    setMessage('Dodano paragon ze skanu.');
  }

  function openEditReceipt(receipt: Receipt) {
    clearFeedback();
    setDetailReceipt(null);
    setReceiptForm(formFromReceipt(receipt));
  }

  function updateFormItem(index: number, patch: Partial<ReceiptItemForm>) {
    setReceiptForm((current) => current ? {
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    } : current);
  }

  function addFormItem() {
    setReceiptForm((current) => current ? {
      ...current,
      items: [...current.items, { name: '', categoryId: categories[0]?.id ?? '', amountText: '' }],
    } : current);
  }

  function removeFormItem(index: number) {
    setReceiptForm((current) => current ? { ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) } : current);
  }

  async function saveReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!receiptForm || busy) return;
    clearFeedback();
    const parsedItems = receiptForm.items.map((item) => ({ ...item, amountMinor: parseMoneyToMinor(item.amountText) }));
    const invalid = parsedItems.find((item) => item.amountMinor === null || item.amountMinor <= 0);
    if (invalid) {
      setError(`Wpisz prawidłową kwotę dla pozycji${invalid.name.trim() ? `: ${invalid.name.trim()}` : ''}.`);
      return;
    }
    setBusy(true);
    try {
      const draft = {
        merchant: receiptForm.merchant,
        date: receiptForm.date,
        items: parsedItems.map((item) => ({
          ...(item.id ? { id: item.id } : {}),
          name: item.name,
          categoryId: item.categoryId,
          amountMinor: item.amountMinor!,
        })),
      };
      if (receiptForm.id) await updateReceipt(receiptForm.id, draft);
      else await createReceipt(draft);
      const wasEditing = Boolean(receiptForm.id);
      setReceiptForm(null);
      await refresh();
      setMessage(wasEditing ? 'Zapisano zmiany paragonu.' : 'Dodano paragon.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać paragonu.');
    } finally {
      setBusy(false);
    }
  }

  function focusReceiptHistory() {
    window.requestAnimationFrame(() => historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function filterByCategory(categoryId: string) {
    setActiveCategoryId(categoryId);
    setShowAllReceipts(true);
    focusReceiptHistory();
  }

  function filterByMerchant(merchantKey: string) {
    setActiveMerchantKey(merchantKey);
    setShowAllReceipts(true);
    focusReceiptHistory();
  }

  function clearReceiptFilters() {
    setSearchQuery('');
    setActiveCategoryId('');
    setActiveMerchantKey('');
  }

  async function undoDeleteReceipt() {
    if (!deletedReceipt || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await restoreDeletedReceipt(deletedReceipt.receipt);
      setDeletedReceipt(null);
      await refresh();
      setMessage('Przywrócono paragon.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się przywrócić paragonu.');
    } finally {
      setBusy(false);
    }
  }

  async function removeReceipt(receipt: Receipt) {
    if (!window.confirm(`Usunąć paragon ${receipt.merchant} z ${formatDate(receipt.date)}?`)) return;
    setBusy(true);
    clearFeedback();
    try {
      await deleteReceipt(receipt.id);
      setDetailReceipt(null);
      await refresh();
      setMessage('');
      setDeletedReceipt({ receipt: structuredClone(receipt), expiresAt: Date.now() + 8000 });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się usunąć paragonu.');
    } finally {
      setBusy(false);
    }
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    clearFeedback();
    try {
      await createExpenseCategory(newCategoryName);
      setNewCategoryName('');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się dodać kategorii.');
    } finally {
      setBusy(false);
    }
  }

  async function saveCategory(category: ExpenseCategory) {
    setBusy(true);
    clearFeedback();
    try {
      await updateExpenseCategory(category.id, categoryDrafts[category.id] ?? category.name);
      await refresh();
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
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się usunąć kategorii.');
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="expenses-view">
      <div className="expenses-dashboard-header">
        <div className="expenses-dashboard-title">
          <div>
            <p className="section-kicker">Wydatki</p>
            <h2>Przegląd miesiąca</h2>
          </div>
          <div className="expenses-receipt-actions">
            <button type="button" className="button button-secondary button-small expenses-scan-action" onClick={openReceiptScan}>Skanuj paragon</button>
            <button type="button" className="button button-primary button-small expenses-primary-action" onClick={openNewReceipt}>+ Paragon</button>
          </div>
        </div>
        <div className="expenses-toolbar">
          <div className="expenses-month-switch" aria-label="Wybierz miesiąc wydatków">
            <button type="button" className="icon-button" onClick={() => setMonthKey((current) => shiftMonthKey(current, -1))} aria-label="Poprzedni miesiąc">‹</button>
            <strong>{formatMonthLabel(monthKey)}</strong>
            <button type="button" className="icon-button" onClick={() => setMonthKey((current) => shiftMonthKey(current, 1))} aria-label="Następny miesiąc">›</button>
          </div>
          <button type="button" className="button button-secondary button-small expenses-category-action" onClick={() => { clearFeedback(); setShowCategories(true); }}>Kategorie</button>
        </div>
      </div>

      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
      {message ? <div className="study-message success-message" role="status">{message}</div> : null}
      {deletedReceipt ? (
        <div className="expense-undo-toast" role="status" aria-live="polite">
          <span>Paragon usunięty.</span>
          <button type="button" className="text-button" disabled={busy} onClick={() => void undoDeleteReceipt()}>Cofnij</button>
        </div>
      ) : null}

      <section className="expense-metrics-grid" aria-label="Podsumowanie wydatków miesiąca">
        <div className="panel expense-metric-card expense-metric-primary">
          <span>Wydatki</span>
          <strong>{formatMoneyMinor(monthSummary.totalMinor)}</strong>
          <small>{formatMonthLabel(monthKey)}</small>
        </div>
        <div className="panel expense-metric-card expense-metric-comparison">
          <span>vs poprzedni miesiąc</span>
          {comparison.state === 'empty' ? (
            <><strong>0,00 zł</strong><small>Brak wydatków</small></>
          ) : comparison.state === 'no-comparison' ? (
            <><strong>{formatSignedMoney(comparison.differenceMinor)}</strong><small>Brak danych porównawczych</small></>
          ) : (
            <><strong>{formatSignedMoney(comparison.differenceMinor)}</strong><small>{formatSignedPercent(comparison.percentageChange ?? 0)}</small></>
          )}
        </div>
        <div className="panel expense-metric-card">
          <span>Paragony</span>
          <strong>{monthSummary.receiptCount}</strong>
          <small>{pluralizeReceipts(monthSummary.receiptCount)}</small>
        </div>
        <div className="panel expense-metric-card">
          <span>Średni paragon</span>
          <strong>{formatMoneyMinor(monthSummary.averageReceiptMinor)}</strong>
          <small>{monthSummary.receiptCount ? 'średnia z miesiąca' : 'brak danych'}</small>
        </div>
      </section>

      {monthSummary.receiptCount === 0 ? (
        <div className="panel expense-month-empty" role="status">
          <strong>Brak wydatków w {formatMonthLabel(monthKey).toLocaleLowerCase('pl-PL')}.</strong>
          <span>Dodaj paragon, aby zobaczyć statystyki tego miesiąca.</span>
        </div>
      ) : null}

      <div className="expenses-dashboard-grid">
        <section className="panel expense-analytics-panel" aria-labelledby="expense-trend-heading">
          <div className="expense-section-heading expense-section-heading-compact">
            <div>
              <p className="section-kicker">Trend</p>
              <h2 id="expense-trend-heading">Wydatki - ostatnie 6 miesięcy</h2>
            </div>
          </div>
          <div className="expense-panel-body expense-trend-panel-body">
            <ExpenseTrendChart trend={trend} />
          </div>
        </section>

        <section className="panel expense-analytics-panel" aria-labelledby="expense-categories-summary">
          <div className="expense-section-heading expense-section-heading-compact">
            <div>
              <p className="section-kicker">Podział</p>
              <h2 id="expense-categories-summary">Kategorie</h2>
            </div>
          </div>
          {categoryAnalytics.length ? (
            <>
              <div className="expense-analytics-list">
                {visibleCategories.map((entry) => {
                  const category = categoryById.get(entry.categoryId) ?? { id: entry.categoryId };
                  return (
                    <button
                      key={entry.categoryId}
                      type="button"
                      className={`expense-analytics-row expense-category-analytics-row expense-filter-trigger${activeCategoryId === entry.categoryId ? ' is-active' : ''}`}
                      onClick={() => filterByCategory(entry.categoryId)}
                      aria-label={`Filtruj paragony: kategoria ${entry.name}`}
                    >
                      <div className="expense-category-analytics-main">
                        <ExpenseCategoryIcon category={category} />
                        <div className="expense-analytics-copy">
                          <strong>{entry.name}</strong>
                          <span>{entry.sharePercent.toFixed(1).replace('.', ',')}% · {entry.itemCount} {pluralizeItems(entry.itemCount)}</span>
                          <div className="expense-share-track" aria-hidden="true"><span style={{ width: `${Math.min(100, entry.sharePercent)}%` }} /></div>
                        </div>
                      </div>
                      <strong className="expense-analytics-amount">{formatMoneyMinor(entry.totalMinor)}</strong>
                    </button>
                  );
                })}
              </div>
              {categoryAnalytics.length > 4 ? (
                <div className="expense-panel-footer">
                  <button type="button" className="text-button" onClick={() => setShowAllCategories((current) => !current)}>
                    {showAllCategories ? 'Zwiń kategorie' : `Pokaż wszystkie kategorie (${categoryAnalytics.length})`}
                  </button>
                </div>
              ) : null}
            </>
          ) : <p className="expense-empty-copy">Brak kategorii z wydatkami w tym miesiącu.</p>}
        </section>
      </div>

      <section ref={historyRef} className="panel expense-history-panel" aria-labelledby="expense-history-heading">
        <div className="expense-section-heading expense-section-heading-compact">
          <div>
            <p className="section-kicker">Historia</p>
            <h2 id="expense-history-heading">Paragony</h2>
          </div>
          {hasReceiptFilters ? <span className="receipt-filter-count">{filteredReceipts.length} wyników</span> : null}
        </div>
        {monthReceipts.length ? (
          <>
            <div className="receipt-history-tools">
              <label className="field receipt-search-field">
                <span>Szukaj w paragonach</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)}
                  placeholder="Sklep lub produkt"
                />
              </label>
              <label className="field receipt-filter-field">
                <span>Kategoria</span>
                <select value={activeCategoryId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setActiveCategoryId(event.target.value)}>
                  <option value="">Wszystkie</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label className="field receipt-filter-field">
                <span>Sklep</span>
                <select value={activeMerchantKey} onChange={(event: ChangeEvent<HTMLSelectElement>) => setActiveMerchantKey(event.target.value)}>
                  <option value="">Wszystkie</option>
                  {merchantAnalytics.map((merchant) => <option key={merchant.key} value={merchant.key}>{merchant.name}</option>)}
                </select>
              </label>
            </div>
            {hasReceiptFilters ? (
              <div className="receipt-active-filters" aria-label="Aktywne filtry paragonów">
                {activeCategoryId ? <button type="button" className="receipt-filter-chip" onClick={() => setActiveCategoryId('')}>Kategoria: {activeCategoryName} ×</button> : null}
                {activeMerchantKey ? <button type="button" className="receipt-filter-chip" onClick={() => setActiveMerchantKey('')}>Sklep: {activeMerchantName} ×</button> : null}
                {searchQuery.trim() ? <span className="receipt-filter-query">Szukaj: „{searchQuery.trim()}”</span> : null}
                <button type="button" className="text-button" onClick={clearReceiptFilters}>Wyczyść filtry</button>
              </div>
            ) : null}
            {filteredReceipts.length ? (
              <>
                <div className="receipt-list">
                  {visibleReceipts.map((receipt) => (
                    <button key={receipt.id} type="button" className="receipt-row" onClick={() => { clearFeedback(); setDetailReceipt(receipt); }}>
                      <span className="receipt-date">{formatDate(receipt.date)}</span>
                      <strong>{receipt.merchant}</strong>
                      <span className="receipt-total">{formatMoneyMinor(receipt.totalMinor)}</span>
                    </button>
                  ))}
                </div>
                {!hasReceiptFilters && filteredReceipts.length > 3 ? (
                  <div className="expense-panel-footer">
                    <button type="button" className="text-button" onClick={() => setShowAllReceipts((current) => !current)}>
                      {showAllReceipts ? 'Zwiń paragony' : `Pokaż wszystkie paragony (${filteredReceipts.length})`}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="expense-empty-state">
                <strong>Brak paragonów pasujących do wyszukiwania.</strong>
                <span>Zmień wyszukiwanie lub wyczyść filtry.</span>
              </div>
            )}
          </>
        ) : (
          <div className="expense-empty-state">
            <strong>Nie ma jeszcze paragonów.</strong>
            <span>Dodaj pierwszy wydatek przyciskiem u góry.</span>
          </div>
        )}
      </section>

      <div className="expenses-secondary-grid">
        <section className="panel expense-analytics-panel" aria-labelledby="expense-merchants-heading">
          <div className="expense-section-heading expense-section-heading-compact">
            <div>
              <p className="section-kicker">Miejsca zakupów</p>
              <h2 id="expense-merchants-heading">Sklepy</h2>
            </div>
          </div>
          {merchantAnalytics.length ? (
            <>
              <div className="expense-analytics-list">
                {visibleMerchants.map((merchant) => (
                  <button
                    key={merchant.key}
                    type="button"
                    className={`expense-analytics-row expense-filter-trigger${activeMerchantKey === merchant.key ? ' is-active' : ''}`}
                    onClick={() => filterByMerchant(merchant.key)}
                    aria-label={`Filtruj paragony: sklep ${merchant.name}`}
                  >
                    <div className="expense-analytics-copy">
                      <strong>{merchant.name}</strong>
                      <span>{merchant.receiptCount} {pluralizeReceipts(merchant.receiptCount)} · śr. {formatMoneyMinor(merchant.averageReceiptMinor)}</span>
                    </div>
                    <strong className="expense-analytics-amount">{formatMoneyMinor(merchant.totalMinor)}</strong>
                  </button>
                ))}
              </div>
              {merchantAnalytics.length > 3 ? (
                <div className="expense-panel-footer">
                  <button type="button" className="text-button" onClick={() => setShowAllMerchants((current) => !current)}>
                    {showAllMerchants ? 'Zwiń sklepy' : `Pokaż wszystkie sklepy (${merchantAnalytics.length})`}
                  </button>
                </div>
              ) : null}
            </>
          ) : <p className="expense-empty-copy">Brak sklepów do podsumowania w tym miesiącu.</p>}
        </section>

        <section className="panel expense-analytics-panel" aria-labelledby="expense-products-heading">
          <div className="expense-section-heading expense-section-heading-compact">
            <div>
              <p className="section-kicker">Pozycje paragonów</p>
              <h2 id="expense-products-heading">Produkty</h2>
            </div>
          </div>
          {productAnalytics.length ? (
            <>
              <div className={`expense-products-layout${showAllProducts ? ' is-expanded' : ''}`}>
                <div>
                  <h3>Największe wydatki</h3>
                  <div className="expense-ranked-list">
                    {visibleProducts.map((product, index) => (
                      <div key={product.key} className="expense-ranked-row">
                        <span className="expense-rank">{index + 1}</span>
                        <div><strong>{product.name}</strong><span>{product.occurrenceCount} {pluralizeEntries(product.occurrenceCount)}</span></div>
                        <strong>{formatMoneyMinor(product.totalMinor)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                {showAllProducts ? (
                  <div>
                    <h3>Najczęściej pojawiające się</h3>
                    <div className="expense-ranked-list compact">
                      {frequentProducts.map((product, index) => (
                        <div key={product.key} className="expense-ranked-row">
                          <span className="expense-rank">{index + 1}</span>
                          <div><strong>{product.name}</strong><span>{formatMoneyMinor(product.totalMinor)}</span></div>
                          <strong>{product.occurrenceCount}×</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              {productAnalytics.length > 5 || frequentProducts.length ? (
                <div className="expense-panel-footer">
                  <button type="button" className="text-button" onClick={() => setShowAllProducts((current) => !current)}>
                    {showAllProducts ? 'Zwiń produkty' : `Więcej o produktach${productAnalytics.length > 5 ? ` (${Math.min(productAnalytics.length, 10)})` : ''}`}
                  </button>
                </div>
              ) : null}
            </>
          ) : <p className="expense-empty-copy">Brak produktów do podsumowania w tym miesiącu.</p>}
        </section>
      </div>
      {receiptScanOpen ? (
        <ReceiptScanFlow
          categories={categories}
          receipts={receipts}
          onSave={saveScannedReceipt}
          onClose={() => setReceiptScanOpen(false)}
          onManualAdd={openNewReceipt}
        />
      ) : null}

      {receiptForm ? (
        <Modal title={receiptForm.id ? 'Edytuj paragon' : 'Dodaj paragon'} onClose={() => !busy && setReceiptForm(null)} wide>
          <form className="receipt-form" onSubmit={(event: FormEvent<HTMLFormElement>) => void saveReceipt(event)}>
            {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
            <div className="receipt-main-fields">
              <label className="field">
                <span>Sklep</span>
                <input data-modal-autofocus="true" value={receiptForm.merchant} onChange={(event: ChangeEvent<HTMLInputElement>) => setReceiptForm((current) => current ? { ...current, merchant: event.target.value } : current)} placeholder="Np. Biedronka" />
              </label>
              <label className="field">
                <span>Data</span>
                <input type="date" value={receiptForm.date} onChange={(event: ChangeEvent<HTMLInputElement>) => setReceiptForm((current) => current ? { ...current, date: event.target.value } : current)} />
              </label>
            </div>

            <div className="receipt-items-heading">
              <strong>Pozycje</strong>
              <button type="button" className="button button-secondary button-small" onClick={addFormItem}>+ Dodaj pozycję</button>
            </div>

            <div className="receipt-items-form">
              {receiptForm.items.map((item, index) => (
                <div className="receipt-item-form" key={item.id ?? `new-${index}`}>
                  <label className="field receipt-item-name">
                    <span>Nazwa</span>
                    <input value={item.name} onChange={(event: ChangeEvent<HTMLInputElement>) => updateFormItem(index, { name: event.target.value })} placeholder="Produkt lub usługa" />
                  </label>
                  <label className="field receipt-item-category">
                    <span>Kategoria</span>
                    <select value={item.categoryId} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateFormItem(index, { categoryId: event.target.value })}>
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  </label>
                  <label className="field receipt-item-amount">
                    <span>Kwota</span>
                    <input inputMode="decimal" value={item.amountText} onChange={(event: ChangeEvent<HTMLInputElement>) => updateFormItem(index, { amountText: event.target.value })} placeholder="0,00" aria-label={`Kwota pozycji ${index + 1}`} />
                  </label>
                  <button type="button" className="text-button danger-text receipt-item-remove" onClick={() => removeFormItem(index)} disabled={receiptForm.items.length === 1}>Usuń</button>
                </div>
              ))}
            </div>

            <div className="receipt-form-total"><span>Razem</span><strong>{formatMoneyMinor(receiptFormTotal)}</strong></div>
            <div className="modal-actions split-actions">
              <button type="button" className="button button-secondary" onClick={() => setReceiptForm(null)} disabled={busy}>Anuluj</button>
              <button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Zapisywanie...' : 'Zapisz paragon'}</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {detailReceipt ? (
        <Modal title={detailReceipt.merchant} onClose={() => setDetailReceipt(null)}>
          <div className="receipt-detail">
            <div className="receipt-detail-meta"><span>{formatDate(detailReceipt.date)}</span><strong>{formatMoneyMinor(detailReceipt.totalMinor)}</strong></div>
            <div className="receipt-detail-items">
              {detailReceipt.items.map((item) => (
                <div key={item.id} className="receipt-detail-item">
                  <div><strong>{item.name}</strong><span>{categoryById.get(item.categoryId)?.name ?? 'Nieznana kategoria'}</span></div>
                  <strong>{formatMoneyMinor(item.amountMinor)}</strong>
                </div>
              ))}
            </div>
            <div className="modal-actions split-actions">
              <button type="button" className="button button-secondary" onClick={() => openEditReceipt(detailReceipt)}>Edytuj</button>
              <button type="button" className="button button-secondary danger-text" disabled={busy} onClick={() => void removeReceipt(detailReceipt)}>Usuń</button>
            </div>
          </div>
        </Modal>
      ) : null}

      {showCategories ? (
        <Modal title="Kategorie wydatków" onClose={() => !busy && setShowCategories(false)}>
          <div className="expense-category-manager">
            {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
            <p className="muted-copy">Kategorie są lokalne. Zmiana nazwy zachowuje przypisania w istniejących paragonach.</p>
            <form className="expense-category-add" onSubmit={(event: FormEvent<HTMLFormElement>) => void addCategory(event)}>
              <label className="field">
                <span>Nowa kategoria</span>
                <input data-modal-autofocus="true" value={newCategoryName} onChange={(event: ChangeEvent<HTMLInputElement>) => setNewCategoryName(event.target.value)} placeholder="Nazwa kategorii" />
              </label>
              <button type="submit" className="button button-primary" disabled={busy}>Dodaj</button>
            </form>
            <div className="expense-category-manager-list">
              {categories.map((category) => (
                <div key={category.id} className="expense-category-manager-row">
                  <input aria-label={`Nazwa kategorii ${category.name}`} value={categoryDrafts[category.id] ?? category.name} onChange={(event: ChangeEvent<HTMLInputElement>) => setCategoryDrafts((current) => ({ ...current, [category.id]: event.target.value }))} />
                  <button type="button" className="button button-secondary button-small" disabled={busy || (categoryDrafts[category.id] ?? category.name) === category.name} onClick={() => void saveCategory(category)}>Zapisz</button>
                  <button type="button" className="text-button danger-text" disabled={busy} onClick={() => void removeCategory(category)}>Usuń</button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
