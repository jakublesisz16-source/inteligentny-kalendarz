import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeReceiptOcrQuality } from '../shopping/receipt-ocr/receipt-ocr-quality';
import { assessReceiptOcrCandidate, chooseReceiptOcrCandidate, shouldRetryReceiptOcr } from '../shopping/receipt-ocr/receipt-ocr-recovery';
import { parseReceiptText } from '../shopping/receipt-ocr/receipt-parser';

const RECOVERY_TEXT = [
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
  '1 ” 9.99 9.99 C',
  'PTU A 11,88',
  'Kwota A 23,00% 2,22',
  'Suma PLN 32,51',
  'Opakowania zwrotne wydania',
  'Kaucja PET 12 * 0.5 6.0',
  'Opakowania zwrotne suma 6,00',
  'Suma 30,51',
  'Płatność Karta płatnicza 38,51',
].join('\n');

const DAMAGED_PRIMARY = [
  'MARKET ALFA',
  '2026-08-01',
  'Jaja wolny wybieg 10',
  '1 "70.99 70.99 C',
  'Program kupon -1,10',
  'Banany luz',
  '0,252kg x 6.99 1.76 C',
  'Program kupon -1,01',
  'Woda źródlana 1,51.',
  '12 * 0.99 11.88 A',
  'Pizza Guseppe',
  '1 = 9.93 9,93 C',
  'Suma PLN 32,51',
  'Opakowania zwrotne suma 6,00',
  'Suma 38,51',
  'Płatność Karta płatnicza 38,51',
].join('\n');

describe('1.1.0-dev.3 DEV3-B028 real receipt OCR recovery', () => {
  it('parses the recovered receipt structure without merchant-specific rules', () => {
    const parsed = parseReceiptText(RECOVERY_TEXT);
    expect(parsed.date).toBe('2026-08-01');
    expect(parsed.items).toHaveLength(4);
    expect(parsed.items.map((item) => item.amountMinor)).toEqual([989, 75, 1188, 999]);
    expect(parsed.items[0]).toMatchObject({ baseAmountMinor: 1099, discountMinor: 110 });
    expect(parsed.items[1]).toMatchObject({ name: 'Banany luz', baseAmountMinor: 176, discountMinor: 101 });
    expect(parsed.items[2]).toMatchObject({ amountMinor: 1188 });
    expect(parsed.items[3]).toMatchObject({ amountMinor: 999 });
    expect(parsed.declaredSubtotalMinor).toBe(3251);
    expect(parsed.depositTotalMinor).toBe(600);
    expect(parsed.declaredTotalMinor).toBe(3851);
    expect(parsed.finalPayableMinor).toBe(3851);
    expect(parsed.detectedItemsTotalMinor).toBe(3251);
    expect(parsed.warnings.some((warning) => warning.code === 'sum-mismatch')).toBe(false);
  });

  it('recognizes quantity lines with an attached unit and OCR multiplier glyphs', () => {
    const quality = analyzeReceiptOcrQuality('PARAGON\nBanany luz\n0,252kg x 6.99 1.76 C\nSUMA 1,76', 'photo');
    expect(quality.consistentFinancialLines).toBe(1);
    expect(quality.suspiciousFinancialLines).toBe(0);
  });

  it('uses look-ahead so damaged capacity text does not become a fake price', () => {
    const parsed = parseReceiptText('MARKET\n2026-08-01\nWoda źródlana 1,51.\n12 * 0.99 11.88 A\nSUMA 11,88');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.amountMinor).toBe(1188);
    expect(parsed.items[0]?.name).toContain('Woda źródlana');
  });

  it('keeps deposits outside the ordinary goods item list', () => {
    const parsed = parseReceiptText('MARKET\n2026-08-01\nProdukt A 10,00\nSuma PLN 10,00\nOpakowania zwrotne suma 2,00\nSuma 12,00\nPłatność Karta płatnicza 12,00');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.amountMinor).toBe(1000);
    expect(parsed.depositTotalMinor).toBe(200);
    expect(parsed.declaredTotalMinor).toBe(1200);
  });

  it('retries a financially broken primary result and chooses a lower-confidence reconciled recovery', () => {
    const primary = assessReceiptOcrCandidate('primary', DAMAGED_PRIMARY, 'photo', 92);
    const recovery = assessReceiptOcrCandidate('single-block-recovery', RECOVERY_TEXT, 'photo', 65);
    expect(primary.goodsReconcile).toBe(false);
    expect(shouldRetryReceiptOcr(primary)).toBe(true);
    expect(recovery.goodsReconcile).toBe(true);
    expect(recovery.finalStructureReconciles).toBe(true);
    expect(chooseReceiptOcrCandidate(primary, recovery).profile).toBe('single-block-recovery');
  });

  it('does not run recovery when the primary result already reconciles', () => {
    const primary = assessReceiptOcrCandidate('primary', RECOVERY_TEXT, 'photo', 88);
    expect(primary.goodsReconcile).toBe(true);
    expect(shouldRetryReceiptOcr(primary)).toBe(false);
  });

  it('does not punish a valid short two-item receipt merely for having few products', () => {
    const text = [
      'MARKET ALFA',
      '2026-08-01',
      'Produkt A 5,00',
      'Produkt B 7,00',
      'SUMA 12,00',
    ].join('\n');
    const primary = assessReceiptOcrCandidate('primary', text, 'photo', 82);
    expect(primary.goodsReconcile).toBe(true);
    expect(shouldRetryReceiptOcr(primary)).toBe(false);
  });

  it('does not hard-code this repair for a specific merchant', () => {
    const parser = readFileSync(new URL('../shopping/receipt-ocr/receipt-parser.ts', import.meta.url), 'utf8');
    const recovery = readFileSync(new URL('../shopping/receipt-ocr/receipt-ocr-recovery.ts', import.meta.url), 'utf8');
    expect(parser).not.toMatch(/LIDL/iu);
    expect(recovery).not.toMatch(/LIDL/iu);
  });

  it('configures PSM 3 for full primary and PSM 6 for bounded recovery profiles', () => {
    const engine = readFileSync(new URL('../shopping/receipt-ocr/ocr-engine.ts', import.meta.url), 'utf8');
    const flow = readFileSync(new URL('../shopping/receipt-ocr/ReceiptScanFlow.tsx', import.meta.url), 'utf8');
    expect(engine).toContain("profile === 'primary' ? '3' : '6'");
    expect(engine).toContain('setParameters');
    expect(flow).toContain('shouldRetryReceiptOcr(primaryAssessment)');
    expect(flow).toContain("'single-block-recovery'");
    expect(flow).toContain("'fiscal-region-recovery'");
    expect(flow).toContain('chooseReceiptOcrCandidate');
  });
});
