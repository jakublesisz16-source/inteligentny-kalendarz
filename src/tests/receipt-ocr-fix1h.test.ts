import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

function unresolvedDiscounts(raw: string): number {
  return parseReceiptText(raw).warnings.filter((warning) => warning.code === 'item-price-missing').length;
}

describe('1.1.0-dev.3 DEV3-B009 FIX1H noisy OCR financial parser', () => {
  it('recognizes the conservative Rabot OCR variant as a discount label', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Alfa C 1.0 x 1,49 1,49C\nRabot -0,74\n0,75C\nSUMA 0,75`);
    expect(parsed.items[0]).toMatchObject({ name: 'Produkt Alfa', amountMinor: 75 });
    expect(parsed.adjustments[0]).toMatchObject({ amountMinor: -74, kind: 'discount' });
  });

  it('treats a one-character OCR/VAT suffix as outside the structured amount', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Beta B 1.0 x 7,55 7,558\nSUMA 7,55`);
    expect(parsed.items[0]).toMatchObject({ name: 'Produkt Beta', amountMinor: 755 });
  });

  it('accepts a space-separated final amount only when discount math confirms it', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Gamma C 1.0 x 1,49 1,49C\nRabat -0,75\n0 74\nSUMA 0,74`);
    expect(parsed.items[0]?.amountMinor).toBe(74);
    expect(unresolvedDiscounts(`SKLEP TESTOWY\n16.08.2026\nProdukt Gamma C 1.0 x 1,49 1,49C\nRabat -0,75\n0 74\nSUMA 0,74`)).toBe(0);
  });

  it('uses exact discount math plus a one-grosz base tolerance for a noisy low-value final token', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Delta C LÓx 1,48 1,48Ć\nRabat -0,75\n6.74l\nSUMA 0,74`);
    expect(parsed.items[0]).toMatchObject({ name: 'Produkt Delta', amountMinor: 74, confidence: 'medium' });
    expect(parsed.warnings.some((warning) => warning.code === 'item-price-missing')).toBe(false);
  });

  it('can use a second structured line amount as the discount base when the OCR final amount on the product row is inconsistent', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Epsilon C 1.6 x 1,49 1,43X\nRabot -0,74\n8.750\nSUMA 0,75`);
    expect(parsed.items[0]).toMatchObject({ name: 'Produkt Epsilon', amountMinor: 75, confidence: 'medium' });
  });

  it('rejects a mathematically inconsistent printed final while preserving exact clean discount math', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Zeta A 1.0 x 8,99 8,99A
Rabat -4,50
4,39A
SUMA 4,39`);
    expect(parsed.items[0]?.amountMinor).toBe(449);
    expect(parsed.items[0]?.warnings.join(' ')).toContain('zgodności rabatu');
  });

  it('still does not steal a full next-product row while deriving the prior clean discount', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY
16.08.2026
Produkt Eta A 1.0 x 8,99 8,99A
Rabat -4,50
Produkt Theta 4,49
SUMA 13,48`);
    expect(parsed.items.map((item) => [item.name, item.amountMinor])).toEqual([
      ['Produkt Eta', 449],
      ['Produkt Theta', 449],
    ]);
    expect(parsed.warnings.some((warning) => warning.code === 'item-price-missing')).toBe(false);
  });

  it('applies four deterministic discount sequences with conservative final-token variants', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Jeden C 1.0 x 1,49 1,49C\nRabat -0,75\n0.74l\nProdukt Dwa C 1.0 x 1,49 1,49C\nRabot -0,74\n0 75\nProdukt Trzy A 1.0 x 8,99 8,99A\nRabat -4,50\n4 49\nProdukt Cztery A 1.0 x 8,99 8,99A\nRabat -4,49\n4 50\nSUMA 10,48`);
    expect(parsed.items.map((item) => item.amountMinor)).toEqual([74, 75, 449, 450]);
    expect(parsed.adjustments.map((adjustment) => adjustment.amountMinor)).toEqual([-75, -74, -450, -449]);
    expect(parsed.detectedItemsTotalMinor).toBe(1048);
    expect(parsed.warnings.filter((warning) => warning.code === 'item-price-missing')).toHaveLength(0);
  });

  it('keeps a unit-only wrapped line attached to one product instead of creating another item', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Plyn C 1.0 x 3,69 3,69C\n1l\nSUMA 3,69`);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({ name: 'Produkt Plyn', amountMinor: 369 });
    expect(parsed.items[0]?.rawText).toContain('1l');
  });

  it('attaches a standalone kaucja descriptor to an already parsed positive item', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nButelka Plastik 1.0 x 0,50 0,50\nkaucja\nSUMA 0,50`);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({ name: 'Butelka Plastik kaucja', amountMinor: 50 });
    expect(parsed.items[0]?.amountMinor).toBeGreaterThan(0);
  });

  it('preserves weighted products and their final line amount', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Wagowy C 0,50 x 25,49 12,75C\nkg\nSUMA 12,75`);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({ name: 'Produkt Wagowy', amountMinor: 1275 });
  });

  it('removes a damaged quantity token and financial suffix from the product name when two prices prove the structure', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Iota Ć LÓx 1,48 1,48Ć\nSUMA 1,48`);
    expect(parsed.items[0]).toMatchObject({ name: 'Produkt Iota', amountMinor: 148 });
  });

  it('stops item creation at a conservatively recognized VAT section', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Kappa 5,00\nSPRZEDAŻ OPODATKOWYWM A 5,00\nPTU A 23% 1,15\nSUM PTU 1,15\nSUMA 5,00`);
    expect(parsed.items.map((item) => item.name)).toEqual(['Produkt Kappa']);
    expect(parsed.declaredTotalMinor).toBe(500);
  });

  it('never creates SUMA or PTU rows as products', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Lambda 2,00\nSPRZEDAŻ OPODATKOWANA A 2,00\nPTU A 23% 0,46\nSUMA 2,00`);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.name).toBe('Produkt Lambda');
  });

  it('preserves duplicate legitimate products as separate items', () => {
    const parsed = parseReceiptText(`SKLEP TESTOWY\n16.08.2026\nProdukt Mu 2,00\nProdukt Mu 2,00\nSUMA 4,00`);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.detectedItemsTotalMinor).toBe(400);
  });

  it('parses a longer synthetic receipt without turning continuations, discounts or VAT into items', () => {
    const lines = ['SKLEP TESTOWY', '16.08.2026'];
    for (let index = 1; index <= 12; index += 1) lines.push(`Produkt ${index} A 1.0 x 1,00 1,00A`);
    lines.push('SPRZEDAŻ OPODATKOWANA A 12,00', 'PTU A 23% 2,76', 'SUMA 12,00');
    const parsed = parseReceiptText(lines.join('\n'));
    expect(parsed.items).toHaveLength(12);
    expect(parsed.detectedItemsTotalMinor).toBe(1200);
  });

  it('is deterministic for identical noisy OCR input', () => {
    const raw = `SKLEP TESTOWY\n16.08.2026\nProdukt Nu C 1.0 x 1,49 1,49C\nRabot -0,74\n0 75\nSUMA 0,75`;
    expect(parseReceiptText(raw)).toEqual(parseReceiptText(raw));
  });
});
