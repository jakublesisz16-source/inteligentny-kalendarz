import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

function merchant(header: string): string | undefined {
  return parseReceiptText(`${header}\nPARAGON FISKALNY\nProdukt Testowy 1 x 10,00 10,00\nSUMA 10,00`).merchant;
}

describe('1.1.0-dev.3 DEV3-B018 merchant resolver', () => {
  it('prefers a trade brand after Salon Firmowy over the legal entity', () => {
    expect(merchant(`TEST RETAIL S.A.\nul. Testowa 1\nSalon Firmowy NOVA`)).toBe('NOVA');
  });

  it('extracts a brand before a shopping-centre descriptor', () => {
    expect(merchant(`HOLDING TEST S.A.\nul. Testowa 1\nVISTA C.H. FORUM`)).toBe('VISTA');
  });

  it('falls back to the legal entity when no stronger brand exists', () => {
    expect(merchant(`TEST RETAIL S.A.\nul. Testowa 1\nNIP 1234567890`)).toBe('TEST RETAIL S.A');
  });

  it('rejects address, NIP, date and numeric document lines as merchant', () => {
    const parsed = parseReceiptText(`ul. Testowa 1\n00-001 Warszawa\nNIP 1234567890\n2026-08-16\nPARAGON FISKALNY\nProdukt Testowy 10,00\nSUMA 10,00`);
    expect(parsed.merchant).toBeUndefined();
    expect(parsed.merchantConfidence).toBe('low');
  });

  it('strips a generic Sklep descriptor when a meaningful name remains', () => {
    expect(merchant(`TEST GROUP S.A.\nSklep AURORA`)).toBe('AURORA');
  });

  it('is deterministic', () => {
    const raw = `TEST RETAIL S.A.\nSalon Firmowy NOVA\nPARAGON FISKALNY\nProdukt Testowy 10,00\nSUMA 10,00`;
    expect(parseReceiptText(raw)).toEqual(parseReceiptText(raw));
  });
});
