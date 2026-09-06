import { describe, expect, it } from 'vitest';
import type { ExpenseCategory, Receipt } from '../shopping/expenses.types';
import { normalizeReceiptProductName, suggestCategoryId } from '../shopping/receipt-ocr/category-suggestions';

const categories: ExpenseCategory[] = [
  ['food', 'Jedzenie'], ['drinks', 'Napoje'], ['home', 'Dom / Chemia'], ['hygiene', 'Higiena / Kosmetyki'], ['health', 'Zdrowie'], ['other', 'Inne'], ['pet', 'Zwierzęta'],
].map(([id, name], sortOrder) => ({ id: id!, name: name!, sortOrder, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }));

function receipt(id: string, date: string, items: Array<[string, string]>): Receipt {
  return {
    id, date, merchant: 'Test', totalMinor: items.length * 100,
    createdAt: `${date}T10:00:00.000Z`, updatedAt: `${date}T10:00:00.000Z`,
    items: items.map(([name, categoryId], index) => ({ id: `${id}-${index}`, name, categoryId, amountMinor: 100 })),
  };
}

describe('1.1.0-dev.3 local category suggestions', () => {
  it('normalizes only case and whitespace conservatively', () => {
    expect(normalizeReceiptProductName('  MLEKO   3,2% ')).toBe('mleko 3,2%');
    expect(normalizeReceiptProductName('MIEKO 3Z%')).not.toBe(normalizeReceiptProductName('MLEKO 3,2%'));
  });

  it('uses exact history match before built-in rules and preserves custom categories', () => {
    const history = [receipt('r1', '2026-08-10', [['MLEKO 3,2%', 'pet']])];
    expect(suggestCategoryId('  mleko  3,2% ', history, categories)).toBe('pet');
  });

  it('uses majority history category', () => {
    const history = [
      receipt('r1', '2026-08-01', [['Produkt X', 'food']]),
      receipt('r2', '2026-08-02', [['Produkt X', 'drinks']]),
      receipt('r3', '2026-08-03', [['Produkt X', 'food']]),
    ];
    expect(suggestCategoryId('Produkt X', history, categories)).toBe('food');
  });

  it('resolves a history tie by most recent use deterministically', () => {
    const history = [receipt('r1', '2026-08-01', [['Produkt X', 'food']]), receipt('r2', '2026-08-10', [['Produkt X', 'drinks']])];
    expect(suggestCategoryId('Produkt X', history, categories)).toBe('drinks');
  });

  it('falls back to small built-in rules and then Inne', () => {
    expect(suggestCategoryId('chleb żytni', [], categories)).toBe('food');
    expect(suggestCategoryId('woda gazowana', [], categories)).toBe('drinks');
    expect(suggestCategoryId('szampon', [], categories)).toBe('hygiene');
    expect(suggestCategoryId('ibuprofen', [], categories)).toBe('health');
    expect(suggestCategoryId('płyn do naczyń', [], categories)).toBe('home');
    expect(suggestCategoryId('nieznany przedmiot', [], categories)).toBe('other');
  });

  it('ignores a historical category that no longer exists', () => {
    const history = [receipt('r1', '2026-08-01', [['Produkt X', 'deleted-category']])];
    expect(suggestCategoryId('Produkt X', history, categories)).toBe('other');
  });
});
