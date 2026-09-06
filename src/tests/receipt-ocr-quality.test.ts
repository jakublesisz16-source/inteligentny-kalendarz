import { describe, expect, it } from 'vitest';
import { analyzeReceiptOcrQuality } from '../shopping/receipt-ocr/receipt-ocr-quality';

describe('1.1.0-dev.3 DEV3-B015 financial OCR quality analyzer', () => {
  it('marks a consistent 1x line as financially consistent', () => {
    const quality = analyzeReceiptOcrQuality('PARAGON\nProdukt Alfa 1 x 7,55 7,55\nSUMA 7,55', 'pdf');
    expect(quality.consistentFinancialLines).toBe(1);
    expect(quality.suspiciousFinancialLines).toBe(0);
  });

  it('detects a financially inconsistent 1x OCR line without correcting it', () => {
    const quality = analyzeReceiptOcrQuality('PARAGON\nProdukt Alfa 1 x 7,95 7,59\nSUMA 7,55', 'pdf');
    expect(quality.suspiciousFinancialLines).toBe(1);
    expect(quality.consistentFinancialLines).toBe(0);
  });

  it('validates quantity greater than one', () => {
    const quality = analyzeReceiptOcrQuality('PARAGON\nProdukt Beta 2 x 1,19 2,38\nSUMA 2,38', 'photo');
    expect(quality.consistentFinancialLines).toBe(1);
  });

  it('validates a weighted line with fiscal rounding', () => {
    const quality = analyzeReceiptOcrQuality('PARAGON\nProdukt Gamma 0,503 x 25,49 12,82\nSUMA 12,82', 'pdf');
    expect(quality.consistentFinancialLines).toBe(1);
    expect(quality.suspiciousFinancialLines).toBe(0);
  });

  it('rejects an inconsistent weighted line', () => {
    const quality = analyzeReceiptOcrQuality('PARAGON\nProdukt Gamma 0,503 x 25,49 11,82\nSUMA 11,82', 'photo');
    expect(quality.suspiciousFinancialLines).toBe(1);
  });

  it('validates a consistent Opust sequence', () => {
    const text = 'PARAGON\nProdukt Delta 1 x 1,49 1,49\nOpust -0,75\n0,74\nSUMA 0,74';
    const quality = analyzeReceiptOcrQuality(text, 'pdf');
    expect(quality.discountSequences).toBe(1);
    expect(quality.suspiciousDiscountSequences).toBe(0);
  });

  it('flags an inconsistent discount final amount', () => {
    const text = 'PARAGON\nProdukt Delta 1 x 1,49 1,49\nOpust -0,75\n0,84\nSUMA 0,84';
    const quality = analyzeReceiptOcrQuality(text, 'pdf');
    expect(quality.suspiciousDiscountSequences).toBe(1);
    expect(quality.suspiciousFinancialLines).toBeGreaterThan(0);
  });

  it('does not mistake aggregate discounts for a product discount sequence', () => {
    const text = 'PARAGON\nProdukt Alfa 1 x 5,00 5,00\nOPUSTY ŁĄCZNIE: -1,00\nSUMA 4,00';
    const quality = analyzeReceiptOcrQuality(text, 'pdf');
    expect(quality.discountSequences).toBe(0);
    expect(quality.suspiciousDiscountSequences).toBe(0);
  });

  it('rates a clean multi-line receipt high', () => {
    const text = [
      'PARAGON FISKALNY',
      'Nazwa PTU Ilość Cena Wartość',
      'Produkt Alfa A 1 x 2,00 2,00',
      'Produkt Beta B 2 x 1,50 3,00',
      'Produkt Gamma C 0,500 x 10,00 5,00',
      'Produkt Delta C 1 x 7,55 7,55',
      'DO ZAPŁATY 17,55',
    ].join('\n');
    const quality = analyzeReceiptOcrQuality(text, 'pdf', 90);
    expect(quality.level).toBe('high');
    expect(quality.score).toBeGreaterThanOrEqual(75);
  });


  it('caps quality at medium when any financial row is inconsistent', () => {
    const text = [
      'PARAGON FISKALNY',
      'Nazwa Ilość Cena Wartość',
      'Produkt A 1 x 2,00 2,00',
      'Produkt B 1 x 3,00 3,00',
      'Produkt C 1 x 7,95 7,59',
      'Produkt D 2 x 1,50 3,00',
      'DO ZAPŁATY 10,59',
    ].join('\n');
    const quality = analyzeReceiptOcrQuality(text, 'pdf', 95);
    expect(quality.suspiciousFinancialLines).toBe(1);
    expect(quality.level).toBe('medium');
  });

  it('rates multiple inconsistent financial lines low', () => {
    const text = [
      'PARAGON',
      'Nazwa Ilość Cena Wartość',
      'Produkt A 1 x 7,95 7,59',
      'Produkt B 2 x 1,19 9,38',
      'Produkt C 0,503 x 25,49 1,82',
      'SUMA 18,79',
    ].join('\n');
    const quality = analyzeReceiptOcrQuality(text, 'photo', 40);
    expect(quality.level).toBe('low');
    expect(quality.suspiciousFinancialLines).toBe(3);
  });

  it('preserves source type in session quality metadata', () => {
    expect(analyzeReceiptOcrQuality('PARAGON\nSUMA 1,00', 'pdf').sourceType).toBe('pdf');
    expect(analyzeReceiptOcrQuality('PARAGON\nSUMA 1,00', 'photo').sourceType).toBe('photo');
  });

  it('is deterministic for identical OCR input', () => {
    const text = 'PARAGON\nProdukt Alfa 1 x 7,55 7,55\nProdukt Beta 2 x 1,19 2,38\nSUMA 9,93';
    expect(analyzeReceiptOcrQuality(text, 'pdf', 81)).toEqual(analyzeReceiptOcrQuality(text, 'pdf', 81));
  });
});
