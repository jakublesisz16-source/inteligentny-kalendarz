import { describe, expect, it } from 'vitest';
import type { ExpenseCategory, Receipt } from '../shopping/expenses.types';
import { suggestCategoryId } from '../shopping/receipt-ocr/category-suggestions';

const names = [
  ['food', 'Jedzenie'], ['drinks', 'Napoje'], ['home', 'Dom / Chemia'], ['hygiene', 'Higiena / Kosmetyki'],
  ['health', 'Zdrowie'], ['clothes', 'Ubrania'], ['deposit', 'Kaucja'], ['other', 'Inne'], ['custom', 'Moja'],
] as const;
const categories: ExpenseCategory[] = names.map(([id, name], sortOrder) => ({ id, name, sortOrder, createdAt: '', updatedAt: '' }));

function history(categoryId: string): Receipt[] {
  return [{ id: 'r1', merchant: 'Test', date: '2026-08-15', totalMinor: 100, createdAt: '', updatedAt: '2026-08-15T12:00:00Z', items: [{ id: 'i1', name: 'OBUWIE DAMSKIE', categoryId, amountMinor: 100 }] }];
}

describe('1.1.0-dev.3 DEV3-B018 category expansion', () => {
  it.each([
    ['OBUWIE DAMSKIE', 'clothes'], ['buty sportowe', 'clothes'], ['sandały', 'clothes'], ['kurtka zimowa', 'clothes'],
    ['mleko świeże', 'food'], ['pesto zielone', 'food'], ['czekolada mleczna', 'food'],
    ['napój gazowany', 'drinks'], ['kawa mielona', 'drinks'],
    ['szampon', 'hygiene'], ['dezodorant', 'hygiene'],
    ['detergent do domu', 'home'], ['płyn do naczyń', 'home'],
    ['opatrunek', 'health'], ['termometr', 'health'],
    ['butelka kaucja', 'deposit'], ['nieznany przedmiot', 'other'],
  ])('suggests %s conservatively', (product, expected) => {
    expect(suggestCategoryId(product, [], categories)).toBe(expected);
  });

  it('keeps exact history ahead of the built-in footwear rule', () => {
    expect(suggestCategoryId('OBUWIE DAMSKIE', history('custom'), categories)).toBe('custom');
  });

  it('falls back to Inne for kaucja when no matching category exists', () => {
    const withoutDeposit = categories.filter((category) => category.id !== 'deposit');
    expect(suggestCategoryId('Butelka kaucja', [], withoutDeposit)).toBe('other');
  });
});
