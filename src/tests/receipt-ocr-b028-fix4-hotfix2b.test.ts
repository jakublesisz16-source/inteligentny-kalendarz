import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assessReceiptOcrCandidate,
  chooseReceiptOcrCandidate,
  describeReceiptOcrCandidate,
} from '../shopping/receipt-ocr/receipt-ocr-recovery';
import { resolveReceiptMerchant } from '../shopping/receipt-ocr/receipt-parser';

describe('DEV3-B028-FIX4-HOTFIX2B fiscal OCR profile, merchant gate and diagnostics', () => {
  it('uses PSM 3 only for primary and PSM 6 for bounded recovery profiles with a single threshold fallback', () => {
    const engine = readFileSync(new URL('../shopping/receipt-ocr/ocr-engine.ts', import.meta.url), 'utf8');
    const flow = readFileSync(new URL('../shopping/receipt-ocr/ReceiptScanFlow.tsx', import.meta.url), 'utf8');
    expect(engine).toContain("'single-block-recovery' | 'fiscal-region-recovery'");
    expect(engine).toContain("profile === 'primary' ? '3' : '6'");
    expect(flow).toContain("'single-block-recovery'");
    expect(flow).toContain("'fiscal-region-recovery'");
    expect(flow).toContain("'fiscal-threshold-recovery'");
    expect(flow.match(/fiscalOcrPasses \+= 1/gu)).toHaveLength(2);
  });

  it('selects a structurally reconciled fiscal candidate over a higher-confidence zero-item isolated total', () => {
    const primary = assessReceiptOcrCandidate(
      'primary',
      ['MARKETING TEXT', '18.08.2006', 'SUMA PLN 3,00'].join('\n'),
      'photo',
      80,
    );
    const fiscal = assessReceiptOcrCandidate(
      'fiscal-region-recovery',
      [
        'PARAGON FISKALNY',
        '18.08.2026',
        'Produkt Alfa 1 x 11,49 11,49',
        'Produkt Beta 6 x 0,69 4,14',
        'SUMA PLN 15,63',
        'KARTA 15,63',
      ].join('\n'),
      'photo',
      45,
    );
    expect(primary.parsed.items).toHaveLength(0);
    expect(fiscal.goodsReconcile).toBe(true);
    expect(fiscal.paymentReconciles).toBe(true);
    expect(chooseReceiptOcrCandidate(primary, fiscal)).toBe(fiscal);
  });

  it('keeps a good primary candidate when fiscal recovery loses receipt structure', () => {
    const primary = assessReceiptOcrCandidate(
      'primary',
      [
        'MARKET TEST', '18.08.2026',
        'Produkt A 2,00', 'Produkt B 3,00', 'Produkt C 4,00', 'Produkt D 6,00',
        'SUMA PLN 15,00', 'KARTA 15,00',
      ].join('\n'),
      'photo', 75,
    );
    const fiscal = assessReceiptOcrCandidate('fiscal-region-recovery', 'PARAGON FISKALNY\nProdukt X 5,00', 'photo', 82);
    expect(primary.goodsReconcile).toBe(true);
    expect(fiscal.parsed.declaredTotalMinor).toBeUndefined();
    expect(chooseReceiptOcrCandidate(primary, fiscal)).toBe(primary);
  });

  it('does not replace one weak unreconciled result with only a marginally better fiscal guess', () => {
    const primary = assessReceiptOcrCandidate('primary', 'MARKETING TEXT\n18.08.2006\nSUMA PLN 3,00', 'photo', 40);
    const fiscal = assessReceiptOcrCandidate('fiscal-region-recovery', 'PARAGON FISKALNY\nProdukt? 5,64\nSUMA PLN 1,63', 'photo', 40);
    // Force the synthetic pair into the narrow score band that previously let
    // a weak crop replace another weak result without financial confirmation.
    const marginalFiscal = { ...fiscal, score: primary.score + 1 };
    expect(marginalFiscal.goodsReconcile).toBe(false);
    expect(marginalFiscal.paymentReconciles).toBe(false);
    expect(chooseReceiptOcrCandidate(primary, marginalFiscal)).toBe(primary);
  });

  it('rejects a single unconfirmed plain token from supplemental header OCR', () => {
    const primary = 'NIP 1234567890\nPARAGON FISKALNY\nProdukt 10,00\nSUMA 10,00';
    const resolved = resolveReceiptMerchant(primary, 'ZYRAX');
    expect(resolved.merchant).toBeUndefined();
    expect(resolved.candidate).toBe('ZYRAX');
    expect(resolved.evidence).toBe('plain');
    expect(resolved.decision).toBe('rejected');
    expect(resolved.rejectReason).toBe('unconfirmed-plain');
  });

  it('still accepts a short brand when independent legal/domain/descriptor evidence agrees', () => {
    const primary = 'PARAGON FISKALNY\nProdukt 10,00\nSUMA 10,00';
    const resolved = resolveReceiptMerchant(primary, 'ABC S.A.\nwww.abc.eu\nSalon Firmowy ABC');
    expect(resolved.merchant).toBe('ABC');
    expect(resolved.decision).toBe('accepted');
    expect(resolved.evidence).toBe('consensus');
  });

  it('accepts a single legal entity from the bounded header even without a dictionary', () => {
    const primary = 'NIP 1234567890\nPARAGON FISKALNY\nProdukt 65,00\nSUMA 65,00';
    const resolved = resolveReceiptMerchant(primary, 'NOVA MEDICAL SPÓŁKA Z O.O.\nul. Testowa 5');
    expect(resolved.merchant).toMatch(/^NOVA MEDICAL/iu);
    expect(resolved.evidence).toBe('legal');
    expect(resolved.decision).toBe('accepted');
  });

  it('does not invent a merchant from address-only supplemental OCR', () => {
    const resolved = resolveReceiptMerchant('PARAGON FISKALNY\nProdukt 10,00\nSUMA 10,00', 'ul. Testowa 5\n00-001 Miasto\nNIP 1234567890');
    expect(resolved.merchant).toBeUndefined();
    expect(resolved.decision).toBe('unresolved');
  });

  it('exposes auditable candidate scores and selection-ready diagnostics', () => {
    const candidate = assessReceiptOcrCandidate(
      'fiscal-region-recovery',
      'PARAGON FISKALNY\n18.08.2026\nProdukt 10,00\nSUMA 10,00\nKARTA 10,00',
      'photo',
      60,
    );
    const diagnostic = describeReceiptOcrCandidate(candidate, true);
    expect(diagnostic.source).toBe('fiscal-region-recovery');
    expect(diagnostic.selected).toBe(true);
    expect(diagnostic).toMatchObject({
      itemsCount: 1,
      declaredTotalMinor: 1000,
      paymentTotalMinor: 1000,
      paymentReconciles: true,
      hasFiscalMarker: true,
    });
    expect(Number.isFinite(diagnostic.structuralScore)).toBe(true);
    expect(Number.isFinite(diagnostic.candidateScore)).toBe(true);
  });

  it('renders candidate and merchant rejection diagnostics in the DEV review', () => {
    const review = readFileSync(new URL('../shopping/receipt-ocr/ReceiptScanReview.tsx', import.meta.url), 'utf8');
    expect(review).toContain('Kandydaci');
    expect(review).toContain('Merchant header');
    expect(review).toContain('merchantRejectReason');
  });
});
