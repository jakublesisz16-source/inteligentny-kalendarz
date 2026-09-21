import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { ExpenseCategory, FinanceCurrencyCode, ReceiptDraft } from '../expenses.types';
import { expenseCategoryPath, formatCurrencyAmountMinor, formatMoneyMinor } from '../expenses.utils';
import type { ReceiptOcrDiagnostics, ReceiptOcrQuality, ReceiptReviewDraft, ReceiptReviewItem } from './receipt-ocr.types';
import { stringifyReceiptJsonFeedbackSnapshot, type ReceiptJsonFeedbackContext } from './receipt-json-feedback';
import {
  isSignificantReceiptMismatch,
  receiptReviewDifferenceMinor,
  receiptReviewItemNeedsReview,
  receiptReviewItemsTotalMinor,
  receiptReviewSavingsMinor,
  receiptReviewToDraft,
  validateReceiptReviewForSave,
} from './receipt-review.model';

function reviewUnitLabel(unit: ReceiptReviewItem['unit']): string {
  if (!unit) return '';
  return unit === 'op' ? 'op.' : unit;
}

function reviewAmountMinor(value: number, currency: FinanceCurrencyCode): string {
  return currency === 'PLN' ? formatMoneyMinor(value) : formatCurrencyAmountMinor(value, currency);
}

function reviewAmountText(value: string, currency: FinanceCurrencyCode): string {
  return `${value} ${currency === 'PLN' ? 'zł' : currency}`;
}

function reviewQuantitySummary(item: ReceiptReviewItem, currency: FinanceCurrencyCode): string {
  const quantity = item.quantityText?.trim() || '?';
  const unit = reviewUnitLabel(item.unit);
  const unitPrice = item.unitPriceText?.trim() || '?';
  return `${quantity}${unit ? ` ${unit}` : ''} × ${reviewAmountText(unitPrice, currency)}`;
}


interface ReceiptScanReviewProps {
  review: ReceiptReviewDraft;
  categories: ExpenseCategory[];
  imageUrl: string;
  rotation: 0 | 90 | 180 | 270;
  saving: boolean;
  error: string;
  diagnosticOcrText: string;
  diagnosticOcrMeta: ReceiptOcrDiagnostics | null;
  diagnosticOcrQuality: ReceiptOcrQuality | null;
  jsonFeedbackContext: ReceiptJsonFeedbackContext | null;
  onChange: (review: ReceiptReviewDraft) => void;
  onRotate: (direction: 'left' | 'right') => void;
  onRerun: () => void;
  onCancel: () => void;
  onSave: (draft: ReceiptDraft) => Promise<void>;
  displayCurrency?: FinanceCurrencyCode;
  sourceKind?: 'ocr' | 'structured-json';
}

function confidenceLabel(confidence: ReceiptReviewDraft['merchantConfidence']): string {
  return confidence === 'high' ? 'OK' : confidence === 'medium' ? 'Sprawdź' : 'Problem';
}

function qualityLabel(quality: ReceiptOcrQuality['level']): string {
  return quality === 'high' ? 'dobra' : quality === 'medium' ? 'wymaga sprawdzenia' : 'niska';
}

function sourceQualityLabel(level: ReceiptOcrDiagnostics['sourceQuality']['level']): string {
  return level === 'high' ? 'dobra' : level === 'medium' ? 'średnia' : level === 'low' ? 'niska' : 'bardzo niska';
}

export function ReceiptScanReview({
  review,
  categories,
  imageUrl,
  rotation,
  saving,
  error,
  diagnosticOcrText,
  diagnosticOcrMeta,
  diagnosticOcrQuality,
  jsonFeedbackContext,
  onChange,
  onRotate,
  onRerun,
  onCancel,
  onSave,
  displayCurrency = 'PLN',
  sourceKind = 'ocr',
}: ReceiptScanReviewProps) {
  const [mobilePane, setMobilePane] = useState<'data' | 'image'>('data');
  const [localError, setLocalError] = useState('');
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const [diagnosticCopyStatus, setDiagnosticCopyStatus] = useState('');
  const [showDiagnosticFallback, setShowDiagnosticFallback] = useState(false);
  const [itemFilter, setItemFilter] = useState<'all' | 'review'>(() => review.items.some(receiptReviewItemNeedsReview) ? 'review' : 'all');
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(() => new Set(
    review.items.filter(receiptReviewItemNeedsReview).map((item) => item.localId),
  ));
  const titleRef = useRef<HTMLHeadingElement>(null);
  const finalItemsTotalMinor = useMemo(() => receiptReviewItemsTotalMinor(review), [review]);
  const savingsMinor = useMemo(() => receiptReviewSavingsMinor(review), [review]);
  const differenceMinor = useMemo(() => receiptReviewDifferenceMinor(review), [review]);
  const mismatch = differenceMinor !== undefined && Math.abs(differenceMinor) > 1;
  const validCategoryIds = useMemo(() => new Set(categories.map((category) => category.id)), [categories]);
  const saveValidation = useMemo(() => validateReceiptReviewForSave(review, validCategoryIds), [review, validCategoryIds]);
  const jsonFeedbackText = useMemo(() => (sourceKind === 'structured-json' && jsonFeedbackContext
    ? stringifyReceiptJsonFeedbackSnapshot(jsonFeedbackContext, review, validCategoryIds)
    : ''), [jsonFeedbackContext, review, sourceKind, validCategoryIds]);
  const flaggedItemsCount = useMemo(() => review.items.filter(receiptReviewItemNeedsReview).length, [review]);
  const fieldsToReviewCount = flaggedItemsCount + (review.merchantConfidence === 'high' ? 0 : 1) + (review.dateConfidence === 'high' ? 0 : 1);
  const visibleItems = useMemo(
    () => review.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => itemFilter === 'all' || receiptReviewItemNeedsReview(item)),
    [itemFilter, review.items],
  );
  const expansionKey = review.items
    .map((item) => `${item.localId}:${item.confidence}:${item.warnings.length}`)
    .join('|');

  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    const currentIds = new Set(review.items.map((item) => item.localId));
    setExpandedItemIds((current) => {
      const next = new Set([...current].filter((id) => currentIds.has(id)));
      for (const item of review.items) {
        if (receiptReviewItemNeedsReview(item)) next.add(item.localId);
      }
      return next;
    });
  }, [expansionKey]);

  useEffect(() => {
    if (!flaggedItemsCount && itemFilter === 'review') setItemFilter('all');
  }, [flaggedItemsCount, itemFilter]);

  function setItemExpanded(localId: string, expanded: boolean) {
    setExpandedItemIds((current) => {
      const next = new Set(current);
      if (expanded) next.add(localId);
      else next.delete(localId);
      return next;
    });
  }

  function expandVisibleItems() {
    setExpandedItemIds((current) => {
      const next = new Set(current);
      for (const { item } of visibleItems) next.add(item.localId);
      return next;
    });
  }

  function collapseReviewedItems() {
    setExpandedItemIds((current) => {
      const next = new Set(current);
      for (const { item } of visibleItems) {
        if (!receiptReviewItemNeedsReview(item)) next.delete(item.localId);
      }
      return next;
    });
  }

  function patch(patchValue: Partial<ReceiptReviewDraft>) {
    setLocalError('');
    setConfirmMismatch(false);
    onChange({ ...review, ...patchValue });
  }

  function patchItem(index: number, patchValue: Partial<ReceiptReviewItem>) {
    patch({ items: review.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patchValue } : item) });
  }

  function markItemReviewed(index: number, localId: string) {
    patchItem(index, { confidence: 'high', warnings: [] });
    setItemExpanded(localId, false);
  }

  function patchItemUnit(index: number, value: string) {
    patch({
      items: review.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (value) return { ...item, unit: value as NonNullable<ReceiptReviewItem['unit']> };
        const { unit: _unit, ...rest } = item;
        return rest;
      }),
    });
  }

  function patchItemAmount(index: number, amountText: string) {
    patch({
      items: review.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const {
          baseAmountMinor: _baseAmountMinor,
          discountMinor: _discountMinor,
          quantityText: _quantityText,
          unit: _unit,
          unitPriceText: _unitPriceText,
          ...rest
        } = item;
        return { ...rest, amountText, confidence: 'high' };
      }),
    });
  }

  function addItem() {
    const fallback = categories.find((category) => category.name.trim().toLocaleLowerCase('pl-PL') === 'inne')?.id ?? categories[0]?.id ?? '';
    patch({
      items: [...review.items, {
        localId: `manual-${crypto.randomUUID()}`,
        name: '',
        categoryId: fallback,
        amountText: '',
        confidence: 'low',
        warnings: [],
      }],
    });
  }

  function removeItem(index: number) {
    patch({ items: review.items.filter((_, itemIndex) => itemIndex !== index) });
  }

  function fallbackCopyText(value: string): boolean {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } finally {
      textarea.remove();
    }
    return copied;
  }

  async function copyDiagnosticOcrText() {
    setDiagnosticCopyStatus('');
    setShowDiagnosticFallback(false);
    if (!diagnosticOcrText) {
      setDiagnosticCopyStatus('Brak tekstu OCR do skopiowania.');
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(diagnosticOcrText);
      } else if (!fallbackCopyText(diagnosticOcrText)) {
        throw new Error('Clipboard unavailable');
      }
      setDiagnosticCopyStatus('Skopiowano tekst OCR.');
    } catch {
      if (fallbackCopyText(diagnosticOcrText)) {
        setDiagnosticCopyStatus('Skopiowano tekst OCR.');
        return;
      }
      setShowDiagnosticFallback(true);
      setDiagnosticCopyStatus('Nie udało się skopiować automatycznie. Zaznacz tekst poniżej ręcznie.');
    }
  }

  async function copyStructuredJsonFeedback() {
    setDiagnosticCopyStatus('');
    setShowDiagnosticFallback(false);
    if (!jsonFeedbackText) {
      setDiagnosticCopyStatus('Brak diagnostyki JSON do skopiowania.');
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(jsonFeedbackText);
      } else if (!fallbackCopyText(jsonFeedbackText)) {
        throw new Error('Clipboard unavailable');
      }
      setDiagnosticCopyStatus('Skopiowano bezpieczną diagnostykę JSON.');
    } catch {
      if (fallbackCopyText(jsonFeedbackText)) {
        setDiagnosticCopyStatus('Skopiowano bezpieczną diagnostykę JSON.');
        return;
      }
      setShowDiagnosticFallback(true);
      setDiagnosticCopyStatus('Nie udało się skopiować automatycznie. Zaznacz diagnostykę poniżej ręcznie.');
    }
  }

  function downloadStructuredJsonFeedback() {
    if (!jsonFeedbackText || !jsonFeedbackContext) {
      setDiagnosticCopyStatus('Brak diagnostyki JSON do pobrania.');
      return;
    }
    const baseName = jsonFeedbackContext.sourceFileName.replace(/\.json$/iu, '').replace(/[^a-z0-9._-]+/giu, '-');
    const blob = new Blob([jsonFeedbackText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${baseName || 'paragon'}-diagnostyka.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setDiagnosticCopyStatus('Pobrano bezpieczną diagnostykę JSON - możesz wysłać ten plik do analizy.');
  }

  async function copyPrivateGeometrySnapshot() {
    if (!import.meta.env.DEV) return;
    setDiagnosticCopyStatus('');
    const debugWindow = window as Window & { __IK_PRIVATE_RECEIPT_GEOMETRY__?: unknown };
    const snapshot = debugWindow.__IK_PRIVATE_RECEIPT_GEOMETRY__;
    if (!snapshot) {
      setDiagnosticCopyStatus('Brak geometrii OCR do skopiowania.');
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      setDiagnosticCopyStatus('Skopiowano prywatny snapshot geometrii OCR.');
    } catch {
      setDiagnosticCopyStatus('Nie udało się skopiować snapshotu geometrii. Otwórz konsolę DEV i skopiuj window.__IK_PRIVATE_RECEIPT_GEOMETRY__.');
    }
  }

  async function save() {
    setLocalError('');
    if (!saveValidation.valid) {
      setLocalError(saveValidation.message);
      return;
    }
    try {
      const depositCategoryId = categories.find((category) => category.id === 'expense-category-deposit')?.id
        ?? categories.find((category) => category.name.trim().toLocaleLowerCase('pl-PL') === 'kaucja / opakowania zwrotne')?.id;
      const draft = receiptReviewToDraft(review, depositCategoryId ? { depositCategoryId } : {});
      if (isSignificantReceiptMismatch(review) && !confirmMismatch) {
        setConfirmMismatch(true);
        return;
      }
      await onSave(draft);
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Nie udało się przygotować paragonu do zapisu.');
    }
  }

  const warnings = review.parserWarnings.filter((warning) => warning.code !== 'sum-mismatch');

  return (
    <div className="receipt-scan-review" role="document">
      <div className="receipt-scan-review-heading">
        <div>
          <p className="section-kicker">{sourceKind === 'structured-json' ? 'Dane strukturalne JSON' : 'Lokalny OCR'}</p>
          <h2 ref={titleRef} tabIndex={-1}>Sprawdź paragon</h2>
        </div>
        {imageUrl ? <div className="receipt-scan-mobile-tabs" role="tablist" aria-label="Widok paragonu">
          <button type="button" role="tab" aria-selected={mobilePane === 'data'} className={mobilePane === 'data' ? 'is-active' : ''} onClick={() => setMobilePane('data')}>Dane</button>
          <button type="button" role="tab" aria-selected={mobilePane === 'image'} className={mobilePane === 'image' ? 'is-active' : ''} onClick={() => setMobilePane('image')}>Zdjęcie</button>
        </div> : null}
      </div>

      <div className={`receipt-scan-review-grid${imageUrl ? '' : ' no-image'}`}>
        {imageUrl ? <aside className={`receipt-scan-image-pane${mobilePane === 'image' ? ' is-mobile-active' : ''}`} aria-label="Zdjęcie paragonu">
          <div className="receipt-scan-image-frame">
            <img src={imageUrl} alt="Zdjęcie paragonu do porównania z rozpoznanymi danymi" style={{ transform: `rotate(${rotation}deg)` }} />
          </div>
          <div className="receipt-scan-image-actions">
            <button type="button" className="button button-secondary button-small" onClick={() => onRotate('left')}>Obróć w lewo</button>
            <button type="button" className="button button-secondary button-small" onClick={() => onRotate('right')}>Obróć w prawo</button>
            <button type="button" className="text-button" onClick={onRerun}>Rozpoznaj ponownie</button>
          </div>
        </aside> : null}

        <section className={`receipt-scan-data-pane${!imageUrl || mobilePane === 'data' ? ' is-mobile-active' : ''}`} aria-label="Rozpoznane dane paragonu">
          {(error || localError) ? <div className="study-message error-message receipt-scan-message" role="alert">{error || localError}</div> : null}
          {!review.items.length ? (
            <div className="receipt-scan-empty" role="status">
              <strong>Nie udało się automatycznie rozpoznać pozycji.</strong>
              <span>{sourceKind === 'structured-json' ? 'Sprawdź plik JSON albo dodaj pozycje ręcznie.' : 'Dodaj je ręcznie na podstawie zdjęcia.'}</span>
            </div>
          ) : null}

          <div className={`receipt-review-priority${fieldsToReviewCount ? ' needs-review' : ''}`} aria-label="Szybkie podsumowanie korekty">
            <div className="receipt-review-priority-copy">
              <strong>{fieldsToReviewCount ? `Sprawdź jeszcze ${fieldsToReviewCount} element${fieldsToReviewCount === 1 ? '' : 'ów'}.` : 'Paragon wygląda spójnie.'}</strong>
              <span>
                {differenceMinor === undefined
                  ? sourceKind === 'structured-json' ? 'Sprawdź sumę w źródłowym e-paragonie przed zapisem.' : 'Sprawdź sumę bezpośrednio na zdjęciu przed zapisem.'
                  : Math.abs(differenceMinor) <= 1
                    ? 'Kwoty są zgodne. Możesz zatwierdzić paragon lub poprawić szczegóły.'
                    : `Najpierw popraw różnicę ${reviewAmountMinor(Math.abs(differenceMinor), displayCurrency)}.`}
              </span>
            </div>
            <div className="receipt-review-priority-chips" aria-label="Priorytety korekty">
              <span className={`receipt-review-chip${fieldsToReviewCount ? ' is-warning' : ''}`}>Do sprawdzenia {fieldsToReviewCount}</span>
              <span className="receipt-review-chip">Pozycje {review.items.length}</span>
              <span className={`receipt-review-chip${differenceMinor !== undefined && Math.abs(differenceMinor) > 1 ? ' is-warning' : ''}`}>
                {differenceMinor === undefined ? 'Brak sumy' : Math.abs(differenceMinor) <= 1 ? 'Kwoty zgodne' : `Różnica ${reviewAmountMinor(Math.abs(differenceMinor), displayCurrency)}`}
              </span>
            </div>
          </div>

          <div className="receipt-review-main-fields">
            <label className={`field receipt-review-field${review.merchantConfidence === 'high' ? '' : ' needs-review'}`}>
              <span>Sklep <small>{confidenceLabel(review.merchantConfidence)}</small></span>
              <input data-modal-autofocus="true" value={review.merchant} onChange={(event: ChangeEvent<HTMLInputElement>) => patch({ merchant: event.target.value, merchantConfidence: 'high' })} placeholder="Nazwa sklepu" />
            </label>
            <label className={`field receipt-review-field${review.dateConfidence === 'high' ? '' : ' needs-review'}`}>
              <span>Data <small>{confidenceLabel(review.dateConfidence)}</small></span>
              <input type="date" value={review.date} onChange={(event: ChangeEvent<HTMLInputElement>) => patch({ date: event.target.value, dateConfidence: 'high' })} />
            </label>
          </div>

          <div className="receipt-review-items-toolbar">
            <div className="receipt-review-items-heading">
              <strong>Pozycje <span>{review.items.length}</span></strong>
              <button type="button" className="button button-secondary button-small" onClick={addItem}>+ Dodaj</button>
            </div>
            <div className="receipt-review-item-filters" role="tablist" aria-label="Filtr pozycji paragonu">
              <button type="button" role="tab" aria-selected={itemFilter === 'review'} className={itemFilter === 'review' ? 'is-active' : ''} onClick={() => setItemFilter('review')} disabled={!flaggedItemsCount}>Do sprawdzenia {flaggedItemsCount}</button>
              <button type="button" role="tab" aria-selected={itemFilter === 'all'} className={itemFilter === 'all' ? 'is-active' : ''} onClick={() => setItemFilter('all')}>Wszystkie {review.items.length}</button>
            </div>
            <div className="receipt-review-item-tools">
              <button type="button" className="text-button" onClick={expandVisibleItems}>Rozwiń wszystkie</button>
              <button type="button" className="text-button" onClick={collapseReviewedItems}>Zwiń poprawne</button>
            </div>
          </div>

          {itemFilter === 'review' && !visibleItems.length ? (
            <div className="receipt-scan-empty receipt-scan-empty-compact" role="status">
              <strong>Nie ma już pozycji do sprawdzenia.</strong>
              <span>Możesz zapisać paragon albo przełączyć listę na wszystkie pozycje.</span>
            </div>
          ) : null}

          <div className="receipt-review-items">
            {visibleItems.map(({ item, index }) => {
              const expanded = expandedItemIds.has(item.localId);
              if (!expanded) {
                return (
                  <article className={`receipt-review-item receipt-review-item-compact${receiptReviewItemNeedsReview(item) ? ' needs-review' : ''}`} key={item.localId}>
                    <span className="receipt-review-item-number">#{index + 1}</span>
                    <button type="button" className="receipt-review-item-compact-main" onClick={() => setItemExpanded(item.localId, true)}>
                      <span>
                        <strong>{item.name || 'Bez nazwy'}</strong>
                        <small>{expenseCategoryPath(categories, item.categoryId)}</small>
                      </span>
                      {(item.quantityText !== undefined || item.unitPriceText !== undefined) ? <small>{reviewQuantitySummary(item, displayCurrency)}</small> : null}
                    </button>
                    <strong className="receipt-review-item-compact-amount">{item.amountText ? reviewAmountText(item.amountText, displayCurrency) : 'Brak kwoty'}</strong>
                    <div className="receipt-review-item-compact-actions">
                      {receiptReviewItemNeedsReview(item) ? <small className="receipt-review-item-compact-flag">Sprawdź{item.warnings.length ? ` (${item.warnings.length})` : ''}</small> : null}
                      <button type="button" className="text-button" onClick={() => setItemExpanded(item.localId, true)}>Edytuj</button>
                    </div>
                  </article>
                );
              }
              return (
                <article className={`receipt-review-item${receiptReviewItemNeedsReview(item) ? ' needs-review' : ''}`} key={item.localId}>
                  <div className="receipt-review-item-topline">
                    <span>#{index + 1}</span>
                    {receiptReviewItemNeedsReview(item) ? <small>{item.confidence !== 'high' ? confidenceLabel(item.confidence) : 'Sprawdź'}</small> : null}
                    {receiptReviewItemNeedsReview(item) ? <button type="button" className="text-button receipt-review-mark-done" onClick={() => markItemReviewed(index, item.localId)}>Sprawdzone</button> : null}
                    <button type="button" className="text-button" onClick={() => setItemExpanded(item.localId, false)}>Zwiń</button>
                    <button type="button" className="text-button danger-text" onClick={() => removeItem(index)}>Usuń</button>
                  </div>
                  <label className="field receipt-review-item-name">
                    <span>Nazwa</span>
                    <input value={item.name} onChange={(event: ChangeEvent<HTMLInputElement>) => patchItem(index, { name: event.target.value, confidence: 'high' })} placeholder="Produkt lub usługa" />
                  </label>
                  <div className="receipt-review-item-bottom">
                    <label className="field receipt-review-item-category">
                      <span>Kategoria</span>
                      <select value={item.categoryId} onChange={(event: ChangeEvent<HTMLSelectElement>) => patchItem(index, { categoryId: event.target.value })}>
                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                    </label>
                    <label className="field receipt-review-item-amount">
                      <span>Kwota{displayCurrency === 'PLN' ? '' : ` (${displayCurrency})`}</span>
                      <input inputMode="decimal" value={item.amountText} onChange={(event: ChangeEvent<HTMLInputElement>) => patchItemAmount(index, event.target.value)} placeholder="0,00" aria-label={`Kwota pozycji ${index + 1}`} />
                    </label>
                  </div>
                  {(item.quantityText !== undefined || item.unitPriceText !== undefined) ? (
                    <details className="receipt-review-unit-details">
                      <summary>Ilość i cena: <strong>{reviewQuantitySummary(item, displayCurrency)}</strong></summary>
                      <div className="receipt-review-unit-fields">
                        <label className="field">
                          <span>Ilość</span>
                          <input inputMode="decimal" value={item.quantityText ?? ''} onChange={(event: ChangeEvent<HTMLInputElement>) => patchItem(index, { quantityText: event.target.value })} placeholder="1" />
                        </label>
                        <label className="field">
                          <span>Jednostka</span>
                          <select value={item.unit ?? ''} onChange={(event: ChangeEvent<HTMLSelectElement>) => patchItemUnit(index, event.target.value)}>
                            <option value="">-</option>
                            <option value="szt">szt.</option>
                            <option value="kg">kg</option>
                            <option value="g">g</option>
                            <option value="mg">mg</option>
                            <option value="l">l</option>
                            <option value="ml">ml</option>
                            <option value="cl">cl</option>
                            <option value="dl">dl</option>
                            <option value="op">op.</option>
                          </select>
                        </label>
                        <label className="field">
                          <span>Cena jednostkowa{displayCurrency === 'PLN' ? '' : ` (${displayCurrency})`}</span>
                          <input inputMode="decimal" value={item.unitPriceText ?? ''} onChange={(event: ChangeEvent<HTMLInputElement>) => patchItem(index, { unitPriceText: event.target.value })} placeholder="0,00" />
                        </label>
                      </div>
                    </details>
                  ) : null}
                  {item.warnings.length ? <p className="receipt-review-inline-warning">{item.warnings.join(' ')}</p> : null}
                </article>
              );
            })}
          </div>

          {review.parserWarnings.some((warning) => warning.code === 'partial-recovery') ? (
            <div className="receipt-ocr-quality-warning" role="status">
              <strong>{review.items.length ? 'Odczytano tylko część danych.' : 'Odczytano część danych z niepełnego OCR.'}</strong>
              <span>Sprawdź zaznaczone pola i uzupełnij brakujące dane przed zapisem.</span>
            </div>
          ) : null}

          {diagnosticOcrMeta?.sourceQuality.level === 'very-low' ? (
            <div className="receipt-ocr-quality-warning" role="status">
              <strong>Źródło ma bardzo niską jakość.</strong>
              <span>Zdjęcie ma zbyt mało szczegółów do pewnego odczytu cen. Jeśli możesz, wybierz oryginalne zdjęcie lub PDF.</span>
            </div>
          ) : diagnosticOcrQuality && (diagnosticOcrQuality.level === 'low' || diagnosticOcrQuality.textScore < 45) ? (
            <div className="receipt-ocr-quality-warning" role="status">
              <strong>{diagnosticOcrQuality.financialScore >= 75 ? 'Kwoty są spójne, ale część nazw wymaga sprawdzenia.' : 'OCR wymaga dokładnego sprawdzenia.'}</strong>
              <span>{diagnosticOcrQuality.financialScore >= 75 ? 'Sprawdź nazwy produktów i sklep przed zapisem.' : 'Część cen może być błędnie rozpoznana.'}</span>
            </div>
          ) : null}

          {import.meta.env.DEV ? (
            <details className="receipt-ocr-diagnostic" aria-label={sourceKind === 'structured-json' ? 'Diagnostyka importu JSON' : 'Diagnostyka OCR FIX1J'} open={diagnosticOpen} onToggle={(event) => setDiagnosticOpen((event.currentTarget as HTMLDetailsElement).open)}>
              <summary>
                <strong>{sourceKind === 'structured-json' ? 'Diagnostyka JSON' : 'Diagnostyka FIX1J'}</strong>
                <span>{sourceKind === 'structured-json'
                  ? 'Raport zawiera wynik importu i kontroli finansowej bez surowego JSON-u, danych karty i identyfikatorów płatności.'
                  : 'Tekst OCR i dane preprocessingu pozostają tylko w pamięci tej sesji.'}</span>
              </summary>
              <div className="receipt-ocr-diagnostic-actions">
                {sourceKind === 'structured-json' ? <>
                  <button type="button" className="button button-secondary button-small" onClick={() => void copyStructuredJsonFeedback()} disabled={!jsonFeedbackText}>Kopiuj diagnostykę JSON</button>
                  <button type="button" className="button button-secondary button-small" onClick={downloadStructuredJsonFeedback} disabled={!jsonFeedbackText}>Pobierz raport JSON</button>
                </> : <>
                  <button type="button" className="button button-secondary button-small" onClick={() => void copyDiagnosticOcrText()} disabled={!diagnosticOcrText}>Kopiuj tekst OCR</button>
                  {diagnosticOcrMeta?.geometryAvailable ? <button type="button" className="button button-secondary button-small" onClick={() => void copyPrivateGeometrySnapshot()}>Kopiuj geom. JSON</button> : null}
                </>}
              </div>
              {sourceKind === 'structured-json' && jsonFeedbackContext ? (
                <dl className="receipt-ocr-diagnostic-meta">
                  <div><dt>Źródło</dt><dd>JSON bez OCR</dd></div>
                  <div><dt>Format</dt><dd>{jsonFeedbackContext.format}</dd></div>
                  <div><dt>Waluta</dt><dd>{jsonFeedbackContext.currency}</dd></div>
                  <div><dt>Pozycje</dt><dd>{review.items.length}</dd></div>
                  <div><dt>Do sprawdzenia</dt><dd>{flaggedItemsCount}</dd></div>
                  <div><dt>Suma pozycji</dt><dd>{reviewAmountMinor(finalItemsTotalMinor, displayCurrency)}</dd></div>
                  {review.depositTotalMinor !== undefined ? <div><dt>Kaucja</dt><dd>{reviewAmountMinor(review.depositTotalMinor, displayCurrency)}</dd></div> : null}
                  {review.declaredTotalMinor !== undefined ? <div><dt>Final</dt><dd>{reviewAmountMinor(review.declaredTotalMinor, displayCurrency)}</dd></div> : null}
                  {review.paymentTotalMinor !== undefined ? <div><dt>Płatność</dt><dd>{reviewAmountMinor(review.paymentTotalMinor, displayCurrency)}</dd></div> : null}
                  <div><dt>Różnica</dt><dd>{differenceMinor === undefined ? 'brak' : reviewAmountMinor(differenceMinor, displayCurrency)}</dd></div>
                  <div><dt>Zapis</dt><dd>{saveValidation.valid ? 'GOTOWY' : 'BLOKOWANY'}</dd></div>
                </dl>
              ) : diagnosticOcrMeta ? (
                <dl className="receipt-ocr-diagnostic-meta">
                  <div><dt>Źródło</dt><dd>{diagnosticOcrMeta.sourceType === 'pdf' ? 'PDF' : 'Zdjęcie'}</dd></div>
                  <div><dt>Jakość źródła</dt><dd>{sourceQualityLabel(diagnosticOcrMeta.sourceQuality.level)} ({diagnosticOcrMeta.sourceQuality.score}/100)</dd></div>
                  {diagnosticOcrMeta.sourceType === 'pdf' ? <div><dt>Strony</dt><dd>{diagnosticOcrMeta.pagesProcessed}/{diagnosticOcrMeta.pageCount}</dd></div> : null}
                  <div><dt>Wymiary</dt><dd>{diagnosticOcrMeta.sourceWidth} × {diagnosticOcrMeta.sourceHeight}</dd></div>
                  <div><dt>OCR</dt><dd>{diagnosticOcrMeta.processedWidth} × {diagnosticOcrMeta.processedHeight}</dd></div>
                  <div><dt>Skala</dt><dd>{diagnosticOcrMeta.scale.toFixed(2)}×</dd></div>
                  <div><dt>Inwersja</dt><dd>{diagnosticOcrMeta.inverted ? 'TAK' : 'NIE'}</dd></div>
                  <div><dt>Crop</dt><dd>{diagnosticOcrMeta.cropApplied ? 'TAK' : 'NIE'}</dd></div>
                  {diagnosticOcrMeta.sourceType === 'photo' ? (
                    <div><dt>Fiscal recovery</dt><dd>{diagnosticOcrMeta.fiscalRecoveryAttempted ? (diagnosticOcrMeta.fiscalRecoverySelected ? 'WYBRANO' : 'ODRZUCONO') : 'NIE'}</dd></div>
                  ) : null}
                  {diagnosticOcrMeta.sourceType === 'photo' && diagnosticOcrMeta.fiscalRecoveryCropAvailable ? (
                    <div><dt>Fiscal crop</dt><dd>{diagnosticOcrMeta.fiscalRecoverySubregionApplied ? 'SUBREGION' : 'PAPIER'}{diagnosticOcrMeta.fiscalRecoveryCropBottomRatio !== undefined ? ` (${Math.round(diagnosticOcrMeta.fiscalRecoveryCropBottomRatio * 100)}% H)` : ''}</dd></div>
                  ) : null}
                  {diagnosticOcrMeta.sourceType === 'photo' && diagnosticOcrMeta.fiscalThresholdRecoveryAttempted ? (
                    <div><dt>Fiscal threshold</dt><dd>{diagnosticOcrMeta.fiscalThresholdRecoverySelected ? 'WYBRANO' : 'ODRZUCONO'}</dd></div>
                  ) : null}
                  {diagnosticOcrMeta.sourceType === 'photo' ? <div><dt>Merchant source</dt><dd>{diagnosticOcrMeta.merchantRecoverySource ?? 'unresolved'}</dd></div> : null}
                  {diagnosticOcrMeta.sourceType === 'photo' ? <div><dt>Data source</dt><dd>{diagnosticOcrMeta.dateRecoverySource ?? 'unresolved'}{diagnosticOcrMeta.dateDecision === 'rejected' ? ` (${diagnosticOcrMeta.dateRejectReason ?? 'rejected'})` : ''}</dd></div> : null}
                  {diagnosticOcrMeta.sourceType === 'photo' ? <div><dt>Items source</dt><dd>{diagnosticOcrMeta.itemBlockSource ?? 'unresolved'}</dd></div> : null}
                  {diagnosticOcrMeta.sourceType === 'photo' ? <div><dt>Tail</dt><dd>{diagnosticOcrMeta.marketingTailDetected ? 'marketing' : 'nie'} / {diagnosticOcrMeta.footerContaminationDetected ? 'footer contamination' : 'czysto'}</dd></div> : null}
                  {diagnosticOcrMeta.sourceType === 'photo' && diagnosticOcrMeta.merchantHeaderAttempted ? (
                    <div><dt>Merchant header</dt><dd>{diagnosticOcrMeta.merchantDecision ?? 'unresolved'}{diagnosticOcrMeta.merchantCandidate ? `: ${diagnosticOcrMeta.merchantCandidate}` : ''}{diagnosticOcrMeta.merchantDecision === 'rejected' && diagnosticOcrMeta.merchantRejectReason ? ` (${diagnosticOcrMeta.merchantRejectReason})` : ''}</dd></div>
                  ) : null}
                  {diagnosticOcrMeta.sourceType === 'photo' && diagnosticOcrMeta.candidateDiagnostics?.length ? (
                    <div><dt>Kandydaci</dt><dd>{diagnosticOcrMeta.candidateDiagnostics.map((candidate) => `${candidate.source}${candidate.selected ? '*' : ''} ${candidate.candidateScore} [S${candidate.structuralScore}/F${candidate.financialScore}] ${candidate.itemsCount}p`).join(' | ')}</dd></div>
                  ) : null}
                  {diagnosticOcrMeta.sourceType === 'photo' ? <div><dt>OCR passy</dt><dd>full {diagnosticOcrMeta.fullOcrPasses ?? 0} / fiscal {diagnosticOcrMeta.fiscalOcrPasses ?? 0} / header {diagnosticOcrMeta.headerOcrPasses ?? 0} / value {diagnosticOcrMeta.valueColumnRecoveryPasses ?? 0}</dd></div> : null}
                  <div><dt>Prostowanie</dt><dd>{diagnosticOcrMeta.deskewDegrees.toFixed(1)}°</dd></div>
                  <div><dt>Fragmenty</dt><dd>{diagnosticOcrMeta.chunkCount}</dd></div>
                  <div><dt>Geometria</dt><dd>{diagnosticOcrMeta.geometryAvailable ? `${diagnosticOcrMeta.geometryTokenCount ?? 0} tokenów / ${diagnosticOcrMeta.geometryRowCount ?? 0} wierszy` : 'BRAK'}</dd></div>
                  {diagnosticOcrMeta.geometryAvailable ? <div><dt>Źródło geom.</dt><dd>{diagnosticOcrMeta.geometrySource ?? 'unknown'}</dd></div> : null}
                  {diagnosticOcrMeta.geometryAvailable ? <div><dt>Kolumny geom.</dt><dd>{diagnosticOcrMeta.geometryColumnSource ?? 'none'}{diagnosticOcrMeta.geometryColumnConfidence !== undefined ? ` (${Math.round(diagnosticOcrMeta.geometryColumnConfidence * 100)}%)` : ''}</dd></div> : null}
                  {diagnosticOcrMeta.geometryAvailable ? <div><dt>Geom. pozycje</dt><dd>kompletne {diagnosticOcrMeta.geometryReconstructedCompleteItemCount ?? 0}/{diagnosticOcrMeta.geometryReconstructedItemCount ?? 0} / nierozstrz. {diagnosticOcrMeta.geometryReconstructedUnresolvedItemCount ?? 0} / plain {diagnosticOcrMeta.geometryRowMajorParsedItemCount ?? 0} / parser {diagnosticOcrMeta.geometryParsedItemCount ?? 0}</dd></div> : null}
                  {diagnosticOcrMeta.geometryAvailable ? <div><dt>Geom. unresolved</dt><dd>rabat {diagnosticOcrMeta.geometryReconstructedDiscountUnresolvedCount ?? 0} / ilość {diagnosticOcrMeta.geometryReconstructedQuantityUnresolvedCount ?? 0}</dd></div> : null}
                  {diagnosticOcrMeta.geometryReconstructedGrossTotalMinor !== undefined ? <div><dt>Geom. brutto poz.</dt><dd>{reviewAmountMinor(diagnosticOcrMeta.geometryReconstructedGrossTotalMinor, displayCurrency)}</dd></div> : null}
                  {diagnosticOcrMeta.geometryReconstructedDiscountTotalMinor !== undefined ? <div><dt>Geom. rabaty</dt><dd>{reviewAmountMinor(diagnosticOcrMeta.geometryReconstructedDiscountTotalMinor, displayCurrency)}</dd></div> : null}
                  {diagnosticOcrMeta.geometryReconstructedItemsTotalMinor !== undefined ? <div><dt>Geom. netto poz.</dt><dd>{reviewAmountMinor(diagnosticOcrMeta.geometryReconstructedItemsTotalMinor, displayCurrency)}</dd></div> : null}
                  {diagnosticOcrMeta.geometryRowMajorParsedItemsTotalMinor !== undefined ? <div><dt>Geom. plain suma</dt><dd>{reviewAmountMinor(diagnosticOcrMeta.geometryRowMajorParsedItemsTotalMinor, displayCurrency)}</dd></div> : null}
                  {diagnosticOcrMeta.geometryParsedItemsTotalMinor !== undefined ? <div><dt>Geom. parser suma</dt><dd>{reviewAmountMinor(diagnosticOcrMeta.geometryParsedItemsTotalMinor, displayCurrency)}{diagnosticOcrMeta.geometryStructuredTextGenerated ? ' (structured)' : ''}</dd></div> : null}
                  {diagnosticOcrMeta.geometryAvailable ? <div><dt>Geom. kandydat</dt><dd>{diagnosticOcrMeta.geometryStructuredCandidateAccepted ? 'AKCEPTOWANY' : `ODRZUCONY${diagnosticOcrMeta.geometryStructuredCandidateRejectionReasons?.length ? ` (${diagnosticOcrMeta.geometryStructuredCandidateRejectionReasons.join(', ')})` : ''}`}</dd></div> : null}
                  {diagnosticOcrMeta.valueColumnRecoveryAttempted ? <div><dt>Value recovery</dt><dd>{diagnosticOcrMeta.valueColumnRecoveryUsed ? 'UŻYTE' : 'ODRZUCONE'} / pass {diagnosticOcrMeta.valueColumnRecoveryPasses ?? 0}</dd></div> : <div><dt>Value recovery</dt><dd>NIE</dd></div>}
                  {diagnosticOcrMeta.valueColumnRecoveryCropX0 !== undefined && diagnosticOcrMeta.valueColumnRecoveryCropY0 !== undefined && diagnosticOcrMeta.valueColumnRecoveryCropX1 !== undefined && diagnosticOcrMeta.valueColumnRecoveryCropY1 !== undefined ? <div><dt>Recovery crop</dt><dd>{diagnosticOcrMeta.valueColumnRecoveryCropX0},{diagnosticOcrMeta.valueColumnRecoveryCropY0} → {diagnosticOcrMeta.valueColumnRecoveryCropX1},{diagnosticOcrMeta.valueColumnRecoveryCropY1} ({diagnosticOcrMeta.valueColumnRecoveryCropPixels ?? 0} px)</dd></div> : null}
                  {diagnosticOcrMeta.valueColumnRecoveryAttempted ? <div><dt>Recovery tokeny</dt><dd>{diagnosticOcrMeta.valueColumnRecoveryTokenCount ?? 0} / użyteczne {diagnosticOcrMeta.valueColumnRecoveryUsableTokenCount ?? 0}</dd></div> : null}
                  {diagnosticOcrMeta.valueColumnRecoveryAttempted ? <div><dt>Recovery komórki</dt><dd>gross {diagnosticOcrMeta.valueColumnRecoveryRecoveredGrossCells ?? 0} / rabat {diagnosticOcrMeta.valueColumnRecoveryRecoveredDiscountCells ?? 0} / net {diagnosticOcrMeta.valueColumnRecoveryRecoveredNetCells ?? 0} / komplet +{diagnosticOcrMeta.valueColumnRecoveryRecoveredCompleteGroups ?? 0}</dd></div> : null}
                  {diagnosticOcrMeta.geometryParsedFinalTotalMinor !== undefined ? <div><dt>Geom. final</dt><dd>{reviewAmountMinor(diagnosticOcrMeta.geometryParsedFinalTotalMinor, displayCurrency)}</dd></div> : null}
                  {diagnosticOcrMeta.geometryParsedPaymentTotalMinor !== undefined ? <div><dt>Geom. płatność</dt><dd>{reviewAmountMinor(diagnosticOcrMeta.geometryParsedPaymentTotalMinor, displayCurrency)}</dd></div> : null}
                  <div><dt>Geom. wybrana</dt><dd>{diagnosticOcrMeta.geometrySelected ? 'TAK' : 'NIE - eksperyment'}</dd></div>
                  {diagnosticOcrQuality ? <div><dt>Jakość OCR</dt><dd>{qualityLabel(diagnosticOcrQuality.level)} ({diagnosticOcrQuality.score}/100)</dd></div> : null}
                  {diagnosticOcrQuality ? <div><dt>Finanse</dt><dd>{diagnosticOcrQuality.financialScore}/100</dd></div> : null}
                  {review.ocrSubtotalMinor !== undefined ? <div><dt>Subtotal OCR</dt><dd>{reviewAmountMinor(review.ocrSubtotalMinor, displayCurrency)}</dd></div> : null}
                  {review.declaredSubtotalMinor !== undefined ? <div><dt>Subtotal uzgodniony</dt><dd>{reviewAmountMinor(review.declaredSubtotalMinor, displayCurrency)}</dd></div> : null}
                  {review.depositTotalMinor !== undefined ? <div><dt>Kaucja</dt><dd>{reviewAmountMinor(review.depositTotalMinor, displayCurrency)}</dd></div> : null}
                  {review.paymentTotalMinor !== undefined ? <div><dt>Płatność</dt><dd>{reviewAmountMinor(review.paymentTotalMinor, displayCurrency)}</dd></div> : null}
                  {diagnosticOcrQuality ? <div><dt>Tekst</dt><dd>{diagnosticOcrQuality.textScore}/100</dd></div> : null}
                  {diagnosticOcrQuality ? <div><dt>Spójne fin.</dt><dd>{diagnosticOcrQuality.consistentFinancialLines}</dd></div> : null}
                  {diagnosticOcrQuality ? <div><dt>Podejrzane</dt><dd>{diagnosticOcrQuality.suspiciousFinancialLines + diagnosticOcrQuality.suspiciousTokens}</dd></div> : null}
                </dl>
              ) : null}
              {diagnosticOcrMeta?.sourceQuality.warnings.length ? <small>{diagnosticOcrMeta.sourceQuality.warnings.join(' ')}</small> : null}
              {diagnosticOcrQuality?.warnings.length ? <small>{diagnosticOcrQuality.warnings.join(' ')}</small> : null}
              {diagnosticCopyStatus ? <small role="status">{diagnosticCopyStatus}</small> : null}
              {showDiagnosticFallback ? <textarea readOnly value={sourceKind === 'structured-json' ? jsonFeedbackText : diagnosticOcrText} aria-label={sourceKind === 'structured-json' ? 'Diagnostyka JSON do ręcznego skopiowania' : 'Surowy tekst OCR do ręcznego skopiowania'} rows={8} /> : null}
            </details>
          ) : null}

          <div className={`receipt-review-totals${mismatch ? ' has-mismatch' : ''}`} aria-live="polite">
            <div><span>Suma pozycji</span><strong>{reviewAmountMinor(finalItemsTotalMinor, displayCurrency)}</strong></div>
            <div><span>Oszczędność</span><strong>{reviewAmountMinor(savingsMinor, displayCurrency)}</strong></div>
            {review.depositTotalMinor !== undefined && review.depositTotalMinor > 0 ? <div><span>Kaucja</span><strong>{reviewAmountMinor(review.depositTotalMinor, displayCurrency)}</strong></div> : null}
            <div><span>Suma paragonu</span><strong>{review.declaredTotalMinor === undefined ? 'Nie rozpoznano' : reviewAmountMinor(review.declaredTotalMinor, displayCurrency)}</strong></div>
            {differenceMinor === undefined ? <small>Sprawdź sumę bezpośrednio na zdjęciu.</small> : Math.abs(differenceMinor) <= 1 ? <small className="receipt-review-match">Zgodne</small> : <small className="receipt-review-mismatch">Różnica {reviewAmountMinor(Math.abs(differenceMinor), displayCurrency)}</small>}
          </div>

          {warnings.length ? (
            <div className="receipt-review-warnings" aria-label="Uwagi do rozpoznania">
              {warnings.map((warning, index) => <p key={`${warning.code}-${index}`}>{warning.message}</p>)}
            </div>
          ) : null}

          {confirmMismatch ? (
            <div className="receipt-review-save-warning" role="alert">
              <strong>Suma pozycji różni się od paragonu o {reviewAmountMinor(Math.abs(differenceMinor ?? 0), displayCurrency)}.</strong>
              <span>Sprawdź zaznaczone pozycje. Jeśli różnica jest prawidłowa, kliknij ponownie „Zapisz paragon”.</span>
            </div>
          ) : null}

          {!saveValidation.valid ? <p className="receipt-review-inline-warning" role="status">{saveValidation.message}</p> : null}
          <div className="receipt-review-actions">
            <button type="button" className="button button-secondary" onClick={onCancel} disabled={saving}>Anuluj</button>
            <button type="button" className="button button-primary" onClick={() => void save()} disabled={saving || !saveValidation.valid}>{saving ? 'Zapisywanie...' : 'Zapisz paragon'}</button>
          </div>
        </section>
      </div>
    </div>
  );
}
