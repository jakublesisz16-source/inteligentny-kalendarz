import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

function parseMerchant(header: string) {
  return parseReceiptText(`${header}\nPARAGON FISKALNY\nProdukt Testowy 1 x 10,00 10,00\nSUMA 10,00`);
}

describe('1.1.0-dev.3 DEV3-B020 merchant consensus', () => {
  it('uses legal entity plus domain consensus to recover the complete brand', () => {
    const parsed = parseMerchant('ABC S.A.\nwww.abc.eu\nSalon Firmowy AB');
    expect(parsed.merchant).toBe('ABC');
    expect(parsed.merchantConfidence).toBe('high');
  });

  it('uses a shopping-centre descriptor as a trade brand instead of holding company', () => {
    expect(parseMerchant('LEGAL HOLDING S.A.\nVENETA C.H. FORUM').merchant).toBe('VENETA');
  });

  it('keeps a generic store name when there is no independent brand evidence', () => {
    expect(parseMerchant('SKLEP SPOZYWCZY').merchant).toBe('SKLEP SPOZYWCZY');
  });

  it('prefers a concise plain brand over a lower-scoring legal operator', () => {
    expect(parseMerchant('NOVA\nOPERATOR POLSKA S.A.').merchant).toBe('NOVA');
  });
});
