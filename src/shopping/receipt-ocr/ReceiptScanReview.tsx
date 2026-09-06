import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { ExpenseCategory, ReceiptDraft } from '../expenses.types';
import { formatMoneyMinor } from '../expenses.utils';
import type { ReceiptOcrDiagnostics, ReceiptOcrQuality, ReceiptReviewDraft, ReceiptReviewItem } from './receipt-ocr.types';
import {
  isSignificantReceiptMismatch,
  receiptReviewDifferenceMinor,
  receiptReviewItemsTotalMinor,
  receiptReviewSavingsMinor,
  receiptReviewToDraft,
  validateReceiptReviewForSave,
} from './receipt-review.model';

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
  onChange: (review: ReceiptReviewDraft) => void;
  onRotate: (direction: 'left' | 'right') => void;
  onRerun: () => void;
  onCancel: () => void;
  onSave: (draft: ReceiptDraft) => Promise<void>;
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
  onChange,
  onRotate,
  onRerun,
  onCancel,
  onSave,
}: ReceiptScanReviewProps) {
  const [mobilePane, setMobilePane] = useState<'data' | 'image'>('data');
  const [localError, setLocalError] = useState('');
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const [diagnosticCopyStatus, setDiagnosticCopyStatus] = useState('');
  const [showDiagnosticFallback, setShowDiagnosticFallback] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const finalItemsTotalMinor = useMemo(() => receiptReviewItemsTotalMinor(review), [review]);
  const savingsMinor = useMemo(() => receiptReviewSavingsMinor(review), [review]);
  const differenceMinor = useMemo(() => receiptReviewDifferenceMinor(review), [review]);
  const mismatch = differenceMinor !== undefined && Math.abs(differenceMinor) > 1;
  const validCategoryIds = useMemo(() => new Set(categories.map((category) => category.id)), [categories]);
  const saveValidation = useMemo(() => validateReceiptReviewForSave(review, validCategoryIds), [review, validCategoryIds]);

  useEffect(() => { titleRef.current?.focus(); }, []);

  function patch(patchValue: Partial<ReceiptReviewDraft>) {
    setLocalError('');
    setConfirmMismatch(false);
    onChange({ ...review, ...patchValue });
  }

  function patchItem(index: number, patchValue: Partial<ReceiptReviewItem>) {
    patch({ items: review.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patchValue } : item) });
  }

  function patchItemAmount(index: number, amountText: string) {
    patch({
      items: review.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const { baseAmountMinor: _baseAmountMinor, discountMinor: _discountMinor, ...rest } = item;
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

  function fallbackCopyDiagnosticText(): boolean {
    const textarea = document.createElement('textarea');
    textarea.value = diagnosticOcrText;
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
      } else if (!fallbackCopyDiagnosticText()) {
        throw new Error('Clipboard unavailable');
      }
      setDiagnosticCopyStatus('Skopiowano tekst OCR.');
    } catch {
      if (fallbackCopyDiagnosticText()) {
        setDiagnosticCopyStatus('Skopiowano tekst OCR.');
        return;
      }
      setShowDiagnosticFallback(true);
      setDiagnosticCopyStatus('Nie udało się skopiować automatycznie. Zaznacz tekst poniżej ręcznie.');
    }
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
      const draft = receiptReviewToDraft(review);
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
          <p className="section-kicker">Lokalny OCR</p>
          <h2 ref={titleRef} tabIndex={-1}>Sprawdź paragon</h2>
        </div>
        <div className="receipt-scan-mobile-tabs" role="tablist" aria-label="Widok paragonu">
          <button type="button" role="tab" aria-selected={mobilePane === 'data'} className={mobilePane === 'data' ? 'is-active' : ''} onClick={() => setMobilePane('data')}>Dane</button>
          <button type="button" role="tab" aria-selected={mobilePane === 'image'} className={mobilePane === 'image' ? 'is-active' : ''} onClick={() => setMobilePane('image')}>Zdjęcie</button>
        </div>
      </div>

      <div className="receipt-scan-review-grid">
        <aside className={`receipt-scan-image-pane${mobilePane === 'image' ? ' is-mobile-active' : ''}`} aria-label="Zdjęcie paragonu">
          <div className="receipt-scan-image-frame">
            <img src={imageUrl} alt="Zdjęcie paragonu do porównania z rozpoznanymi danymi" style={{ transform: `rotate(${rotation}deg)` }} />
          </div>
          <div className="receipt-scan-image-actions">
            <button type="button" className="button button-secondary button-small" onClick={() => onRotate('left')}>Obróć w lewo</button>
            <button type="button" className="button button-secondary button-small" onClick={() => onRotate('right')}>Obróć w prawo</button>
            <button type="button" className="text-button" onClick={onRerun}>Rozpoznaj ponownie</button>
          </div>
        </aside>

        <section className={`receipt-scan-data-pane${mobilePane === 'data' ? ' is-mobile-active' : ''}`} aria-label="Rozpoznane dane paragonu">
          {(error || localError) ? <div className="study-message error-message receipt-scan-message" role="alert">{error || localError}</div> : null}
          {!review.items.length ? (
            <div className="receipt-scan-empty" role="status">
              <strong>Nie udało się automatycznie rozpoznać pozycji.</strong>
              <span>Dodaj je ręcznie na podstawie zdjęcia.</span>
            </div>
          ) : null}

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

          <div className="receipt-review-items-heading">
            <strong>Pozycje <span>{review.items.length}</span></strong>
            <button type="button" className="button button-secondary button-small" onClick={addItem}>+ Dodaj</button>
          </div>

          <div className="receipt-review-items">
            {review.items.map((item, index) => (
              <article className={`receipt-review-item${item.confidence === 'high' ? '' : ' needs-review'}`} key={item.localId}>
                <div className="receipt-review-item-topline">
                  <span>#{index + 1}</span>
                  {item.confidence !== 'high' ? <small>{confidenceLabel(item.confidence)}</small> : null}
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
                    <span>Kwota</span>
                    <input inputMode="decimal" value={item.amountText} onChange={(event: ChangeEvent<HTMLInputElement>) => patchItemAmount(index, event.target.value)} placeholder="0,00" aria-label={`Kwota pozycji ${index + 1}`} />
                  </label>
                </div>
                {item.warnings.length ? <p className="receipt-review-inline-warning">{item.warnings.join(' ')}</p> : null}
              </article>
            ))}
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
            <div className="receipt-ocr-diagnostic" aria-label="Diagnostyka OCR FIX1J">
              <div>
                <strong>Diagnostyka FIX1J</strong>
                <span>Tekst OCR jest tylko w pamięci tej sesji i nie jest zapisywany. Dane preprocessingu i jakości również są tylko w pamięci tej sesji i nie są zapisywane.</span>
              </div>
              <div className="receipt-ocr-diagnostic-actions">
                <button type="button" className="button button-secondary button-small" onClick={() => void copyDiagnosticOcrText()} disabled={!diagnosticOcrText}>Kopiuj tekst OCR</button>
                {diagnosticOcrMeta?.geometryAvailable ? <button type="button" className="button button-secondary button-small" onClick={() => void copyPrivateGeometrySnapshot()}>Kopiuj geom. JSON</button> : null}
              </div>
              {diagnosticOcrMeta ? (
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
                  {diagnosticOcrMeta.geometryReconstructedGrossTotalMinor !== undefined ? <div><dt>Geom. brutto poz.</dt><dd>{formatMoneyMinor(diagnosticOcrMeta.geometryReconstructedGrossTotalMinor)}</dd></div> : null}
                  {diagnosticOcrMeta.geometryReconstructedDiscountTotalMinor !== undefined ? <div><dt>Geom. rabaty</dt><dd>{formatMoneyMinor(diagnosticOcrMeta.geometryReconstructedDiscountTotalMinor)}</dd></div> : null}
                  {diagnosticOcrMeta.geometryReconstructedItemsTotalMinor !== undefined ? <div><dt>Geom. netto poz.</dt><dd>{formatMoneyMinor(diagnosticOcrMeta.geometryReconstructedItemsTotalMinor)}</dd></div> : null}
                  {diagnosticOcrMeta.geometryRowMajorParsedItemsTotalMinor !== undefined ? <div><dt>Geom. plain suma</dt><dd>{formatMoneyMinor(diagnosticOcrMeta.geometryRowMajorParsedItemsTotalMinor)}</dd></div> : null}
                  {diagnosticOcrMeta.geometryParsedItemsTotalMinor !== undefined ? <div><dt>Geom. parser suma</dt><dd>{formatMoneyMinor(diagnosticOcrMeta.geometryParsedItemsTotalMinor)}{diagnosticOcrMeta.geometryStructuredTextGenerated ? ' (structured)' : ''}</dd></div> : null}
                  {diagnosticOcrMeta.geometryAvailable ? <div><dt>Geom. kandydat</dt><dd>{diagnosticOcrMeta.geometryStructuredCandidateAccepted ? 'AKCEPTOWANY' : `ODRZUCONY${diagnosticOcrMeta.geometryStructuredCandidateRejectionReasons?.length ? ` (${diagnosticOcrMeta.geometryStructuredCandidateRejectionReasons.join(', ')})` : ''}`}</dd></div> : null}
                  {diagnosticOcrMeta.valueColumnRecoveryAttempted ? <div><dt>Value recovery</dt><dd>{diagnosticOcrMeta.valueColumnRecoveryUsed ? 'UŻYTE' : 'ODRZUCONE'} / pass {diagnosticOcrMeta.valueColumnRecoveryPasses ?? 0}</dd></div> : <div><dt>Value recovery</dt><dd>NIE</dd></div>}
                  {diagnosticOcrMeta.valueColumnRecoveryCropX0 !== undefined && diagnosticOcrMeta.valueColumnRecoveryCropY0 !== undefined && diagnosticOcrMeta.valueColumnRecoveryCropX1 !== undefined && diagnosticOcrMeta.valueColumnRecoveryCropY1 !== undefined ? <div><dt>Recovery crop</dt><dd>{diagnosticOcrMeta.valueColumnRecoveryCropX0},{diagnosticOcrMeta.valueColumnRecoveryCropY0} → {diagnosticOcrMeta.valueColumnRecoveryCropX1},{diagnosticOcrMeta.valueColumnRecoveryCropY1} ({diagnosticOcrMeta.valueColumnRecoveryCropPixels ?? 0} px)</dd></div> : null}
                  {diagnosticOcrMeta.valueColumnRecoveryAttempted ? <div><dt>Recovery tokeny</dt><dd>{diagnosticOcrMeta.valueColumnRecoveryTokenCount ?? 0} / użyteczne {diagnosticOcrMeta.valueColumnRecoveryUsableTokenCount ?? 0}</dd></div> : null}
                  {diagnosticOcrMeta.valueColumnRecoveryAttempted ? <div><dt>Recovery komórki</dt><dd>gross {diagnosticOcrMeta.valueColumnRecoveryRecoveredGrossCells ?? 0} / rabat {diagnosticOcrMeta.valueColumnRecoveryRecoveredDiscountCells ?? 0} / net {diagnosticOcrMeta.valueColumnRecoveryRecoveredNetCells ?? 0} / komplet +{diagnosticOcrMeta.valueColumnRecoveryRecoveredCompleteGroups ?? 0}</dd></div> : null}
                  {diagnosticOcrMeta.geometryParsedFinalTotalMinor !== undefined ? <div><dt>Geom. final</dt><dd>{formatMoneyMinor(diagnosticOcrMeta.geometryParsedFinalTotalMinor)}</dd></div> : null}
                  {diagnosticOcrMeta.geometryParsedPaymentTotalMinor !== undefined ? <div><dt>Geom. płatność</dt><dd>{formatMoneyMinor(diagnosticOcrMeta.geometryParsedPaymentTotalMinor)}</dd></div> : null}
                  <div><dt>Geom. wybrana</dt><dd>{diagnosticOcrMeta.geometrySelected ? 'TAK' : 'NIE - eksperyment'}</dd></div>
                  {diagnosticOcrQuality ? <div><dt>Jakość OCR</dt><dd>{qualityLabel(diagnosticOcrQuality.level)} ({diagnosticOcrQuality.score}/100)</dd></div> : null}
                  {diagnosticOcrQuality ? <div><dt>Finanse</dt><dd>{diagnosticOcrQuality.financialScore}/100</dd></div> : null}
                  {review.ocrSubtotalMinor !== undefined ? <div><dt>Subtotal OCR</dt><dd>{formatMoneyMinor(review.ocrSubtotalMinor)}</dd></div> : null}
                  {review.declaredSubtotalMinor !== undefined ? <div><dt>Subtotal uzgodniony</dt><dd>{formatMoneyMinor(review.declaredSubtotalMinor)}</dd></div> : null}
                  {review.depositTotalMinor !== undefined ? <div><dt>Kaucja</dt><dd>{formatMoneyMinor(review.depositTotalMinor)}</dd></div> : null}
                  {review.paymentTotalMinor !== undefined ? <div><dt>Płatność</dt><dd>{formatMoneyMinor(review.paymentTotalMinor)}</dd></div> : null}
                  {diagnosticOcrQuality ? <div><dt>Tekst</dt><dd>{diagnosticOcrQuality.textScore}/100</dd></div> : null}
                  {diagnosticOcrQuality ? <div><dt>Spójne fin.</dt><dd>{diagnosticOcrQuality.consistentFinancialLines}</dd></div> : null}
                  {diagnosticOcrQuality ? <div><dt>Podejrzane</dt><dd>{diagnosticOcrQuality.suspiciousFinancialLines + diagnosticOcrQuality.suspiciousTokens}</dd></div> : null}
                </dl>
              ) : null}
              {diagnosticOcrMeta?.sourceQuality.warnings.length ? <small>{diagnosticOcrMeta.sourceQuality.warnings.join(' ')}</small> : null}
              {diagnosticOcrQuality?.warnings.length ? <small>{diagnosticOcrQuality.warnings.join(' ')}</small> : null}
              {diagnosticCopyStatus ? <small role="status">{diagnosticCopyStatus}</small> : null}
              {showDiagnosticFallback ? <textarea readOnly value={diagnosticOcrText} aria-label="Surowy tekst OCR do ręcznego skopiowania" rows={8} /> : null}
            </div>
          ) : null}

          <div className={`receipt-review-totals${mismatch ? ' has-mismatch' : ''}`} aria-live="polite">
            <div><span>Suma pozycji</span><strong>{formatMoneyMinor(finalItemsTotalMinor)}</strong></div>
            <div><span>Oszczędność</span><strong>{formatMoneyMinor(savingsMinor)}</strong></div>
            {review.depositTotalMinor !== undefined && review.depositTotalMinor > 0 ? <div><span>Kaucja</span><strong>{formatMoneyMinor(review.depositTotalMinor)}</strong></div> : null}
            <div><span>Suma paragonu</span><strong>{review.declaredTotalMinor === undefined ? 'Nie rozpoznano' : formatMoneyMinor(review.declaredTotalMinor)}</strong></div>
            {differenceMinor === undefined ? <small>Sprawdź sumę bezpośrednio na zdjęciu.</small> : Math.abs(differenceMinor) <= 1 ? <small className="receipt-review-match">Zgodne</small> : <small className="receipt-review-mismatch">Różnica {formatMoneyMinor(Math.abs(differenceMinor))}</small>}
          </div>

          {warnings.length ? (
            <div className="receipt-review-warnings" aria-label="Uwagi do rozpoznania">
              {warnings.map((warning, index) => <p key={`${warning.code}-${index}`}>{warning.message}</p>)}
            </div>
          ) : null}

          {confirmMismatch ? (
            <div className="receipt-review-save-warning" role="alert">
              <strong>Suma różni się co najmniej o 1,00 zł.</strong>
              <span>Jeśli dane są poprawne, kliknij ponownie „Zapisz paragon”.</span>
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
