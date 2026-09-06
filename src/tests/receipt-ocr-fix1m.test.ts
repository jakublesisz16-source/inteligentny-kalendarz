import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ExpenseCategory } from '../shopping/expenses.types';
import { suggestCategoryId } from '../shopping/receipt-ocr/category-suggestions';
import { analyzeReceiptOcrQuality } from '../shopping/receipt-ocr/receipt-ocr-quality';

function source(path: string): string { return readFileSync(new URL(path, import.meta.url), 'utf8'); }
const categories: ExpenseCategory[] = [
  ['expense-category-food', 'Jedzenie'], ['expense-category-drinks', 'Napoje'], ['expense-category-clothes', 'Ubrania'],
  ['expense-category-deposit', 'Kaucja / opakowania zwrotne'], ['expense-category-other', 'Inne'],
].map(([id, name], sortOrder) => ({ id: id!, name: name!, sortOrder, createdAt: '', updatedAt: '' }));

describe('1.1.0-dev.3 DEV3-B020 FIX1M integration contracts', () => {
  it.each([
    ['Polaris NGaz 1,5l', 'expense-category-drinks'],
    ['NapGaz Test 1,25l', 'expense-category-drinks'],
    ['Mle bez lakt 2 1l', 'expense-category-food'],
    ['Fil Z Piersi K kg', 'expense-category-food'],
    ['Śliwka Domowa Luz', 'expense-category-food'],
    ['Pesto Zielone', 'expense-category-food'],
    ['CzekOrzechMix100g', 'expense-category-food'],
    ['OBUWIE DAMSKIE', 'expense-category-clothes'],
    ['But Plastik kaucja', 'expense-category-deposit'],
  ])('categorizes %s', (name, categoryId) => {
    expect(suggestCategoryId(name, [], categories)).toBe(categoryId);
  });

  it('counts damaged money tokens as suspicious even if financial recovery may later succeed', () => {
    const quality = analyzeReceiptOcrQuality('PARAGON\nProdukt 1 x 1,49 1,49\nRabat -0,/5\n0,74\nSUMA 0,74', 'photo', 60);
    expect(quality.suspiciousTokens).toBeGreaterThan(0);
  });

  it('keeps financial reliability high when line totals, final total and payment agree despite a quantity anomaly', () => {
    const quality = analyzeReceiptOcrQuality('PARAGON FISKALNY\nProdukt Alfa 1 x 299,00 299,00\nProdukt Beta 4 x 229,00 229,00\nSUMA PLN 528,00\nKARTA 528,00', 'photo', 55);
    expect(quality.financialScore).toBeGreaterThanOrEqual(75);
  });

  it('keeps real receipt media and persistence out of OCR implementation', () => {
    const flow = source('../shopping/receipt-ocr/ReceiptScanFlow.tsx');
    const pdf = source('../shopping/receipt-ocr/receipt-pdf.ts');
    for (const implementation of [flow, pdf]) {
      expect(implementation).not.toContain('localStorage');
      expect(implementation).not.toContain('indexedDB');
      expect(implementation).not.toContain('https://');
    }
  });
});
