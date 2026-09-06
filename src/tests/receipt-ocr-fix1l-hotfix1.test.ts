import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

describe('1.1.0-dev.3 DEV3-B019 FIX1L hotfix regressions', () => {
  it('preserves a generic Sklep descriptor when it is part of the meaningful merchant name', () => {
    const parsed = parseReceiptText(`SKLEP SPOZYWCZY\nul. Testowa 12\nNIP 1234567890\n16.08.2026 19:42\nPARAGON FISKALNY\nCHLEB 1 x 5,00 5,00\nSUMA 5,00`);
    expect(parsed.merchant).toBe('SKLEP SPOZYWCZY');
  });

  it('still extracts a brand-like name from Sklep X when X is not only a generic shop type', () => {
    const parsed = parseReceiptText(`TEST GROUP S.A.\nSklep AURORA\nPARAGON FISKALNY\nProdukt Testowy 1 x 10,00 10,00\nSUMA 10,00`);
    expect(parsed.merchant).toBe('AURORA');
  });

  it('does not treat a product containing the word Rabat as a discount row', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nPARAGON FISKALNY\nProdukt Rabat 1 x 5,00 5,00\nRabat -1,00\n4,00\nSUMA PLN 4,00`);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.name).toBe('Produkt Rabat');
    expect(parsed.items[0]?.amountMinor).toBe(400);
  });

  it('does not treat a product containing the word Opust as an Opust label', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nPARAGON FISKALNY\nProdukt Opust 1 x 5,00 5,00\nOpust -1,00\n4,00\nSUMA PLN 4,00`);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.name).toBe('Produkt Opust');
    expect(parsed.items[0]?.amountMinor).toBe(400);
  });

  it('enters payment context when a Bon/Karta line follows a final total', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nPARAGON FISKALNY\nProdukt A 1 x 2,00 2,00\nSUMA PLN 2,00\nBon 1,00\nKarta 1,00`);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.amountMinor).toBe(200);
    expect(parsed.detectedItemsTotalMinor).toBe(200);
  });
});
