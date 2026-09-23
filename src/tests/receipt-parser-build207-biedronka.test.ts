import { describe, expect, it } from 'vitest';
import { formatExpenseProductDisplayName } from '../shopping/expenses.utils';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

// Sanitized replay of the 23.09.2026 Biedronka layout: six goods, one item-level
// Opust row, weighted quantity, malformed compact numeric tokens and a 42,85 total.
const BIEDRONKA_LAYOUT_23092026 = `
Biedronka
Codziennie niskie ceny
BIEDRONKA "CODZIENNIE NISKIE CENY" 7727
02-237 WARSZAWA UL. ALEJA KRAKOWSKA 291
JERONIMO MARTINS POLSKA SIA.
NIP 7791011327
PARAGON FISKALNY
Nazwa PTU Ilość Cena Wartość
PlatkiTest500g | ©; 1x 2,75 2,75
CiastkaTest147g C 1x 5,99 5,99
Banan Luz Cc 0,350x 6,99 2,45
WarzywaTest450g | ©; 2x 469 9,38
Opust -1,40
7,98
WafleTest60g c 1x 3,29 3,29
FiletTest kg Cc 0510x 39,99 20,39
OPUSTY ŁĄCZNIE: -1,40
Sprzedaż opodatkowana C 42,85
PTU C 5% 2,04
Suma PTU 2,04
Suma PLN 42,85
Karta płatnicza 42,85
Numer transakcji 676
Data 23/09/2026 16:48:43
`;

describe('Build207 Biedronka receipt regression', () => {
  it('keeps six goods, the item discount and the 42.85 PLN total reconciled', () => {
    const parsed = parseReceiptText(BIEDRONKA_LAYOUT_23092026);
    expect(parsed.merchant).toBe('BIEDRONKA');
    expect(parsed.date).toBe('2026-09-23');
    expect(parsed.items).toHaveLength(6);
    expect(parsed.declaredTotalMinor).toBe(4285);
    expect(parsed.paymentTotalMinor).toBe(4285);
    expect(parsed.detectedItemsTotalMinor).toBe(4285);
    expect(parsed.unexplainedDifferenceMinor).toBe(0);

    const vegetables = parsed.items.find((item) => item.name.includes('WarzywaTest450g'));
    expect(vegetables).toMatchObject({ baseAmountMinor: 938, discountMinor: 140, amountMinor: 798 });

    const banana = parsed.items.find((item) => item.name.includes('Banan Luz'));
    expect(banana).toMatchObject({ quantity: 0.35, unitPriceMinor: 699, amountMinor: 245 });

    const chicken = parsed.items.find((item) => item.name.includes('FiletTest'));
    expect(chicken).toMatchObject({ amountMinor: 2039 });
  });

  it('removes only explicit PTU OCR-symbol noise from the Finance display name', () => {
    expect(formatExpenseProductDisplayName('PlatkiTest500g | ©;')).toBe('Platki Test 500 g');
    expect(formatExpenseProductDisplayName('WarzywaTest450g | ©;')).toBe('Warzywa Test 450 g');
    expect(formatExpenseProductDisplayName('Produkt © specjalny')).toBe('Produkt © specjalny');
  });
});
