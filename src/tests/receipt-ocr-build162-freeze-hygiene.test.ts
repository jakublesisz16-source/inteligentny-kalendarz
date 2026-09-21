import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseStructuredReceiptJsonText } from '../shopping/receipt-ocr/receipt-json';
import { normalizeReceiptItemDisplayName, parseReceiptText, resolveReceiptMerchant } from '../shopping/receipt-ocr/receipt-parser';

function structuredReceipt(): string {
  return JSON.stringify({
    protoVersion: '000',
    header: [
      { headerText: { headerTextLines: '<div>ALFA &quot;CODZIENNIE DOBRE CENY&quot; 123</div><div>00-001 MIASTO</div>' } },
      { headerData: { date: '2026-09-20T12:00:00.000Z' } },
    ],
    body: [
      { sellLine: { name: 'Produkt A C', vatId: 'C', price: 500, total: 500, quantity: '1', isStorno: false } },
      { vatSummary: { currency: 'PLN', vatRatesSummary: [{ vatId: 'C', vatRate: 500, vatSale: 500, vatAmount: 24 }] } },
      { sumInCurrency: { fiscalTotal: 500, totalWithPacks: 500, currency: 'PLN' } },
      { payment: { amount: 500, currency: 'PLN', reszta: false, type: '2' } },
      { fiscalFooter: { date: '2026-09-20T12:00:00.000Z' } },
    ],
  });
}

describe('Receipt Scanner Build162 freeze hygiene', () => {
  it('trusts an accepted merchant from structured e-receipt source without changing OCR confidence semantics', () => {
    const structured = parseStructuredReceiptJsonText(structuredReceipt()).parsed;
    expect(structured.merchant).toBe('ALFA');
    expect(structured.merchantConfidence).toBe('high');
    expect(structured.warnings.some((warning) => warning.code === 'merchant-uncertain')).toBe(false);

    const ocr = resolveReceiptMerchant('ALFA "CODZIENNIE DOBRE CENY" 123\n00-001 MIASTO');
    expect(ocr.merchant).toBe('ALFA');
    expect(ocr.confidence).toBe('medium');
    expect(ocr.warnings.some((warning) => warning.code === 'merchant-uncertain')).toBe(true);
  });

  it('repairs only conservative litre glyph errors and strips narrow PTU-column debris from display names', () => {
    expect(normalizeReceiptItemDisplayName('Mle bez lakt2 1I')).toBe('Mle bez lakt2 1l');
    expect(normalizeReceiptItemDisplayName('Olej Kujawski 1!')).toBe('Olej Kujawski 1l');
    expect(normalizeReceiptItemDisplayName('NapGazHellCze1,25I | ©')).toBe('NapGazHellCze1,25l');
    expect(normalizeReceiptItemDisplayName('WodaTestowa1|!')).toBe('WodaTestowa1l');
    expect(normalizeReceiptItemDisplayName('MODEL1I')).toBe('MODEL1I');
    expect(normalizeReceiptItemDisplayName('Produkt A | B')).toBe('Produkt A | B');
  });

  it('keeps raw OCR evidence while using the cleaned product label', () => {
    const parsed = parseReceiptText(`
SKLEP TESTOWY
PARAGON FISKALNY
Nazwa PTU Ilość Cena Wartość
Olej Kujawski 1! C 1x 6,99 6,99
Suma PLN 6,99
Karta płatnicza 6,99
Data 19/09/2026 15:10:24
`);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.rawText).toContain('Olej Kujawski 1!');
    expect(parsed.items[0]?.name).toBe('Olej Kujawski 1l');
  });

  it('labels geometry value-column recovery separately from OCR candidate recovery', () => {
    const selectorSource = readFileSync('src/shopping/receipt-ocr/receipt-geometry-production-selector.ts', 'utf8');
    expect(selectorSource).toContain("'value-column-recovery-not-attempted'");
    expect(selectorSource).toContain("'selected-value-column-recovery'");
    expect(selectorSource).not.toContain("'recovery-not-attempted'");
    expect(selectorSource).not.toContain("'selected-recovery'");
  });

});
