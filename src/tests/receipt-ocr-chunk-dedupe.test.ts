import { describe, expect, it } from 'vitest';
import { mergeReceiptOcrChunkTexts } from '../shopping/receipt-ocr/ocr-preprocess-plan';

describe('1.1.0-dev.3 DEV3-B020 boundary-local chunk dedupe', () => {
  it('removes an exact overlap only at adjacent chunk boundary', () => {
    const merged = mergeReceiptOcrChunkTexts([
      'Produkt Alfa 1 x 5,00 5,00\nProdukt Beta 1 x 7,55 7,55\n20ml\nRabat -0,75',
      'Produkt Beta 1 x 7,55 7,55\n20ml\nRabat -0,75\n6,80\nProdukt Gamma 1 x 2,00 2,00',
    ]);
    expect(merged.match(/Produkt Beta/gu)).toHaveLength(1);
  });

  it('dedupes a strong fuzzy overlap with OCR punctuation/noise', () => {
    const merged = mergeReceiptOcrChunkTexts([
      'Nagłówek\nProdukt Testowy 1 x 7,55 7,55\n20ml\nRabat -0,75\n6,80',
      'Produkt Testowv 1x 7,55 7,558\n20mI\nRabat -0,75\n6,80\nProdukt Dalej 1 x 4,00 4,00',
    ]);
    expect(merged).toContain('Produkt Dalej');
    expect((merged.match(/Rabat -0,75/gu) ?? []).length).toBe(1);
  });

  it('preserves legitimate duplicate products inside one logical chunk', () => {
    const merged = mergeReceiptOcrChunkTexts(['Produkt A 1 x 5,00 5,00\nProdukt A 1 x 5,00 5,00']);
    expect(merged.match(/Produkt A/gu)).toHaveLength(2);
  });
});
