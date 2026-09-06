import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

interface CorpusCase { name: string; raw: string; items: number; total: number; expectedNames?: string[]; warningIncludes?: string; }

const base = (body: string, total: string) => `SKLEP TESTOWY\n16.08.2026\nPARAGON FISKALNY\n${body}\nSUMA PLN ${total}`;
const cases: CorpusCase[] = [
  { name: 'single item', raw: base('Produkt Alfa 1 x 10,00 10,00', '10,00'), items: 1, total: 1000 },
  { name: 'two items', raw: base('Produkt Alfa 1 x 10,00 10,00\nProdukt Beta 1 x 5,00 5,00', '15,00'), items: 2, total: 1500 },
  { name: 'three items', raw: base('Produkt A 1 x 1,00 1,00\nProdukt B 1 x 2,00 2,00\nProdukt C 1 x 3,00 3,00', '6,00'), items: 3, total: 600 },
  { name: 'weighted item', raw: base('Produkt Wagowy 0,500 x 10,00 5,00', '5,00'), items: 1, total: 500 },
  { name: 'quantity two', raw: base('Produkt Dwa 2 x 4,00 8,00', '8,00'), items: 1, total: 800 },
  { name: 'tax sp op excluded', raw: `SKLEP TESTOWY\n16.08.2026\nPARAGON FISKALNY\n5905588686613 OBUWIE TESTOWE\n1 SZT * 149,99 = 149,99 A\nSp.op.A 149,99\nPTU A 23,00% 28,05\nSUMA PTU 28,05\nSUMA PLN 149,99`, items: 1, total: 14999, expectedNames: ['OBUWIE TESTOWE'] },
  { name: 'tax sprzedaz excluded', raw: `SKLEP TESTOWY\n16.08.2026\nPARAGON FISKALNY\nProdukt Testowy 1 x 20,00 20,00\nSPRZEDAŻ OPODATKOWANA A 20,00\nPTU A 23% 3,74\nSUMA PLN 20,00`, items: 1, total: 2000 },
  { name: 'payment card excluded', raw: `${base('Produkt Testowy 1 x 20,00 20,00', '20,00')}\nKARTA 20,00`, items: 1, total: 2000 },
  { name: 'payment cash excluded', raw: `${base('Produkt Testowy 1 x 20,00 20,00', '20,00')}\nGOTÓWKA 20,00\nRESZTA 0,00`, items: 1, total: 2000 },
  { name: 'sku alphanumeric cleaned', raw: base('0405-04166-01UH1E370 OBUWIE DAMSKIE A 1 x 299,00 299,00', '299,00'), items: 1, total: 29900, expectedNames: ['OBUWIE DAMSKIE'] },
  { name: 'sku numeric cleaned', raw: base('5901234567890 Produkt Testowy A 1 x 9,00 9,00', '9,00'), items: 1, total: 900, expectedNames: ['Produkt Testowy'] },
  { name: 'wrong quantity keeps line total', raw: base('Produkt Testowy A 4 x 229,00 229,00', '229,00'), items: 1, total: 22900, warningIncludes: 'Niepewna ilość' },
  { name: 'unit continuation ml', raw: base('Produkt Płyn 1 x 3,00 3,00\n20ml', '3,00'), items: 1, total: 300 },
  { name: 'unit continuation g', raw: base('Produkt Sypki 1 x 4,00 4,00\n100g', '4,00'), items: 1, total: 400 },
  { name: 'unit continuation kg', raw: base('Produkt Wagowy 1 x 5,00 5,00\nkg', '5,00'), items: 1, total: 500 },
  { name: 'deposit continuation', raw: base('Butelka Plastik 1 x 0,50 0,50\nkaucja', '0,50'), items: 1, total: 50, expectedNames: ['Butelka Plastik kaucja'] },
  { name: 'exact discount', raw: base('Produkt Rabat 1 x 5,00 5,00\nRabat -1,00\n4,00', '4,00'), items: 1, total: 400 },
  { name: 'opust discount', raw: base('Produkt Opust 1 x 5,00 5,00\nOpust -1,00\n4,00', '4,00'), items: 1, total: 400 },
  { name: 'noisy discount', raw: base('Produkt Noisy 1 x 1,49 1,49\nRabat -0,/5\n0,74', '0,74'), items: 1, total: 74 },
  { name: 'duplicate legitimate products', raw: base('Produkt X 1 x 2,00 2,00\nProdukt X 1 x 2,00 2,00', '4,00'), items: 2, total: 400 },
  { name: 'deposit section', raw: `SKLEP TESTOWY\n16.08.2026\nPARAGON FISKALNY\nProdukt A 1 x 2,00 2,00\nSuma PLN 2,00\nOPAKOWANIA ZWROTNE WYDANIA\nButelka kaucja 1 x 0,50 0,50\nOPAKOWANIA ZWROTNE SUMA 0,50\nDO ZAPŁATY 2,50 PLN`, items: 1, total: 200 },
  { name: 'bon excluded', raw: `${base('Produkt A 1 x 2,00 2,00', '2,00')}\nBon 1,00\nKarta 1,00`, items: 1, total: 200 },
  { name: 'footer transaction excluded', raw: `${base('Produkt A 1 x 2,00 2,00', '2,00')}\nNumer transakcji 12345`, items: 1, total: 200 },
  { name: 'footer cashier excluded', raw: `${base('Produkt A 1 x 2,00 2,00', '2,00')}\nNumer kasjera 4`, items: 1, total: 200 },
  { name: 'vat outlier ignored', raw: `SKLEP TESTOWY\n16.08.2026\nPARAGON FISKALNY\nProdukt A 1 x 299,00 299,00\nProdukt B 1 x 229,00 229,00\nSPRZEDAŻ OPODATKOWANA A 328,00\nPTU A 23% 98,73\nSUMA PLN 528,00\nKARTA 528,00`, items: 2, total: 52800 },
  { name: 'price suffix A', raw: base('Produkt A 1 x 8,99 8,99A', '8,99'), items: 1, total: 899 },
  { name: 'price suffix C', raw: base('Produkt C 1 x 4,79 4,79C', '4,79'), items: 1, total: 479 },
  { name: 'decimal dot', raw: base('Produkt Dot 1 x 4.79 4.79', '4,79'), items: 1, total: 479 },
  { name: 'wrapped pending name', raw: `SKLEP TESTOWY\n16.08.2026\nPARAGON FISKALNY\nProdukt Rozdzielony\n1 x 6,00 6,00\nSUMA PLN 6,00`, items: 1, total: 600 },
  { name: 'thirty final scenario', raw: base('Produkt Ostatni 1 x 12,34 12,34', '12,34'), items: 1, total: 1234 },
];

describe('1.1.0-dev.3 DEV3-B018 synthetic robustness corpus', () => {
  it('contains at least 30 privacy-safe scenarios', () => {
    expect(cases.length).toBeGreaterThanOrEqual(30);
    expect(JSON.stringify(cases)).not.toMatch(/\bNIP\s*[:0-9]|\d{2}-\d{3}\s+[A-ZĄĆĘŁŃÓŚŹŻ]/u);
  });

  it.each(cases)('$name', ({ raw, items, total, expectedNames, warningIncludes }) => {
    const parsed = parseReceiptText(raw);
    expect(parsed.items).toHaveLength(items);
    expect(parsed.detectedItemsTotalMinor).toBe(total);
    if (expectedNames) expect(parsed.items.map((item) => item.name)).toEqual(expectedNames);
    if (warningIncludes) expect(parsed.items.flatMap((item) => item.warnings).join(' ')).toContain(warningIncludes);
  });

  it('keeps deposit-section amounts separate from ordinary goods while reconciling final payable', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
PARAGON FISKALNY
Produkt A 1 x 2,00 2,00
Suma PLN 2,00
OPAKOWANIA ZWROTNE WYDANIA
Butelka kaucja 1 x 0,50 0,50
OPAKOWANIA ZWROTNE SUMA 0,50
DO ZAPŁATY 2,50 PLN`);
    expect(parsed.detectedItemsTotalMinor).toBe(200);
    expect(parsed.depositTotalMinor).toBe(50);
    expect(parsed.declaredTotalMinor).toBe(250);
    expect(parsed.unexplainedDifferenceMinor).toBe(0);
  });

});
