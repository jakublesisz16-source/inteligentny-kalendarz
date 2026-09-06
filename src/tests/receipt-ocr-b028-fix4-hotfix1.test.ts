import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';
import { assessReceiptOcrCandidate, shouldRetryReceiptOcr } from '../shopping/receipt-ocr/receipt-ocr-recovery';

const damagedGenericAfterDeposit = [
  'MARKET ALFA',
  '2026-08-01',
  'Jaja wolny wybieg 10',
  '1 * 10.99 10.99 C',
  'Program kupon -1,10',
  'Banany luz',
  '0,252kg x 6.99 1.76 C',
  'Program kupon -1,01',
  'Woda źródlana 1,51.',
  '12 * 0.99 11.88 A',
  'Pizza Guseppe',
  '1 * 9.99 9.99 C',
  'Suma PLN 32,51',
  'Opakowania zwrotne suma 6,00',
  'Suma 30,51',
  'Płatność Karta płatnicza 38,51',
].join('\n');

describe('DEV3-B028-FIX4-HOTFIX1 legacy contract reconciliation', () => {
  it('lets subtotal + deposit + payment override a damaged generic total after the deposit section', () => {
    const parsed = parseReceiptText(damagedGenericAfterDeposit);
    expect(parsed.detectedItemsTotalMinor).toBe(3251);
    expect(parsed.declaredSubtotalMinor).toBe(3251);
    expect(parsed.depositTotalMinor).toBe(600);
    expect(parsed.declaredTotalMinor).toBe(3851);
    expect(parsed.finalPayableMinor).toBe(3851);
    expect(parsed.paymentTotalMinor).toBe(3851);
    expect(parsed.unexplainedDifferenceMinor).toBe(0);
  });

  it('keeps tax context local so a later generic Suma can still be the receipt total', () => {
    const parsed = parseReceiptText('SKLEP\n16.08.2026\nProdukt 5,00\nSPRZEDAŻ OPODATKOWANA A 5,00\nPTU A 23% 1,15\nSUM PTU 1,15\nSUMA 5,00');
    expect(parsed.taxTotalMinor).toBeUndefined();
    expect(parsed.declaredTotalMinor).toBe(500);
  });

  it('keeps a percentage-only discount visible but unresolved', () => {
    const parsed = parseReceiptText('SKLEP\n16.08.2026\nProdukt 10,00\nRabat 20%\nSUMA 10,00');
    expect(parsed.items[0]?.amountMinor).toBe(1000);
    expect(parsed.adjustments).toEqual([{ rawText: 'Rabat 20%', kind: 'discount' }]);
    expect(parsed.warnings.some((warning) => warning.code === 'item-price-missing')).toBe(true);
  });

  it('derives a clean monetary discount without stealing the next product row', () => {
    const parsed = parseReceiptText('SKLEP\n16.08.2026\nProdukt A 1,49\nRabat -0,75\nProdukt B 3,20\nSUMA 3,94');
    expect(parsed.items.map((item) => [item.name, item.amountMinor])).toEqual([
      ['Produkt A', 74],
      ['Produkt B', 320],
    ]);
  });

  it('recovers a damaged monetary discount only when the printed final confirms the math', () => {
    const good = parseReceiptText('SKLEP\n16.08.2026\nProdukt 1,49\nRabat -0,/5\n0,74\nSUMA 0,74');
    expect(good.items[0]?.amountMinor).toBe(74);
    expect(good.adjustments[0]?.amountMinor).toBe(-75);

    const bad = parseReceiptText('SKLEP\n16.08.2026\nProdukt 1,49\nRabat -0,/5\n0,84\nSUMA 0,84');
    expect(bad.items[0]?.amountMinor).toBe(149);
    expect(bad.adjustments[0]?.amountMinor).toBeUndefined();
    expect(bad.warnings.some((warning) => warning.code === 'item-price-missing')).toBe(true);
  });

  it('keeps deposits separate from ordinary goods while reconciling the final payable', () => {
    const parsed = parseReceiptText('SKLEP\n16.08.2026\nProdukt 2,00\nSuma PLN 2,00\nOPAKOWANIA ZWROTNE WYDANIA\nButelka kaucja 1 x 0,50 0,50\nOPAKOWANIA ZWROTNE SUMA 0,50\nDO ZAPŁATY 2,50 PLN');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.detectedItemsTotalMinor).toBe(200);
    expect(parsed.depositTotalMinor).toBe(50);
    expect(parsed.declaredTotalMinor).toBe(250);
    expect(parsed.unexplainedDifferenceMinor).toBe(0);
  });

  it('does not retry a primary OCR candidate once goods and final structure reconcile', () => {
    const primary = assessReceiptOcrCandidate('primary', damagedGenericAfterDeposit, 'photo', 88);
    expect(primary.goodsReconcile).toBe(true);
    expect(primary.finalStructureReconciles).toBe(true);
    expect(shouldRetryReceiptOcr(primary)).toBe(false);
  });
});
