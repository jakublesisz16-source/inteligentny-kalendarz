import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string { return readFileSync(new URL(path, import.meta.url), 'utf8'); }

describe('1.1.0-dev.3 receipt OCR review contract', () => {
  it('keeps scan separate from manual + Paragon and uses explicit review/save', () => {
    const expenses = source('../shopping/ExpensesView.tsx');
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    const review = source('../shopping/receipt-ocr/ReceiptScanReview.tsx');
    expect(expenses).toContain('Skanuj paragon');
    expect(expenses).toContain('+ Paragon');
    expect(expenses).toContain("await createReceipt({ ...draft, source: 'receipt' })");
    expect(review).toContain('Sprawdź paragon');
    expect(review).toContain('Zapisz paragon');
    expect(flow).not.toContain('createReceipt(');
    expect(review).not.toContain('createReceipt(');
  });

  it('keeps camera capture and gallery picker as separate native actions', () => {
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    expect(flow).toContain('cameraInputRef');
    expect(flow).toContain('galleryInputRef');
    expect(flow).toContain('ref={cameraInputRef} className="visually-hidden" type="file" accept="image/*" capture="environment"');
    expect(flow).toContain('ref={galleryInputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,application/pdf,.pdf,application/json,.json" onChange={selectFile}');
    expect(flow).toContain('>Zrób zdjęcie</button>');
    expect(flow).toContain('>Wybierz zdjęcie / PDF / JSON</button>');
    expect(flow).not.toContain('Zrób lub wybierz zdjęcie');
  });

  it('supports cancel, retry, rotation and manual fallback', () => {
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    expect(flow).toContain('Spróbuj ponownie');
    expect(flow).toContain('Obróć w lewo');
    expect(flow).toContain('Obróć w prawo');
    expect(flow).toContain('Dodaj ręcznie');
    expect(flow).toContain('Anuluj');
    expect(flow).toContain('URL.revokeObjectURL');
  });

  it('keeps all OCR review fields editable and exposes mobile Data/Image switch', () => {
    const review = source('../shopping/receipt-ocr/ReceiptScanReview.tsx');
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    expect(review).toContain('>Dane</button>');
    expect(review).toContain('>Zdjęcie</button>');
    expect(review).toContain('Sklep');
    expect(review).toContain('type="date"');
    expect(review).toContain('Nazwa');
    expect(review).toContain('Kategoria');
    expect(review).toContain('Kwota');
    expect(review).toContain('+ Dodaj');
    expect(review).toContain('Do sprawdzenia');
    expect(review).toContain('Wszystkie');
    expect(review).toContain('Rozwiń wszystkie');
    expect(review).toContain('Zwiń poprawne');
    expect(review).toContain('Sprawdzone');
    expect(review).toContain("patchItem(index, { confidence: 'high', warnings: [] })");
    expect(review).toContain('Usuń');
    expect(review).toContain('Suma pozycji');
    expect(review).toContain('Oszczędność');
    expect(review).toContain('Suma paragonu');
    expect(review).toContain('Kopiuj tekst OCR');
    expect(review).toContain('Tekst OCR i dane preprocessingu pozostają tylko w pamięci tej sesji.');
    expect(review).toContain('open={diagnosticOpen}');
    expect(flow).toContain('diagnosticOcrText');
    expect(flow).toMatch(/setDiagnosticOcrText\(\s*[A-Za-z_$][\w$]*\s*\)/u);
    expect(flow).toContain('diagnosticOcrText={diagnosticOcrText}');
  });

  it('uses compact responsive review styling without horizontal grid overflow', () => {
    const components = source('../styles/components.css');
    const responsive = source('../styles/responsive.css');
    expect(components).toContain('.receipt-scan-review-grid');
    expect(components).toContain('.receipt-review-priority');
    expect(components).toContain('.receipt-review-item-filters');
    expect(components).toContain('.receipt-review-item-bottom');
    expect(responsive).toContain('@media (max-width: 760px)');
    expect(responsive).toContain('@media (max-width: 370px)');
    expect(responsive).toContain('.receipt-scan-mobile-tabs');
    expect(responsive).toContain('.receipt-scan-mobile-tabs button { min-height: 40px;');
    expect(responsive).toContain('.receipt-review-item-filters button { min-height: 40px;');
    expect(responsive).toContain('.receipt-review-item-topline .text-button { min-height: 40px;');
    expect(responsive).toContain('.receipt-review-item-compact-actions > .text-button { min-height: 40px;');
  });
});
